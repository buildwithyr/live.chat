-- =============================================================
-- live.chat – Upgrade v1 -> v2
-- =============================================================
-- NUR ausfuehren, wenn du schema.sql (v1) BEREITS eingespielt hast.
-- Bei einer frischen Datenbank reicht das aktuelle schema.sql allein.
-- Idempotent: kann gefahrlos mehrfach ausgefuehrt werden.
-- =============================================================

-- 1) Lesebestaetigungen: Spalte fuer "zuletzt gelesen"
alter table public.room_members
  add column if not exists last_read_at timestamptz;

-- 2) Bild-Nachrichten: Spalte + gelockerter Content-Constraint
alter table public.messages
  add column if not exists image_url text;

alter table public.messages
  alter column content drop not null;

alter table public.messages
  drop constraint if exists messages_content_check;        -- alter unbenannter Check aus v1
alter table public.messages
  drop constraint if exists messages_content_or_image;
alter table public.messages
  add constraint messages_content_or_image check (
    (content is not null and char_length(content) between 1 and 4000)
    or image_url is not null
  );

-- 3) RLS: User darf eigene Mitgliedschaft updaten (last_read_at)
drop policy if exists "members_update_self" on public.room_members;
create policy "members_update_self" on public.room_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4) Funktion: Raum als gelesen markieren
create or replace function public.mark_room_read(_room_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.room_members
  set last_read_at = now()
  where room_id = _room_id and user_id = auth.uid();
$$;

-- 5) Realtime fuer room_members aktivieren
do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end $$;

-- 6) Storage-Bucket + Policies fuer Bild-Uploads
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "chat_images_read" on storage.objects;
create policy "chat_images_read" on storage.objects
  for select to public
  using (bucket_id = 'chat-images');

drop policy if exists "chat_images_insert" on storage.objects;
create policy "chat_images_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat_images_delete_own" on storage.objects;
create policy "chat_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Fertig.
