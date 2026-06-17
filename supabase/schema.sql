-- =============================================================
-- live.chat – Supabase Schema
-- =============================================================
-- Im Supabase Dashboard ausfuehren:  SQL Editor -> New query -> einfuegen -> Run
-- Das Skript ist idempotent (kann mehrfach ausgefuehrt werden).
-- =============================================================

-- ----------------------------------------------------------------
-- 1) TABELLEN
-- ----------------------------------------------------------------

-- Benutzerprofile (1:1 mit auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz not null default now()
);

-- Chats / Raeume (1:1 = is_group false, Gruppe = is_group true)
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  is_group    boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Mitgliedschaften (welcher User ist in welchem Raum)
create table if not exists public.room_members (
  room_id      uuid not null references public.rooms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz, -- fuer Lesebestaetigungen
  primary key (room_id, user_id)
);

-- Nachrichten (Text und/oder Bild)
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  content    text,
  image_url  text,
  created_at timestamptz not null default now(),
  constraint messages_content_or_image check (
    (content is not null and char_length(content) between 1 and 4000)
    or image_url is not null
  )
);

create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at);
create index if not exists room_members_user_idx
  on public.room_members (user_id);

-- ----------------------------------------------------------------
-- 2) HILFSFUNKTIONEN (SECURITY DEFINER, um RLS-Rekursion zu vermeiden)
-- ----------------------------------------------------------------

-- Prueft Mitgliedschaft, ohne RLS auf room_members erneut auszuloesen.
create or replace function public.is_room_member(_room_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = _room_id and user_id = _user_id
  );
$$;

-- Legt automatisch ein Profil an, sobald sich ein User registriert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    ),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Startet einen 1:1-Chat (oder gibt den bestehenden zurueck).
create or replace function public.start_direct_chat(_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me   uuid := auth.uid();
  _room uuid;
begin
  if _me is null then raise exception 'not authenticated'; end if;
  if _other = _me then raise exception 'cannot chat with yourself'; end if;

  -- Bestehenden 1:1-Raum mit genau diesen zwei Mitgliedern finden
  select r.id into _room
  from public.rooms r
  where r.is_group = false
    and exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = _me)
    and exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = _other)
    and (select count(*) from public.room_members m where m.room_id = r.id) = 2
  limit 1;

  if _room is not null then
    return _room;
  end if;

  insert into public.rooms (is_group, created_by) values (false, _me)
  returning id into _room;

  insert into public.room_members (room_id, user_id)
  values (_room, _me), (_room, _other);

  return _room;
end;
$$;

-- ----------------------------------------------------------------
-- 3) ROW LEVEL SECURITY
-- ----------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.messages     enable row level security;

-- ---- profiles -------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (true); -- alle angemeldeten User koennen Profile lesen (fuer Suche & Anzeige)

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid()); -- Fallback; normal uebernimmt das der Trigger

-- ---- rooms ----------------------------------------------------
drop policy if exists "rooms_select_member" on public.rooms;
create policy "rooms_select_member" on public.rooms
  for select to authenticated
  using (public.is_room_member(id, auth.uid()) or created_by = auth.uid());

drop policy if exists "rooms_insert_own" on public.rooms;
create policy "rooms_insert_own" on public.rooms
  for insert to authenticated
  with check (created_by = auth.uid());

-- ---- room_members ---------------------------------------------
drop policy if exists "members_select" on public.room_members;
create policy "members_select" on public.room_members
  for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));

drop policy if exists "members_insert" on public.room_members;
create policy "members_insert" on public.room_members
  for insert to authenticated
  with check (
    user_id = auth.uid() -- sich selbst hinzufuegen
    or exists (          -- oder als Ersteller andere hinzufuegen
      select 1 from public.rooms r
      where r.id = room_id and r.created_by = auth.uid()
    )
  );

drop policy if exists "members_delete_self" on public.room_members;
create policy "members_delete_self" on public.room_members
  for delete to authenticated
  using (user_id = auth.uid()); -- Raum verlassen

drop policy if exists "members_update_self" on public.room_members;
create policy "members_update_self" on public.room_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()); -- eigenen last_read_at setzen

-- ---- messages -------------------------------------------------
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages
  for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_room_member(room_id, auth.uid())
  );

-- ----------------------------------------------------------------
-- 4) LESEBESTAETIGUNGEN: Raum als gelesen markieren
-- ----------------------------------------------------------------
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

-- ----------------------------------------------------------------
-- 5) REALTIME aktivieren (Live-Nachrichten + Lesebestaetigungen)
-- ----------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------
-- 6) STORAGE: Bucket fuer Bild-Uploads
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

-- Oeffentlich lesbar (Bilder werden per <img src> angezeigt).
drop policy if exists "chat_images_read" on storage.objects;
create policy "chat_images_read" on storage.objects
  for select to public
  using (bucket_id = 'chat-images');

-- Hochladen nur angemeldet und nur in den eigenen Ordner (user-id als 1. Pfadteil).
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

-- ----------------------------------------------------------------
-- 7) WEB PUSH: gespeicherte Browser-Subscriptions
-- ----------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Fertig. Tabellen: profiles, rooms, room_members, messages, push_subscriptions.
-- Bucket: chat-images. Edge Function: notify-message (siehe supabase/functions).
