import * as THREE from 'three';
import gl from './renderer.js';
import { trackProgress, range, makeSprite, easeInOut, NOISE_GLSL } from './util.js';

/**
 * The closing act: departure.
 *
 * One terminal at dusk, with a lane streaking out to every market we ship to.
 * Scroll lifts the camera off the deck and pulls it back until the whole fan is
 * visible — the point being that everything leaves from one place under one
 * exporter. Warm end of the palette throughout; there is no water in this act.
 */

// A visual fan only — deliberately not tied to a destination list, so the
// scene never implies a set of countries the business actually serves.
const LANE_COUNT = 9;

const GROUND_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  varying vec3 vW;
  ${NOISE_GLSL}

  void main() {
    float d = length(vW.xz);

    // Deep earth underfoot, warming toward an ember horizon.
    vec3 near = vec3(0.036, 0.030, 0.027);
    vec3 far  = vec3(0.20, 0.062, 0.012);
    // Hold black much further out, so the ember only reads near the horizon.
    vec3 col = mix(near, far, smoothstep(150.0, 520.0, d));

    // Heat haze drifting over the apron.
    float haze = fbm(vW.xz * 0.004 + vec2(uTime * 0.012, uTime * 0.007), 4);
    col += vec3(0.22, 0.075, 0.014) * haze * smoothstep(180.0, 430.0, d) * 0.55;

    // Apron grid, fading out before it reaches the horizon.
    vec2 g = abs(fract(vW.xz * 0.02) - 0.5) / fwidth(vW.xz * 0.02);
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    col += vec3(1.0, 0.42, 0.12) * line * 0.16 * (1.0 - smoothstep(30.0, 190.0, d));

    // Pool of light around the terminal itself.
    col += vec3(1.0, 0.48, 0.14) * (1.0 - smoothstep(0.0, 70.0, d)) * 0.10;

    gl_FragColor = vec4(col, uReveal);
  }
`;

const LANE_VERT = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LANE_FRAG = /* glsl */ `
  uniform vec3  uCold;
  uniform vec3  uHot;
  uniform float uHead;
  uniform float uOpacity;
  varying float vT;

  void main() {
    float base = 0.16;
    float d = uHead - vT;
    float trail = smoothstep(0.34, 0.0, d) * step(0.0, d);
    float head  = smoothstep(0.05, 0.0, abs(d));

    vec3 col = mix(uCold, uHot, clamp(trail * 0.8 + head, 0.0, 1.0));
    // Lanes emerge from the terminal and dissolve as they leave the frame.
    float ends = smoothstep(0.0, 0.05, vT) * (1.0 - smoothstep(0.72, 1.0, vT));
    float a = (base + trail * 0.9) * uOpacity * ends + head * 0.7 * uOpacity * ends;
    gl_FragColor = vec4(col, a);
  }
