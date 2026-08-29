import { initScroll, gsap, ScrollTrigger } from './ui/scroll.js';
import { initChrome } from './ui/chrome.js';
import { initContent } from './ui/content.js';
import { initTransitions } from './ui/transition.js';
import { initReveals } from './ui/reveal.js';
import { initCounters } from './ui/counters.js';
import { initMarquees } from './ui/marquee.js';
import { initFaq } from './ui/faq.js';
import { initTestimonials } from './ui/testimonials.js';
import { initNav } from './ui/nav.js';
import { initCursor } from './ui/cursor.js';
import { initFlourish } from './ui/flourish.js';
import { initStages } from './ui/stages.js';
import { initTilt } from './ui/tilt.js';
import { whenGLNeeded } from './ui/lazy-gl.js';

/* -------------------------------------------------------------------------
   Preloader. Deliberately independent of WebGL — the page is readable long
   before three.js arrives, so holding the curtain for it would be a lie.
   ------------------------------------------------------------------------- */
function initLoader(onDone) {
  const loader = document.querySelector('[data-loader]');
  const bar = document.querySelector('[data-loader-bar]');
  const pct = document.querySelector('[data-loader-pct]');

  const state = { p: 0 };
  let settled = false;

  const paint = () => {
    if (bar) bar.style.width = state.p * 100 + '%';
    if (pct) pct.textContent = Math.round(state.p * 100);
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    gsap.to(state, {
      p: 1, duration: 0.4, ease: 'power2.out', onUpdate: paint,
      onComplete() {
        document.documentElement.classList.remove('is-loading');
        if (loader) {
          gsap.to(loader, {
            clipPath: 'inset(0 0 100% 0)', duration: 0.85, ease: 'expo.inOut',
            onComplete: () => loader.remove(),
          });
        }
        onDone && onDone();
      },
    });
  };

  // Creep forward while fonts and CSS settle, then finish on load.
  gsap.to(state, { p: 0.8, duration: 1.1, ease: 'power1.out', onUpdate: paint });
  if (document.readyState === 'complete') setTimeout(finish, 250);
  else window.addEventListener('load', () => setTimeout(finish, 250));
  setTimeout(finish, 2600);

  paint();
}

/** Hero entrance — text only, so it never waits on the 3D. */
function playIntro() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    document.querySelectorAll('.hero__title .line, .scroll-hint').forEach((el) => {
      el.style.opacity = 1;
    });
    return;
  }
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .from('.hero__title .line', { yPercent: 108, opacity: 0, duration: 1.15, stagger: 0.09 })
    .from('.scroll-hint', { opacity: 0, duration: 0.8 }, '-=0.6')
    .from('.header__inner > *', { y: -22, opacity: 0, duration: 0.7, stagger: 0.06 }, '-=1.1');
}

function boot() {
  initChrome();
  initContent();   // before reveals, so new nodes get their triggers          // header/footer must exist before anything queries them
  initScroll();
  initTransitions();
  initNav();
  initCursor();
  initFlourish();

  initStages();
  initReveals();
  initCounters();
  initMarquees();
  initFaq();
  initTestimonials();
  initTilt();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  initLoader(playIntro);

  // three.js and the acts arrive only once a 3D slot is close to the viewport.
  whenGLNeeded(async () => {
    const { mountHome } = await import('./gl/mount-home.js');
    const scenes = mountHome();
    if (scenes.globe) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.to(scenes.globe.reveal, { v: 1, duration: reduced ? 0.3 : 2.2, ease: 'power2.out' });
    }
    ScrollTrigger.refresh();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
