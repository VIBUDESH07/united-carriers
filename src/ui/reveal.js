import { gsap, ScrollTrigger } from './scroll.js';

/**
 * Wrap every word of an element in a masked span so it can be swept up into
 * place. Spans are kept inline-block inside an overflow-hidden parent, which is
 * what gives the line-by-line reveal its clipped edge.
 */
function splitWords(el) {
  if (el.dataset.split === 'done') return [...el.querySelectorAll('.word > span')];
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.textContent = '';
  const frag = document.createDocumentFragment();

  text.split(' ').forEach((w, i, arr) => {
    const outer = document.createElement('span');
    outer.className = 'word';
    const inner = document.createElement('span');
    inner.textContent = w + (i < arr.length - 1 ? ' ' : '');
    outer.appendChild(inner);
    frag.appendChild(outer);
  });

  el.appendChild(frag);
  el.dataset.split = 'done';
  return [...el.querySelectorAll('.word > span')];
}

export function initReveals() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    document.querySelectorAll('[data-reveal], [data-split-text]').forEach((el) => {
      el.style.opacity = 1;
      el.style.transform = 'none';
    });
    return;
  }

  // Headlines: words rise out of their mask.
  document.querySelectorAll('[data-split-text]').forEach((el) => {
    const words = splitWords(el);
    el.style.opacity = 1;
    gsap.set(words, { yPercent: 115 });
    gsap.to(words, {
      yPercent: 0,
      duration: 0.95,
      stagger: 0.035,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  // Everything else: a short fade-up, optionally staggered across children.
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const mode = el.dataset.reveal;
    const targets = mode === 'children' ? [...el.children] : [el];
    gsap.set(targets, { y: 34, opacity: 0 });
    gsap.to(targets, {
      y: 0,
      opacity: 1,
      duration: 0.9,
      stagger: mode === 'children' ? 0.08 : 0,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  // Panels that scale up slightly as they enter.
  document.querySelectorAll('[data-scale-in]').forEach((el) => {
    gsap.fromTo(el,
      { scale: 0.94, opacity: 0 },
      {
        scale: 1, opacity: 1, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
  });

  // Slow vertical drift for decorative layers.
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const amount = parseFloat(el.dataset.parallax) || 60;
    gsap.to(el, {
      y: -amount,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  ScrollTrigger.refresh();
}
