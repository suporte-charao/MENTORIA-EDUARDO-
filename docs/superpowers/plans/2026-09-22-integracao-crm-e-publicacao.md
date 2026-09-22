# Integração com o CRM + publicação no site do grupo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda pré-inscrição da landing Método Charão vira lead no CRM Charão Leads (Fonte "Método Charão Eduardo"), com backup local, e a landing passa a ser publicada em `https://grupocharao.com.br/charaoeducacional/eduardocharao/`, aberta pelo botão "Conheça a Charão Educacional" do site do grupo.

**Architecture:** Um backend Express mínimo (`BACK END/`) recebe o formulário, valida, grava em SQLite e encaminha servidor a servidor ao webhook autenticado do CRM (`POST /api/webhooks/leads`), sem bloquear a resposta ao visitante. O front estático só troca o destino do envio. O backend roda na VPS como processo PM2 atrás do nginx; o front vai para uma subpasta do `public_html` do site do grupo na Hostinger.

**Tech Stack:** Node 20+ (fetch nativo, `node:test`), Express 4, better-sqlite3, express-rate-limit, cors, dotenv. Front: HTML/CSS/JS puro. Site do grupo: Next.js `output: "export"`.

**Spec:** `docs/superpowers/specs/2026-09-22-integracao-crm-e-publicacao-design.md`

## Global Constraints

