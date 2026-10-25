-- Envio do ingresso (e, depois, dos lembretes) pelo WhatsApp em vez de e-mail.
-- Só acrescenta coisas: não apaga nem altera dados existentes.

-- Número do grupo (já importado da planilha; aqui só garante que a coluna existe)
alter table public.convidados_lista
  add column if not exists whatsapp text;  -- só dígitos, com DDI (ex: 5511987654321)

-- A confirmação passa a guardar o WhatsApp para onde o ingresso foi enviado.
-- O e-mail deixa de ser obrigatório (confirmações antigas continuam com ele).
alter table public.confirmacoes
  add column if not exists whatsapp text;
alter table public.confirmacoes
  alter column email drop not null;

-- Registro de cada mensagem enviada pelo robô: o ingresso e, no futuro, os lembretes
-- ("faltam 30 dias", etc). O status é atualizado pelo webhook da Meta
-- (enviado -> entregue -> lido, ou erro quando o número não recebe).
create table if not exists public.mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  confirmacao_id uuid not null references public.confirmacoes(id) on delete cascade,
  tipo text not null,                 -- 'ingresso', 'lembrete_30_dias', ...
  telefone text not null,
  template text not null,
  wa_message_id text unique,          -- id devolvido pela Meta
  status text not null default 'pendente'
    check (status in ('pendente','enviado','entregue','lido','erro')),
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_mensagens_whatsapp_confirmacao
  on public.mensagens_whatsapp (confirmacao_id, tipo);

-- Cada lembrete só pode sair uma vez por grupo (o ingresso pode ser reenviado
-- quando o grupo refaz a confirmação).
create unique index if not exists uq_mensagens_whatsapp_lembrete
  on public.mensagens_whatsapp (confirmacao_id, tipo)
  where tipo <> 'ingresso' and status <> 'erro';

alter table public.mensagens_whatsapp enable row level security;
-- Sem policies: só as Edge Functions (service_role) leem e escrevem.
