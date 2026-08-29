/** Trailing dot + ring cursor that swells over interactive elements. */
export function initCursor() {
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.append(dot, ring);

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;

  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
  }, { passive: true });

  (function loop() {
    // The ring lags the dot, which is what makes it read as a trail.
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();

  const hot = 'a, button, [data-cursor="hover"], input, textarea, summary';
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest(hot)) document.body.classList.add('cursor-hot');
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest(hot)) document.body.classList.remove('cursor-hot');
  });
  document.addEventListener('pointerdown', () => document.body.classList.add('cursor-down'));
  document.addEventListener('pointerup', () => document.body.classList.remove('cursor-down'));
}
