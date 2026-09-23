# Método Charão — Pré-inscrição

Landing page de pré-inscrição do Programa de Aceleração e Implementação do Método Charão
(Charão Educacional). Front estático (HTML + CSS + JS, sem build) + backend mínimo que grava
as inscrições e as encaminha ao CRM Charão Leads.

**Produção:** https://grupocharao.com.br/charaoeducacional/eduardocharao/
**API:** https://api-metodo.charaotechub.com (VPS, PM2 `metodo-charao-api`)

## Estrutura

```
index.html
assets/css/style.css
assets/js/config.js      ← endereço da API (dev/produção)
assets/js/inscricao.js   ← único ponto de envio (POST /api/inscricoes)
assets/js/main.js        ← máscara, validação, progresso, tela de sucesso
assets/img/              ← logos, foto e og-image
BACK END/                ← API Express + SQLite + encaminhamento ao CRM (ver README próprio)
.htaccess                ← HTTPS e cache na Hostinger
docs/superpowers/        ← spec e plano desta integração
```

## Rodar localmente

```bash
npm install
cd "BACK END" && npm install && cp .env.example .env && cd ..   # CRM_FORWARD_ENABLED=false em dev
npm run dev:api    # API em http://localhost:3004
npm run dev        # site em http://localhost:8080 (recarrega ao salvar)
```

Se o live-server abrir em outra porta, inclua-a em `CORS_ORIGIN` do `BACK END/.env`.

## Cache

O `.htaccess` guarda CSS e JS por 1 semana. Ao alterar `assets/css` ou `assets/js`, atualize o
`?v=` nos links do `index.html` (ex.: `?v=202609222000`).

## Fluxo do lead

Form → `POST /api/inscricoes` → grava no SQLite → encaminha ao webhook do CRM
(`origemLead = "Método Charão Eduardo"`, questionário nas notas). Lead aparece em
**Meus Leads** filtrável pela Fonte. Falha no CRM não afeta o visitante; ver `BACK END/README.md`.

## Publicar

1. **Backend na VPS** — roteiro em `BACK END/README.md` (PM2 + nginx + certbot + DNS).
2. **Front na Hostinger** — enviar `index.html`, `assets/`, `favicon.ico` e `.htaccess` para
   `public_html/charaoeducacional/eduardocharao/` do site grupocharao.com.br.
   Não enviar `BACK END/`, `docs/`, `node_modules/`, `README.md` nem `.git`.
3. **Site do grupo** — `ctaHref` da Charão Educacional em `src/lib/empresas-data.tsx` aponta
   para a URL acima (repositório SITE-CHARAO).

## Checklist de aceite

- [ ] `curl https://api-metodo.charaotechub.com/health` responde `ok`.
- [ ] Inscrição real pela URL de produção → tela de sucesso.
- [ ] Lead em Meus Leads com Fonte "Método Charão Eduardo" e respostas nas notas.
- [ ] Segunda inscrição com o mesmo e-mail não duplica (webhook devolve `updated`).
- [ ] Link compartilhado no WhatsApp mostra a imagem (`og:image`).
- [ ] Botão "Conheça a Charão Educacional" no site do grupo abre a landing.
