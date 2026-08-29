/**
 * Seamless logo marquee. The track is duplicated until it comfortably overruns
 * the viewport, then translated by exactly one copy width and looped - so the
 * seam never shows regardless of how many logos are in the list.
 */
export function initMarquees() {
  document.querySelectorAll('[data-marquee]').forEach((row) => {
    const track = row.querySelector('[data-marquee-track]');
    if (!track) return;

    const speed = parseFloat(row.dataset.speed || '60'); // px/sec
    const reverse = row.dataset.direction === 'reverse';
    const original = [...track.children];

    let copyWidth = 0;
    let offset = 0;
    let raf = 0;
    let last = performance.now();

    function layout() {
      // Reset to a single copy before measuring.
      track.innerHTML = '';
      original.forEach((c) => track.appendChild(c.cloneNode(true)));
      copyWidth = track.scrollWidth;
      if (copyWidth <= 0) return;

      const needed = Math.ceil((window.innerWidth * 2) / copyWidth) + 1;
      for (let i = 0; i < needed; i++) {
        original.forEach((c) => track.appendChild(c.cloneNode(true)));
      }
      offset = 0;
    }

    function tick(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (copyWidth > 0 && !row.matches(':hover')) {
        offset += speed * dt;
        if (offset >= copyWidth) offset -= copyWidth;
      }
      const x = reverse ? offset - copyWidth : -offset;
      track.style.transform = `translate3d(${x}px,0,0)`;
      raf = requestAnimationFrame(tick);
    }

    layout();
    raf = requestAnimationFrame(tick);

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(layout, 200);
    }, { passive: true });

    // Pause when scrolled away - no reason to burn frames off-screen.
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
    }).observe(row);
  });
}
