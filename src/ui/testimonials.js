import { gsap } from './scroll.js';

/** Cross-fading testimonial slider with arrows, dots, drag and autoplay. */
export function initTestimonials() {
  const root = document.querySelector('[data-slider]');
  if (!root) return;

  const slides = [...root.querySelectorAll('[data-slide]')];
  const dotsWrap = root.querySelector('[data-slider-dots]');
  const prev = root.querySelector('[data-slider-prev]');
  const next = root.querySelector('[data-slider-next]');
  if (!slides.length) return;

  let index = 0;
  let timer = null;

  const dots = slides.map((_, i) => {
    const d = document.createElement('button');
    d.className = 'slider__dot';
    d.type = 'button';
    d.setAttribute('aria-label', `Testimonial ${i + 1}`);
    d.addEventListener('click', () => go(i, true));
    dotsWrap && dotsWrap.appendChild(d);
    return d;
  });

  function go(to, user = false) {
    const nextIndex = (to + slides.length) % slides.length;
    if (nextIndex === index && user) return;

    const from = slides[index];
    const target = slides[nextIndex];
    const dir = nextIndex > index || (index === slides.length - 1 && nextIndex === 0) ? 1 : -1;

    gsap.to(from, { autoAlpha: 0, x: -30 * dir, duration: 0.45, ease: 'power2.in' });
    gsap.fromTo(target,
      { autoAlpha: 0, x: 40 * dir },
      { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out', delay: 0.12 });

    from.classList.remove('is-active');
    target.classList.add('is-active');
    dots.forEach((d, i) => d.classList.toggle('is-active', i === nextIndex));

    index = nextIndex;
    if (user) restart();
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(() => go(index + 1), 6500);
  }

  // Initial state: only the first slide is visible.
  slides.forEach((s, i) => {
    gsap.set(s, { autoAlpha: i === 0 ? 1 : 0, x: 0 });
    s.classList.toggle('is-active', i === 0);
  });
  dots[0] && dots[0].classList.add('is-active');

  prev && prev.addEventListener('click', () => go(index - 1, true));
  next && next.addEventListener('click', () => go(index + 1, true));

  root.addEventListener('mouseenter', () => clearInterval(timer));
  root.addEventListener('mouseleave', restart);

  // Pointer drag / swipe.
  let startX = null;
  root.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  root.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1), true);
    startX = null;
  });

  restart();
}
