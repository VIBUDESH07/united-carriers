import { gsap } from './scroll.js';

/**
 * Page transitions.
 *
 * The site is a genuine multi-page build, so navigation is a real document
 * load. A wipe covers the swap: it closes over the outgoing page, the browser
 * navigates, and the incoming page opens it again — which hides the flash of an
 * unstyled first paint while the WebGL scenes warm up.
 */
function makeCurtain() {
  let el = document.querySelector('.curtain');
  if (el) return el;
  el = document.createElement('div');
  el.className = 'curtain';
  el.innerHTML = '<span class="curtain__mark">UC</span>';
  document.body.appendChild(el);
  return el;
}

export function initTransitions() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const curtain = makeCurtain();

  // Opening move: reveal this page.
  if (reduced) {
    curtain.style.display = 'none';
  } else {
    gsap.set(curtain, { yPercent: 0 });
    gsap.to(curtain, {
      yPercent: -100, duration: 0.85, ease: 'expo.inOut', delay: 0.05,
      onComplete: () => { curtain.style.pointerEvents = 'none'; },
    });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

    // External links leave normally.
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) return;

    e.preventDefault();
    document.documentElement.classList.remove('nav-open');

    if (reduced) { location.href = url.href; return; }

    curtain.style.pointerEvents = 'auto';
    gsap.fromTo(curtain,
      { yPercent: 100 },
      {
        yPercent: 0, duration: 0.6, ease: 'expo.inOut',
        onComplete: () => { location.href = url.href; },
      });
  });

  // Coming back via the bfcache should not leave the curtain down.
  window.addEventListener('pageshow', (ev) => {
    if (ev.persisted) gsap.set(curtain, { yPercent: -100 });
  });
}
