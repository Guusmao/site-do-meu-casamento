-- Migration: create qrcode invitation tables and RLS
create extension if not exists unaccent;

create table if not exists public.convidados_lista (
  id uuid primary key default gen_random_uuid(),
  responsavel text not null,
  quantidade_maxima int not null check (quantidade_maxima > 0),
  origem text not null check (origem in ('noiva','noivo','amigos')),
  observacoes text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_convidados_lista_busca
  on public.convidados_lista using gin (to_tsvector('simple', unaccent(responsavel)));

create table if not exists public.confirmacoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.convidados_lista(id),
  email text not null,
  nomes_confirmados jsonb not null default '[]'::jsonb,
  qr_token text unique,
  qr_enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (grupo_id)
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  confirmacao_id uuid not null references public.confirmacoes(id),
  nome text not null,
  checado_em timestamptz not null default now(),
  checado_por text
);

alter table public.convidados_lista enable row level security;
alter table public.confirmacoes enable row level security;
alter table public.checkins enable row level security;
