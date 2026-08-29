/**
 * Pointer-reactive tilt for cards.
 *
 * Elements marked [data-tilt] lean toward the cursor and lift a highlight that
 * tracks it. Everything is written to CSS custom properties so the styling
 * stays in the stylesheet, and the whole thing is skipped on touch and under
 * reduced-motion.
 */
export function initTilt() {
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cards = [...document.querySelectorAll('[data-tilt]')];
  if (!cards.length) return;

  const MAX = 7; // degrees

  cards.forEach((card) => {
    let raf = 0;
    let tx = 0, ty = 0, cx = 50, cy = 50;
    let rx = 0, ry = 0, gx = 50, gy = 50;

    const tick = () => {
      // Ease toward the target so a fast flick does not snap.
      rx += (tx - rx) * 0.14;
      ry += (ty - ry) * 0.14;
      gx += (cx - gx) * 0.16;
      gy += (cy - gy) * 0.16;

      card.style.setProperty('--rx', rx.toFixed(3) + 'deg');
      card.style.setProperty('--ry', ry.toFixed(3) + 'deg');
      card.style.setProperty('--gx', gx.toFixed(2) + '%');
      card.style.setProperty('--gy', gy.toFixed(2) + '%');

      if (Math.abs(tx - rx) > 0.01 || Math.abs(ty - ry) > 0.01 ||
          Math.abs(cx - gx) > 0.05 || Math.abs(cy - gy) > 0.05) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const start = () => { if (!raf) raf = requestAnimationFrame(tick); };

    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      ty = (px - 0.5) * 2 * MAX;        // horizontal position drives Y rotation
      tx = -(py - 0.5) * 2 * MAX;
      cx = px * 100;
      cy = py * 100;
      card.classList.add('is-tilting');
      start();
    });

    card.addEventListener('pointerleave', () => {
      tx = ty = 0; cx = cy = 50;
      card.classList.remove('is-tilting');
      start();
    });
  });
}
