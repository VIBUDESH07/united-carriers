import { gsap, ScrollTrigger } from './scroll.js';

/**
 * Products page motion.
 *
 * A sticky index down the side that marks the product currently in view, plus
 * scrubbed parallax on each product photo so the column has some depth as it
 * passes. Both are no-ops on any page without [data-product-index].
 */
export function initProductIndex() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rows = [...document.querySelectorAll('[data-product]')];
  if (!rows.length) return;

  // --- Parallax + entry for each product photo -----------------------------
  rows.forEach((row) => {
    const media = row.querySelector('.prod__media img');
    const body = row.querySelector('.prod__body');
    if (!media || reduced) return;

    // Photo drifts against the scroll; the frame stays put.
    gsap.fromTo(media,
      { yPercent: -8, scale: 1.14 },
      {
        yPercent: 8, scale: 1.14, ease: 'none',
        scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: true },
      });

    gsap.from(row.querySelector('.prod__media'), {
      clipPath: 'inset(100% 0 0 0)', duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: row, start: 'top 82%', once: true },
    });

    if (body) {
      gsap.from(body.children, {
        y: 30, opacity: 0, duration: 0.85, stagger: 0.07, ease: 'power3.out',
        scrollTrigger: { trigger: row, start: 'top 78%', once: true },
      });
    }
  });

  // --- Sticky index --------------------------------------------------------
  const index = document.querySelector('[data-product-index]');
  if (!index) return;

  const links = [...index.querySelectorAll('a')];
  const mark = (slug) => {
    links.forEach((l) => l.classList.toggle('is-active', l.dataset.jump === slug));
    const bar = index.querySelector('[data-index-bar]');
    const active = links.find((l) => l.classList.contains('is-active'));
    if (bar && active) {
      bar.style.transform = `translateY(${active.offsetTop}px)`;
      bar.style.height = active.offsetHeight + 'px';
    }
  };

  rows.forEach((row) => {
    ScrollTrigger.create({
      trigger: row,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) mark(row.dataset.product); },
    });
  });

  links.forEach((l) => {
    l.addEventListener('click', (e) => {
      const target = document.getElementById(l.dataset.jump);
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - 90;
      import('./scroll.js').then(({ lenis }) => {
        if (lenis) lenis.scrollTo(y);
        else window.scrollTo({ top: y, behavior: 'smooth' });
      });
    });
  });

  mark(rows[0].dataset.product);
}
