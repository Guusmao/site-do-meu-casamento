-- ============================================================
-- SCHEMA: Sistema de Convite Digital com QR Code (Sarah & Felipe)
-- Rode este arquivo no SQL Editor do Supabase (uma vez só).
-- ============================================================

-- 1) LISTA FECHADA DE CONVIDADOS (fornecida por vocês, não editável pelo site)
create table if not exists public.convidados_lista (
  id uuid primary key default gen_random_uuid(),
  responsavel text not null,              -- nome que a pessoa vai digitar para se achar (ex: "Tio Negão")
  quantidade_maxima int not null check (quantidade_maxima > 0),
  origem text not null check (origem in ('noiva','noivo','amigos')),
  observacoes text,
  criado_em timestamptz not null default now()
);

-- Observação: a busca por nome é feita via `ilike` na Edge Function
-- `buscar-grupo`; não há índice sobre unaccent() (não é IMMUTABLE, erro 42P17).

-- 2) CONFIRMAÇÃO (um registro por grupo, criado quando o responsável confirma)
create table if not exists public.confirmacoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.convidados_lista(id),
  whatsapp text not null,
  nomes_confirmados jsonb not null default '[]'::jsonb,  -- [{"nome": "João", "vai": true}, ...]
  qr_token text unique,               -- token assinado (HMAC) que vira o QR Code
  qr_enviado_em timestamptz,
  lembrete_aquecimento_enviado_em timestamptz,
  lembrete_logistica_enviado_em timestamptz,
  lembrete_clima_enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (grupo_id)                   -- só uma confirmação por grupo (pode editar, não duplicar)
);

-- 3) CHECK-IN (registrado pela pessoa da portaria no dia do evento)
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  confirmacao_id uuid not null references public.confirmacoes(id),
  nome text not null,
  checado_em timestamptz not null default now(),
  checado_por text
);

-- 4) PESSOAS DE CADA GRUPO (nome e sobrenome; cadastradas pelo próprio convidado no RSVP)
-- Depois de cadastrada, a pessoa só pode ser marcada "vai"/"não vai" pelo site;
-- trocar ou remover o nome só pela página admin (evita trocar quem não vai por outra pessoa).
create table if not exists public.convidados_pessoas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.convidados_lista(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  sobrenome text not null check (length(trim(sobrenome)) > 0),
  parentesco text,
  vai boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists idx_convidados_pessoas_nome_unico
  on public.convidados_pessoas (grupo_id, lower(trim(nome)), lower(trim(sobrenome)));

-- 5) PENDENTES ("não achei meu convite" — os noivos ligam ao grupo pela página admin)
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

-- ============================================================
-- RLS (Row Level Security)
-- O site NUNCA fala direto com essas tabelas usando o anon key
-- para leitura/escrita sensível — tudo passa pelas Edge Functions,
-- que usam a service_role key (fica só no servidor).
-- Por isso, aqui bloqueamos tudo para o público.
-- ============================================================

alter table public.convidados_lista enable row level security;
alter table public.confirmacoes enable row level security;
alter table public.checkins enable row level security;
alter table public.convidados_pessoas enable row level security;
alter table public.pendentes enable row level security;

-- Nenhuma policy criada = nenhum acesso via anon key.
-- As Edge Functions usam a service_role key, que ignora RLS.
