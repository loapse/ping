-- ============================================================
-- ChatterBox schema — paste into Supabase Dashboard → SQL Editor → Run
-- Creates tables + Row Level Security so the static frontend is safe.
-- After running, grant yourself admin (see README step 4):
--   update profiles set role = 'admin' where username = 'YOURNAME';
-- ============================================================

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  role text not null default 'member',
  is_muted boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);
alter table profiles enable row level security;

drop policy if exists "profiles readable by everyone" on profiles;
create policy "profiles readable by everyone" on profiles
  for select using (true);

drop policy if exists "users insert own profile" on profiles;
create policy "users insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- Users may only touch their own display fields (never role/flags).
-- Column-level grants enforce this even though the policy is row-wide.
revoke all on profiles from anon, authenticated;
grant select on profiles to anon, authenticated;
grant insert on profiles to authenticated;
grant update (username, last_active) on profiles to authenticated;
drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on profiles
  for update using (auth.uid() = id);

-- Admins can moderate anyone (mute/ban/role).
drop policy if exists "admins update any profile" on profiles;
create policy "admins update any profile" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------- login IPs (admin eyes only) ----------
create table if not exists user_ips (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  ip text not null,
  user_agent text,
  seen_at timestamptz not null default now()
);
alter table user_ips enable row level security;

drop policy if exists "users log own ip" on user_ips;
create policy "users log own ip" on user_ips
  for insert with check (auth.uid() = user_id);

drop policy if exists "admins read ips" on user_ips;
create policy "admins read ips" on user_ips
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------- servers ----------
create table if not exists servers (
  id bigint generated always as identity primary key,
  name text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
alter table servers enable row level security;

drop policy if exists "servers readable" on servers;
create policy "servers readable" on servers for select using (true);

drop policy if exists "members create servers" on servers;
create policy "members create servers" on servers
  for insert with check (auth.role() = 'authenticated');

-- ---------- channels ----------
create table if not exists channels (
  id bigint generated always as identity primary key,
  server_id bigint not null references servers (id) on delete cascade,
  name text not null,
  topic text not null default ''
);
alter table channels enable row level security;

drop policy if exists "channels readable" on channels;
create policy "channels readable" on channels for select using (true);

drop policy if exists "members create channels" on channels;
create policy "members create channels" on channels
  for insert with check (auth.role() = 'authenticated');

-- ---------- messages ----------
create table if not exists messages (
  id bigint generated always as identity primary key,
  channel_id bigint not null references channels (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table messages enable row level security;

drop policy if exists "messages readable" on messages;
create policy "messages readable" on messages for select using (true);

-- Muted users are rejected at the database level, not just the UI.
drop policy if exists "unmuted members send" on messages;
create policy "unmuted members send" on messages
  for insert with check (
    auth.uid() = user_id
    and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_muted)
  );

-- ---------- activity log ----------
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  user_id uuid references profiles (id) on delete set null,
  username text not null,
  action text not null,          -- signup | login | logout | message | server_create | mod_mute | mod_unmute | mod_ban | mod_unban
  detail text not null default '',
  ip text not null default '',
  created_at timestamptz not null default now()
);
alter table activity_log enable row level security;

drop policy if exists "users log own activity" on activity_log;
create policy "users log own activity" on activity_log
  for insert with check (auth.uid() = user_id);

drop policy if exists "admins read activity" on activity_log;
create policy "admins read activity" on activity_log
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Realtime for chat
alter publication supabase_realtime add table messages;

-- ---------- v2 upgrade (safe to run if you already ran v1) ----------
-- Users can delete their own messages; admins can delete any message.
drop policy if exists "users delete own messages" on messages;
create policy "users delete own messages" on messages
  for delete using (auth.uid() = user_id);

drop policy if exists "admins delete messages" on messages;
create policy "admins delete messages" on messages
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------- v3 upgrade (DMs, avatars, server/channel management) ----------
alter table profiles add column if not exists avatar_emoji text;
grant update (username, last_active, avatar_emoji) on profiles to authenticated;

alter table servers add column if not exists icon_color text not null default '#5865F2';

-- Servers: creators and admins can rename/recolor/delete.
drop policy if exists "creators and admins manage servers" on servers;
create policy "creators and admins manage servers" on servers
  for update using (
    auth.uid() = created_by
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "creators and admins delete servers" on servers;
create policy "creators and admins delete servers" on servers
  for delete using (
    auth.uid() = created_by
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Channels: admins and the server creator can rename/topic/delete.
drop policy if exists "managers manage channels" on channels;
create policy "managers manage channels" on channels
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from servers s where s.id = server_id and s.created_by = auth.uid())
  );
drop policy if exists "managers delete channels" on channels;
create policy "managers delete channels" on channels
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from servers s where s.id = server_id and s.created_by = auth.uid())
  );