- Backend em ESM (`"type": "module"`), `import`/`export`, fetch nativo, testes com `node:test` (sem framework extra).
- Segredo do CRM só em `BACK END/.env` (gitignored). `.env.example` com `CRM_WEBHOOK_SECRET=` vazio.
- `origemLead` exato: `Método Charão Eduardo`. `areasInteresse`: `Educacional`.
- Porta do backend: `3004`. Nome PM2: `metodo-charao-api`. Subdomínio: `api-metodo.charaotechub.com`.
- URL pública do front: `https://grupocharao.com.br/charaoeducacional/eduardocharao/`.
- Falha no CRM nunca vira erro para o visitante (lead já salvo local).
- `notas` enviadas ao CRM truncadas em 1900 caracteres.
- Front continua sem build. Ao mexer em `assets/`, atualizar `?v=` no `index.html`.
- Repositório da landing: `C:\DESENVOLVIMENTO CLAUDE CODE PRODUÇÃO\MENTORIA-EDUARDO` (branch `feat/integracao-crm`). Site do grupo: `C:\DESENVOLVIMENTO CLAUDE CODE PRODUÇÃO\SITE-CHARAO-main`.
- Commits com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` na última linha.

---

## File Structure

**Criar (backend):**
- `BACK END/package.json` — scripts `dev`, `start`, `test`; deps.
- `BACK END/.env.example` — variáveis documentadas.
- `BACK END/.gitignore` — `node_modules/`, `.env`, `data/*.db*`.
- `BACK END/data/.gitkeep` — pasta do SQLite.
- `BACK END/src/validate.js` — `validateInscricao(body)`: validação e normalização do form.
- `BACK END/src/validate.test.js`
- `BACK END/src/db.js` — SQLite: `saveInscricao`, `countRecentByEmail`, `updateCrmStatus`, `dbPath`.
- `BACK END/src/crm.js` — `getCrmConfig`, `buildCrmPayload`, `forwardToCrm`.
- `BACK END/src/crm.test.js`
- `BACK END/src/routes/inscricoes.js` — `POST /` (honeypot, valida, salva, encaminha, 201).
- `BACK END/src/index.js` — app Express: CORS, rate limit, `/health`, rotas, erros.
- `BACK END/README.md` — rodar, variáveis, deploy na VPS.

**Modificar (front):**
- `assets/js/config.js` — só `API_URL`.
- `assets/js/inscricao.js` — POST no backend.
- `index.html` — honeypot, `og:*` absolutos, `?v=`.
- `assets/css/style.css` — regra `.hp`.
- `package.json` (raiz) — script `dev:api`.
- `README.md` — nova estrutura, checklist.

**Remover:** `supabase/schema.sql`.

**Site do grupo:** `src/lib/empresas-data.tsx` (ctaHref da Educacional), `DEPLOY.md` (nota sobre a subpasta).

---

### Task 1: Esqueleto do backend + validação do formulário

**Files:**
- Create: `BACK END/package.json`, `BACK END/.gitignore`, `BACK END/.env.example`, `BACK END/data/.gitkeep`
- Create: `BACK END/src/validate.js`
- Test: `BACK END/src/validate.test.js`

**Interfaces:**
- Produces: `validateInscricao(body: unknown) -> { data: Inscricao } | { errors: Record<string,string> }`
  - `Inscricao = { nome, telefone (só dígitos, 10–11), email (lowercase), empresa, cargo, cidade, estado (UF maiúscula), faturamento, funcionarios, problemas, aprender, dificuldades, consentimento: true }`

- [ ] **Step 1: Criar `BACK END/package.json`**

```json
{
  "name": "metodo-charao-api",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "API de pré-inscrição — Método Charão | Charão Educacional",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "test": "node --test src/"
  },
  "dependencies": {
    "better-sqlite3": "^12.11.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0"
  }
}
```

- [ ] **Step 2: Criar `BACK END/.gitignore`, `BACK END/.env.example` e `BACK END/data/.gitkeep`**

`.gitignore`:
```
node_modules/
.env
data/*.db
data/*.db-*
```

`.env.example`:
```
# Porta do servidor
PORT=3004

# Origens permitidas (CORS), separadas por vírgula.
# Dev: live-server da landing. Produção: https://grupocharao.com.br
CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080

# Caminho do SQLite (relativo à pasta BACK END)
DATABASE_PATH=./data/inscricoes.db

# --- CRM Charão Leads (webhook autenticado) ---
CRM_WEBHOOK_URL=https://api.leads.charaotechub.com/api/webhooks/leads
# Mesmo valor de WEBHOOK_SECRET do .env do CRM. NUNCA commitar.
CRM_WEBHOOK_SECRET=
CRM_ORIGEM_LEAD=Método Charão Eduardo
CRM_AREAS_INTERESSE=Educacional
# false = só grava local (útil em dev)
CRM_FORWARD_ENABLED=true
```

`data/.gitkeep`: arquivo vazio.

- [ ] **Step 3: Instalar dependências**

Run: `cd "BACK END" && npm install`
Expected: `node_modules/` criado, sem erro de compilação do better-sqlite3 (usa binário pré-compilado).

- [ ] **Step 4: Escrever os testes de validação (falham)**

`BACK END/src/validate.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateInscricao } from './validate.js'

const valido = {
  nome: '  Ana Souza ',
  telefone: '(92) 99999-1234',
  email: 'Ana@Empresa.com',
  empresa: 'ACME',
  cargo: 'Sócia',
  cidade: 'Manaus',
  estado: 'am',
  faturamento: 'Até R$ 500 mil',
  funcionarios: '1 a 5',
  problemas: 'Fluxo de caixa',
  aprender: 'Indicadores',
  dificuldades: 'Time',
  consentimento: true,
}

test('payload válido: normaliza e devolve data', () => {
  const r = validateInscricao(valido)
  assert.equal(r.errors, undefined)
  assert.equal(r.data.nome, 'Ana Souza')
  assert.equal(r.data.telefone, '92999991234')
  assert.equal(r.data.email, 'ana@empresa.com')
  assert.equal(r.data.estado, 'AM')
  assert.equal(r.data.consentimento, true)
})

test('campos obrigatórios vazios geram erro por campo', () => {
  const r = validateInscricao({})
  for (const k of ['nome','telefone','email','empresa','cargo','cidade','estado','faturamento','funcionarios','problemas','aprender','dificuldades','consentimento']) {
    assert.ok(r.errors[k], `esperava erro em ${k}`)
  }
})

test('telefone com menos de 10 dígitos é inválido', () => {
  const r = validateInscricao({ ...valido, telefone: '9999' })
  assert.equal(r.errors.telefone, 'Informe um telefone válido com DDD.')
})

test('UF precisa ter 2 letras', () => {
  const r = validateInscricao({ ...valido, estado: 'Amazonas' })
  assert.equal(r.errors.estado, 'Informe a UF com 2 letras.')
})

test('e-mail inválido', () => {
  const r = validateInscricao({ ...valido, email: 'ana@' })
  assert.equal(r.errors.email, 'E-mail inválido.')
})

test('consentimento false é erro', () => {
  const r = validateInscricao({ ...valido, consentimento: false })
  assert.equal(r.errors.consentimento, 'É preciso aceitar o uso dos dados.')
})

test('texto longo acima de 2000 caracteres é rejeitado', () => {
  const r = validateInscricao({ ...valido, problemas: 'x'.repeat(2001) })
  assert.equal(r.errors.problemas, 'Máximo de 2000 caracteres.')
})

test('texto curto acima de 200 caracteres é rejeitado', () => {
  const r = validateInscricao({ ...valido, empresa: 'x'.repeat(201) })
  assert.equal(r.errors.empresa, 'Máximo de 200 caracteres.')
})

test('payload não-objeto', () => {
  assert.deepEqual(validateInscricao(null), { errors: { _form: 'Payload inválido.' } })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `cd "BACK END" && node --test src/validate.test.js`
Expected: falha com `Cannot find module './validate.js'`.

- [ ] **Step 6: Implementar `BACK END/src/validate.js`**

```js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UF_RE = /^[A-Z]{2}$/
const CURTO_MAX = 200
const LONGO_MAX = 2000

const CURTOS = ['nome', 'empresa', 'cargo', 'cidade', 'faturamento', 'funcionarios']
const LONGOS = ['problemas', 'aprender', 'dificuldades']
const MENSAGENS = {
  nome: 'Informe seu nome completo.',
  empresa: 'Informe a empresa.',
  cargo: 'Informe seu cargo.',
  cidade: 'Informe a cidade.',
  faturamento: 'Selecione o faturamento.',
  funcionarios: 'Selecione o número de funcionários.',
  problemas: 'Conte os principais problemas.',
  aprender: 'Conte o que quer aprender.',
  dificuldades: 'Conte suas dificuldades.',
}

const str = (v) => String(v ?? '').trim()

export function validateInscricao(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: { _form: 'Payload inválido.' } }
  }
  const errors = {}
  const data = {}

  for (const k of CURTOS) {
    const v = str(body[k])
    if (!v) errors[k] = MENSAGENS[k]
    else if (v.length > CURTO_MAX) errors[k] = `Máximo de ${CURTO_MAX} caracteres.`
    else data[k] = v
  }
  for (const k of LONGOS) {
    const v = str(body[k])
    if (!v) errors[k] = MENSAGENS[k]
    else if (v.length > LONGO_MAX) errors[k] = `Máximo de ${LONGO_MAX} caracteres.`
    else data[k] = v
  }

  const telefone = str(body.telefone).replace(/\D/g, '')
  if (telefone.length < 10 || telefone.length > 11) errors.telefone = 'Informe um telefone válido com DDD.'
  else data.telefone = telefone

  const email = str(body.email).toLowerCase()
  if (!email) errors.email = 'Informe seu e-mail.'
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'E-mail inválido.'
  else data.email = email

  const estado = str(body.estado).toUpperCase()
  if (!UF_RE.test(estado)) errors.estado = 'Informe a UF com 2 letras.'
  else data.estado = estado

  if (body.consentimento !== true) errors.consentimento = 'É preciso aceitar o uso dos dados.'
  else data.consentimento = true

  if (Object.keys(errors).length > 0) return { errors }
  return { data }
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd "BACK END" && node --test src/validate.test.js`
Expected: 9 testes passando.

- [ ] **Step 8: Commit**

```bash
git add "BACK END/package.json" "BACK END/package-lock.json" "BACK END/.gitignore" "BACK END/.env.example" "BACK END/data/.gitkeep" "BACK END/src/validate.js" "BACK END/src/validate.test.js"
git commit -m "feat(api): esqueleto do backend e validação da pré-inscrição"
```

---

### Task 2: Persistência SQLite

**Files:**
- Create: `BACK END/src/db.js`

**Interfaces:**
- Consumes: `Inscricao` (Task 1) mais `id: string`.
- Produces:
  - `saveInscricao(inscricao & { id }) -> inscricao`
  - `countRecentByEmail(email: string, minutes = 10) -> number`
  - `updateCrmStatus(id: string, { status: 'enviado'|'erro', leadId?: string, erro?: string }) -> void`
  - `dbPath: string`

- [ ] **Step 1: Implementar `BACK END/src/db.js`**

```js
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(root, process.env.DATABASE_PATH)
  : path.join(root, 'data', 'inscricoes.db')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS inscricoes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT NOT NULL,
    empresa TEXT NOT NULL,
    cargo TEXT NOT NULL,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    faturamento TEXT NOT NULL,
    funcionarios TEXT NOT NULL,
    problemas TEXT NOT NULL,
    aprender TEXT NOT NULL,
    dificuldades TEXT NOT NULL,
    consentimento INTEGER NOT NULL DEFAULT 1,
    crm_status TEXT NOT NULL DEFAULT 'pendente',
    crm_lead_id TEXT,
    crm_erro TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

const insert = db.prepare(`
  INSERT INTO inscricoes (id, nome, telefone, email, empresa, cargo, cidade, estado,
    faturamento, funcionarios, problemas, aprender, dificuldades)
  VALUES (@id, @nome, @telefone, @email, @empresa, @cargo, @cidade, @estado,
    @faturamento, @funcionarios, @problemas, @aprender, @dificuldades)
`)

const updateCrm = db.prepare(`
  UPDATE inscricoes SET crm_status = @status, crm_lead_id = @leadId, crm_erro = @erro WHERE id = @id
`)

export function saveInscricao(inscricao) {
  insert.run(inscricao)
  return inscricao
}

export function countRecentByEmail(email, minutes = 10) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM inscricoes
    WHERE lower(email) = lower(?) AND datetime(criado_em) > datetime('now', ?)
  `).get(email, `-${minutes} minutes`)
  return row?.count ?? 0
}

export function updateCrmStatus(id, { status, leadId = null, erro = null }) {
  updateCrm.run({ id, status, leadId, erro })
}

export { dbPath }
```

- [ ] **Step 2: Smoke test manual (sem gravar no repo)**

Run (na pasta `BACK END`):
```bash
DATABASE_PATH=./data/smoke.db node -e "import('./src/db.js').then(m => { m.saveInscricao({id:'t1',nome:'A',telefone:'92999991234',email:'a@a.com',empresa:'X',cargo:'C',cidade:'M',estado:'AM',faturamento:'f',funcionarios:'1',problemas:'p',aprender:'a',dificuldades:'d'}); console.log(m.countRecentByEmail('A@a.com')); m.updateCrmStatus('t1',{status:'enviado',leadId:'L1'}); console.log('ok') })"
rm -f data/smoke.db data/smoke.db-*
```
Expected: imprime `1` e `ok`.

- [ ] **Step 3: Commit**

```bash
git add "BACK END/src/db.js"
git commit -m "feat(api): persistência SQLite das pré-inscrições"
```

---

### Task 3: Encaminhamento ao CRM (`crm.js`)

**Files:**
- Create: `BACK END/src/crm.js`
- Test: `BACK END/src/crm.test.js`

**Interfaces:**
- Consumes: `Inscricao & { id }` (Task 1/2).
- Produces:
  - `getCrmConfig(env = process.env) -> { enabled, url, secret, origemLead, areasInteresse: string[] }`
  - `buildCrmPayload(inscricao, config) -> { contato, empresa, email, telefone, cargo, origemLead, areasInteresse, notas }` (pura)
  - `forwardToCrm(inscricao, { config?, timeoutMs? = 5000, fetchImpl? = fetch }) -> Promise<{ ok: boolean, action?, leadId?, status?, error?, skipped? }>` (nunca lança)

- [ ] **Step 1: Escrever os testes (falham)**

`BACK END/src/crm.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCrmPayload, getCrmConfig, forwardToCrm } from './crm.js'

const cfg = {
  enabled: true,
  url: 'https://crm.test/api/webhooks/leads',
  secret: 's3cr3t',
  origemLead: 'Método Charão Eduardo',
  areasInteresse: ['Educacional'],
}

const insc = {
  id: 'abc',
  nome: 'Ana Souza',
  telefone: '92999991234',
  email: 'ana@empresa.com',
  empresa: 'ACME',
  cargo: 'Sócia',
  cidade: 'Manaus',
  estado: 'AM',
  faturamento: 'Até R$ 500 mil',
  funcionarios: '1 a 5',
  problemas: 'Fluxo de caixa',
  aprender: 'Indicadores',
  dificuldades: 'Time',
}

test('buildCrmPayload mapeia campos e monta notas', () => {
  const p = buildCrmPayload(insc, cfg)
  assert.equal(p.contato, 'Ana Souza')
  assert.equal(p.empresa, 'ACME')
  assert.equal(p.email, 'ana@empresa.com')
  assert.equal(p.telefone, '92999991234')
  assert.equal(p.cargo, 'Sócia')
  assert.equal(p.origemLead, 'Método Charão Eduardo')
  assert.deepEqual(p.areasInteresse, ['Educacional'])
  assert.equal(p.notas, [
    'Cidade/UF: Manaus/AM',
    'Faturamento: Até R$ 500 mil',
    'Funcionários: 1 a 5',
    'Problemas: Fluxo de caixa',
    'Quer aprender: Indicadores',
    'Dificuldades: Time',
  ].join('\n'))
})

test('notas são truncadas em 1900 caracteres', () => {
  const p = buildCrmPayload({ ...insc, problemas: 'x'.repeat(3000) }, cfg)
  assert.equal(p.notas.length, 1900)
  assert.ok(p.notas.endsWith('…'))
})

test('getCrmConfig lê env e parseia CSV', () => {
  const c = getCrmConfig({
    CRM_WEBHOOK_URL: 'https://x/api/webhooks/leads',
    CRM_WEBHOOK_SECRET: 's',
    CRM_ORIGEM_LEAD: 'Método Charão Eduardo',
    CRM_AREAS_INTERESSE: 'Educacional, Gestão',
    CRM_FORWARD_ENABLED: 'true',
  })
  assert.equal(c.enabled, true)
  assert.equal(c.url, 'https://x/api/webhooks/leads')
  assert.equal(c.secret, 's')
  assert.deepEqual(c.areasInteresse, ['Educacional', 'Gestão'])
})

test('getCrmConfig desliga com CRM_FORWARD_ENABLED=false', () => {
  assert.equal(getCrmConfig({ CRM_FORWARD_ENABLED: 'false' }).enabled, false)
})

test('forwardToCrm pula quando desligado ou sem secret', async () => {
  const r1 = await forwardToCrm(insc, { config: { ...cfg, enabled: false } })
  assert.deepEqual(r1, { ok: false, skipped: true })
  const r2 = await forwardToCrm(insc, { config: { ...cfg, secret: '' } })
  assert.deepEqual(r2, { ok: false, skipped: true })
})

test('forwardToCrm envia Bearer e trata 201 created', async () => {
  let captured
  const fetchImpl = async (url, opts) => {
    captured = { url, opts }
    return { ok: true, status: 201, json: async () => ({ action: 'created', lead: { id: 'L1' } }) }
  }
  const r = await forwardToCrm(insc, { config: cfg, fetchImpl })
  assert.equal(captured.url, cfg.url)
  assert.equal(captured.opts.headers.Authorization, 'Bearer s3cr3t')
  assert.equal(JSON.parse(captured.opts.body).origemLead, 'Método Charão Eduardo')
  assert.deepEqual(r, { ok: true, action: 'created', leadId: 'L1' })
})

test('forwardToCrm trata 200 updated como sucesso', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ action: 'updated', lead: { id: 'L2' } }) })
  const r = await forwardToCrm(insc, { config: cfg, fetchImpl })
  assert.deepEqual(r, { ok: true, action: 'updated', leadId: 'L2' })
})

test('forwardToCrm devolve status em resposta não-2xx', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) })
  const r = await forwardToCrm(insc, { config: cfg, fetchImpl })
  assert.deepEqual(r, { ok: false, status: 401 })
})

test('forwardToCrm nunca lança em erro de rede', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED') }
  const r = await forwardToCrm(insc, { config: cfg, fetchImpl })
  assert.deepEqual(r, { ok: false, error: 'ECONNREFUSED' })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd "BACK END" && node --test src/crm.test.js`
Expected: `Cannot find module './crm.js'`.

- [ ] **Step 3: Implementar `BACK END/src/crm.js`**

```js
const NOTAS_MAX = 1900

export function getCrmConfig(env = process.env) {
  return {
    enabled: env.CRM_FORWARD_ENABLED !== 'false',
    url: env.CRM_WEBHOOK_URL || '',
    secret: env.CRM_WEBHOOK_SECRET || '',
    origemLead: env.CRM_ORIGEM_LEAD || 'Método Charão Eduardo',
    areasInteresse: String(env.CRM_AREAS_INTERESSE || '')
      .split(',').map((s) => s.trim()).filter(Boolean),
  }
}

function montarNotas(i) {
  const linhas = [
    `Cidade/UF: ${i.cidade}/${i.estado}`,
    `Faturamento: ${i.faturamento}`,
    `Funcionários: ${i.funcionarios}`,
    `Problemas: ${i.problemas}`,
    `Quer aprender: ${i.aprender}`,
    `Dificuldades: ${i.dificuldades}`,
  ]
  const texto = linhas.join('\n')
  return texto.length > NOTAS_MAX ? texto.slice(0, NOTAS_MAX - 1) + '…' : texto
}

export function buildCrmPayload(inscricao, config) {
  return {
    contato: inscricao.nome,
    empresa: inscricao.empresa,
    email: inscricao.email,
    telefone: inscricao.telefone,
    cargo: inscricao.cargo || '',
    origemLead: config.origemLead,
    areasInteresse: config.areasInteresse,
    notas: montarNotas(inscricao),
  }
}

export async function forwardToCrm(inscricao, { config = getCrmConfig(), timeoutMs = 5000, fetchImpl = fetch } = {}) {
  if (!config.enabled || !config.url || !config.secret) {
    console.warn('[crm] encaminhamento desativado ou sem configuração — pulando')
    return { ok: false, skipped: true }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secret}` },
      body: JSON.stringify(buildCrmPayload(inscricao, config)),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error(`[crm] webhook respondeu ${res.status} para inscrição ${inscricao.id}`)
      return { ok: false, status: res.status }
    }
    const body = await res.json().catch(() => ({}))
    return { ok: true, action: body.action, leadId: body.lead?.id }
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'timeout' : err.message
    console.error(`[crm] falha na inscrição ${inscricao.id}: ${msg}`)
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd "BACK END" && node --test src/`
Expected: todos os testes (validate + crm) passando.

- [ ] **Step 5: Commit**

```bash
git add "BACK END/src/crm.js" "BACK END/src/crm.test.js"
git commit -m "feat(api): encaminhamento das inscrições ao webhook do CRM"
```

---

### Task 4: Rota `POST /api/inscricoes` + servidor Express

**Files:**
- Create: `BACK END/src/routes/inscricoes.js`
- Create: `BACK END/src/index.js`
- Create: `BACK END/README.md`

**Interfaces:**
- Consumes: `validateInscricao` (T1), `saveInscricao`/`countRecentByEmail`/`updateCrmStatus`/`dbPath` (T2), `forwardToCrm` (T3).
- Produces: HTTP `POST /api/inscricoes` → `201 { id, message }` | `400 { errors }` | `403` (CORS) | `429` | `500`; `GET /health` → `{ status:'ok', service:'metodo-charao-api' }`.

- [ ] **Step 1: Implementar `BACK END/src/routes/inscricoes.js`**

```js
import { Router } from 'express'
import { randomUUID } from 'crypto'
import { validateInscricao } from '../validate.js'
import { saveInscricao, countRecentByEmail, updateCrmStatus } from '../db.js'
import { forwardToCrm } from '../crm.js'

const router = Router()
const LIMITE_MSG = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'

router.post('/', (req, res) => {
  // Honeypot: humanos nunca preenchem. Responde sucesso falso sem gravar.
  if (req.body?.website || req.body?._hp) {
    return res.status(201).json({ id: randomUUID(), message: 'Pré-inscrição recebida.' })
  }

  const result = validateInscricao(req.body)
  if (result.errors) return res.status(400).json({ errors: result.errors })

  const { data } = result
  if (countRecentByEmail(data.email) >= 3) {
    return res.status(429).json({ message: LIMITE_MSG })
  }

  const inscricao = { id: randomUUID(), ...data }
  try {
    saveInscricao(inscricao)
  } catch (err) {
    console.error('[inscricoes] erro ao salvar:', err)
    return res.status(500).json({ message: 'Erro interno. Tente novamente em instantes.' })
  }

  // Encaminha ao CRM sem bloquear a resposta. Falha aqui nunca chega ao visitante.
  forwardToCrm(inscricao)
    .then((r) => {
      if (r.ok) updateCrmStatus(inscricao.id, { status: 'enviado', leadId: r.leadId ?? null })
      else if (!r.skipped) updateCrmStatus(inscricao.id, { status: 'erro', erro: r.error ?? `HTTP ${r.status}` })
    })
    .catch((e) => console.error('[crm] inesperado:', e))

  return res.status(201).json({ id: inscricao.id, message: 'Pré-inscrição recebida.' })
})

export default router
```

- [ ] **Step 2: Implementar `BACK END/src/index.js`**

```js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import inscricoesRouter from './routes/inscricoes.js'
import { dbPath } from './db.js'
import { getCrmConfig } from './crm.js'

const PORT = Number(process.env.PORT) || 3004

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080,http://127.0.0.1:8080')
  .split(',').map((o) => o.trim()).filter(Boolean)

const app = express()
app.set('trust proxy', 1) // atrás do nginx: rate limit por IP real

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) callback(null, true)
    else callback(new Error(`CORS bloqueado: ${origin}`))
  },
  methods: ['POST', 'GET'],
}))

app.use(express.json({ limit: '32kb' }))

app.use('/api/inscricoes', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
}))

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'metodo-charao-api' }))
app.use('/api/inscricoes', inscricoesRouter)

app.use((_req, res) => res.status(404).json({ message: 'Rota não encontrada.' }))
app.use((err, _req, res, _next) => {
  if (err.message?.startsWith('CORS bloqueado')) return res.status(403).json({ message: 'Origem não permitida.' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ errors: { _form: 'JSON inválido.' } })
  console.error('[api] erro não tratado:', err)
  res.status(500).json({ message: 'Erro interno.' })
})

app.listen(PORT, () => {
  const crm = getCrmConfig()
  console.log(`metodo-charao-api em http://localhost:${PORT}`)
  console.log(`SQLite: ${dbPath}`)
  console.log(`CORS: ${corsOrigins.join(', ')}`)
  console.log(`CRM: ${crm.enabled && crm.secret ? 'ligado → ' + crm.url : 'DESLIGADO'}`)
})
```

- [ ] **Step 3: Subir e testar com curl**

Run (na pasta `BACK END`), com `.env` copiado de `.env.example` e `CRM_FORWARD_ENABLED=false`:
```bash
cp .env.example .env && sed -i 's/CRM_FORWARD_ENABLED=true/CRM_FORWARD_ENABLED=false/' .env
npm run dev &
sleep 2
curl -s localhost:3004/health
curl -s -X POST localhost:3004/api/inscricoes -H 'Content-Type: application/json' -d '{}'
curl -s -X POST localhost:3004/api/inscricoes -H 'Content-Type: application/json' -H 'Origin: http://localhost:8080' -d '{"nome":"Teste Local","telefone":"92999991234","email":"teste@local.dev","empresa":"ACME","cargo":"Sócio","cidade":"Manaus","estado":"AM","faturamento":"Até R$ 500 mil","funcionarios":"1 a 5","problemas":"p","aprender":"a","dificuldades":"d","consentimento":true}'
curl -s -X POST localhost:3004/api/inscricoes -H 'Content-Type: application/json' -H 'Origin: https://site-invasor.com' -d '{}'
```
Expected, na ordem: `{"status":"ok",...}`; `400` com `errors` por campo; `201 {"id":"...","message":"Pré-inscrição recebida."}` e no log `[crm] encaminhamento desativado`; `403 {"message":"Origem não permitida."}`.

- [ ] **Step 4: Escrever `BACK END/README.md`**

```markdown
# BACK END — metodo-charao-api

API de pré-inscrição da landing **Método Charão** (Charão Educacional). Recebe o formulário,
grava em SQLite e encaminha o lead ao CRM Charão Leads via webhook autenticado.

## Rodar local

```bash
npm install
cp .env.example .env      # CRM_FORWARD_ENABLED=false para não bater no CRM
npm run dev               # http://localhost:3004
npm test
```

## Endpoints

- `GET /health` → `{ status: "ok", service: "metodo-charao-api" }`
- `POST /api/inscricoes` → `201 { id, message }` | `400 { errors }` | `429` | `500`
  Campos obrigatórios: nome, telefone (10–11 dígitos), email, empresa, cargo, cidade, estado (UF),
  faturamento, funcionarios, problemas, aprender, dificuldades, consentimento (true).
  Campo honeypot `website`: se preenchido, responde 201 sem gravar.

## Fluxo do lead

1. Valida e grava em `data/inscricoes.db` (tabela `inscricoes`, coluna `crm_status`).
2. Encaminha ao CRM (`CRM_WEBHOOK_URL`, header `Authorization: Bearer CRM_WEBHOOK_SECRET`) com
   `origemLead = "Método Charão Eduardo"`. Questionário completo vai em `notas`.
3. Responde 201 ao visitante mesmo se o CRM falhar. `crm_status` fica `erro` e `crm_erro` guarda o motivo.

Reenviar pendentes: consultar `SELECT id, email, crm_status FROM inscricoes WHERE crm_status <> 'enviado'`
e repetir o POST manualmente (ver guia `integracao-landing-pages.md` no repositório do CRM).

## Produção (VPS srv1309622)

```bash
sudo mkdir -p /var/www/metodo-charao && cd /var/www/metodo-charao
git clone https://github.com/suporte-charao/MENTORIA-EDUARDO-.git .
cd "BACK END" && npm ci --omit=dev
cp .env.example .env && nano .env   # PORT=3004, CORS_ORIGIN=https://grupocharao.com.br, CRM_WEBHOOK_SECRET=<mesmo do CRM>
pm2 start src/index.js --name metodo-charao-api && pm2 save
curl -s localhost:3004/health
```

nginx (`/etc/nginx/sites-available/api-metodo.charaotechub.com`):

```nginx
server {
    server_name api-metodo.charaotechub.com;
    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api-metodo.charaotechub.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api-metodo.charaotechub.com
```

DNS (Hostinger, zona charaotechub.com): registro `A` `api-metodo` → IP da VPS.

Atualizar: `cd /var/www/metodo-charao && git pull && cd "BACK END" && npm ci --omit=dev && pm2 restart metodo-charao-api`.
```

- [ ] **Step 5: Parar o servidor de teste e commitar**

```bash
kill %1 2>/dev/null
rm -f "BACK END/data/inscricoes.db" "BACK END/data/inscricoes.db-"*
git add "BACK END/src/routes/inscricoes.js" "BACK END/src/index.js" "BACK END/README.md"
git commit -m "feat(api): rota de pré-inscrição, servidor Express e README de deploy"
```

---

### Task 5: Front envia para o backend (honeypot, config, remoção do Supabase)

**Files:**
- Modify: `assets/js/config.js`
- Modify: `assets/js/inscricao.js`
- Modify: `index.html` (honeypot + `?v=`)
- Modify: `assets/css/style.css` (regra `.hp`)
- Modify: `package.json` (raiz)
- Delete: `supabase/schema.sql`

**Interfaces:**
- Consumes: `POST {API_URL}/api/inscricoes` (T4).
- Produces: `window.enviarInscricao(dados)` mantém a assinatura usada por `main.js` (lança em erro).

- [ ] **Step 1: Reescrever `assets/js/config.js`**

```js
// Endereço do backend de pré-inscrição (BACK END/).
// Dev: npm run dev:api sobe em http://localhost:3004.
// Produção: https://api-metodo.charaotechub.com
window.APP_CONFIG = {
  API_URL: location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:3004'
    : 'https://api-metodo.charaotechub.com'
};
```

- [ ] **Step 2: Reescrever `assets/js/inscricao.js`**

```js
// Único ponto de envio das inscrições. Trocar o destino = mexer só aqui.
window.enviarInscricao = async function (dados) {
  const cfg = window.APP_CONFIG || {};
  const res = await fetch((cfg.API_URL || '') + '/api/inscricoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (res.ok) return;
  let msg = 'Falha no envio (' + res.status + ')';
  try {
    const body = await res.json();
    if (body.errors) msg = Object.values(body.errors)[0] || msg;
    else if (body.message) msg = body.message;
  } catch (_) {}
  throw new Error(msg);
};
```

- [ ] **Step 3: Mostrar a mensagem do servidor em `assets/js/main.js`**

No bloco `catch (err)` do submit (linha ~76), trocar:
```js
      console.error(err);
      erro.hidden = false;
```
por:
```js
      console.error(err);
      erro.textContent = err && err.message && !/^Falha no envio/.test(err.message)
        ? err.message
        : 'Não conseguimos enviar agora. Verifique sua conexão e tente de novo.';
      erro.hidden = false;
```

- [ ] **Step 4: Honeypot no `index.html` e no CSS**

Em `index.html`, logo após `<p class="req-note">…</p>` (linha 87), inserir:
```html
        <div class="hp" aria-hidden="true"><label for="website">Site</label><input type="text" id="website" name="website" tabindex="-1" autocomplete="off"></div>
```
Em `assets/css/style.css`, ao final:
```css
/* Honeypot anti-bot: fora da tela, nunca preenchido por pessoas */
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
```
Em `assets/js/main.js`, na função `coletarDados()` (linha ~35), após `dados.consentimento = …`, adicionar:
```js
    dados.website = (fd.get('website') || '').toString();
