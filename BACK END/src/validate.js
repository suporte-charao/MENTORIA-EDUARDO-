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
