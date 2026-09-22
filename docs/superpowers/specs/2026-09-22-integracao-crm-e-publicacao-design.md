# Landing Método Charão → CRM de Leads + publicação no site do grupo

**Data:** 2026-09-22
**Status:** Design aprovado (conversa de 22/09/26), aguardando plano de implementação
**Padrão seguido:** `CHARAO-LEADS-CRM-BACKEND/docs/integracao-landing-pages.md` (webhook autenticado,
encaminhamento server-to-server, backup local), o mesmo usado na landing Mentoria Reforma Tributária.

## Objetivo

1. Toda pré-inscrição feita na landing vira um lead no CRM Charão Leads, com Fonte própria e
   filtrável em "Meus Leads", sem perder nenhuma resposta do questionário.
2. A landing passa a ser publicada em `https://grupocharao.com.br/charaoeducacional/eduardocharao/`.
3. O botão "Conheça a Charão Educacional" do site grupocharao.com.br passa a abrir essa URL
   (hoje aponta para a âncora `#contato` da própria página).

## Decisões

| Decisão | Escolha |
|---|---|
| Como o lead chega ao CRM | Backend próprio da landing recebe o form e encaminha ao webhook `POST /api/webhooks/leads` do CRM com `Authorization: Bearer <WEBHOOK_SECRET>`. Segredo só no `.env` do backend. |
| Backup local | SQLite (`better-sqlite3`), igual à Reforma. Guarda o questionário completo e é a rede de segurança se o CRM falhar. |
| Supabase da landing | **Removido** (`supabase/schema.sql` e as chaves em `assets/js/config.js`). Não será mais usado. |
| `origemLead` no CRM | `Método Charão Eduardo` (string legível, com acento, sempre a mesma). |
| `areasInteresse` | `["Educacional"]`. |
| Hospedagem do front | Hostinger, `public_html/charaoeducacional/eduardocharao/` do site do grupo. |
| Hospedagem do backend | VPS srv1309622, PM2 `metodo-charao-api`, porta **3004**, nginx + HTTPS em `api-metodo.charaotechub.com`. |
| CORS do backend | Só `https://grupocharao.com.br` (mais `http://localhost:8080` e `http://127.0.0.1:8080` em dev). |
| Falha no CRM | Nunca vira erro para o visitante. Lead fica no SQLite; erro logado com o `id`. |

## Arquitetura

```
Navegador (form)  --POST /api/inscricoes-->  BACK END (Express, VPS:3004)
                                               |- 1. valida + honeypot + rate limit
                                               |- 2. salva no SQLite (questionário completo)
                                               |- 3. encaminha ao CRM (fire-and-forget, timeout 5s)
                                               '- 4. responde 201 sempre que o passo 2 deu certo
```

## Componentes

### `BACK END/` (novo, ESM, Node 20+)

Estrutura copiada da Reforma: `src/index.js`, `src/db.js`, `src/validate.js`,
`src/routes/inscricoes.js`, `src/crm.js`, `src/crm.test.js`, `src/validate.test.js`,
`.env.example`, `package.json`, `data/.gitkeep`.

- **`index.js`**: `express.json({ limit: '32kb' })`, CORS por `CORS_ORIGIN`, rate limit 30/15 min por IP
  em `/api/inscricoes`, `GET /health` responde `{ status: 'ok', service: 'metodo-charao-api' }`, 404/500 em JSON.
- **`validate.js`**: `validateInscricao(body)` retorna `{ data }` ou `{ errors: { campo: mensagem } }`.
  Obrigatórios: nome, telefone (10 ou 11 dígitos após limpar), email válido, empresa, cargo, cidade,
  estado (UF de 2 letras), faturamento, funcionarios, problemas, aprender, dificuldades,
  consentimento === true. Limites: textos curtos 200 chars, textos longos 2000 chars.
- **Honeypot**: se `website` ou `_hp` vier preenchido, a rota responde 201 falso sem salvar.
- **`db.js`**: tabela `inscricoes` com todas as colunas do form mais `id`, `criado_em`,
  `crm_status` (`pendente | enviado | erro`), `crm_lead_id`, `crm_erro`. Funções `saveInscricao`,
  `countRecentByEmail` (máximo 3 por e-mail a cada 10 min) e `updateCrmStatus`.
- **`crm.js`**: `getCrmConfig(env)`, `buildCrmPayload(inscricao, config)` (função pura) e
  `forwardToCrm(inscricao, { config, timeoutMs })` (nunca lança; retorna `{ ok, action | status | error | skipped }`).
- **`routes/inscricoes.js`**: valida, salva, dispara `forwardToCrm` sem `await` (atualiza
  `crm_status` no retorno) e responde `201 { id, message }`.

