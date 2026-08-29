/**
 * Defer the WebGL bundle without leaving the page looking broken.
 *
 * three.js plus the scenes is the largest thing this site ships and none of it
 * is needed for first paint, so it is never a static import. But *when* to pull
 * it depends on where the scene actually is:
 *
 *   - A stage that is already on screen (every page header carries one) is part
 *     of the first impression. Waiting for a scroll would leave the header half
 *     empty. Those load as soon as the page has finished its own load and the
 *     main thread is idle — off the critical path, but without a delay the
 *     reader would notice.
 *
 *   - Everything below the fold waits: the reader passing `scrollFraction` of
 *     the page (15% by default), or the stage arriving within `rootMargin`,
 *     whichever comes first.
 *
 *   - A timeout backstops both, so an odd layout never leaves the page flat.
 */
export function whenGLNeeded(load, { rootMargin = '200px', scrollFraction = 0.15 } = {}) {
  const slots = [...document.querySelectorAll('[data-gl]')];
  if (!slots.length) return;

  let fired = false;
  let io = null;

  const go = () => {
    if (fired) return;
    fired = true;
    if (io) io.disconnect();
    window.removeEventListener('scroll', onScroll);
    // Never start the import inside a paint; let the browser settle first.
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 400 });
    else setTimeout(load, 1);
  };

  // Which stages are on screen right now?
  const vh = window.innerHeight;
  const above = [];
  const below = [];
  slots.forEach((el) => {
    const r = el.getBoundingClientRect();
    (r.top < vh && r.bottom > 0 ? above : below).push(el);
  });

  if (above.length) {
    // Part of the header, so it must not wait for a scroll.
    //
    // Deliberately NOT gated on window.load: that waits for every image on the
    // page, which on an image-heavy page (and especially on an uncached dev
    // server) leaves the header empty for seconds. DOM-ready plus a frame is
    // enough to stay off the critical path.
    const soon = () => requestAnimationFrame(() => setTimeout(go, 60));
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', soon, { once: true });
    } else {
      soon();
    }
  }

  // Below-the-fold stages get the deferred treatment.
  if (below.length) {
    io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) go();
    }, { rootMargin });
    below.forEach((el) => io.observe(el));
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= scrollFraction) go();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();   // covers a reload that restores a scroll position

  setTimeout(go, 6000);
}
