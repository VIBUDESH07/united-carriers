import { initScroll, gsap, ScrollTrigger } from './ui/scroll.js';
import { initChrome } from './ui/chrome.js';
import { initContent } from './ui/content.js';
import { initTransitions } from './ui/transition.js';
import { initReveals } from './ui/reveal.js';
import { initCounters } from './ui/counters.js';
import { initMarquees } from './ui/marquee.js';
import { initFaq } from './ui/faq.js';
import { initNav } from './ui/nav.js';
import { initCursor } from './ui/cursor.js';
import { initFlourish } from './ui/flourish.js';
import { initForm } from './ui/form.js';
import { initRoles } from './ui/roles.js';
import { initTilt } from './ui/tilt.js';
import { initProductIndex } from './ui/product-index.js';
import { initPageMotion } from './ui/page-motion.js';
import { initStages } from './ui/stages.js';
import { whenGLNeeded } from './ui/lazy-gl.js';

/**
 * Entry point for the inner pages. Same chrome, scroll and reveal system as the
 * home page; WebGL is deferred the same way and pulls a smaller bundle.
 */
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
      p: 1, duration: 0.3, ease: 'power2.out', onUpdate: paint,
      onComplete() {
        document.documentElement.classList.remove('is-loading');
        if (loader) gsap.to(loader, {
          autoAlpha: 0, duration: 0.45, onComplete: () => loader.remove(),
        });
        onDone && onDone();
      },
    });
  };

  gsap.to(state, { p: 0.8, duration: 0.9, ease: 'power1.out', onUpdate: paint });
  if (document.readyState === 'complete') setTimeout(finish, 200);
  else window.addEventListener('load', () => setTimeout(finish, 200));
  setTimeout(finish, 2200);
  paint();
}

function playIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .from('.page-hero .eyebrow', { y: 18, opacity: 0, duration: 0.7 }, 0.1)
    .from('.page-hero__title .line', { yPercent: 108, opacity: 0, duration: 1.0, stagger: 0.08 }, 0.15)
    .from('.page-hero__sub', { y: 26, opacity: 0, duration: 0.8 }, 0.45);
}

function boot() {
  initChrome();
  initContent();   // before reveals, so new nodes get their triggers
  initScroll();
  initTransitions();
  initNav();
  initCursor();
  initFlourish();

  initReveals();
  initCounters();
  initMarquees();
  initFaq();
  initRoles();
  initForm();
  initTilt();
  initProductIndex();
  initPageMotion();
  initStages();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  initLoader(playIntro);

  whenGLNeeded(async () => {
    const { mountPage } = await import('./gl/mount-page.js');
    const scenes = mountPage();
    if (scenes.hero) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        scenes.hero.reveal.v = 1;
      } else {
        gsap.to(scenes.hero.reveal, { v: 1, duration: 1.6, ease: 'power2.out' });
        // Belt and braces: if the tween is ever missed the header must still
        // fill in rather than sit empty.
        setTimeout(() => { scenes.hero.reveal.v = Math.max(scenes.hero.reveal.v, 1); }, 2600);
      }
    }
    ScrollTrigger.refresh();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
