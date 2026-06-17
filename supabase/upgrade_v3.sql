-- =============================================================
-- live.chat – Upgrade v3: Gruppen-Rollen, Gruppen-Profile,
--            Umfragen, Einladungslinks, erweiterte Profile
-- =============================================================
-- Idempotent. In Supabase: SQL Editor -> einfuegen -> Run.
-- =============================================================

-- -------------------------------------------------------------
-- 1) PROFILE erweitern
-- -------------------------------------------------------------
alter table public.profiles add column if not exists bio          text;
alter table public.profiles add column if not exists status       text;
alter table public.profiles add column if not exists banner_url   text;
alter table public.profiles add column if not exists birthday     date;
alter table public.profiles add column if not exists show_birthday boolean not null default false;

alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len
  check (bio is null or char_length(bio) <= 250);

-- -------------------------------------------------------------
-- 2) GRUPPEN (rooms) erweitern
-- -------------------------------------------------------------
alter table public.rooms add column if not exists description   text;
alter table public.rooms add column if not exists category      text;
alter table public.rooms add column if not exists avatar_url    text;
alter table public.rooms add column if not exists banner_url    text;
alter table public.rooms add column if not exists invite_code   text;
alter table public.rooms add column if not exists invite_active boolean not null default false;

alter table public.rooms drop constraint if exists rooms_invite_code_key;
create unique index if not exists rooms_invite_code_key on public.rooms (invite_code);

-- -------------------------------------------------------------
-- 3) ROLLEN & MUTE (room_members)
-- -------------------------------------------------------------
alter table public.room_members add column if not exists role  text not null default 'member';
alter table public.room_members add column if not exists muted boolean not null default false;

alter table public.room_members drop constraint if exists room_members_role_chk;
alter table public.room_members add constraint room_members_role_chk
  check (role in ('owner','admin','moderator','member'));

-- Bestehende Gruppen-Ersteller zu Owner machen
update public.room_members rm
set role = 'owner'
from public.rooms r
where r.id = rm.room_id and r.is_group = true and r.created_by = rm.user_id
  and rm.role <> 'owner';

-- -------------------------------------------------------------
-- 4) UMFRAGEN
-- -------------------------------------------------------------
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  question   text not null check (char_length(question) between 1 and 300),
  multiple   boolean not null default false,
  closed     boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.polls (id) on delete cascade,
  text     text not null check (char_length(text) between 1 and 200),
  position int not null default 0
);

create table if not exists public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);

create index if not exists polls_room_idx on public.polls (room_id, created_at desc);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id);
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

-- -------------------------------------------------------------
-- 5) MELDUNGEN (Reports)
-- -------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  target_id   uuid references public.profiles (id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 6) HILFSFUNKTIONEN (SECURITY DEFINER -> keine RLS-Rekursion)
-- -------------------------------------------------------------
create or replace function public.room_role(_room_id uuid, _user_id uuid)
returns text language sql security definer set search_path = public stable as $$
  select role from public.room_members where room_id = _room_id and user_id = _user_id;
$$;

create or replace function public.is_muted(_room_id uuid, _user_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select muted from public.room_members where room_id = _room_id and user_id = _user_id), false);
$$;

create or replace function public.poll_is_visible(_poll_id uuid, _user_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.polls p
    join public.room_members m on m.room_id = p.room_id
    where p.id = _poll_id and m.user_id = _user_id
  );
$$;

