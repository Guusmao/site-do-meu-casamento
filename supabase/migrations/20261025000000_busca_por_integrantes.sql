-- Busca do RSVP pelo nome de cada convidado, em vez do nome do grupo ("responsavel").
create extension if not exists unaccent with schema extensions;

alter table public.convidados_lista
  add column if not exists nomes text[] not null default '{}';  -- adultos e crianças do grupo

-- Busca só pelo nome de cada integrante (não pelo nome do grupo), uma linha por pessoa.
create or replace function public.buscar_convidado_por_nome(termo text)
returns table (id uuid, nome text, integrantes text[], quantidade_maxima int)
language sql
stable
set search_path = public, extensions
as $$
  select g.id, n.nome, g.nomes, g.quantidade_maxima
  from public.convidados_lista g
  cross join lateral unnest(g.nomes) as n(nome)
  where lower(extensions.unaccent(n.nome)) like '%' || lower(extensions.unaccent(trim(termo))) || '%'
  order by n.nome
  limit 8;
$$;

revoke all on function public.buscar_convidado_por_nome(text) from public, anon, authenticated;
grant execute on function public.buscar_convidado_por_nome(text) to service_role;