**Mapeamento inscrição → webhook do CRM:**

| Campo CRM | Origem |
|---|---|
| `contato` | `nome` |
| `empresa` | `empresa` |
| `email` | `email` |
| `telefone` | `telefone` só dígitos |
| `cargo` | `cargo` |
| `origemLead` | env `CRM_ORIGEM_LEAD` = `Método Charão Eduardo` |
| `areasInteresse` | env `CRM_AREAS_INTERESSE` = `Educacional` |
| `notas` | texto multilinha: `Cidade/UF: <cidade>/<estado>`, `Faturamento: ...`, `Funcionários: ...`, `Problemas: ...`, `Quer aprender: ...`, `Dificuldades: ...`. Truncado em 1900 chars com reticências (limite do CRM é 2000). |

`201 created` e `200 updated` são sucesso.

**`.env.example`:**

```
PORT=3004
CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080
DATABASE_PATH=./data/inscricoes.db
CRM_WEBHOOK_URL=https://api.leads.charaotechub.com/api/webhooks/leads
CRM_WEBHOOK_SECRET=
CRM_ORIGEM_LEAD=Método Charão Eduardo
CRM_AREAS_INTERESSE=Educacional
CRM_FORWARD_ENABLED=true
```

### Frontend (alterações mínimas)

- `assets/js/config.js`: passa a ter só `API_URL`. Em dev `http://localhost:3004`
  (o live-server não faz proxy); em produção `https://api-metodo.charaotechub.com`. Nenhuma chave.
- `assets/js/inscricao.js`: `POST ${API_URL}/api/inscricoes` com JSON. Resposta `400` com `errors`
  mostra a primeira mensagem; outros erros caem na mensagem genérica já existente. Remove o modo Supabase.
- `index.html`: campo honeypot `<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true">`
  oculto via CSS; `og:image` e `og:url` absolutos em `https://grupocharao.com.br/charaoeducacional/eduardocharao/...`;
  `?v=` atualizado nos assets.
- `package.json` (raiz): mantém `dev`; adiciona `dev:api` (`npm --prefix "BACK END" run dev`).
- Remover `supabase/`. Atualizar `README.md` (rodar, publicar, variáveis, checklist).

### Site do grupo (`SITE-CHARAO-main`)

- Trocar o `href="#contato"` do botão "Conheça a Charão Educacional" por
  `https://grupocharao.com.br/charaoeducacional/eduardocharao/` via `ctaHref` (abre em nova aba, mesma convenção já usada para a Mentoria Tributária).
- `npm run build` e resubir `out/` no `public_html` conforme `DEPLOY.md`. A pasta
  `charaoeducacional/` não é gerada pelo Next, então o build não a sobrescreve; documentar isso no `DEPLOY.md`.

### Infra (VPS + Hostinger)

- VPS: clonar o repo em `/var/www/metodo-charao`, `npm ci --omit=dev` dentro de `BACK END`, `.env` com
  o segredo real (mesmo `WEBHOOK_SECRET` do `.env` do CRM), `pm2 start src/index.js --name metodo-charao-api`,
  `pm2 save`; server block nginx `api-metodo.charaotechub.com` para `127.0.0.1:3004`; certbot.
  DNS: registro A do subdomínio apontando para a VPS.
- Hostinger: enviar `index.html`, `assets/`, `favicon.ico` e `.htaccess` para
  `public_html/charaoeducacional/eduardocharao/`.
- CI/CD fica **fora do escopo** desta entrega (deploy manual documentado no README). Pode ser
  adicionado depois seguindo o roteiro das outras APIs.

## Testes

- Unitários (`node:test`, sem rede): `validate.test.js` (obrigatórios, UF, telefone, honeypot,
  limites) e `crm.test.js` (mapeamento, montagem e truncamento das notas, parse do env, flag desligada).
- Integração local: subir o backend com `CRM_FORWARD_ENABLED=false`, enviar o form pelo site local,
  conferir a linha no SQLite e a resposta 201.
- Aceite em produção: uma inscrição real gera lead em "Meus Leads" com Fonte "Método Charão Eduardo"
  e todas as respostas nas notas; segunda inscrição com o mesmo e-mail retorna `updated`, sem duplicata.

## Fora de escopo

- Fila ou retry automático para o CRM (reenvio manual a partir do SQLite; `crm_status` facilita).
- CI/CD, captcha, e-mails automáticos ao inscrito.
- Rotação do `WEBHOOK_SECRET` do CRM. Recomendada, porque o valor está em texto puro no guia dentro
  do repositório do CRM. Tratar em tarefa própria.
