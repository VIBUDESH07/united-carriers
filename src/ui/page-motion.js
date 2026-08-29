import { gsap, ScrollTrigger } from './scroll.js';

/**
 * Motion for the inner pages.
 *
 * The home page carries the scrubbed WebGL acts; these pages are mostly type
 * and cards, so the movement here is scroll-linked rather than 3D — parallax on
 * the headers, lines that draw themselves, and media that uncovers as it
 * arrives. All of it is skipped under reduced-motion.
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Hero type drifts up slower than the page, and its backdrop drifts down. */
function heroParallax() {
  const hero = document.querySelector('.page-hero');
  if (!hero) return;

  const title = hero.querySelector('.page-hero__title');
  const sub = hero.querySelector('.page-hero__sub');
  const bg = hero.querySelector('.page-hero__bg');

  const tl = gsap.timeline({
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4 },
  });

  if (title) tl.to(title, { yPercent: -18, ease: 'none' }, 0);
  if (sub) tl.to(sub, { yPercent: -34, opacity: 0.25, ease: 'none' }, 0);
  // The 3D backdrop sinks a little, so the layers separate as you leave.
  if (bg) tl.to(bg, { yPercent: 12, ease: 'none' }, 0);
}

/** A rule under each section head that draws across as the head arrives. */
function drawRules() {
  document.querySelectorAll('[data-rule]').forEach((el) => {
    gsap.fromTo(el,
      { scaleX: 0 },
      {
        scaleX: 1, duration: 1.1, ease: 'expo.out', transformOrigin: 'left center',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      });
  });
}

/** Vertical spine on the sourcing timeline, filling as you read down it. */
function drawSpine() {
  document.querySelectorAll('[data-spine]').forEach((spine) => {
    const fill = spine.querySelector('[data-spine-fill]');
    if (!fill) return;
    gsap.fromTo(fill,
      { scaleY: 0 },
      {
        scaleY: 1, ease: 'none', transformOrigin: 'top center',
        scrollTrigger: { trigger: spine, start: 'top 72%', end: 'bottom 60%', scrub: 0.5 },
      });
  });

  // Each stop lights up as the spine passes it.
  document.querySelectorAll('[data-spine] .tl').forEach((li) => {
    ScrollTrigger.create({
      trigger: li,
      start: 'top 68%',
      end: 'bottom 40%',
      onToggle: (self) => li.classList.toggle('is-live', self.isActive),
    });
  });
}

/** Media uncovers rather than fading, and drifts inside its frame. */
function revealMedia() {
  document.querySelectorAll('[data-uncover]').forEach((frame) => {
    const img = frame.querySelector('img');

    gsap.fromTo(frame,
      { clipPath: 'inset(0% 0% 100% 0%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.15, ease: 'expo.out',
        scrollTrigger: { trigger: frame, start: 'top 88%', once: true },
      });

    if (img) {
      // Counter-move so the photo is never static behind its own frame.
      gsap.fromTo(img,
        { scale: 1.18, yPercent: -4 },
        {
          scale: 1, yPercent: 4, ease: 'none',
          scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        });
    }
  });
}

/** Grid children arrive in a diagonal sweep rather than all at once. */
function sweepGrids() {
  document.querySelectorAll('[data-sweep]').forEach((grid) => {
    const kids = [...grid.children];
    if (!kids.length) return;
    gsap.set(kids, { y: 42, opacity: 0 });
    gsap.to(kids, {
      y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
      stagger: { each: 0.06, from: 'start' },
      scrollTrigger: { trigger: grid, start: 'top 86%', once: true },
    });
  });
}

/** Big statements settle as they cross the middle of the screen. */
function settleStatements() {
  document.querySelectorAll('[data-settle]').forEach((el) => {
    gsap.fromTo(el,
      { scale: 0.96, opacity: 0, y: 30 },
      {
        scale: 1, opacity: 1, y: 0, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
  });
}

export function initPageMotion() {
  if (reduced()) {
    document.querySelectorAll('[data-uncover]').forEach((f) => { f.style.clipPath = 'none'; });
    return;
  }
  heroParallax();
  drawRules();
  drawSpine();
  revealMedia();
  sweepGrids();
  settleStatements();
  ScrollTrigger.refresh();
}
