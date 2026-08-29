import * as THREE from 'three';
import gl from './renderer.js';
import { trackProgress, range, easeInOut } from './util.js';
import { PRODUCTS } from '../brand.js';

/**
 * The range act — a rotating cube.
 *
 * Each face carries one spice. Scroll turns the cube a quarter at a time so the
 * range is presented face by face, with the front face lit and the rest falling
 * into shadow. The turns are eased and held, so it reads as a deliberate
 * presentation rather than a continuous spin.
 */

// Which product sits on which face, in the order the cube presents them.
const FACE_ORDER = [0, 1, 2, 3, 4];

const FACE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3  uAccent;
  uniform float uReveal;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vN;

  void main() {
    vec3 col = texture2D(uMap, vUv).rgb;

    // Face brightness follows how square-on it is to the viewer.
    float facing = clamp(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    float lit = 0.30 + pow(facing, 1.4) * 0.95;
    col *= lit;

    // Warm key from the upper left, so the solid reads as a solid.
    float key = 0.86 + 0.24 * clamp(dot(normalize(vN), normalize(vec3(-0.5, 0.7, 0.6))), 0.0, 1.0);
    col *= key;

    // Accent edging, strongest on the face being presented.
    vec2 e = abs(vUv - 0.5) * 2.0;
    float edge = smoothstep(0.86, 1.0, max(e.x, e.y));
    col += uAccent * edge * (0.20 + facing * 0.85);

    // Slow sheen travelling across the front face.
    float sheen = smoothstep(0.5, 0.0, abs(vUv.x + vUv.y - 1.0 + sin(uTime * 0.3) * 0.8));
    col += vec3(1.0, 0.78, 0.5) * sheen * facing * 0.10;

    gl_FragColor = vec4(col, uReveal);
  }
`;

const FACE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelViewMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class Cube {
  constructor(el, track) {
    this.el = el;
    this.track = track || el;
    this.onProduct = null;
    this._current = -1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 0, 12.5);

    this.rig = new THREE.Group();
    this.scene.add(this.rig);

    this.mats = [];
    this._build();
    this._buildMotes();
  }

  _build() {
    const loader = new THREE.TextureLoader();
    const S = 4.6;

    // BoxGeometry face order is +x, -x, +y, -y, +z, -z. We present around the
    // Y axis, so the four side faces do the work and the caps get the two
    // remaining products.
    const faceProduct = [
      PRODUCTS[1],  // +x
      PRODUCTS[3],  // -x
      PRODUCTS[4],  // +y  (top)
      PRODUCTS[4],  // -y  (bottom, repeats — never presented)
      PRODUCTS[0],  // +z  (front at rest: turmeric, the primary focus)
      PRODUCTS[2],  // -z
    ];

    const materials = faceProduct.map((p) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uMap: { value: null },
          uAccent: { value: new THREE.Color(p.accent) },
          uReveal: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: FACE_VERT,
        fragmentShader: FACE_FRAG,
      });
      loader.load(`assets/photo/${p.slug}.webp`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, gl.renderer.capabilities.getMaxAnisotropy());
        mat.uniforms.uMap.value = tex;
      });
      this.mats.push(mat);
      return mat;
    });

    this.cube = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), materials);
    this.rig.add(this.cube);

    // A soft pool under the cube so it does not float in nothing.
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(S * 1.5, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff5500, transparent: true, opacity: 0.10,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -S * 0.92;
    this.glow = glow;
    this.scene.add(glow);
  }

  _buildMotes() {
    const COUNT = gl.reduced ? 110 : 600;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.moteMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSize: { value: 2.0 * gl.dpr }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uSize, uFade;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.3 + aSeed * 27.0) * 0.8;
          p.x += cos(uTime * 0.25 + aSeed * 20.0) * 0.8;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.18 + aSeed * 0.42) * uFade;
          gl_PointSize = uSize * (1.0 / -mv.z) * 26.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          gl_FragColor = vec4(1.0, 0.72, 0.42, smoothstep(0.25, 0.0, d) * vA);
        }`,
    });
    const pts = new THREE.Points(geo, this.moteMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  update(dt, t) {
    const p = trackProgress(this.track);
    const n = FACE_ORDER.length;
    const reveal = range(p, 0.02, 0.12) * (1 - range(p, 0.95, 1.0));

    // Step through the faces: hold on each, then a quick eased quarter turn.
    const scaled = THREE.MathUtils.clamp(p, 0, 0.9999) * n;
    const idx = Math.floor(scaled);
    const frac = scaled - idx;
    const turn = easeInOut(range(frac, 0.62, 1.0));

    // Offset the presented face by an eighth turn and hold a downward tilt, so
    // two faces and the top are always visible. Square-on, a cube just reads as
    // a flat picture.
    const THREE_QUARTER = Math.PI / 7;
    this.rig.rotation.y = (idx + turn) * (Math.PI / 2) * -1 - THREE_QUARTER;
    this.rig.rotation.x = 0.30 + Math.sin(p * Math.PI * 2) * 0.10 + gl.pointer.y * 0.10;
    this.rig.rotation.z = Math.sin(p * Math.PI * 3) * 0.05;
    this.rig.position.y = Math.sin(t * 0.7) * 0.12;

    this.mats.forEach((m) => {
      m.uniforms.uReveal.value = reveal;
      m.uniforms.uTime.value = t;
    });
    this.glow.material.opacity = 0.10 * reveal;
    this.moteMat.uniforms.uTime.value = t;
    this.moteMat.uniforms.uFade.value = reveal;

    this.camera.position.x = gl.pointer.x * 0.8;
    this.camera.position.z = THREE.MathUtils.lerp(13.5, 11.0, p);
    this.camera.lookAt(0, 0, 0);

    const shown = Math.min(n - 1, idx);
    if (shown !== this._current) {
      this._current = shown;
      if (this.onProduct) this.onProduct(shown, PRODUCTS[shown]);
    }
  }
}

export function createCube(el, track) {
  return gl.add(new Cube(el, track));
}
