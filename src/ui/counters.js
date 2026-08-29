import { gsap } from './scroll.js';

/** Count [data-count] elements up to their target the first time they land. */
export function initCounters() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const obj = { v: 0 };

    gsap.to(obj, {
      v: target,
      duration: 2.1,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onUpdate() {
        el.textContent = obj.v.toLocaleString('en-AU', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      },
    });
  });
}
