-- Migration: cadastro de nome e sobrenome de cada pessoa do grupo + pedidos pendentes
-- Rodar no SQL Editor do Supabase (ou `supabase db push`).

-- Pessoas de cada grupo. Depois de cadastrada, a pessoa só pode ser marcada
-- como "vai" / "não vai" pelo site; trocar ou remover o nome só pela página admin.
create table if not exists public.convidados_pessoas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.convidados_lista(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  sobrenome text not null check (length(trim(sobrenome)) > 0),
  parentesco text,                     -- opcional: pai, mãe, filho, tio...
  vai boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Mesmo nome completo não pode aparecer duas vezes no mesmo grupo
-- (a portaria identifica cada pessoa do QR pelo nome completo).
create unique index if not exists idx_convidados_pessoas_nome_unico
  on public.convidados_pessoas (grupo_id, lower(trim(nome)), lower(trim(sobrenome)));

-- Quem não achou o próprio convite na busca deixa um pedido aqui,
-- e os noivos ligam ao grupo certo pela página admin.
create table if not exists public.pendentes (
  id uuid primary key default gen_random_uuid(),
  nome_digitado text not null,
  contato text,
  mensagem text,
  status text not null default 'pendente' check (status in ('pendente','vinculado','descartado')),
  grupo_id uuid references public.convidados_lista(id) on delete set null,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

alter table public.convidados_pessoas enable row level security;
alter table public.pendentes enable row level security;
-- Sem policies: acesso só pelas Edge Functions (service_role).
