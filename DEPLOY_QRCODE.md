# Deploy do Sistema de Convite Digital com QR Code

## O que foi criado
- `supabase/schema.sql` — tabelas novas (`convidados_lista`, `confirmacoes`, `checkins`) + RLS.
- `seed_convidados.sql` (na raiz, fora da pasta do site) — os 81 grupos da sua planilha, prontos pra importar.
- `supabase/functions/buscar-grupo` — autocomplete de nomes no RSVP.
- `supabase/functions/confirmar-presenca` — valida contra a lista, gera o QR e dispara o WhatsApp.
- `supabase/functions/enviar-ingresso` — manda o convite com o QR + nomes pelo WhatsApp (template da Meta).
- `supabase/functions/whatsapp-webhook` — recebe da Meta o status de cada mensagem (entregue, lida, erro).
- `supabase/functions/_shared/whatsapp.ts` — envio de templates pela WhatsApp Cloud API (usado também pelos lembretes).
- `supabase/functions/validar-checkin` — usada pela página da portaria.
- `checkin.html` + `js/checkin.js` — página da portaria (leitor de QR pela câmera).
- `index.html` / `js/app.js` — RSVP trocado para o fluxo de busca por grupo.

## Passo 1 — Rodar o schema
No painel do Supabase → **SQL Editor** → cole e rode o conteúdo de `supabase/schema.sql`.

## Passo 2 — Importar a lista de convidados
Ainda no SQL Editor, cole e rode o conteúdo de `seed_convidados.sql` (vou te entregar esse arquivo junto).

## Passo 3 — Instalar a Supabase CLI (se ainda não tiver)
```bash
npm install -g supabase
supabase login
supabase link --project-ref faccbfidybfsoplaeqjw
```

## Passo 4 — Configurar os segredos (nunca vão para o código)
```bash
supabase secrets set QR_SECRET="uma-frase-longa-aleatoria-só-sua"
supabase secrets set PORTARIA_SENHA="escolha-uma-senha-para-a-entrada"
supabase secrets set WHATSAPP_TOKEN="token-permanente-da-meta"
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="id-do-numero-na-meta"
supabase secrets set WHATSAPP_APP_SECRET="chave-secreta-do-app-na-meta"
supabase secrets set WHATSAPP_VERIFY_TOKEN="uma-frase-qualquer-para-o-webhook"
```
> Opcionais: `WHATSAPP_TEMPLATE_INGRESSO` (padrão `ingresso_casamento`) e
> `WHATSAPP_API_VERSION` (padrão `v23.0`). O passo a passo da conta na Meta e do
> template está no guia do WhatsApp.

## Passo 5 — Deploy das funções
```bash
supabase functions deploy buscar-grupo
supabase functions deploy confirmar-presenca
supabase functions deploy enviar-ingresso
supabase functions deploy validar-checkin
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

## Passo 6 — Testar
1. Abra o site, vá até a seção RSVP, digite um nome da lista (ex: "Tio Negão").
2. Confirme 1–2 pessoas com o seu WhatsApp, veja se o convite chega com o QR Code.
3. Abra `checkin.html` no celular de quem vai ficar na portaria, digite a senha
   escolhida no Passo 4, aponte a câmera pro QR do WhatsApp — deve mostrar os nomes
   com botão "Liberar entrada".