```

- [ ] **Step 5: Atualizar `?v=` e `package.json`**

Em `index.html`, trocar todas as ocorrências de `?v=202609221615` por `?v=202609222000`:
```bash
sed -i 's/?v=202609221615/?v=202609222000/g' index.html
```
Em `package.json` (raiz), adicionar o script:
```json
    "dev:api": "npm --prefix \"BACK END\" run dev"
```

- [ ] **Step 6: Remover o Supabase**

```bash
git rm -r supabase
```

- [ ] **Step 7: Teste ponta a ponta local**

Run (dois terminais, na raiz do repo):
```bash
npm run dev:api     # terminal 1 (usa BACK END/.env com CRM_FORWARD_ENABLED=false)
npm run dev         # terminal 2
```
No navegador (http://127.0.0.1:8080 ou porta que o live-server escolher — a porta precisa estar em `CORS_ORIGIN`): preencher o form e enviar.
Expected: tela de sucesso, log `POST /api/inscricoes 201` no terminal 1, linha na tabela:
```bash
node -e "const D=require('better-sqlite3');console.log(new D('BACK END/data/inscricoes.db').prepare('select nome,email,crm_status from inscricoes').all())"
```
Depois, enviar de novo com o mesmo e-mail 3 vezes → na 4ª, mensagem "Muitas tentativas…" na tela.

- [ ] **Step 8: Commit**

```bash
git add assets/js/config.js assets/js/inscricao.js assets/js/main.js assets/css/style.css index.html package.json
git commit -m "feat(front): envio da pré-inscrição para o backend próprio, honeypot e remoção do Supabase"
```

---

### Task 6: Metadados de compartilhamento e README da landing

**Files:**
- Modify: `index.html:14-26`
- Modify: `README.md`

- [ ] **Step 1: `og:*` absolutos em `index.html`**

Remover a linha do `TODO` (linha 15) e trocar:
```html
<meta property="og:image" content="assets/img/og-image.jpg">
```
por:
```html
<meta property="og:url" content="https://grupocharao.com.br/charaoeducacional/eduardocharao/">
<meta property="og:image" content="https://grupocharao.com.br/charaoeducacional/eduardocharao/assets/img/og-image.jpg">
```
Adicionar após `<meta name="twitter:card" content="summary">`:
```html
<link rel="canonical" href="https://grupocharao.com.br/charaoeducacional/eduardocharao/">
```

- [ ] **Step 2: Reescrever `README.md`**

```markdown
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
```

- [ ] **Step 3: Conferir no navegador e commitar**

Run: `npm run dev` e abrir; confirmar que nada quebrou visualmente (header, form, footer).
```bash
git add index.html README.md
git commit -m "docs: metadados absolutos de compartilhamento e README atualizado"
```

---

### Task 7: Botão do site do grupo

**Files:**
- Modify: `SITE-CHARAO-main/src/lib/empresas-data.tsx:266`
- Modify: `SITE-CHARAO-main/src/components/sections/EmpresasImersivasSection.tsx:122-125` (comentário TODO)
- Modify: `SITE-CHARAO-main/DEPLOY.md`

- [ ] **Step 1: Verificar estado do repositório do site**

Run: `cd "C:\DESENVOLVIMENTO CLAUDE CODE PRODUÇÃO\SITE-CHARAO-main" && git status -sb && git log --oneline -1`
Expected: árvore limpa (se houver alterações locais não commitadas, parar e avisar o usuário antes de continuar).

- [ ] **Step 2: Adicionar `ctaHref` da Educacional**

Em `src/lib/empresas-data.tsx`, logo antes de `ctaLabel: "Conheça a Charão Educacional",` (linha 266), inserir:
```tsx
    ctaHref: "https://grupocharao.com.br/charaoeducacional/eduardocharao/",
