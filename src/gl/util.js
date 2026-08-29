import * as THREE from 'three';

/**
 * Progress of a pinned "track" element: 0 the moment its sticky child locks to
 * the top, 1 when the track scrolls out from under it. This is what every
 * scrubbed act uses to drive its camera, rather than the renderer's generic
 * in-view bell.
 */
export function trackProgress(track) {
  if (!track) return 0;
  const r = track.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  if (span <= 0) return 0;
  return THREE.MathUtils.clamp(-r.top / span, 0, 1);
}

/** Remap v from [a,b] into [0,1], clamped. */
export function range(v, a, b) {
  return THREE.MathUtils.clamp((v - a) / (b - a), 0, 1);
}

/** Smooth 0->1->0 window between a and b, for staged fades. */
export function band(v, a, b, fade = 0.15) {
  const inn = range(v, a, a + (b - a) * fade);
  const out = 1 - range(v, b - (b - a) * fade, b);
  return Math.min(inn, out);
}

export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** Shared GLSL: cheap value noise + fbm, used by the ground and apron shaders. */
export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p, int oct) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= oct) break;
      s += a * vnoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return s;
  }
`;

/**
 * Load a cutout asset as a camera-facing plane sized to the image's own aspect,
 * given a target height in world units. Returns the mesh immediately and
 * resizes it once the texture arrives.
 */
export function makeSprite(src, height, opts = {}) {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: opts.opacity ?? 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, height), mat);
  mesh.userData.height = height;

  new THREE.TextureLoader().load(src, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    mat.map = tex;
    mat.needsUpdate = true;
    const a = tex.image.width / tex.image.height;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(height * a, height);
    mesh.userData.width = height * a;
    mesh.userData.ready = true;
    if (opts.onReady) opts.onReady(mesh);
  });

  return mesh;
}
