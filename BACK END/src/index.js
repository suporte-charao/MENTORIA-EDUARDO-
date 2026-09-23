import './env.js'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import inscricoesRouter from './routes/inscricoes.js'
import { dbPath } from './db.js'
import { getCrmConfig } from './crm.js'

const PORT = Number(process.env.PORT) || 3004
const HOST = process.env.HOST || '127.0.0.1'

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080,http://127.0.0.1:8080')
  .split(',').map((o) => o.trim()).filter(Boolean)

const crm = getCrmConfig()
if (crm.enabled && crm.url && !crm.url.startsWith('https://')) {
  console.error('[crm] CRM_WEBHOOK_URL precisa ser https://')
  process.exit(1)
}

const app = express()
app.set('trust proxy', 1) // atrás do nginx: rate limit por IP real

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) callback(null, true)
    else callback(new Error(`CORS bloqueado: ${origin}`))
  },
  methods: ['POST', 'GET'],
}))

// Antes do express.json(): corpo malformado/grande também conta na cota por IP.
app.use('/api/inscricoes', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
}))

app.use(express.json({ limit: '32kb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'metodo-charao-api' }))
app.use('/api/inscricoes', inscricoesRouter)

app.use((_req, res) => res.status(404).json({ message: 'Rota não encontrada.' }))
app.use((err, _req, res, _next) => {
  if (err.message?.startsWith('CORS bloqueado')) return res.status(403).json({ message: 'Origem não permitida.' })
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({
      errors: { _form: err.type === 'entity.parse.failed' ? 'JSON inválido.' : 'Requisição inválida.' },
    })
  }
  console.error('[api] erro não tratado:', err)
  res.status(500).json({ message: 'Erro interno.' })
})

app.listen(PORT, HOST, () => {
  console.log(`metodo-charao-api em http://${HOST}:${PORT}`)
  console.log(`SQLite: ${dbPath}`)
  console.log(`CORS: ${corsOrigins.join(', ')}`)
  console.log(`CRM: ${crm.enabled && crm.secret ? 'ligado → ' + crm.url : 'DESLIGADO'}`)
})