```
O componente já abre links `http` em nova aba com `rel="noopener noreferrer"` (mesmo comportamento da Mentoria Tributária).

- [ ] **Step 3: Atualizar o comentário TODO do componente**

Em `EmpresasImersivasSection.tsx`, trocar o comentário das linhas 122-125 por:
```tsx
                {/* Consultoria ainda sem página própria — preencher `ctaHref`
                    quando o endereço existir. Até lá o fallback leva ao CTA de
                    contato: href="#" rolava a página ao TOPO, o que lia como bug. */}
```

- [ ] **Step 4: Nota no `DEPLOY.md`**

Adicionar ao final da seção "1. Subir os arquivos":
```markdown
> **Subpastas de landing pages:** `public_html/mentoriacharaotributario/` e
> `public_html/charaoeducacional/eduardocharao/` são publicadas pelos repositórios das
> respectivas landings e **não** fazem parte do `out/` deste site. Ao reenviar o site,
> extraia o zip por cima sem apagar essas pastas.
```

- [ ] **Step 5: Build e verificação**

Run: `npm run build`
Expected: build concluído; `out/index.html` contém `href="https://grupocharao.com.br/charaoeducacional/eduardocharao/"` (`grep -c charaoeducacional/eduardocharao out/index.html` ≥ 1).

- [ ] **Step 6: Commit (no repositório do site)**

```bash
git add src/lib/empresas-data.tsx src/components/sections/EmpresasImersivasSection.tsx DEPLOY.md
git commit -m "feat: botão da Charão Educacional abre a landing do Método Charão"
```
Não fazer push nem publicar ainda: a publicação do site é o último passo da Task 8.

---

### Task 8: Publicação (VPS → Hostinger → site do grupo) e aceite

Esta task é operacional. Requer acesso SSH à VPS, ao hPanel da Hostinger e ao `.env` do CRM (para copiar o `WEBHOOK_SECRET`). O executor deve entregar comandos prontos e pedir ao usuário para rodá-los onde a sessão não tiver acesso (ver regra "Claude Code bloqueia escrita em produção").

**Files:** nenhum no repositório (só `.env` na VPS e arquivos no `public_html`).

- [ ] **Step 1: Push das branches**

```bash
cd "C:\DESENVOLVIMENTO CLAUDE CODE PRODUÇÃO\MENTORIA-EDUARDO" && GCM_INTERACTIVE=always git push -u origin feat/integracao-crm
```
Abrir PR `feat/integracao-crm → main` no GitHub e mesclar após revisão (o deploy na VPS clona a `main`).

- [ ] **Step 2: Backend na VPS**

Seguir a seção "Produção" de `BACK END/README.md`: clone em `/var/www/metodo-charao`, `.env` com
`PORT=3004`, `CORS_ORIGIN=https://grupocharao.com.br`, `CRM_WEBHOOK_SECRET=<valor de WEBHOOK_SECRET do .env do CRM>`, PM2, nginx, certbot, DNS.
Verificar:
```bash
curl -s https://api-metodo.charaotechub.com/health
pm2 list | grep metodo-charao-api
```
Expected: `{"status":"ok","service":"metodo-charao-api"}` e processo `online`. Nenhum outro processo PM2 reiniciado (`pm2 list` mostra uptime inalterado nos demais).

