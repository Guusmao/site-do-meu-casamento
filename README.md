# Site de Casamento - Sarah & Felipe

Site de casamento responsivo com tela de abertura em envelope, contagem regressiva, RSVP, galeria e mural de recados.

## Funcionalidades

- Tela de abertura com envelope animado
- Contagem regressiva para a data do casamento
- Secao Nossa Historia
- Informacoes do evento com mapa
- Galeria com lightbox
- Lista de presentes
- Formulario de confirmacao de presenca (RSVP)
- Mural de recados
- Layout responsivo

## Tecnologias

- HTML5
- CSS3
- JavaScript (Vanilla)
- Supabase JS (CDN)
- Google Fonts (Inter e Playfair Display)
- Lucide Icons

## Estrutura do Projeto

```text
site-casamento/
├── assets/
│   └── images/
│       ├── branding/
│       │   └── logo-oficial.png.png
│       ├── gallery/
│       │   └── casal-auditorio.jpg (e demais fotos .jpg)
│       ├── hero/
│       │   └── hero-bg.png
│       └── story/
│           └── casal-janeloes.jpg
├── css/
│   ├── style.css
│   └── envelope.css
├── js/
│   └── app.js
├── index.html
├── package.json
└── README.md
```

## Como Executar

1. Entre na pasta do projeto.
2. Abra `index.html` no navegador.

Para desenvolvimento, use Live Server no VS Code.

## Personalizacao Rapida

### Trocar nomes dos noivos

Edite no arquivo `index.html`:

```html
<h1 class="hero-title">Sarah & Felipe</h1>
```

### Trocar data do casamento

Edite no arquivo `js/app.js`:

```javascript
const weddingDate = new Date('Feb 08, 2027 16:30:00').getTime();
```

### Trocar logo/favicon

Substitua o arquivo:

```text
assets/images/branding/logo-oficial.png.png
```

Se mudar o nome do arquivo, atualize os caminhos no `index.html`.

### Trocar imagens

Substitua imagens nas pastas:

- `assets/images/hero/`
- `assets/images/story/`
- `assets/images/gallery/`

## Observacoes

- O projeto usa links CDN para algumas bibliotecas no `index.html`.
- O fluxo do envelope e animacoes estao em `css/envelope.css` e `js/app.js`.

## Licenca

Projeto para uso pessoal. Pode ser adaptado para outros eventos.
