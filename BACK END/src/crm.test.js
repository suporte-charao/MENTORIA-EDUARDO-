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

test('resposta longa é truncada por campo, sem afetar as demais', () => {
  const p = buildCrmPayload({ ...insc, problemas: 'x'.repeat(3000) }, cfg)
  assert.ok(p.notas.includes('Quer aprender: Indicadores'))
  assert.ok(p.notas.includes('Dificuldades: Time'))
})

test('notas com as três respostas longas ficam dentro do corte de segurança de 1900', () => {
  const p = buildCrmPayload({
    ...insc,
    problemas: 'x'.repeat(3000),
    aprender: 'y'.repeat(3000),
    dificuldades: 'z'.repeat(3000),
  }, cfg)
  assert.ok(p.notas.length <= 1900)
  assert.ok(p.notas.includes('Problemas:'))
  assert.ok(p.notas.includes('Quer aprender:'))
  assert.ok(p.notas.includes('Dificuldades:'))
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
  assert.equal(captured.opts.redirect, 'error')
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
