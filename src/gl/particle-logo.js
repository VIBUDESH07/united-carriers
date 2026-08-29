import * as THREE from 'three';
import gl from './renderer.js';

/**
 * The wordmark in the footer, rebuilt out of particles.
 *
 * Text is rasterised to an offscreen 2D canvas, sampled on a grid, and every
 * opaque pixel becomes a point. Assembly and cursor repulsion both happen in
 * the vertex shader, so the pixel count costs us nothing on the CPU.
 */
const VERT = /* glsl */ `
  attribute vec3  aHome;    // final resting place
  attribute vec3  aStart;   // scattered origin
  attribute float aSeed;

  uniform vec2  uMouse;     // cursor in the same pixel space, -9999 when away
  uniform float uRadius;
  uniform float uTime;
  uniform float uReveal;
  uniform float uSize;

  varying float vGlow;

  void main() {
    // Fly in from the scatter, staggered per particle.
    float r = smoothstep(0.0, 1.0, clamp(uReveal * 1.6 - aSeed * 0.6, 0.0, 1.0));
    vec3 pos = mix(aStart, aHome, r);

    // Idle drift so the wordmark shimmers instead of sitting dead.
    pos.x += sin(uTime * 0.9 + aSeed * 30.0) * 0.9;
    pos.y += cos(uTime * 0.7 + aSeed * 22.0) * 0.9;

    // Push out of the way of the cursor, easing back afterwards.
    vec2 away = pos.xy - uMouse;
    float d = length(away);
    float force = 1.0 - smoothstep(0.0, uRadius, d);
    pos.xy += normalize(away + vec2(0.001)) * force * uRadius * 0.55;

    vGlow = force;

    gl_PointSize = uSize * (1.0 + force * 1.4) * r;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    if (d > 0.25) discard;
    float a = smoothstep(0.25, 0.02, d);
    gl_FragColor = vec4(mix(uColor, uHot, vGlow), a * (0.85 + vGlow * 0.15));
  }
`;

export class ParticleLogo {
  constructor(el, opts = {}) {
    this.el = el;
    this.opts = Object.assign({
      text: 'UNITED CARRIERS',
      color: 0xffffff,
      hot: 0xff5500,
      gap: 4,
    }, opts);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    this.camera.position.z = 10;

    this.uniforms = {
      uMouse:  { value: new THREE.Vector2(-9999, -9999) },
      uRadius: { value: 70 },
      uTime:   { value: 0 },
      uReveal: { value: 0 },
      uSize:   { value: 3.4 * gl.dpr },
      uColor:  { value: new THREE.Color(this.opts.color) },
      uHot:    { value: new THREE.Color(this.opts.hot) },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: this.uniforms,
    });

    this._size = new THREE.Vector2(0, 0);
    this.build();
  }

  /** Rasterise the wordmark and turn its opaque pixels into points. */
  build() {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(2, Math.floor(r.width));
    const h = Math.max(2, Math.floor(r.height));
    if (w === this._size.x && h === this._size.y) return;
    this._size.set(w, h);

    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.updateProjectionMatrix();

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });

    // Fit the wordmark to the box, then measure to centre it exactly.
    let size = Math.floor(h * 0.72);
    const family = '"BT Steinhart", "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let i = 0; i < 40; i++) {
      ctx.font = `700 ${size}px ${family}`;
      if (ctx.measureText(this.opts.text).width <= w * 0.92) break;
      size -= Math.max(1, Math.floor(size * 0.06));
    }
    ctx.fillStyle = '#fff';
    ctx.fillText(this.opts.text, w / 2, h / 2);

    const data = ctx.getImageData(0, 0, w, h).data;
    const gap = Math.max(3, Math.round(this.opts.gap * (gl.reduced ? 1.8 : 1)));

    const home = [], start = [], seeds = [];
    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        if (data[(y * w + x) * 4 + 3] > 128) {
          home.push(x - w / 2, -(y - h / 2), 0);
          const a = Math.random() * Math.PI * 2;
          const rad = Math.max(w, h) * (0.55 + Math.random() * 0.7);
          start.push(Math.cos(a) * rad, Math.sin(a) * rad, 0);
          seeds.push(Math.random());
        }
      }
    }

    this.count = seeds.length;

    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
    }

    const geo = new THREE.BufferGeometry();
    // position is unused by the shader but three needs it to size the draw.
    geo.setAttribute('position', new THREE.Float32BufferAttribute(home, 3));
    geo.setAttribute('aHome', new THREE.Float32BufferAttribute(home, 3));
    geo.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.uniforms.uRadius.value = Math.max(46, Math.min(w, h) * 0.42);
  }

  resize() { this.build(); }

  update(dt, t) {
    this.uniforms.uTime.value = t;

    const target = THREE.MathUtils.clamp((this.progress - 0.05) * 3.2, 0, 1);
    this.uniforms.uReveal.value += (target - this.uniforms.uReveal.value) * Math.min(1, dt * 3);

    // Cursor into the logo's own centred pixel space.
    const r = this.el.getBoundingClientRect();
    const mx = gl.pointerPx.x - r.left - r.width / 2;
    const my = -(gl.pointerPx.y - r.top - r.height / 2);
    const inside =
      gl.pointerPx.x > r.left - 80 && gl.pointerPx.x < r.right + 80 &&
      gl.pointerPx.y > r.top - 80 && gl.pointerPx.y < r.bottom + 80;

    const m = this.uniforms.uMouse.value;
    const tx = inside ? mx : -9999;
    const ty = inside ? my : -9999;
    if (inside) {
      m.x += (tx - m.x) * 0.2;
      m.y += (ty - m.y) * 0.2;
    } else {
      m.set(-9999, -9999);
    }
  }
}

export function createParticleLogo(el, opts) {
  return gl.add(new ParticleLogo(el, opts));
}
