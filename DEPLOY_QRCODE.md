# Deploy do Sistema de Convite Digital com QR Code

## O que foi criado
- `supabase/schema.sql` — tabelas novas (`convidados_lista`, `confirmacoes`, `checkins`) + RLS.
- `seed_convidados.sql` (na raiz, fora da pasta do site) — os 81 grupos da sua planilha, prontos pra importar.
- `supabase/functions/buscar-grupo` — autocomplete de nomes no RSVP.
- `supabase/functions/confirmar-presenca` — valida contra a lista, gera o QR e dispara o email.
- `supabase/functions/enviar-ingresso` — monta o email bonito com QR + nomes, envia via Resend.
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
supabase secrets set RESEND_API_KEY="sua-chave-do-resend-aqui"
supabase secrets set PORTARIA_SENHA="escolha-uma-senha-para-a-entrada"
supabase secrets set RESEND_FROM="Sarah & Felipe <onboarding@resend.dev>"
```
> Sobre o `RESEND_FROM`: enquanto seu domínio não estiver verificado no Resend, use
> `onboarding@resend.dev` (funciona, mas identifica o Resend no remetente). Depois,
> se quiser, verifique um domínio próprio no Resend e troque esse valor.

## Passo 5 — Deploy das funções
```bash
supabase functions deploy buscar-grupo
supabase functions deploy confirmar-presenca
supabase functions deploy enviar-ingresso
supabase functions deploy validar-checkin
```

## Passo 6 — Testar
1. Abra o site, vá até a seção RSVP, digite um nome da lista (ex: "Tio Negão").
2. Confirme 1–2 pessoas com um email seu, veja se o ingresso chega bonito.
3. Abra `checkin.html` no celular de quem vai ficar na portaria, digite a senha
   escolhida no Passo 4, aponte a câmera pro QR do email — deve mostrar os nomes
   com botão "Liberar entrada".

## Sobre a chave do Resend que você me enviou
Ela **não foi colocada em nenhum arquivo do projeto** — vai direto pro comando do
Passo 4, que grava como *secret* no servidor do Supabase. Como você a compartilhou
aqui no chat, recomendo, por precaução, gerar uma nova chave no painel do Resend e
revogar a antiga antes de ir para produção — é rápido e evita qualquer risco.
