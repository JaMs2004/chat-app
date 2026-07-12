-- ============================================================
-- Esquema de base de datos para el sistema de chat
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. PERFILES ------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  status text default 'offline',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Los perfiles son visibles para cualquier usuario autenticado"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Un usuario solo puede editar su propio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Crea automáticamente un perfil cuando alguien entra con su apodo
-- (login anónimo). Si el apodo ya está en uso, le agrega un sufijo
-- corto para que no choque con la restricción de username único.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'invitado');
  final_username := base_username;

  if exists (select 1 from public.profiles where username = final_username) then
    final_username := base_username || '_' || substr(new.id::text, 1, 4);
  end if;

  insert into public.profiles (id, username)
  values (new.id, final_username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CONVERSACIONES -------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean default false,
  name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.conversations enable row level security;

-- 3. PARTICIPANTES ---------------------------------------------
create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

create policy "Ver conversaciones donde participo"
  on public.conversations for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

create policy "Crear conversaciones"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Ver participantes de mis conversaciones"
  on public.conversation_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp2
      where cp2.conversation_id = conversation_id and cp2.user_id = auth.uid()
    )
  );

create policy "Agregar participantes a conversaciones"
  on public.conversation_participants for insert
  to authenticated
  with check (true);

-- 4. MENSAJES ----------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Ver mensajes de mis conversaciones"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "Enviar mensajes a mis conversaciones"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- 5. REALTIME ------------------------------------------------------
alter publication supabase_realtime add table public.messages;

-- 6. ÍNDICES ------------------------------------------------------
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_participants_user on public.conversation_participants(user_id);