-- ---------- direct messages (private: never shown on admin dashboard) ----------
create table if not exists dms (
  id bigint generated always as identity primary key,
  sender_id uuid not null references profiles (id) on delete cascade,
  receiver_id uuid not null references profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table dms enable row level security;

drop policy if exists "participants read dms" on dms;
create policy "participants read dms" on dms
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "users send dms" on dms;
create policy "users send dms" on dms
  for insert with check (auth.uid() = sender_id);

drop policy if exists "senders delete dms" on dms;
create policy "senders delete dms" on dms
  for delete using (auth.uid() = sender_id);

alter publication supabase_realtime add table dms;

-- ---------- v4 upgrade (reactions, mods, equipped look, voice, wallets) ----------
-- Users can read their OWN activity (needed for the coin wallet ledger).
drop policy if exists "users read own activity" on activity_log;
create policy "users read own activity" on activity_log
  for select using (auth.uid() = user_id);

-- Users can read coin grants addressed to them (wallet credit).
drop policy if exists "users read grants to self" on activity_log;
create policy "users read grants to self" on activity_log
  for select using (
    action = 'coin_grant'
    and detail like 'grant:' || (select username from profiles where id = auth.uid()) || ':%'
  );

-- Equipped look (avatar frame + name color), editable by owner only.
alter table profiles add column if not exists equipped jsonb not null default '{}';
grant update (username, last_active, avatar_emoji, equipped) on profiles to authenticated;

-- Channel kinds: 'text' or 'voice'.
alter table channels add column if not exists kind text not null default 'text';

-- Moderators: same powers as admins except role assignment, bans stay admin-only.
-- (Role is granted with: update profiles set role='mod' where username='X';)
grant update (is_muted) on profiles to authenticated;
drop policy if exists "mods mute anyone" on profiles;
create policy "mods mute anyone" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  );

drop policy if exists "admins read ips" on user_ips;
create policy "mods read ips" on user_ips
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  );

drop policy if exists "admins read activity" on activity_log;
create policy "mods read activity" on activity_log
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  );

drop policy if exists "admins delete messages" on messages;
create policy "mods delete messages" on messages
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  );

-- ---------- reactions ----------
create table if not exists message_reactions (
  message_id bigint not null references messages (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
alter table message_reactions enable row level security;

drop policy if exists "reactions readable" on message_reactions;
create policy "reactions readable" on message_reactions for select using (true);

drop policy if exists "members react" on message_reactions;
create policy "members react" on message_reactions
  for insert with check (
    auth.uid() = user_id
    and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_muted)
  );

drop policy if exists "members unreact" on message_reactions;
create policy "members unreact" on message_reactions
  for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table message_reactions;

-- ---------- v5 upgrade (pins, image uploads) ----------
alter table messages add column if not exists pinned boolean not null default false;
grant update (pinned) on messages to authenticated;
drop policy if exists "mods pin messages" on messages;
create policy "mods pin messages" on messages
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  );

-- Public image bucket for chat uploads (1 GB free; 5 MB per file enforced in app).
insert into storage.buckets (id, name, public)
  values ('chat-uploads', 'chat-uploads', true)
  on conflict (id) do nothing;
drop policy if exists "public read uploads" on storage.objects;
create policy "public read uploads" on storage.objects
  for select using (bucket_id = 'chat-uploads');
drop policy if exists "members upload images" on storage.objects;
create policy "members upload images" on storage.objects
  for insert with check (bucket_id = 'chat-uploads' and auth.role() = 'authenticated');
