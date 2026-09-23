// Único ponto de envio das inscrições. Trocar o destino = mexer só aqui.
window.enviarInscricao = async function (dados) {
  const cfg = window.APP_CONFIG || {};
  let res;
  try {
    res = await fetch((cfg.API_URL || '') + '/api/inscricoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(dados)
    });
  } catch (_) {
    throw new Error('Falha no envio (rede)');
  }
  if (res.ok) return;
  let msg = null;
  try {
    const body = await res.json();
    if (body.errors) msg = Object.values(body.errors)[0] || null;
    else if (body.message) msg = body.message;
  } catch (_) {}
  if (msg) throw Object.assign(new Error(msg), { exibir: true });
  throw new Error('Falha no envio (' + res.status + ')');
};
