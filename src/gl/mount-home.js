/**
 * Home-page WebGL bundle.
 *
 * Imported dynamically, so three.js and the five acts stay out of the initial
 * payload. Everything in here is pulled in one chunk the first time a GL slot
 * comes near the viewport.
 */
import gl from './renderer.js';
import { createGlobe } from './globe.js';
import { createCube } from './cube.js';
import { createLift } from './lift.js';
import { createRoad } from './road.js';
import { createDeparture } from './departure.js';
import { createShowcase } from './showcase.js';
import { createParticleLogo } from './particle-logo.js';
import { BRAND } from '../brand.js';

export function mountHome() {
  const scenes = {};

  // Each act's stage sits inside the track that scrubs it.
  const bind = (name, factory) => {
    const el = document.querySelector(`[data-gl="${name}"]`);
    if (!el) return null;
    scenes[name] = factory(el, el.closest('[data-act-track]'));
    return scenes[name];
  };

  bind('globe', createGlobe);
  bind('cube', createCube);
  bind('lift', createLift);
  bind('road', createRoad);
  bind('departure', createDeparture);

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