drop policy if exists "owners delete uploads" on storage.objects;
create policy "owners delete uploads" on storage.objects
  for delete using (bucket_id = 'chat-uploads' and auth.uid() = owner);

-- ---------- v6 upgrade (public home server, app authorization, game scores, item gifts) ----------
do $$
declare
  vq_id uuid;
  public_server_id bigint;
begin
  select id into vq_id from profiles where lower(username) = 'vq' order by created_at limit 1;
  if vq_id is not null then
    select id into public_server_id from servers
      where lower(name) in ('chatterbox hq', 'ping hq', 'ping public chat')
      order by case when lower(name) = 'ping public chat' then 0 else 1 end, id limit 1;
    if public_server_id is null then
      insert into servers (name, created_by) values ('Ping Public Chat', vq_id)
        returning id into public_server_id;
    else
      update servers set name = 'Ping Public Chat', created_by = vq_id where id = public_server_id;
    end if;
    insert into channels (server_id, name, topic)
      select public_server_id, 'general', 'Welcome to Ping Public Chat.'
      where not exists (select 1 from channels where server_id = public_server_id and name = 'general');
    insert into channels (server_id, name, topic)
      select public_server_id, 'rules', 'Be kind. Keep it friendly.'
      where not exists (select 1 from channels where server_id = public_server_id and name = 'rules');
  end if;
end $$;

-- Only first-party app IDs are accepted; no third-party OAuth tokens are stored here.
create table if not exists app_authorizations (
  user_id uuid not null references profiles (id) on delete cascade,
  app_id text not null check (app_id in ('ping-arcade')),
  granted_at timestamptz not null default now(),
  primary key (user_id, app_id)
);
alter table app_authorizations enable row level security;
grant select, insert, delete on app_authorizations to authenticated;
drop policy if exists "users read own app authorizations" on app_authorizations;
create policy "users read own app authorizations" on app_authorizations
  for select using (auth.uid() = user_id);
drop policy if exists "users authorize own apps" on app_authorizations;
create policy "users authorize own apps" on app_authorizations
  for insert with check (auth.uid() = user_id);
drop policy if exists "users revoke own apps" on app_authorizations;
create policy "users revoke own apps" on app_authorizations
  for delete using (auth.uid() = user_id);

create table if not exists game_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  game_id text not null check (game_id in ('tictactoe', 'quickdraw')),
  score integer not null,
  result text not null,
  created_at timestamptz not null default now()
);
alter table game_scores enable row level security;
grant select, insert on game_scores to authenticated;
grant usage, select on sequence game_scores_id_seq to authenticated;
create index if not exists game_scores_user_created_idx on game_scores (user_id, created_at desc);
drop policy if exists "users read own game scores" on game_scores;
create policy "users read own game scores" on game_scores
  for select using (auth.uid() = user_id);
drop policy if exists "authorized apps save own scores" on game_scores;
create policy "authorized apps save own scores" on game_scores
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from app_authorizations a
      where a.user_id = auth.uid() and a.app_id = 'ping-arcade'
    )
  );

drop policy if exists "users read item grants to self" on activity_log;
create policy "users read item grants to self" on activity_log
  for select using (
    action = 'item_grant'
    and detail like 'item:' || (select username from profiles where id = auth.uid()) || ':%'
  );

-- ---------- v7 upgrade (public profile cards) ----------
alter table profiles add column if not exists bio text not null default '';
alter table profiles add column if not exists custom_status text not null default '';
grant update (bio, custom_status) on profiles to authenticated;

-- ---------- v8 upgrade (message reports + moderator game overview) ----------
-- Keep client-generated wallet entries from letting members mint grants for themselves.
drop policy if exists "users log own activity" on activity_log;
create policy "users log own activity" on activity_log
  for insert with check (
    auth.uid() = user_id
    and (
      action not like 'mod_%'
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
    )
    and (
      action not in ('coin_grant', 'item_grant')
      or (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        and (
          (action = 'coin_grant' and detail ~ '^grant:[^:]+:\+[1-9][0-9]*$')
          or (action = 'item_grant' and detail ~ '^item:[^:]+:[a-z0-9-]+$')
        )
      )
    )
  );

