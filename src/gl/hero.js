import * as THREE from 'three';
import gl from './renderer.js';
import { range } from './util.js';
import { PRODUCTS } from '../brand.js';

/**
 * Page-header scenes.
 *
 * Every inner page gets its own scene in the tall empty half of its header,
 * rather than the same object repeated. They share a camera, a mote field and
 * a reveal, and differ only in what they build and how they move — so five
 * distinct headers cost roughly one scene's worth of code.
 *
 *   rings   — about,    concentric orbits, layered and slowly building
 *   sort    — quality,  grain falling through a sieve, accepted and rejected
 *   stream  — insights, a rising ribbon of particles
 *   knot    — faq,      a tangle turning steadily in the light
 *   pulse   — contact,  signal rings going out from a point
 */

const ACCENTS = PRODUCTS.map((p) => new THREE.Color(p.accent));
const ORANGE = new THREE.Color(0xff5500);
const GOLD = new THREE.Color(0xf0a81e);

export class HeroScene {
  constructor(el, opts = {}) {
    this.el = el;
    this.mode = opts.mode || 'rings';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 0, 15);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const key = new THREE.DirectionalLight(0xffc38a, 1.5);
    key.position.set(-4, 6, 8);
    this.scene.add(key);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.reveal = { v: 0 };
    this.parts = [];

    ({
      rings: () => this._rings(),
      sort: () => this._sort(),
      stream: () => this._stream(),
      knot: () => this._knot(),
      pulse: () => this._pulse(),
    }[this.mode] || (() => this._rings()))();

