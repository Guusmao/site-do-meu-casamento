# Testar o site no seu computador (Supabase local)

Com isso o banco de dados, as Edge Functions e o site rodam no seu PC, sem depender do
Supabase na nuvem (que pausa no plano grátis). Nada do que você fizer aqui mexe no site no ar.

## 0. O que precisa estar instalado (uma vez só)

- **Docker Desktop** — https://www.docker.com/products/docker-desktop/ (abra e deixe rodando)
- **Node.js** (você já tem, por causa do `npm`)
- **VS Code** com a extensão **Live Server**

Não precisa instalar a Supabase CLI: os comandos abaixo usam `npx supabase`, que baixa sozinho.

## 1. Pegar o código desta versão

No terminal do VS Code, dentro da pasta do projeto:

```bash
git fetch origin
git checkout feat/cadastro-nomes-grupo
git pull
```

## 2. Subir o banco local

```bash
npx supabase start
```

A primeira vez demora (baixa as imagens do Docker). No fim ele cria as tabelas
(`supabase/migrations/`) e importa os 81 grupos (`supabase/seed.sql`).

Depois rode:

```bash
npx supabase status -o env
```

e copie o valor de **`ANON_KEY`** (um texto grande que começa com `eyJ`).

## 3. Configurar as senhas de teste das funções

Copie `supabase/functions/.env.example` para `supabase/functions/.env`.
Os valores de exemplo já servem para testar (senha do admin `admin123`, da portaria `portaria123`).
Esse arquivo não vai para o GitHub.

## 4. Rodar as Edge Functions

Em **outro** terminal (deixe aberto enquanto testa):

```bash
npx supabase functions serve --env-file supabase/functions/.env
```

## 5. Apontar o site para o banco local

Copie `js/config.local.example.js` para `js/config.local.js` e cole a `ANON_KEY` no lugar de
`COLE_AQUI_A_CHAVE_ANON_LOCAL`. Esse arquivo não vai para o GitHub e só é usado quando o site
é aberto em `localhost` / `127.0.0.1`. No site publicado nada muda.

## 6. Abrir o site

Clique com o botão direito em `index.html` → **Open with Live Server**
(abre em `http://127.0.0.1:5500`).

Para ver as tabelas por dentro: **Supabase Studio** em http://127.0.0.1:54323.

## 7. Roteiro de teste

**Confirmação (RSVP)**
1. Na seção de confirmação, digite `Teteu` e escolha **Tio Teteu** (convite de 4 pessoas).
   Devem aparecer 4 vagas em branco.
2. Preencha: José Silva (pai), Maria Silva (mãe), Pedro Silva (filho) e Ana Silva (filha),
   marque a Ana como **Não vai comparecer**, coloque um e-mail e confirme.
   → A mensagem deve listar só José, Maria e Pedro.
3. Tente deixar um nome sem sobrenome → deve aparecer o aviso pedindo nome e sobrenome.
4. Clique em **Refazer confirmação** e busque o Tio Teteu de novo.
   → Os 4 nomes aparecem **travados** (só dá para trocar "vai/não vai") e não há
   botão para adicionar outra pessoa no lugar da Ana.
5. Mude a Ana para **Vai comparecer** e confirme → agora aparecem os 4.

**"Não encontrou seu convite?"**
6. Busque um nome que não existe (ex.: `Fulano de Tal`) → clique em **avise a gente**,
   preencha o contato e envie.

**Mural de recados**
7. Deixe um recado → ele aparece na lista na hora.

**Admin** — abra `http://127.0.0.1:5500/admin.html`, senha `admin123`
8. O pedido do Fulano aparece em **Pedidos pendentes**. Escolha um grupo com vaga
   (ex.: Tio Negão) e clique em **Adicionar ao grupo** → o pedido some e o nome entra no grupo.
9. Em **Grupos**, filtre por `teteu`: aparecem os 4 nomes com "vai".
   Teste **Editar** e **Remover** num nome.
10. Clique em **Exportar planilha (CSV)** e abra no Excel.

**Portaria** — `http://127.0.0.1:5500/checkin.html`, senha `portaria123`
11. Localmente o e-mail não é enviado (a não ser que você coloque uma `RESEND_API_KEY` no `.env`).
    Para ter o QR: no Studio, tabela `confirmacoes`, copie o `qr_token` do Tio Teteu e abra no
    celular `https://quickchart.io/qr?size=400&text=` + o token colado no fim.
12. Aponte a câmera do computador para o QR no celular → aparecem os nomes do grupo.
    Libere a entrada de uma pessoa e tente liberar de novo → deve avisar que já entrou.

## Recomeçar do zero / desligar

```bash
npx supabase db reset   # apaga tudo e recria tabelas + 81 grupos
npx supabase stop       # desliga o banco local
```
