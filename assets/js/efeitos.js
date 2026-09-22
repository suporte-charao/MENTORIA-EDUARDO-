// Revela elementos marcados com [data-reveal] / [data-line] quando entram na tela.
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('fx')) return;
  const els = document.querySelectorAll('[data-reveal], [data-line]');
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('is-in')); return; }
  const reveal = (entries, obs) => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    obs.unobserve(e.target);
  });
  const io = new IntersectionObserver(reveal, { rootMargin: '0px 0px -10% 0px' });
  // O rodapé encosta no fim da página e nunca passaria da margem de 10%
  const ioFim = new IntersectionObserver(reveal);
  els.forEach(el => (el.closest('footer') ? ioFim : io).observe(el));
  // Se o foco cair num campo ainda oculto (tab, autofill, erro), revela na hora
  document.addEventListener('focusin', e => {
    const el = e.target.closest('[data-reveal]');
    if (el) el.classList.add('is-in');
  });
})();
