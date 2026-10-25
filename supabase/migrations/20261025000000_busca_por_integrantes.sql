-- Busca do RSVP também pelos integrantes de cada grupo (não só pelo "responsavel").
create extension if not exists unaccent with schema extensions;

alter table public.convidados_lista
  add column if not exists nomes text[] not null default '{}';  -- adultos e crianças do grupo

create or replace function public.buscar_convidados(termo text)
returns table (id uuid, responsavel text, quantidade_maxima int, nome_encontrado text)
language sql
stable
set search_path = public, extensions
as $$
  with t as (select '%' || lower(extensions.unaccent(trim(termo))) || '%' as padrao)
  select g.id, g.responsavel, g.quantidade_maxima,
    case when lower(extensions.unaccent(g.responsavel)) like t.padrao then null
         else (select n from unnest(g.nomes) n
               where lower(extensions.unaccent(n)) like t.padrao limit 1)
    end as nome_encontrado
  from public.convidados_lista g, t
  where lower(extensions.unaccent(g.responsavel)) like t.padrao
     or exists (select 1 from unnest(g.nomes) n where lower(extensions.unaccent(n)) like t.padrao)
  order by g.responsavel
  limit 8;
$$;

revoke all on function public.buscar_convidados(text) from public, anon, authenticated;
grant execute on function public.buscar_convidados(text) to service_role;
