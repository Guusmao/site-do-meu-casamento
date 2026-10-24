-- Migration: tabela do Mural de Recados (já existia em produção, mas não estava versionada).
-- O site lê e grava direto com a chave anon, então aqui há policies de leitura e inserção.
-- Pode rodar em produção sem risco: não recria a tabela nem duplica as policies.

create table if not exists public.recados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  mensagem text not null,
  criado_em timestamptz not null default now()
);

alter table public.recados enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recados' and cmd = 'SELECT') then
    create policy "recados_leitura_publica" on public.recados for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recados' and cmd = 'INSERT') then
    create policy "recados_insercao_publica" on public.recados for insert to anon, authenticated
      with check (length(trim(nome)) between 2 and 80 and length(trim(mensagem)) between 3 and 1000);
  end if;
end $$;
