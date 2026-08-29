/**
 * Inner-page WebGL bundle — globe, the About origin act, service tiles and the
 * footer wordmark. The home page's five acts stay in their own bundle.
 */
import gl from './renderer.js';
import { createColumn } from './column.js';
import { createHeroScene } from './hero.js';
import { createGlobe } from './globe.js';
import { createField } from './field.js';
import { createShowcase } from './showcase.js';
import { createParticleLogo } from './particle-logo.js';
import { BRAND } from '../brand.js';

export function mountPage() {
  const scenes = {};

  // Every inner header gets its own scene, chosen by data-scene, so no two
  // pages open with the same object. They all expose `reveal`, so the page
  // entry can fade whichever one it got without caring which it is.
  const heroEl = document.querySelector('[data-gl="hero"]');
  if (heroEl) {
    const scene = heroEl.dataset.scene || 'rings';
    if (scene === 'column') {
      scenes.hero = createColumn(heroEl, { focus: heroEl.dataset.focus || null });
    } else if (scene === 'globe') {
      scenes.hero = createGlobe(heroEl, null);
    } else {
      scenes.hero = createHeroScene(heroEl, { mode: scene });
    }
  }

  // About carries the origin act; the other pages have no pinned track.
  const fieldEl = document.querySelector('[data-gl="field"]');
  if (fieldEl) scenes.field = createField(fieldEl, fieldEl.closest('[data-act-track]'));

  document.querySelectorAll('[data-gl="showcase"]').forEach((el) => {
    createShowcase(el, {
      src: el.dataset.src,
      scale: parseFloat(el.dataset.scale || '2.4'),
      accent: parseInt(el.dataset.accent || '0xff5500', 16),
      spin: 0.22 + Math.random() * 0.12,
    });
  });

  const logoEl = document.querySelector('[data-gl="logo"]');
  if (logoEl) {
    scenes.logo = createParticleLogo(logoEl, {
      text: BRAND.wordmark, color: 0xa0a0a0, hot: 0xf0a81e,
    });
  }

  gl.start();
  return scenes;
}
