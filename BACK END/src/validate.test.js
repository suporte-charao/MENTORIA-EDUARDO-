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
