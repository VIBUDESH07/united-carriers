/** Accordion. Heights are measured per open so answers can hold any content. */
export function initFaq() {
  const items = [...document.querySelectorAll('[data-faq-item]')];

  items.forEach((item) => {
    const btn = item.querySelector('[data-faq-toggle]');
    const panel = item.querySelector('[data-faq-panel]');
    if (!btn || !panel) return;

    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      // Single-open accordion: close whatever else is showing.
      items.forEach((other) => {
        if (other === item) return;
        other.classList.remove('is-open');
        const p = other.querySelector('[data-faq-panel]');
        const b = other.querySelector('[data-faq-toggle]');
        if (p) p.style.height = '0px';
        if (b) b.setAttribute('aria-expanded', 'false');
      });

      item.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      panel.style.height = isOpen ? '0px' : panel.scrollHeight + 'px';
    });
  });

  // Keep an open panel correctly sized when the text reflows.
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      document.querySelectorAll('[data-faq-item].is-open [data-faq-panel]').forEach((p) => {
        p.style.height = p.scrollHeight + 'px';
      });
    }, 150);
  }, { passive: true });
}
