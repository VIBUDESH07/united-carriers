import { gsap } from './scroll.js';

/** Sticky header that hides on the way down, plus the mobile drawer. */
export function initNav() {
  const header = document.querySelector('[data-header]');
  const burger = document.querySelector('[data-burger]');
  const drawer = document.querySelector('[data-drawer]');
  if (!header) return;

  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    // Sticky throughout — the header never retracts, it only picks up a
    // backing once you are off the hero.
    header.classList.toggle('is-stuck', y > 40);
    lastY = y;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (burger && drawer) {
    burger.addEventListener('click', () => {
      const open = document.documentElement.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', String(open));

      if (open) {
        gsap.fromTo(drawer.querySelectorAll('.drawer__link'),
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out', delay: 0.15 });
      }
    });
  }

  // Highlight the section currently in view.
  const links = [...document.querySelectorAll('[data-nav-link]')];
  const sections = links
    .map((l) => document.querySelector(l.getAttribute('href')))
    .filter(Boolean);

  if (sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((l) =>
          l.classList.toggle('is-current', l.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }
}