`;

export class Departure {
  constructor(el, track) {
    this.el = el;
    this.track = track || el;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b0705, 0.0016);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1600);

    this.scene.add(new THREE.AmbientLight(0xffd9b0, 2.0));
    const key = new THREE.DirectionalLight(0xff9a4a, 1.5);
    key.position.set(-60, 90, 40);
    this.scene.add(key);

    this._buildGround();
    this._buildTerminal();
    this._buildLanes();
    this._buildEmbers();
  }

  _buildGround() {
    this.groundMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: GROUND_FRAG,
    });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1), this.groundMat);
    g.rotation.x = -Math.PI / 2;
    g.renderOrder = 0;
    this.scene.add(g);
  }

  /** The terminal the lanes leave from. */
  _buildTerminal() {
    this.port = makeSprite('assets/port.webp', 64);
    this.port.rotation.x = -Math.PI / 2;
    this.port.position.y = 0.4;
    this.port.renderOrder = 1;
    this.scene.add(this.port);

    // A few stacks around it, so the apron is not empty.
    const geo = new THREE.BoxGeometry(5.4, 2.4, 2.4);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const COUNT = gl.reduced ? 30 : 90;
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    const palette = [0xff5500, 0xf0a81e, 0xe8e8e8, 0x2a2a2a, 0xc1440e];
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 46 + Math.random() * 120;
      dummy.position.set(Math.cos(a) * r, 1.2 + Math.floor(Math.random() * 3) * 2.5, Math.sin(a) * r);
      dummy.rotation.y = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col.setHex(palette[i % palette.length]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.renderOrder = 2;
    this.stacks = mesh;
    this.scene.add(mesh);
  }

  /** One lane per market, fanning out from the terminal and lifting away. */
  _buildLanes() {
    this.lanes = [];
    const cold = new THREE.Color(0xffb37a);
    const hot = new THREE.Color(0xff5500);

    for (let i = 0; i < LANE_COUNT; i++) {
      const a = (i / LANE_COUNT) * Math.PI * 2 + 0.22;
      const len = 380 + (i % 4) * 90;
      const bend = (i % 2 === 0 ? 1 : -1) * (0.28 + (i % 3) * 0.12);

      const pts = [];
      const SEG = 70;
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        // Curve away from straight, and climb as the lane leaves the apron.
        const ang = a + bend * t * t;
        const r = t * len;
        pts.push(new THREE.Vector3(
          Math.cos(ang) * r,
          2 + Math.pow(t, 1.7) * 118,
          Math.sin(ang) * r
        ));
      }

      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 90, 0.5, 6, false);

      const count = geo.attributes.position.count;
      const aT = new Float32Array(count);
      const radial = 7;   // TubeGeometry emits radialSegments+1 verts per ring
      for (let v = 0; v < count; v++) aT[v] = Math.floor(v / radial) / 90;
      geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));

      const mat = new THREE.ShaderMaterial({
        vertexShader: LANE_VERT,
        fragmentShader: LANE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uCold: { value: cold.clone() },
          uHot: { value: hot.clone() },
          uHead: { value: -1 },
          uOpacity: { value: 0 },
        },
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 4;
      this.scene.add(mesh);

      this.lanes.push({ mat, speed: 0.16 + (i % 5) * 0.035, offset: i * 0.21 });
    }
  }

  /** Embers lifting off the warm apron. */
  _buildEmbers() {
    const COUNT = gl.reduced ? 220 : 1400;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 320;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 90;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.emberMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSize: { value: 2.0 * gl.dpr }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uSize, uFade;
        varying float vA;
        void main() {
          vec3 p = position;
          // Rise and loop, drifting as they go.
          p.y = mod(p.y + uTime * (2.0 + aSeed * 5.0), 95.0);
          p.x += sin(uTime * 0.22 + aSeed * 30.0) * 7.0;
          p.z += cos(uTime * 0.19 + aSeed * 22.0) * 7.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.25 + aSeed * 0.55) * uFade * (1.0 - smoothstep(45.0, 95.0, p.y));
          gl_PointSize = uSize * (1.0 / -mv.z) * 240.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          gl_FragColor = vec4(1.0, 0.52, 0.16, smoothstep(0.25, 0.0, d) * vA);
        }`,
    });

    const pts = new THREE.Points(geo, this.emberMat);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    this.scene.add(pts);
  }

  update(dt, t) {
    const p = trackProgress(this.track);
    const climb = easeInOut(p);

    // Off the deck and back, until the whole fan of lanes is in frame.
    const alt = THREE.MathUtils.lerp(16, 300, climb);
    const dist = THREE.MathUtils.lerp(70, 330, climb);
    const spin = 0.5 + p * 0.85 + gl.pointer.x * 0.12;

    this.camera.position.set(
      Math.sin(spin) * dist,
      alt - gl.pointer.y * 6,
      Math.cos(spin) * dist
    );
    this.camera.lookAt(0, THREE.MathUtils.lerp(6, 30, climb), 0);

    const reveal = range(p, 0.01, 0.10);
    this.groundMat.uniforms.uTime.value = t;
    this.groundMat.uniforms.uReveal.value = reveal;
    this.emberMat.uniforms.uTime.value = t;
    this.emberMat.uniforms.uFade.value = reveal * (1 - range(p, 0.9, 1.0));

    this.port.material.opacity = range(p, 0.02, 0.12) * (1 - range(p, 0.88, 1.0));

    // Lanes light up once we are high enough to read the fan.
    const laneOn = range(p, 0.16, 0.40) * (1 - range(p, 0.93, 1.0));
    for (const lane of this.lanes) {
      const cycle = ((t * lane.speed + lane.offset) % 1.7) / 1.0;
      lane.mat.uniforms.uHead.value = cycle > 1 ? -1 : cycle;
      lane.mat.uniforms.uOpacity.value = laneOn;
    }
  }
}

export function createDeparture(el, track) {
  return gl.add(new Departure(el, track));
}
