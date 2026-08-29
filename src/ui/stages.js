/**
 * Progress of a pinned track: 0 when its sticky child locks to the top, 1 when
 * the track scrolls out from under it.
 *
 * Deliberately re-implemented here rather than imported from gl/util.js — that
 * module imports three, and a static import from an eagerly-loaded UI file
 * would pull the whole 3D bundle into the critical path and defeat the lazy
 * loading.
 */
function trackProgress(track) {
  if (!track) return 0;
  const r = track.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  if (span <= 0) return 0;
  const p = -r.top / span;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/**
 * Copy staged against a pinned act.
 *
 * Any element inside a [data-act-track] carrying data-stage="in,out" fades and
 * lifts across that window of the track's scroll progress, so the words land in
 * step with the 3D rather than on a timer of their own.
 */
export function initStages() {
  const tracks = [...document.querySelectorAll('[data-act-track]')].map((track) => ({
    track,
    items: [...track.querySelectorAll('[data-stage]')].map((el) => {
      const [a, b] = el.dataset.stage.split(',').map(Number);
      return { el, a, b: isNaN(b) ? 1.1 : b };
    }),
    bar: track.querySelector('[data-act-progress]'),
  })).filter((t) => t.items.length || t.bar);

  if (!tracks.length) return;

  const FADE = 0.055;   // how much of the window is spent fading

  function frame() {
    for (const t of tracks) {
      const r = t.track.getBoundingClientRect();
      // Skip anything nowhere near the viewport.
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;

      const p = trackProgress(t.track);

      for (const it of t.items) {
        const inn = Math.min(1, Math.max(0, (p - it.a) / FADE));
        const out = 1 - Math.min(1, Math.max(0, (p - (it.b - FADE)) / FADE));
        const v = Math.min(inn, out);
        it.el.style.opacity = v;
        it.el.style.transform = `translate3d(0, ${(1 - v) * 26}px, 0)`;
        it.el.style.pointerEvents = v > 0.5 ? 'auto' : 'none';
      }

      if (t.bar) t.bar.style.width = (p * 100).toFixed(2) + '%';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