- [ ] **Step 3: Teste do webhook a partir da VPS (antes de expor o front)**

```bash
curl -s -X POST https://api-metodo.charaotechub.com/api/inscricoes -H 'Content-Type: application/json' -H 'Origin: https://grupocharao.com.br' -d '{"nome":"Teste Integração","telefone":"92999990000","email":"teste.integracao@charaoconsultoria.com.br","empresa":"Charão (teste)","cargo":"TI","cidade":"Manaus","estado":"AM","faturamento":"Até R$ 500 mil","funcionarios":"1 a 5","problemas":"teste","aprender":"teste","dificuldades":"teste","consentimento":true}'
pm2 logs metodo-charao-api --lines 20 --nostream
```
Expected: `201`; no log nenhuma linha `[crm] webhook respondeu 4xx`. No CRM (leads.charaotechub.com → Meus Leads), lead "Teste Integração" com Fonte "Método Charão Eduardo" e notas com Cidade/UF, Faturamento etc. Excluir o lead de teste no CRM depois.

- [ ] **Step 4: Front na Hostinger**

Montar o pacote local:
```bash
cd "C:\DESENVOLVIMENTO CLAUDE CODE PRODUÇÃO\MENTORIA-EDUARDO" && mkdir -p /tmp/eduardocharao && cp -r index.html assets favicon.ico .htaccess /tmp/eduardocharao/ && (cd /tmp && zip -r eduardocharao.zip eduardocharao)
```
No hPanel do grupocharao.com.br: Gerenciador de Arquivos → `public_html` → criar `charaoeducacional/` → enviar `eduardocharao.zip` dentro dela → extrair → apagar o zip. Resultado: `public_html/charaoeducacional/eduardocharao/index.html`.
Verificar: abrir https://grupocharao.com.br/charaoeducacional/eduardocharao/ e conferir que carrega com CSS/imagens (aba Rede: `assets/css/style.css?v=202609222000` 200).

- [ ] **Step 5: Aceite ponta a ponta em produção**

Enviar uma inscrição real pela URL pública. Conferir: tela de sucesso; lead em Meus Leads; repetir com o mesmo e-mail e conferir que o lead não duplicou (nota "recapturado via integração" anexada). Testar o link no WhatsApp para ver a `og:image`.

- [ ] **Step 6: Publicar o site do grupo**

Backup primeiro: no hPanel, compactar `public_html` em `backup-public_html-2026-09-22.zip` (fora da pasta ou apagar depois).
Depois: `cd SITE-CHARAO-main && npm run build`, zipar `out/` e extrair em `public_html` por cima, **sem apagar** `charaoeducacional/` nem `mentoriacharaotributario/`.
Verificar: no site, clicar em "Conheça a Charão Educacional" → abre a landing em nova aba. Commitar/push do repositório do site.

- [ ] **Step 7: Registrar conclusão**

Marcar o checklist de aceite do `README.md` da landing, mesclar o PR se ainda não foi e atualizar a memória do projeto (arquivo `mentoria-eduardo-projeto.md`) com: URLs, porta, nome PM2, data de publicação e pendência de rotação do `WEBHOOK_SECRET`.
