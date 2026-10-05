-- Reflet de la migration « add_invitation_layout » déjà appliquée au projet Supabase.
alter table public.events add column invitation_layout jsonb not null default '{}'::jsonb;
grant select (invitation_layout) on public.events to anon;
grant update (invitation_layout) on public.events to authenticated;
