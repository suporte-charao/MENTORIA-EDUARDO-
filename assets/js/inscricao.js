// Único ponto de envio das inscrições. Trocar o destino = mexer só aqui.
window.enviarInscricao = async function (dados) {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.info('[modo teste] inscrição não enviada:', dados);
    await new Promise(r => setTimeout(r, 600));
    return;
  }
  const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + cfg.TABELA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': cfg.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(dados)
  });
  if (!res.ok) throw new Error('Falha no envio (' + res.status + ')');
};