create table if not exists message_reports (
  id bigint generated always as identity primary key,
  message_id bigint references messages (id) on delete set null,
  message_author_id uuid references profiles (id) on delete set null,
  channel_id bigint references channels (id) on delete set null,
  message_content text not null,
  reporter_id uuid not null references profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'threats', 'other')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_reports_message_reporter_unique unique (message_id, reporter_id)
);
alter table message_reports enable row level security;
grant select, insert on message_reports to authenticated;
grant update (status, reviewed_by, reviewed_at) on message_reports to authenticated;
grant usage, select on sequence message_reports_id_seq to authenticated;
create index if not exists message_reports_status_created_idx on message_reports (status, created_at desc);
drop policy if exists "mods read message reports" on message_reports;
create policy "mods read message reports" on message_reports
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  );
drop policy if exists "members report public messages" on message_reports;
create policy "members report public messages" on message_reports
  for insert with check (
    auth.uid() = reporter_id
    and status = 'open'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from messages m
      where m.id = message_reports.message_id
        and m.user_id = message_reports.message_author_id
        and m.user_id <> message_reports.reporter_id
        and m.channel_id = message_reports.channel_id
        and m.content = message_reports.message_content
    )
  );
drop policy if exists "mods review message reports" on message_reports;
create policy "mods review message reports" on message_reports
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  ) with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
    and reviewed_by = auth.uid()
    and reviewed_at is not null
    and status in ('resolved', 'dismissed')
  );

drop policy if exists "mods read game scores" on game_scores;
create policy "mods read game scores" on game_scores
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  );

-- ---------- v9 upgrade (Ping Arcade word scramble) ----------
do $$
begin
  alter table game_scores drop constraint if exists game_scores_game_id_check;
  alter table game_scores add constraint game_scores_game_id_check
    check (game_id in ('tictactoe', 'quickdraw', 'scramble'));
end $$;

-- ---------- v10 upgrade (admin-awarded profile badges) ----------
create table if not exists profile_badges (
  user_id uuid not null references profiles (id) on delete cascade,
  badge_id text not null check (badge_id in (
    'founder', 'early_supporter', 'event_winner', 'helper', 'builder',
    'artist', 'bug_hunter', 'veteran', 'vip', 'community_voice'
  )),
  granted_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table profile_badges enable row level security;
grant select, insert, delete on profile_badges to authenticated;
drop policy if exists "members read public profile badges" on profile_badges;
create policy "members read public profile badges" on profile_badges
  for select using (auth.role() = 'authenticated');
drop policy if exists "admins award profile badges" on profile_badges;
create policy "admins award profile badges" on profile_badges
  for insert with check (
    granted_by = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "admins remove profile badges" on profile_badges;
create policy "admins remove profile badges" on profile_badges
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------- v11 upgrade (secure message editing + pin RPC) ----------
-- Message edits are owner-only and muted users remain blocked. Pinning stays
-- moderator-only through a narrow RPC so the old broad update grant is removed.
alter table messages add column if not exists updated_at timestamptz;
revoke update on messages from anon, authenticated;
revoke update (content, pinned, updated_at) on messages from anon, authenticated;
grant update (content) on messages to authenticated;

drop policy if exists "mods pin messages" on messages;
drop policy if exists "users edit own messages" on messages;
create policy "users edit own messages" on messages
  for update using (
    auth.uid() = user_id
    and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_muted)
  ) with check (
    auth.uid() = user_id
    and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_muted)
  );

create or replace function public.touch_message_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.content is distinct from old.content then
    if char_length(btrim(new.content)) < 1 or char_length(new.content) > 500 then
      raise exception 'Messages must contain between 1 and 500 characters';
    end if;
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;
drop trigger if exists messages_touch_updated_at on messages;
create trigger messages_touch_updated_at
  before update on messages
  for each row execute function public.touch_message_updated_at();

create or replace function public.set_message_pin(p_message_id bigint, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'mod')
  ) then
    raise exception 'Only moderators can pin messages';
  end if;

  update public.messages set pinned = p_pinned where id = p_message_id;
  if not found then
    raise exception 'Message not found';
  end if;
end;
$$;
revoke all on function public.set_message_pin(bigint, boolean) from public, anon;
grant execute on function public.set_message_pin(bigint, boolean) to authenticated;

