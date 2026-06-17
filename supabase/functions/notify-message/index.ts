// Supabase Edge Function: sendet Web-Push an die anderen Raum-Mitglieder.
//
// Deploy:
//   supabase functions deploy notify-message --no-verify-jwt
//
// Benoetigte Secrets (Supabase -> Edge Functions -> Manage secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT  (z. B. mailto:du@example.com)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY sind automatisch gesetzt.
//
// VAPID-Keys erzeugen:  npx web-push generate-vapid-keys --json

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "no auth" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Aufrufer aus dem JWT bestimmen (eigene Authentifizierung).
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { room_id, content } = await req.json();
    if (!room_id) return json({ error: "room_id required" }, 400);

    const admin = createClient(url, service);

    const { data: members } = await admin
      .from("room_members").select("user_id").eq("room_id", room_id);
    if (!members?.some((m) => m.user_id === user.id)) return json({ error: "forbidden" }, 403);

    const recipientIds = members.filter((m) => m.user_id !== user.id).map((m) => m.user_id);
    if (recipientIds.length === 0) return json({ ok: true, sent: 0 });

    const { data: prof } = await admin
      .from("profiles").select("username, full_name").eq("id", user.id).single();
    const senderName = prof?.full_name || prof?.username || "Neue Nachricht";

    const { data: room } = await admin
      .from("rooms").select("name, is_group").eq("id", room_id).single();
    const title = room?.is_group && room?.name ? `${senderName} · ${room.name}` : senderName;

    const { data: subs } = await admin
      .from("push_subscriptions").select("*").in("user_id", recipientIds);
    if (!subs || subs.length === 0) return json({ ok: true, sent: 0 });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const payload = JSON.stringify({
      title,
      body: (content && String(content).slice(0, 120)) || "📷 Bild",
      url: `/chat/${room_id}`,
    });

    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }));

    return json({ ok: true, sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
