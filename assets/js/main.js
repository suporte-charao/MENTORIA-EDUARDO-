(function () {
  const form = document.getElementById('form');
  const tel = document.getElementById('telefone');
  const btn = form.querySelector('button[type=submit]');
  const erro = document.getElementById('formError');

  tel.addEventListener('input', () => {
    let d = tel.value.replace(/\D/g, '').slice(0, 11), out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(d.length - 4);
    tel.value = out;
  });
  document.querySelectorAll('[data-count-for]').forEach(el => {
    const ta = document.getElementById(el.dataset.countFor);
    ta.addEventListener('input', () => { el.textContent = ta.value.length; });
  });
  const fields = Array.from(form.querySelectorAll('[data-req]'));
  function isValid(f) {
    if (f.dataset.group) return !!form.querySelector('input[name="' + f.dataset.group + '"]:checked');
    const el = f.querySelector('input, textarea, select'), v = (el.value || '').trim();
    if (el.tagName === 'SELECT') return v !== '';
    if (el.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    if (el.type === 'tel') return v.replace(/\D/g, '').length >= 10;
    if (el.id === 'nome') return v.split(/\s+/).filter(Boolean).length >= 2;
    return v.length >= 3;
  }
  function updateProgress() {
    const total = fields.length + 1;
    const done = fields.filter(isValid).length + (document.getElementById('consent').checked ? 1 : 0);
    const pct = Math.round(done / total * 100);
    document.getElementById('bar').style.width = pct + '%';
    document.getElementById('progressLabel').textContent = pct + '% concluído';
  }
  function coletarDados() {
    const fd = new FormData(form), dados = {};
    ['nome', 'telefone', 'email', 'empresa', 'cargo', 'cidade', 'estado', 'faturamento',
     'funcionarios', 'problemas', 'aprender', 'dificuldades']
      .forEach(k => { dados[k] = (fd.get(k) || '').toString().trim(); });
    dados.consentimento = document.getElementById('consent').checked;
    return dados;
  }
  form.addEventListener('input', e => {
    const f = e.target.closest('[data-req]');
    if (f && f.classList.contains('invalid') && isValid(f)) f.classList.remove('invalid');
    if (e.target.id === 'consent' && e.target.checked) document.getElementById('consentWrap').classList.remove('invalid');
    updateProgress();
  });
  // Aponta o erro assim que a pessoa sai do campo (só se já digitou algo)
  form.addEventListener('focusout', e => {
    const f = e.target.closest('[data-req]');
    if (!f || f.dataset.group || !e.target.value.trim()) return;
    f.classList.toggle('invalid', !isValid(f));
  });
  form.addEventListener('change', updateProgress);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (btn.disabled) return;
    let first = null;
    fields.forEach(f => { const ok = isValid(f); f.classList.toggle('invalid', !ok); if (!ok && !first) first = f; });
    const consent = document.getElementById('consent'), cw = document.getElementById('consentWrap');
    cw.classList.toggle('invalid', !consent.checked);
    if (!consent.checked && !first) first = cw;
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const el = first.querySelector('input:not([type=radio]), textarea, select');
      if (el) setTimeout(() => el.focus({ preventScroll: true }), 350);
      return;
    }
    erro.hidden = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    try {
      await window.enviarInscricao(coletarDados());
    } catch (err) {
      console.error(err);
      erro.hidden = false;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      return;
    }
    document.getElementById('firstName').textContent = document.getElementById('nome').value.trim().split(/\s+/)[0];
    form.style.display = 'none';
    document.getElementById('bar').style.width = '100%';
    document.getElementById('progressLabel').textContent = 'Enviado';
    const s = document.getElementById('success');
    s.classList.add('show');
    s.scrollIntoView({ behavior: 'smooth', block: 'center' });
    irParaInstagram();
  });

  // Depois da confirmação, leva ao Instagram do J. Eduardo com contagem visível
  function irParaInstagram() {
    const link = document.getElementById('igLink');
    const nota = document.getElementById('redirectNote');
    const cont = document.getElementById('countdown');
    let restante = 10;
    nota.hidden = false;
    const t = setInterval(() => {
      restante -= 1;
      cont.textContent = restante;
      if (restante <= 0) { clearInterval(t); window.location.href = link.href; }
    }, 1000);
    link.addEventListener('click', () => clearInterval(t));
  }
  updateProgress();
})();