-- ---------- v12 upgrade (secure admin slash-command actions) ----------
-- Keep privileged profile changes behind database checks instead of relying
-- on the client role or broad profile column grants.
create or replace function public.admin_set_profile_flag(
  p_user_id uuid,
  p_field text,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
begin
  select p.role into actor_role from public.profiles p where p.id = auth.uid();
  if actor_role is null then
    raise exception 'Sign in is required';
  end if;
  if p_field is null or p_field not in ('is_muted', 'is_banned') or p_value is null then
    raise exception 'Invalid moderation action';
  end if;
  if p_field = 'is_muted' and actor_role not in ('admin', 'mod') then
    raise exception 'Only moderators can change mute status';
  end if;
  if p_field = 'is_banned' and actor_role <> 'admin' then
    raise exception 'Only admins can change ban status';
  end if;

  if p_field = 'is_muted' then
    update public.profiles set is_muted = p_value where id = p_user_id;
  else
    update public.profiles set is_banned = p_value where id = p_user_id;
  end if;
  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;
revoke all on function public.admin_set_profile_flag(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_profile_flag(uuid, text, boolean) to authenticated;

create or replace function public.admin_set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  target_role text;
begin
  select p.role into actor_role from public.profiles p where p.id = auth.uid();
  if actor_role is distinct from 'admin' then
    raise exception 'Only admins can change member roles';
  end if;
  if p_role is null or p_role not in ('member', 'mod') then
    raise exception 'Role must be member or mod';
  end if;

  select p.role into target_role from public.profiles p where p.id = p_user_id;
  if target_role is null then
    raise exception 'Member not found';
  end if;
  if target_role = 'admin' then
    raise exception 'Admin roles cannot be changed here';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;
revoke all on function public.admin_set_member_role(uuid, text) from public, anon;
grant execute on function public.admin_set_member_role(uuid, text) to authenticated;

-- ---------- v13 upgrade (server channel categories) ----------
alter table public.channels
  add column if not exists category text not null default '';

drop policy if exists "members create channels" on public.channels;
drop policy if exists "managers create channels" on public.channels;
create policy "managers create channels" on public.channels
  for insert with check (
    exists (
      select 1 from public.servers s
      where s.id = channels.server_id
        and (s.created_by = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- ---------- v14 upgrade (private saved public-channel messages) ----------
create table if not exists public.saved_messages (
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id bigint not null references public.messages (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
alter table public.saved_messages enable row level security;
revoke all on public.saved_messages from anon, authenticated;
grant select, insert, delete on public.saved_messages to authenticated;
create index if not exists saved_messages_owner_saved_at_idx
  on public.saved_messages (user_id, saved_at desc);

drop policy if exists "users read own saved messages" on public.saved_messages;
create policy "users read own saved messages" on public.saved_messages
  for select using (auth.uid() = user_id);
drop policy if exists "users save own messages" on public.saved_messages;
create policy "users save own messages" on public.saved_messages
  for insert with check (auth.uid() = user_id);
drop policy if exists "users remove own saved messages" on public.saved_messages;
create policy "users remove own saved messages" on public.saved_messages
  for delete using (auth.uid() = user_id);

-- ---------- v15 upgrade (server settings and permission roles) ----------
alter table public.servers add column if not exists description text not null default '';

create table if not exists public.server_roles (
  id bigint generated by default as identity primary key,
  server_id bigint not null references public.servers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  color text not null default '#99aab5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (server_id, name)
);
create table if not exists public.server_member_roles (
  server_id bigint not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id bigint not null references public.server_roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (server_id, user_id, role_id)
);
create index if not exists server_member_roles_user_idx on public.server_member_roles(user_id, server_id);
alter table public.server_roles enable row level security;
alter table public.server_member_roles enable row level security;
revoke all on public.server_roles, public.server_member_roles from anon, authenticated;
grant select, insert, update, delete on public.server_roles, public.server_member_roles to authenticated;
grant usage, select on sequence public.server_roles_id_seq to authenticated;

create or replace function public.has_server_permission(p_server_id bigint, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.servers s where s.id = p_server_id and s.created_by = auth.uid())
    or (p_permission <> 'owner_control' and exists (
      select 1 from public.server_member_roles smr
      join public.server_roles sr on sr.id = smr.role_id and sr.server_id = smr.server_id
      where smr.server_id = p_server_id and smr.user_id = auth.uid()
        and (coalesce(sr.permissions ->> 'administrator', 'false') = 'true'
          or coalesce(sr.permissions ->> p_permission, 'false') = 'true')
    ))
  );
$$;
revoke all on function public.has_server_permission(bigint, text) from public, anon;
grant execute on function public.has_server_permission(bigint, text) to authenticated;

drop policy if exists "server roles readable" on public.server_roles;
create policy "server roles readable" on public.server_roles
  for select using (auth.uid() is not null);
drop policy if exists "server role managers create roles" on public.server_roles;
create policy "server role managers create roles" on public.server_roles for insert
  with check (public.has_server_permission(server_id, 'manage_roles')
    and (not coalesce(permissions ->> 'administrator', 'false') = 'true'
      or public.has_server_permission(server_id, 'owner_control')));
drop policy if exists "server role managers edit roles" on public.server_roles;
create policy "server role managers edit roles" on public.server_roles for update
  using (public.has_server_permission(server_id, 'manage_roles'))
  with check (public.has_server_permission(server_id, 'manage_roles')
    and (not coalesce(permissions ->> 'administrator', 'false') = 'true'
      or public.has_server_permission(server_id, 'owner_control')));
drop policy if exists "server role managers delete roles" on public.server_roles;
create policy "server role managers delete roles" on public.server_roles for delete
  using (public.has_server_permission(server_id, 'manage_roles'));

drop policy if exists "server role assignments readable" on public.server_member_roles;
create policy "server role assignments readable" on public.server_member_roles
  for select using (auth.uid() is not null);
drop policy if exists "server role managers assign roles" on public.server_member_roles;
create policy "server role managers assign roles" on public.server_member_roles for insert
  with check (public.has_server_permission(server_id, 'manage_roles')
    and exists (select 1 from public.server_roles sr where sr.id = server_member_roles.role_id and sr.server_id = server_member_roles.server_id
      and (not coalesce(sr.permissions ->> 'administrator', 'false') = 'true'
        or public.has_server_permission(server_member_roles.server_id, 'owner_control'))));
drop policy if exists "server role managers remove roles" on public.server_member_roles;
create policy "server role managers remove roles" on public.server_member_roles for delete
  using (public.has_server_permission(server_id, 'manage_roles'));

drop policy if exists "server managers update settings" on public.servers;
create policy "server managers update settings" on public.servers for update
  using (public.has_server_permission(id, 'manage_server'))
  with check (public.has_server_permission(id, 'manage_server'));

drop policy if exists "managers create channels" on public.channels;
create policy "managers create channels" on public.channels for insert
  with check (public.has_server_permission(server_id, 'manage_channels'));
drop policy if exists "server managers update channels" on public.channels;
create policy "server managers update channels" on public.channels for update
  using (public.has_server_permission(server_id, 'manage_channels'))
  with check (public.has_server_permission(server_id, 'manage_channels'));
drop policy if exists "server managers delete channels" on public.channels;
create policy "server managers delete channels" on public.channels for delete
  using (public.has_server_permission(server_id, 'manage_channels'));

drop policy if exists "mods delete messages" on public.messages;
create policy "mods delete messages" on public.messages for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
  or exists (
    select 1 from public.channels c
    where c.id = messages.channel_id and public.has_server_permission(c.server_id, 'manage_messages')
  )
);

create or replace function public.set_message_pin(p_message_id bigint, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_server bigint;
begin
  select c.server_id into target_server
  from public.messages m join public.channels c on c.id = m.channel_id
  where m.id = p_message_id;
  if target_server is null then raise exception 'Message not found'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'mod'))
    and not public.has_server_permission(target_server, 'manage_messages') then
    raise exception 'You need the Manage Messages permission';
  end if;
  update public.messages set pinned = p_pinned where id = p_message_id;
end;
$$;
revoke all on function public.set_message_pin(bigint, boolean) from public, anon;
grant execute on function public.set_message_pin(bigint, boolean) to authenticated;
