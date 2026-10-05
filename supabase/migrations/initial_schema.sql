-- Reflet de la migration « mariage_qr_initial_schema » déjà appliquée au projet Supabase.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  groom_name text not null,
  bride_name text not null,
  event_date timestamptz not null,
  location text not null,
  invitation_image text,
  access_code text check (access_code is null or length(access_code) >= 6),
  scanner_code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
    check (length(scanner_code) >= 8),
  max_invitations int not null default 200 check (max_invitations > 0),
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 2 and 80),
  token text not null unique,
  status text not null default 'valid' check (status in ('valid', 'used', 'revoked')),
  client_hash text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index invitations_event_status_idx on public.invitations (event_id, status);
create index invitations_client_hash_idx on public.invitations (client_hash, created_at);

create table public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index admins_event_idx on public.admins (event_id);

alter table public.events enable row level security;
alter table public.invitations enable row level security;
alter table public.admins enable row level security;
revoke all on public.events, public.invitations, public.admins from anon, authenticated;

create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_event_admin(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a
                 where a.user_id = (select auth.uid()) and a.event_id = p_event_id)
$$;
create function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
$$;
revoke all on function private.is_event_admin(uuid), private.is_admin() from public, anon;
grant execute on function private.is_event_admin(uuid), private.is_admin() to authenticated;

-- Visiteurs : uniquement les champs publics (jamais access_code ni scanner_code)
grant select (id, groom_name, bride_name, event_date, location, invitation_image) on public.events to anon;
create policy events_public_read on public.events for select to anon using (true);

-- Mariés (admins)
grant select on public.admins to authenticated;
create policy admins_read_own on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.events to authenticated;
grant update (groom_name, bride_name, event_date, location, invitation_image,
              access_code, scanner_code, max_invitations) on public.events to authenticated;
create policy events_admin_read on public.events for select to authenticated
  using ((select private.is_event_admin(id)));
create policy events_admin_update on public.events for update to authenticated
  using ((select private.is_event_admin(id)))
  with check ((select private.is_event_admin(id)));

grant select on public.invitations to authenticated;
grant update (status, used_at) on public.invitations to authenticated;
create policy invitations_admin_read on public.invitations for select to authenticated
  using ((select private.is_event_admin(event_id)));
create policy invitations_admin_update on public.invitations for update to authenticated
  using ((select private.is_event_admin(event_id)))
  with check ((select private.is_event_admin(event_id)));

create view public.invitation_stats with (security_invoker = true) as
select event_id,
       count(*) as total,
       count(*) filter (where status = 'valid') as available,
       count(*) filter (where status = 'used') as used,
       count(*) filter (where status = 'revoked') as revoked
from public.invitations
group by event_id;
revoke all on public.invitation_stats from anon, authenticated;
grant select on public.invitation_stats to authenticated;

-- Validation à l'entrée : atomique, réservée aux Edge Functions
create function public.validate_invitation(p_event_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.invitations;
begin
  update public.invitations
     set status = 'used', used_at = now()
   where event_id = p_event_id and token = p_token and status = 'valid'
  returning * into v;
  if found then
    return jsonb_build_object('result', 'accepted', 'guest_name', v.guest_name, 'used_at', v.used_at);
  end if;

  select * into v from public.invitations where event_id = p_event_id and token = p_token;
  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;
  return jsonb_build_object('result', v.status, 'guest_name', v.guest_name, 'used_at', v.used_at);
end $$;
revoke all on function public.validate_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.validate_invitation(uuid, text) to service_role;

-- Image d'invitation : lecture publique, écriture réservée aux admins
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invitation-images', 'invitation-images', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy invitation_images_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'invitation-images' and (select private.is_admin()))
  with check (bucket_id = 'invitation-images' and (select private.is_admin()));
