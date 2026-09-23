const NOTAS_MAX = 1900 // corte de segurança final do texto completo enviado ao CRM
const RESPOSTA_MAX = 550 // corte por resposta longa (problemas/aprender/dificuldades), antes do corte final

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

// Corta por code point (não por code unit) para nunca partir um par substituto (emoji etc.).
function cortarTexto(texto, max) {
  const chars = Array.from(texto)
  if (chars.length <= max) return texto
  return chars.slice(0, max).join('') + '…'
}

function montarNotas(i) {
  const linhas = [
    `Cidade/UF: ${i.cidade}/${i.estado}`,
    `Faturamento: ${i.faturamento}`,
    `Funcionários: ${i.funcionarios}`,
    `Problemas: ${cortarTexto(i.problemas, RESPOSTA_MAX)}`,
    `Quer aprender: ${cortarTexto(i.aprender, RESPOSTA_MAX)}`,
    `Dificuldades: ${cortarTexto(i.dificuldades, RESPOSTA_MAX)}`,
  ]
  const texto = linhas.join('\n')
  return texto.length > NOTAS_MAX ? cortarTexto(texto, NOTAS_MAX - 1) : texto
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
      redirect: 'error',
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
