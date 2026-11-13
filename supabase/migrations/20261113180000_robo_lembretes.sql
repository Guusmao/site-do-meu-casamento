-- Robô do WhatsApp: lembretes (30 dias, 15 dias e no dia) e resposta automática.

-- 1) Só os lembretes são únicos por grupo. Reenvios pedidos pelo convidado
--    ("reenvio") e envios de teste ("teste_...") podem se repetir.
drop index if exists public.uq_mensagens_whatsapp_lembrete;
create unique index if not exists uq_mensagens_whatsapp_lembrete
  on public.mensagens_whatsapp (confirmacao_id, tipo)
  where tipo like 'lembrete_%' and status <> 'erro';

-- 2) Respostas automáticas do robô (para limitar quantas manda por número)
create table if not exists public.robo_respostas (
  id bigint generated always as identity primary key,
  contato text not null,           -- número ou JID de quem escreveu
  tipo text not null,              -- 'aviso' ou 'reenvio'
  criado_em timestamptz not null default now()
);
create index if not exists idx_robo_respostas_contato on public.robo_respostas (contato, tipo, criado_em);
alter table public.robo_respostas enable row level security;
-- Sem policies: só as Edge Functions (service_role) leem e escrevem.

-- 3) A cada 10 minutos, das 8h às 20h50 de Brasília (11h-23h UTC), chama a
--    função enviar-lembretes. Ela mesma decide se hoje tem lembrete e manda
--    um lote pequeno por vez. A chave usada é a anon, que já é pública no site.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('enviar-lembretes') where exists (select 1 from cron.job where jobname = 'enviar-lembretes');
select cron.schedule(
  'enviar-lembretes',
  '*/10 11-23 * * *',
  $$
  select net.http_post(
    url := 'https://faccbfidybfsoplaeqjw.supabase.co/functions/v1/enviar-lembretes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY2NiZmlkeWJmc29wbGFlcWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTY4ODYsImV4cCI6MjA5Njc5Mjg4Nn0.SNPbyvdHeICpuswamoUeJ-bAUtMosv7RvlVoxYyOTc8'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
