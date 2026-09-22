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