-- -------------------------------------------------------------
-- 7) RPCs: Gruppen-/Rollen-/Einladungs-Verwaltung
-- -------------------------------------------------------------
create or replace function public.create_group(_name text, _members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare _room uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.rooms (name, is_group, created_by)
  values (coalesce(nullif(_name, ''), 'Neue Gruppe'), true, auth.uid())
  returning id into _room;
  insert into public.room_members (room_id, user_id, role) values (_room, auth.uid(), 'owner');
  if _members is not null then
    foreach m in array _members loop
      if m <> auth.uid() then
        insert into public.room_members (room_id, user_id, role)
        values (_room, m, 'member') on conflict do nothing;
      end if;
    end loop;
  end if;
  return _room;
end; $$;

create or replace function public.add_member(_room_id uuid, _target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.room_role(_room_id, auth.uid()) not in ('owner','admin') then
    raise exception 'insufficient permissions'; end if;
  insert into public.room_members (room_id, user_id, role)
  values (_room_id, _target, 'member') on conflict do nothing;
end; $$;

create or replace function public.remove_member(_room_id uuid, _target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _trole text;
begin
  if _target = auth.uid() then
    if public.room_role(_room_id, auth.uid()) = 'owner' then
      raise exception 'owner must transfer ownership first'; end if;
    delete from public.room_members where room_id = _room_id and user_id = _target;
    return;
  end if;
  if public.room_role(_room_id, auth.uid()) not in ('owner','admin') then
    raise exception 'insufficient permissions'; end if;
  _trole := public.room_role(_room_id, _target);
  if _trole = 'owner' then raise exception 'cannot remove owner'; end if;
  if _trole = 'admin' and public.room_role(_room_id, auth.uid()) <> 'owner' then
    raise exception 'only owner can remove admins'; end if;
  delete from public.room_members where room_id = _room_id and user_id = _target;
end; $$;

create or replace function public.set_member_role(_room_id uuid, _target uuid, _role text)
returns void language plpgsql security definer set search_path = public as $$
declare _caller text; _trole text;
begin
  _caller := public.room_role(_room_id, auth.uid());
  _trole  := public.room_role(_room_id, _target);
  if _caller is null then raise exception 'not a member'; end if;
  if _trole is null then raise exception 'target not a member'; end if;
  if _role not in ('admin','moderator','member') then raise exception 'invalid role'; end if;
  if _trole = 'owner' then raise exception 'cannot change owner role'; end if;
  if _caller = 'owner' then
    update public.room_members set role = _role where room_id = _room_id and user_id = _target;
  elsif _caller = 'admin' then
    if _trole = 'admin' or _role = 'admin' then
      raise exception 'only owner can manage admins'; end if;
    update public.room_members set role = _role where room_id = _room_id and user_id = _target;
  else
    raise exception 'insufficient permissions';
  end if;
end; $$;

create or replace function public.set_member_muted(_room_id uuid, _target uuid, _muted boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _trole text;
begin
  if public.room_role(_room_id, auth.uid()) not in ('owner','admin','moderator') then
    raise exception 'insufficient permissions'; end if;
  _trole := public.room_role(_room_id, _target);
  if _trole in ('owner','admin') then raise exception 'cannot mute admins or owner'; end if;
  update public.room_members set muted = _muted where room_id = _room_id and user_id = _target;
end; $$;

create or replace function public.transfer_owner(_room_id uuid, _new uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.room_role(_room_id, auth.uid()) <> 'owner' then raise exception 'only owner'; end if;
  if public.room_role(_room_id, _new) is null then raise exception 'target not a member'; end if;
  update public.room_members set role = 'admin' where room_id = _room_id and user_id = auth.uid();
  update public.room_members set role = 'owner' where room_id = _room_id and user_id = _new;
end; $$;

create or replace function public.delete_group(_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.room_role(_room_id, auth.uid()) <> 'owner' then raise exception 'only owner'; end if;
  delete from public.rooms where id = _room_id;
end; $$;

create or replace function public.generate_invite_code(_room_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _code text;
begin
  if public.room_role(_room_id, auth.uid()) not in ('owner','admin') then
    raise exception 'insufficient permissions'; end if;
  _code := replace(replace(replace(encode(gen_random_bytes(9), 'base64'), '/', '_'), '+', '-'), '=', '');
  update public.rooms set invite_code = _code, invite_active = true where id = _room_id;
  return _code;
end; $$;

create or replace function public.set_invite_active(_room_id uuid, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.room_role(_room_id, auth.uid()) not in ('owner','admin') then
    raise exception 'insufficient permissions'; end if;
  update public.rooms set invite_active = _active where id = _room_id;
end; $$;

create or replace function public.join_via_invite(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _room uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into _room from public.rooms
  where invite_code = _code and invite_active = true and is_group = true;
  if _room is null then raise exception 'invalid or inactive invite'; end if;
  if not public.is_room_member(_room, auth.uid()) then
    insert into public.room_members (room_id, user_id, role) values (_room, auth.uid(), 'member');
  end if;
  return _room;
end; $$;

create or replace function public.report_member(_room_id uuid, _target uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_member(_room_id, auth.uid()) then raise exception 'not a member'; end if;
  insert into public.reports (room_id, reporter_id, target_id, reason)
  values (_room_id, auth.uid(), _target, _reason);
end; $$;

-- -------------------------------------------------------------
-- 8) RPCs: Umfragen
-- -------------------------------------------------------------
create or replace function public.create_poll(_room_id uuid, _question text, _multiple boolean, _options text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare _poll uuid; _i int;
begin
  if not public.is_room_member(_room_id, auth.uid()) then raise exception 'not a member'; end if;
  if coalesce(array_length(_options, 1), 0) < 2 then raise exception 'need at least 2 options'; end if;
  insert into public.polls (room_id, question, multiple, created_by)
  values (_room_id, _question, coalesce(_multiple, false), auth.uid()) returning id into _poll;
  for _i in 1 .. array_length(_options, 1) loop
    if nullif(trim(_options[_i]), '') is not null then
      insert into public.poll_options (poll_id, text, position) values (_poll, _options[_i], _i);
    end if;
  end loop;
  return _poll;
end; $$;

create or replace function public.cast_vote(_poll_id uuid, _option_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare _room uuid; _multiple boolean; _closed boolean;
begin
  select room_id, multiple, closed into _room, _multiple, _closed from public.polls where id = _poll_id;
  if _room is null then raise exception 'poll not found'; end if;
  if not public.is_room_member(_room, auth.uid()) then raise exception 'not a member'; end if;
  if _closed then raise exception 'poll closed'; end if;
  if not _multiple and coalesce(array_length(_option_ids, 1), 0) > 1 then
    raise exception 'only one vote allowed'; end if;
  if exists (
    select 1 from unnest(_option_ids) oid
    where oid not in (select id from public.poll_options where poll_id = _poll_id)
  ) then raise exception 'invalid option'; end if;
  delete from public.poll_votes where poll_id = _poll_id and user_id = auth.uid();
  if coalesce(array_length(_option_ids, 1), 0) > 0 then
    insert into public.poll_votes (poll_id, option_id, user_id)
    select _poll_id, oid, auth.uid() from unnest(_option_ids) oid;
  end if;
end; $$;

create or replace function public.close_poll(_poll_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _room uuid; _creator uuid;
begin
  select room_id, created_by into _room, _creator from public.polls where id = _poll_id;
  if _room is null then raise exception 'not found'; end if;
  if auth.uid() <> _creator and public.room_role(_room, auth.uid()) not in ('owner','admin','moderator') then
    raise exception 'insufficient permissions'; end if;
  update public.polls set closed = true where id = _poll_id;
end; $$;

-- -------------------------------------------------------------
-- 9) ROW LEVEL SECURITY
-- -------------------------------------------------------------
alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;
alter table public.reports      enable row level security;

-- rooms: Admins/Owner duerfen aendern, Owner darf loeschen
drop policy if exists "rooms_update_admin" on public.rooms;
create policy "rooms_update_admin" on public.rooms
  for update to authenticated
  using (public.room_role(id, auth.uid()) in ('owner','admin'))
  with check (public.room_role(id, auth.uid()) in ('owner','admin'));

drop policy if exists "rooms_delete_owner" on public.rooms;
create policy "rooms_delete_owner" on public.rooms
  for delete to authenticated
  using (public.room_role(id, auth.uid()) = 'owner');

-- room_members: Self-Update-Policy entfernen (Rollenwechsel nur via RPC)
drop policy if exists "members_update_self" on public.room_members;

-- messages: Stummgeschaltete duerfen nicht senden
drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_room_member(room_id, auth.uid())
    and not public.is_muted(room_id, auth.uid())
  );

-- messages: loeschen durch Absender oder Moderation
drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages
  for delete to authenticated
  using (
    sender_id = auth.uid()
    or public.room_role(room_id, auth.uid()) in ('owner','admin','moderator')
  );

-- polls
drop policy if exists "polls_select" on public.polls;
create policy "polls_select" on public.polls
  for select to authenticated using (public.is_room_member(room_id, auth.uid()));

drop policy if exists "poll_options_select" on public.poll_options;
create policy "poll_options_select" on public.poll_options
  for select to authenticated using (public.poll_is_visible(poll_id, auth.uid()));

drop policy if exists "poll_votes_select" on public.poll_votes;
create policy "poll_votes_select" on public.poll_votes
  for select to authenticated using (public.poll_is_visible(poll_id, auth.uid()));

-- reports: nur Moderation darf lesen, Mitglieder duerfen (via RPC) erstellen
drop policy if exists "reports_select_mod" on public.reports;
create policy "reports_select_mod" on public.reports
  for select to authenticated
  using (public.room_role(room_id, auth.uid()) in ('owner','admin','moderator'));

-- -------------------------------------------------------------
-- 10) REALTIME (Umfragen live)
-- -------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.polls;        exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.poll_options; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.poll_votes;   exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rooms;        exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- 11) STORAGE: Buckets fuer Gruppen- & Profilbilder
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('group-images',   'group-images',   true),
  ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

-- group-images: oeffentlich lesbar; schreiben nur Admin/Owner des Raums (Pfad: <room_id>/...)
drop policy if exists "group_images_read" on storage.objects;
create policy "group_images_read" on storage.objects
  for select to public using (bucket_id = 'group-images');

drop policy if exists "group_images_write" on storage.objects;
create policy "group_images_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'group-images'
    and public.room_role(((storage.foldername(name))[1])::uuid, auth.uid()) in ('owner','admin')
  );

drop policy if exists "group_images_update" on storage.objects;
create policy "group_images_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'group-images'
    and public.room_role(((storage.foldername(name))[1])::uuid, auth.uid()) in ('owner','admin')
  );

drop policy if exists "group_images_delete" on storage.objects;
create policy "group_images_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'group-images'
    and public.room_role(((storage.foldername(name))[1])::uuid, auth.uid()) in ('owner','admin')
  );

-- profile-images: oeffentlich lesbar; schreiben nur in eigenen Ordner (Pfad: <user_id>/...)
drop policy if exists "profile_images_read" on storage.objects;
create policy "profile_images_read" on storage.objects
  for select to public using (bucket_id = 'profile-images');

drop policy if exists "profile_images_write" on storage.objects;
create policy "profile_images_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_images_update" on storage.objects;
create policy "profile_images_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_images_delete" on storage.objects;
create policy "profile_images_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Fertig.
