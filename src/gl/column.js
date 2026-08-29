import * as THREE from 'three';
import gl from './renderer.js';
import { range } from './util.js';
import { PRODUCTS } from '../brand.js';

/**
 * The inner-page hero scene.
 *
 * A slowly turning column of product discs, sized for the tall empty half of a
 * page header. Each disc carries one spice, rotates on its own axis and drifts
 * on a slightly different phase, so the stack never lines up into something
 * static. A page can name one product to bring forward — the product pages do,
 * so their header echoes the page you are on.
 */

const GAP = 3.05;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3  uAccent;
  uniform float uFocus;
  uniform float uReveal;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c);
    if (r > 0.5) discard;

    vec3 col = texture2D(uMap, vUv).rgb;

    // Unfocused discs sit back: darker and desaturated.
    float grey = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(grey) * 0.5, col, 0.42 + uFocus * 0.58);
    col *= 0.62 + uFocus * 0.5;

    // A slow sheen crossing the face, so the stack always has movement in it.
    float sheen = smoothstep(0.55, 0.0, abs(c.x + c.y + sin(uTime * 0.35) * 0.7));
    col += vec3(1.0, 0.72, 0.42) * sheen * (0.05 + uFocus * 0.12);

    // Accent ring.
    float ring = smoothstep(0.5, 0.455, r) * (1.0 - smoothstep(0.47, 0.5, r));
    col += uAccent * ring * (0.5 + uFocus * 1.6);

    float edge = 1.0 - smoothstep(0.485, 0.5, r);
    gl_FragColor = vec4(col, edge * uReveal);
  }
`;

export class Column {
  constructor(el, opts = {}) {
    this.el = el;
    this.focus = opts.focus || null;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.set(0, 0, 15);

    this.root = new THREE.Group();
    this.root.rotation.z = -0.13;
    this.scene.add(this.root);

    this.discs = [];
    this._build();
    this._buildMotes();

    this.reveal = { v: 0 };
  }

  _build() {
    const loader = new THREE.TextureLoader();
    const geo = new THREE.CircleGeometry(1.35, 72);

    // Put the focused product in the middle of the stack where the eye lands.
    const order = [...PRODUCTS];
    if (this.focus) {
      const i = order.findIndex((p) => p.slug === this.focus);
      if (i > -1) {
        const [p] = order.splice(i, 1);
        order.splice(Math.floor(order.length / 2), 0, p);
      }
    }

    order.forEach((p, i) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uMap: { value: null },
          uAccent: { value: new THREE.Color(p.accent) },
          uFocus: { value: this.focus ? (p.slug === this.focus ? 1 : 0.12) : 0.5 },
          uReveal: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });

      loader.load(`assets/photo/${p.slug}.webp`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, gl.renderer.capabilities.getMaxAnisotropy());
        mat.uniforms.uMap.value = tex;
      });

      const mesh = new THREE.Mesh(geo, mat);
      const mid = (order.length - 1) / 2;
      mesh.position.set(0, (mid - i) * GAP, 0);
      this.root.add(mesh);

      const isFocus = this.focus && p.slug === this.focus;
      this.discs.push({
        mesh, mat, i,
        phase: i * 0.9,
        scale: isFocus ? 1.28 : (this.focus ? 0.78 : 1),
      });
    });
  }

  _buildMotes() {
    const COUNT = gl.reduced ? 90 : 460;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 13;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 9;
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
          // Drift upward and wrap, like dust in a shaft of light.
          p.y = mod(p.y + uTime * (0.25 + aSeed * 0.55) + 11.0, 22.0) - 11.0;
          p.x += sin(uTime * 0.3 + aSeed * 26.0) * 0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.2 + aSeed * 0.5) * uFade;
          gl_PointSize = uSize * (1.0 / -mv.z) * 26.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          gl_FragColor = vec4(1.0, 0.76, 0.46, smoothstep(0.25, 0.0, d) * vA);
        }`,
    });

    const pts = new THREE.Points(geo, this.moteMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  setReveal(v) { this.reveal.v = v; }

  update(dt, t) {
    const rev = this.reveal.v;

    // The stack rides down a little as the header scrolls away.
    const p = this.progress ?? 0;
    this.root.position.y = p * 3.4;
    this.root.rotation.y = Math.sin(t * 0.16) * 0.28 + gl.pointer.x * 0.3;
    this.root.rotation.x = -gl.pointer.y * 0.16;

    this.discs.forEach((d) => {
      d.mat.uniforms.uReveal.value = rev * (1 - range(p, 0.55, 1.0));
      d.mat.uniforms.uTime.value = t;
      // Each disc turns on its own axis, at its own phase.
      d.mesh.rotation.z = Math.sin(t * 0.32 + d.phase) * 0.22;
      const bob = Math.sin(t * 0.6 + d.phase) * 0.09;
      d.mesh.position.x = Math.sin(t * 0.24 + d.phase) * 0.28;
      d.mesh.scale.setScalar(d.scale * (1 + bob * 0.04));
    });

    this.moteMat.uniforms.uTime.value = t;
    this.moteMat.uniforms.uFade.value = rev * (1 - range(p, 0.5, 1.0));
  }
}

export function createColumn(el, opts) {
  return gl.add(new Column(el, opts));
}
