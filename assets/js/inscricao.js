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