    this._motes();
  }

  /* ---------------------------------------------------------------- rings */
  _rings() {
    this.rings = [];
    for (let i = 0; i < 6; i++) {
      const r = 1.9 + i * 1.05;
      const mat = new THREE.MeshBasicMaterial({
        color: ACCENTS[i % ACCENTS.length].clone(),
        transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 3, 128), mat);
      ring.rotation.x = 1.1 + i * 0.16;
      ring.rotation.y = i * 0.36;
      this.root.add(ring);
      this.rings.push({ ring, mat, speed: 0.06 + i * 0.028, dir: i % 2 ? 1 : -1, base: 0.55 - i * 0.05 });
    }
    // A bead riding each orbit, so the rings read as motion not decoration.
    const beadGeo = new THREE.SphereGeometry(0.11, 12, 12);
    this.beads = this.rings.map((r, i) => {
      const m = new THREE.MeshBasicMaterial({ color: 0xffd2a6, transparent: true, opacity: 0 });
      const b = new THREE.Mesh(beadGeo, m);
      this.root.add(b);
      return { mesh: b, mat: m, radius: 1.9 + i * 1.05, ringIndex: i, phase: i * 1.1 };
    });
  }

  /* ----------------------------------------------------------------- sort */
  /**
   * Grain falling through a sieve: most of it passes and carries on down in
   * warm gold, a minority is turned aside and dims out. That is what sourcing
   * to a specification actually looks like, so it suits this page better than
   * an abstract grid.
   */
  _sort() {
    const COUNT = gl.reduced ? 700 : 4200;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) seed[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.sortMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 2.3 * gl.dpr }, uReveal: { value: 0 },
        uPass: { value: GOLD.clone() }, uReject: { value: new THREE.Color(0x7a3a1c) },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uSize, uReveal;
        varying float vA;
        varying float vPass;

        float hash(float n) { return fract(sin(n) * 43758.5453); }

        void main() {
          // Each grain loops its own fall.
          float t = fract(aSeed * 3.17 + uTime * 0.12);

          // Roughly four in five pass the sieve.
          float pass = step(0.2, hash(aSeed * 91.7));
          vPass = pass;

          float SIEVE = 0.42;          // where the sieve sits along the fall
          float x = (hash(aSeed * 12.3) - 0.5) * 4.6;
          float z = (hash(aSeed * 47.1) - 0.5) * 3.0;

          // Accelerating fall from above down to the sieve.
          float y = 9.5 - t * t * 26.0;

          if (t > SIEVE) {
            float u = (t - SIEVE) / (1.0 - SIEVE);
            if (pass < 0.5) {
              // Rejected: turned aside and slowed.
              float dir = sign(x + 0.001);
              x += dir * u * 5.2;
              y = 9.5 - SIEVE * SIEVE * 26.0 - u * 5.0;
            }
          }

          vec3 p = vec3(x, y, z);

          float fade = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.86, 1.0, t));
          vA = uReveal * fade * (pass > 0.5 ? (0.35 + aSeed * 0.5) : 0.30);

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * (1.0 / -mv.z) * 26.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uPass, uReject;
        varying float vA, vPass;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          gl_FragColor = vec4(mix(uReject, uPass, vPass), smoothstep(0.25, 0.0, d) * vA);
        }`,
    });

    const pts = new THREE.Points(geo, this.sortMat);
    pts.frustumCulled = false;
    this.root.add(pts);

    // The sieve itself: a slowly turning ring the grain passes through.
    this.sieve = [];
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i ? ORANGE.clone() : GOLD.clone(),
        transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9 + i * 0.45, 0.028, 3, 128), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 4.9;
      this.root.add(ring);
      this.sieve.push({ ring, mat, dir: i ? 1 : -1 });
    }
  }

  /* --------------------------------------------------------------- stream */
  _stream() {
    const COUNT = gl.reduced ? 500 : 3200;
    const seed = new Float32Array(COUNT);
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) { seed[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.streamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 2.4 * gl.dpr }, uReveal: { value: 0 },
        uColA: { value: GOLD.clone() }, uColB: { value: ORANGE.clone() },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uSize, uReveal;
        varying float vA;
        varying float vT;
        void main() {
          // Each grain runs a helix up the column, offset by its seed.
          float t = fract(aSeed + uTime * 0.055);
          float a = aSeed * 62.8 + t * 7.0;
          float r = 1.1 + sin(aSeed * 30.0 + t * 6.28) * 1.5;
          vec3 p = vec3(cos(a) * r, (t - 0.5) * 19.0, sin(a) * r * 0.55);
          vT = t;
          vA = uReveal * smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.86, 1.0, t)) * (0.3 + aSeed * 0.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * (1.0 / -mv.z) * 24.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColA, uColB;
        varying float vA, vT;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          gl_FragColor = vec4(mix(uColA, uColB, vT), smoothstep(0.25, 0.0, d) * vA);
        }`,
    });
    const pts = new THREE.Points(geo, this.streamMat);
    pts.frustumCulled = false;
    this.root.add(pts);
  }

  /* ------------------------------------------------------------------ knot */
  _knot() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a1a12, roughness: 0.42, metalness: 0.5,
      emissive: new THREE.Color(0x2a0d02), transparent: true, opacity: 0,
    });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(3.0, 0.42, 220, 24, 2, 3), mat);
    this.knot = knot;
    this.knotMat = mat;
    this.root.add(knot);

    // A wire shell just outside it, to catch the light.
    const wire = new THREE.Mesh(
      new THREE.TorusKnotGeometry(3.0, 0.52, 150, 12, 2, 3),
      new THREE.MeshBasicMaterial({ color: 0xff7a33, wireframe: true, transparent: true, opacity: 0, depthWrite: false })
    );
    this.wire = wire;
    this.root.add(wire);
  }

  /* ----------------------------------------------------------------- pulse */
  _pulse() {
    this.pulses = [];
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 ? ORANGE.clone() : GOLD.clone(),
        transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.045, 96), mat);
      ring.rotation.x = -0.45;
      this.root.add(ring);
      this.pulses.push({ ring, mat, offset: i / 5 });
    }
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0 })
    );
    this.core = core;
    this.root.add(core);
  }

  /* ----------------------------------------------------------------- motes */
  _motes() {
    const COUNT = gl.reduced ? 80 : 380;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.moteMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSize: { value: 1.9 * gl.dpr }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uSize, uFade;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.2 + aSeed * 0.4) + 10.0, 20.0) - 10.0;
          p.x += sin(uTime * 0.3 + aSeed * 25.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.18 + aSeed * 0.42) * uFade;
          gl_PointSize = uSize * (1.0 / -mv.z) * 24.0;
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
    const p = this.progress ?? 0;
    const rev = this.reveal.v * (1 - range(p, 0.55, 1.0));

    this.root.position.y = p * 3.2;
    this.root.rotation.y = gl.pointer.x * 0.28;
    this.root.rotation.x = -gl.pointer.y * 0.14;

    this.moteMat.uniforms.uTime.value = t;
    this.moteMat.uniforms.uFade.value = rev;

    if (this.mode === 'rings') {
      this.rings.forEach((r, i) => {
        r.ring.rotation.z += dt * r.speed * r.dir;
        r.ring.rotation.y += dt * r.speed * 0.4;
        r.mat.opacity = rev * r.base;
      });
      this.beads.forEach((b) => {
        const ring = this.rings[b.ringIndex].ring;
        const a = t * (0.35 + b.ringIndex * 0.1) + b.phase;
        const local = new THREE.Vector3(Math.cos(a) * b.radius, Math.sin(a) * b.radius, 0);
        local.applyEuler(ring.rotation);
        b.mesh.position.copy(local);
        b.mat.opacity = rev;
      });
    }

    if (this.mode === 'sort') {
      this.sortMat.uniforms.uTime.value = t;
      this.sortMat.uniforms.uReveal.value = rev;
      this.sieve.forEach((sv, i) => {
        sv.ring.rotation.z += dt * 0.22 * sv.dir;
        sv.mat.opacity = rev * (0.5 - i * 0.18);
      });
    }

    if (this.mode === 'stream') {
      this.streamMat.uniforms.uTime.value = t;
      this.streamMat.uniforms.uReveal.value = rev;
      this.root.rotation.y += dt * 0.09;
    }

    if (this.mode === 'knot') {
      this.knot.rotation.y += dt * 0.22;
      this.knot.rotation.x += dt * 0.09;
      this.wire.rotation.copy(this.knot.rotation);
      this.knotMat.opacity = rev;
      this.wire.material.opacity = rev * 0.28;
    }

    if (this.mode === 'pulse') {
      this.pulses.forEach((q) => {
        // Rings expand out and fade, on a stagger.
        const k = (t * 0.28 + q.offset) % 1;
        q.ring.scale.setScalar(0.5 + k * 5.4);
        q.mat.opacity = rev * (1 - k) * 0.7;
      });
      this.core.material.opacity = rev * (0.7 + Math.sin(t * 2.2) * 0.25);
      this.core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08);
    }
  }
}

export function createHeroScene(el, opts) {
  return gl.add(new HeroScene(el, opts));
}
