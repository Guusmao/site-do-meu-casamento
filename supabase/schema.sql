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

-- Busca por nome sem acento/maiúscula (autocomplete)
create extension if not exists unaccent;
create index if not exists idx_convidados_lista_busca
  on public.convidados_lista using gin (to_tsvector('simple', unaccent(responsavel)));

-- 2) CONFIRMAÇÃO (um registro por grupo, criado quando o responsável confirma)
create table if not exists public.confirmacoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.convidados_lista(id),
  email text not null,
  nomes_confirmados jsonb not null default '[]'::jsonb,  -- [{"nome": "João", "vai": true}, ...]
  qr_token text unique,               -- token assinado (HMAC) que vira o QR Code
  qr_enviado_em timestamptz,
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

-- Nenhuma policy criada = nenhum acesso via anon key.
-- As Edge Functions usam a service_role key, que ignora RLS.
