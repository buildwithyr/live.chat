# live.chat 💬

Eine moderne, private Echtzeit-Chat-App – schlicht im Apple/Notion/Linear-Stil.
Gebaut mit **Next.js 16**, **TypeScript**, **Supabase** (Auth + Realtime + Postgres),
**Tailwind CSS** und PWA-Unterstützung. **Keine KI**, keine externen API-Keys.

---

## ✨ Funktionen

- 🔐 Registrierung & Login (Supabase Auth, E-Mail + Passwort)
- 👤 Benutzerprofile (Anzeigename, Benutzername, Avatar-URL)
- 💬 1:1-Chats & Gruppenchats
- ⚡ Nachrichten live empfangen (Supabase Realtime)
- ✍️ **Tippanzeige** („… schreibt") in Echtzeit
- ✓✓ **Lesebestätigungen** (1:1 „Gelesen", Gruppen „Gelesen · N/M")
- 🖼️ **Bild-Uploads** via Supabase Storage
- 🕒 Chronologischer Verlauf mit Zeitstempeln & Tages-Trennern
- ↔️ Eigene Nachrichten rechts, fremde links
- 🌓 Dark Mode (System + manueller Umschalter, ohne Flackern)
- 📱 Responsives Design (iPhone & Desktop) + installierbar als PWA
- 🔒 Sinnvolles Row Level Security – jeder sieht nur seine eigenen Chats
- 🚪 Logout
- ▲ Bereit für Deployment auf Vercel

---

## 🧱 Tech-Stack & Projektstruktur

```
src/
  app/
    layout.tsx              # Root-Layout, Theme-Init, PWA-Meta
    page.tsx                # Weiterleitung -> /chat oder /login
    login/page.tsx          # Auth-Seite (Server-Wrapper)
    auth/callback/route.ts  # E-Mail-Bestätigung -> Session
    chat/
      page.tsx              # Chat-Übersicht (Sidebar)
      [roomId]/page.tsx     # Einzelner Chat (Realtime)
      settings/page.tsx     # Profil bearbeiten
  components/               # UI-Komponenten (Sidebar, ChatRoom, …)
  lib/
    supabase/{client,server,middleware}.ts  # Supabase-Clients
    data.ts                 # Serverseitige Datenabfragen
    types.ts, utils.ts
  proxy.ts                  # Session-Refresh & Routenschutz
supabase/schema.sql         # Komplettes DB-Schema inkl. RLS
public/                     # manifest.json, sw.js, icon.svg
```

---

## 🗄️ Benötigte Supabase-Tabellen

Alle vier Tabellen werden vom Skript `supabase/schema.sql` erstellt:

| Tabelle | Zweck | Wichtige Spalten |
|---|---|---|
| `profiles` | Benutzerprofil (1:1 mit `auth.users`) | `id`, `username` (unique), `full_name`, `avatar_url` |
| `rooms` | Chats/Räume (1:1 **oder** Gruppe) | `id`, `name`, `is_group`, `created_by` |
| `room_members` | Wer ist in welchem Raum | `room_id`, `user_id` (PK kombiniert) |
| `messages` | Nachrichten (Text und/oder Bild) | `id`, `room_id`, `sender_id`, `content`, `image_url`, `created_at` |

Zusätzlich: Spalte `room_members.last_read_at` (Lesebestätigungen) und der **Storage-Bucket `chat-images`** (Bild-Uploads). Tippanzeigen laufen rein über Realtime-Broadcast – **ohne** DB-Tabelle.

> **Hinweis zu Bildern:** Der Bucket `chat-images` ist öffentlich lesbar (Bilder werden per `<img src>` angezeigt), aber Uploads sind nur angemeldeten Usern und nur im eigenen Ordner (`<user-id>/…`) erlaubt. Dateinamen sind zufällige UUIDs. Für maximale Privatsphäre könntest du den Bucket auf *privat* stellen und mit signierten URLs arbeiten.

**Automatik im Skript:**
- Trigger `on_auth_user_created` → legt bei jeder Registrierung automatisch ein `profiles`-Zeile an.
- Funktion `start_direct_chat(_other)` → findet/erstellt 1:1-Chats ohne Duplikate.
- `is_room_member(...)` → `SECURITY DEFINER`-Helfer, der **RLS-Rekursion vermeidet** (häufiger Bug in anderen Templates).
- Realtime ist für `messages` aktiviert.

**Row Level Security (Kurzfassung):**
- `profiles`: jeder Angemeldete kann lesen (für Suche/Anzeige), aber nur das **eigene** Profil ändern.
- `rooms` / `messages`: nur sichtbar/schreibbar für **Mitglieder** des Raums.
- `room_members`: man sieht nur Mitglieder eigener Räume; man kann sich selbst hinzufügen oder – als Ersteller – andere.

---

## 🔑 Environment Variables

Lege eine Datei `.env.local` im Projektroot an (Vorlage: `.env.local.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN-ANON-PUBLIC-KEY
```

> Beide Werte sind **öffentlich** (anon key) und stehen unter
> **Supabase → Project Settings → API**. Ein `service_role`-Key wird **nicht** benötigt
> und darf niemals ins Frontend.

---

## 🚀 Schritt-für-Schritt-Anleitung

### 1) Supabase einrichten
1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt erstellen.
2. Projekt-Region wählen, Datenbank-Passwort setzen, kurz warten bis bereit.

### 2) SQL ausführen
1. Im Supabase-Dashboard: **SQL Editor → New query**.
2. **Frische Datenbank:** Inhalt von [`supabase/schema.sql`](./supabase/schema.sql) komplett einfügen und **Run** klicken (enthält bereits alle Features inkl. Bilder & Lesebestätigungen).
3. **Bereits v1 eingespielt?** Dann stattdessen einmalig [`supabase/upgrade.sql`](./supabase/upgrade.sql) ausführen – fügt nur die neuen Sachen idempotent hinzu.
3. (Empfohlen für eine private App) Unter **Authentication → Sign In / Providers → Email**
   die Option **„Confirm email"** ausschalten, damit man sich ohne Bestätigungs-Mail
   sofort einloggen kann. Lässt du sie an, kommt die Bestätigung per E-Mail und der
   Link führt über `/auth/callback` zurück in die App.

### 3) `.env.local` erstellen
```bash
cp .env.local.example .env.local
# danach URL und ANON KEY aus Supabase → Project Settings → API eintragen
```

### 4) Lokal starten
```bash
npm install
npm run dev
```
App läuft auf **http://localhost:3000**.
Registriere zwei Benutzer (z. B. in zwei Browser-Fenstern), starte einen Chat und
beobachte, wie Nachrichten **live** erscheinen.

### 5) Auf Vercel deployen
1. Projekt zu GitHub pushen (ist bereits geschehen, falls du diese Anleitung dort liest).
2. Auf [vercel.com](https://vercel.com) **New Project → Repository importieren**.
3. Unter **Environment Variables** beide Werte eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy** klicken. Fertig. 🎉
5. Nach dem ersten Deploy in Supabase unter **Authentication → URL Configuration**
   die Vercel-Domain als **Site URL** / **Redirect URL** hinterlegen
   (z. B. `https://deine-app.vercel.app/**`), damit E-Mail-Logins korrekt zurückleiten.

---

## 🧪 Lokaler Build-Test
```bash
npm run build
```

## 📦 Skripte
| Befehl | Wirkung |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build |
| `npm run start` | Produktionsserver (nach Build) |

---

Viel Spaß beim Chatten! Erweiterbar z. B. um Tippanzeige, Lesebestätigungen,
Bild-Uploads (Supabase Storage) oder Push-Benachrichtigungen.
