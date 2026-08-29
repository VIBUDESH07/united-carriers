import { gsap } from './scroll.js';

/**
 * Small site-wide motion: the things you feel rather than notice.
 *
 * Deliberately DOM-level and cheap — magnetic buttons, a scroll-progress rail,
 * scramble-in labels, and velocity skew on media. Nothing here wraps the page
 * in a transform, which would create a stacking context and break the shared
 * WebGL canvas layering.
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = () => window.matchMedia('(hover: none)').matches;

/** Buttons lean toward the cursor, and their label leans a little further. */
function magnetic() {
  if (coarse()) return;
  const PULL = 0.32;
  const RADIUS = 90;

  document.querySelectorAll('.btn, [data-magnetic]').forEach((el) => {
    let raf = 0, tx = 0, ty = 0, x = 0, y = 0;
    const label = el.querySelector('.arrow');

    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      if (label) label.style.transform = `translate3d(${(x * 0.5).toFixed(2)}px, 0, 0)`;
      if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(tick); };

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      // Only pull once the cursor is genuinely close to the control.
      const d = Math.hypot(dx, dy);
      const k = Math.max(0, 1 - d / (RADIUS + r.width / 2));
      tx = dx * PULL * k;
      ty = dy * PULL * k;
      start();
    });
    el.addEventListener('pointerleave', () => { tx = 0; ty = 0; start(); });
  });
}

/** A hairline rail across the top showing how far through the page you are. */
function progressRail() {
  const rail = document.createElement('div');
  rail.className = 'scroll-rail';
  const fill = document.createElement('i');
  rail.appendChild(fill);
  document.body.appendChild(rail);

  let raf = 0;
  const paint = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    fill.style.transform = `scaleX(${Math.min(1, Math.max(0, p)).toFixed(4)})`;
    raf = 0;
  };
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
  paint();
}

/**
 * Mono labels resolve out of noise, which suits copy that reads like a spec
 * sheet. Only the label characters are cycled; spacing is preserved so nothing
 * reflows while it settles.
 */
function scrambleLabels() {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—';

  document.querySelectorAll('.eyebrow, [data-scramble]').forEach((el) => {
    const text = el.textContent;
    if (!text.trim() || text.length > 60) return;

    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      let frame = 0;
      const total = 22;
      const id = setInterval(() => {
        frame++;
        const settled = Math.floor((frame / total) * text.length);
        el.textContent = text
          .split('')
          .map((c, i) => {
            if (i < settled || c === ' ') return c;
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('');
        if (frame >= total) { clearInterval(id); el.textContent = text; }
      }, 26);
    };

    new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) { run(); obs.disconnect(); }
    }, { rootMargin: '-10% 0px' }).observe(el);
  });
}

/** Media leans with scroll speed, so fast scrolling has some weight to it. */
function velocitySkew() {
  const targets = [...document.querySelectorAll('[data-velocity], .card__media, .pcard__media')];
  if (!targets.length) return;

  let last = window.scrollY;
  let vel = 0;
  let raf = 0;

  const tick = () => {
    // Ease the velocity back to rest so the lean releases rather than snapping.
    vel *= 0.88;
    const skew = gsap.utils.clamp(-5, 5, vel * 0.12);
    targets.forEach((t) => { t.style.transform = `skewY(${skew.toFixed(3)}deg)`; });
    if (Math.abs(vel) > 0.15) raf = requestAnimationFrame(tick);
    else { targets.forEach((t) => { t.style.transform = ''; }); raf = 0; }
  };

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    vel = y - last;
    last = y;
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
}

/** The footer sits under the page and is uncovered as you reach the end. */
function footerReveal() {
  const footer = document.querySelector('.footer');
  if (!footer) return;
  gsap.fromTo(footer.querySelector('.wrap'),
    { yPercent: -14, opacity: 0.45 },
    {
      yPercent: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top 55%', scrub: 0.5 },
    });
}

export function initFlourish() {
  progressRail();
  if (reduced()) return;
  magnetic();
  scrambleLabels();
  velocitySkew();
  footerReveal();
}
