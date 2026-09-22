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
    faturamento, funcionarios, problemas, aprender, dificuldades, consentimento)
  VALUES (@id, @nome, @telefone, @email, @empresa, @cargo, @cidade, @estado,
    @faturamento, @funcionarios, @problemas, @aprender, @dificuldades, @consentimento)
`)

const updateCrm = db.prepare(`
  UPDATE inscricoes SET crm_status = @status, crm_lead_id = @leadId, crm_erro = @erro WHERE id = @id
`)

export function saveInscricao(inscricao) {
  insert.run({ ...inscricao, consentimento: inscricao.consentimento ? 1 : 0 })
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
