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
    console.warn('[inscricoes] honeypot acionado', { ip: req.ip })
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
