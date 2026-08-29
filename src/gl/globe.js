import * as THREE from 'three';
import gl from './renderer.js';
import { trackProgress, range, easeInOut } from './util.js';

const DEG = Math.PI / 180;
const RADIUS = 1;

/** Lat/lon -> point on a sphere of the given radius. */
function latLonToVec3(lat, lon, radius = RADIUS) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// The lanes the hero traces. Roughly the APAC network the copy talks about,
// plus the long hauls out to Europe and the Americas.
const HUBS = {
  // Indian loading ports
  chennai:     [13.08, 80.27],
  kochi:       [9.93, 76.27],
  mundra:      [22.84, 69.72],
  nhavasheva:  [18.95, 72.95],
  tuticorin:   [8.76, 78.13],
  // Export markets
  jebelali:    [25.01, 55.06],
  jeddah:      [21.49, 39.19],
  felixstowe:  [51.96, 1.35],
  hamburg:     [53.55, 9.99],
  rotterdam:   [51.92, 4.48],
  newyork:     [40.71, -74.01],
  singapore:   [1.35, 103.82],
  portklang:   [3.00, 101.39],
  melbourne:   [-37.81, 144.96],
};

// Every lane leaves an Indian port — the hero is a map of where our spice goes.
const LANES = [
  ['chennai', 'jebelali'],    ['chennai', 'singapore'],   ['chennai', 'melbourne'],
  ['kochi', 'rotterdam'],     ['kochi', 'hamburg'],       ['kochi', 'jeddah'],
  ['mundra', 'felixstowe'],   ['mundra', 'newyork'],      ['mundra', 'jebelali'],
  ['nhavasheva', 'hamburg'],  ['nhavasheva', 'newyork'],  ['nhavasheva', 'jeddah'],
  ['tuticorin', 'portklang'], ['tuticorin', 'singapore'], ['chennai', 'felixstowe'],
  ['kochi', 'melbourne'],
];

// Air freight moves on its own routes: fewer, higher and much faster.
const AIR_LANES = [
  ['chennai', 'jebelali'],   ['chennai', 'felixstowe'], ['mundra', 'newyork'],
  ['kochi', 'hamburg'],      ['nhavasheva', 'singapore'],
];

// Open the hero looking at the subcontinent.
const FOCUS = [20.0, 78.0];
// Anchor for the on-screen origin label.
const HOME = [22.0, 79.0];

const DOT_VERT = /* glsl */ `
  attribute float aScale;
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uReveal;
  varying float vFade;

  void main() {
    vec3 pos = position;

    // Dots bloom outward from the core as the hero reveals.
    float rev = smoothstep(0.0, 1.0, clamp(uReveal * 1.35 - aSeed * 0.35, 0.0, 1.0));
    pos *= mix(0.82, 1.0, rev);

    // A slow breathing wobble so the surface never looks frozen.
    pos *= 1.0 + sin(uTime * 0.8 + aSeed * 12.0) * 0.004;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);

    // Fade dots as they rotate to the limb, so the sphere reads as a sphere.
    vec3 nrm = normalize(mat3(modelViewMatrix) * normalize(position));
    float facing = smoothstep(-0.35, 0.28, nrm.z);

    vFade = facing * rev;
    gl_PointSize = uSize * aScale * rev * (1.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;

  void main() {
    // Round off the point sprite.
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    if (d > 0.25) discard;
    float edge = smoothstep(0.25, 0.06, d);
    if (vFade <= 0.001) discard;
    gl_FragColor = vec4(uColor, edge * vFade);
  }
`;

const ARC_VERT = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform vec3  uHeadColor;
  uniform float uHead;     // where the pulse currently is, 0..1
  uniform float uOpacity;
  varying float vT;

  void main() {
    // Faint constant thread showing the whole lane...
    float base = 0.18;

    // ...plus a bright comet that runs along it.
    float d = uHead - vT;
    float trail = smoothstep(0.30, 0.0, d) * step(0.0, d);
    float head  = smoothstep(0.045, 0.0, abs(d));

    float a = (base + trail * 0.85) * uOpacity;
    vec3 col = mix(uColor, uHeadColor, clamp(trail * 0.7 + head, 0.0, 1.0));

    // Fade the very ends so lanes emerge out of the hubs rather than stopping dead.
    float ends = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
    gl_FragColor = vec4(col, a * ends + head * 0.6 * uOpacity);
  }
`;

export class Globe {
  constructor(el, track) {
    this.el = el;
    this.track = track || el;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.camera.position.set(0, 0, 4.25);

    this.root = new THREE.Group();
    // Tilt the axis so Australia/APAC sits nicely in frame.
    this.root.rotation.z = -14 * DEG;
    this.root.rotation.x = 12 * DEG;
    this.scene.add(this.root);

    this.spin = new THREE.Group();
    // Rotate so FOCUS sits on the +Z axis, i.e. facing the viewer on arrival.
    const f = latLonToVec3(FOCUS[0], FOCUS[1]);
    this.spin.rotation.y = Math.atan2(-f.x, f.z);
    this.root.add(this.spin);

    this.reveal = { v: 0 };
    this.arcs = [];
    this._targetRot = new THREE.Vector2();

    this._buildOcean();
    this._buildGraticule();
    this._buildAtmosphere();
    this._loadDots();
    this._buildArcs();
    this._buildHubs();
    this._buildEmbers();
    this._buildOrbit();
  }

  /**
   * An opaque sphere just under the dots. It writes depth, so dots on the far
   * side are correctly hidden instead of showing through.
   */
  _buildOcean() {
    const geo = new THREE.SphereGeometry(RADIUS * 0.985, 64, 48);
    const mat = new THREE.MeshBasicMaterial({ color: 0x0b0b0f });
    this.ocean = new THREE.Mesh(geo, mat);
    this.spin.add(this.ocean);
  }

  _buildGraticule() {
    const g = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
      color: 0xffb37a, transparent: true, opacity: 0.16, depthWrite: false,
    });
    for (let i = 1; i < 6; i++) {
      const lat = -90 + (180 / 6) * i;
      const r = Math.cos(lat * DEG) * RADIUS * 0.995;
      const y = Math.sin(lat * DEG) * RADIUS * 0.995;
      const pts = [];
      for (let a = 0; a <= 96; a++) {
        const th = (a / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
      }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    this.spin.add(g);
  }

  /** Soft rim light hugging the limb of the globe. */
  _buildAtmosphere() {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0xff5a12) },
        uPower: { value: 4.2 },
        uStrength: { value: 0.34 },
        uWrap: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        void main() {
          vN = normalize(mat3(modelViewMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uPower;
        uniform float uStrength;
        uniform float uWrap;   // 0 = crescent, 1 = all the way round
        varying vec3 vN;
        void main() {
          float rim = pow(clamp(1.0 + vN.z, 0.0, 1.0), uPower);
          // Light the limb from one side so it reads as a terminator rather
          // than a ring drawn around the planet.
          float dir = smoothstep(-0.45, 0.85, dot(normalize(vN.xy + 1e-5), vec2(-0.5, 0.87)));
          float shape = mix(dir, 1.0, uWrap);
          gl_FragColor = vec4(uColor, rim * shape * uStrength);
        }`,
    });
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.055, 64, 40), mat);
    this.root.add(this.atmo);
  }

  /** Sample the equirectangular land mask and scatter dots over land only. */
  _loadDots() {
    const img = new Image();
    img.src = 'assets/land-mask.png';
    img.onload = () => {
      const W = 1024, H = 512;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;

      const COUNT = gl.reduced ? 9000 : 26000;
      const positions = [], scales = [], seeds = [];

      // Fibonacci sphere: even coverage with no polar clumping.
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < COUNT; i++) {
        const y = 1 - (i / (COUNT - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const th = golden * i;
        const x = Math.cos(th) * r;
        const z = Math.sin(th) * r;

        const lat = Math.asin(y) / DEG;
        const lon = Math.atan2(z, -x) / DEG - 180;

        const u = Math.floor(((lon + 180) / 360) * W) % W;
        const v = Math.floor(((90 - lat) / 180) * H);
        const idx = (v * W + ((u + W) % W)) * 4;

        if (data[idx] > 120) {
          positions.push(x, y, z);
          scales.push(0.75 + Math.random() * 0.75);
          seeds.push(Math.random());
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1));
      geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));

      this.dotMat = new THREE.ShaderMaterial({
        vertexShader: DOT_VERT,
        fragmentShader: DOT_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime:   { value: 0 },
          uSize:   { value: 5.6 * gl.dpr },
          uColor:  { value: new THREE.Color(0xffffff) },
          uReveal: { value: 0 },
        },
      });

      this.dots = new THREE.Points(geo, this.dotMat);
      this.dots.renderOrder = 2;
      this.spin.add(this.dots);
    };
  }

  _buildArcs() {
    const colA = new THREE.Color(0xff7a2f);
    const colB = new THREE.Color(0xffd0a8);

    LANES.forEach(([a, b], i) => {
      const from = latLonToVec3(...HUBS[a]);
      const to = latLonToVec3(...HUBS[b]);

      // Great-circle path, lifted by an amount proportional to lane length so
      // short hops stay tight to the surface and long hauls arc high.
      const angle = from.angleTo(to);
      const lift = 0.16 + angle * 0.22;
      const pts = [];
      const SEG = 96;
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        const p = new THREE.Vector3().copy(from).lerp(to, t).normalize();
        p.multiplyScalar(RADIUS + Math.sin(Math.PI * t) * lift);
        pts.push(p);
      }

      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 110, 0.0038, 6, false);

      // Per-vertex position along the tube, for the comet shader.
      const pos = geo.attributes.position.count;
      const aT = new Float32Array(pos);
      const radial = 7; // TubeGeometry emits radialSegments+1 verts per ring
      for (let v = 0; v < pos; v++) aT[v] = Math.floor(v / radial) / 110;
      geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));

      const mat = new THREE.ShaderMaterial({
        vertexShader: ARC_VERT,
        fragmentShader: ARC_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor:     { value: colA.clone() },
          uHeadColor: { value: colB.clone() },
          uHead:      { value: -1 },
          uOpacity:   { value: 0 },
        },
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 3;
      this.spin.add(mesh);

      this.arcs.push({
        mat,
        curve,
        speed: 0.13 + Math.random() * 0.1,
        offset: (i / LANES.length) * 2 + Math.random() * 0.6,
      });
    });

    this._buildCargo();
    this._buildAir();
  }

  /**
   * Air routes. Same great-circle construction as the lanes, but lifted much
   * higher and run at several times the speed, so the two modes read as
   * different traffic rather than one effect at two colours.
   */
  _buildAir() {
    this.air = [];
    const cold = new THREE.Color(0xffe6c8);
    const hot = new THREE.Color(0xffffff);

    AIR_LANES.forEach(([a, b], i) => {
      const from = latLonToVec3(...HUBS[a]);
      const to = latLonToVec3(...HUBS[b]);
      const angle = from.angleTo(to);
      const lift = 0.34 + angle * 0.34;

      const pts = [];
      const SEG = 88;
      for (let s2 = 0; s2 <= SEG; s2++) {
        const t = s2 / SEG;
        const q = new THREE.Vector3().copy(from).lerp(to, t).normalize();
        q.multiplyScalar(RADIUS + Math.sin(Math.PI * t) * lift);
        pts.push(q);
      }

      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 100, 0.0022, 5, false);
      const count = geo.attributes.position.count;
      const aT = new Float32Array(count);
      const radial = 6;
      for (let v = 0; v < count; v++) aT[v] = Math.floor(v / radial) / 100;
      geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));

      const mat = new THREE.ShaderMaterial({
        vertexShader: ARC_VERT,
        fragmentShader: ARC_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: cold.clone() },
          uHeadColor: { value: hot.clone() },
          uHead: { value: -1 },
          uOpacity: { value: 0 },
        },
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 5;
      this.spin.add(mesh);
      this.air.push({ mat, curve, speed: 0.42 + i * 0.06, offset: i * 0.42 });
    });

    // A bright dart at the head of each flight.
    const n = this.air.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aOn', new THREE.BufferAttribute(new Float32Array(n), 1));

    this.planeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 7.0 * gl.dpr }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aOn;
        uniform float uSize;
        varying float vOn;
        void main() {
          vOn = aOn;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 nrm = normalize(mat3(modelViewMatrix) * normalize(position));
          vOn *= smoothstep(-0.2, 0.2, nrm.z);
          gl_PointSize = uSize * (1.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vOn;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          // Hard core with a soft halo, so it reads as a light not a blob.
          float core = smoothstep(0.16, 0.0, d);
          float halo = smoothstep(0.5, 0.12, d) * 0.45;
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.86), (core + halo) * vOn * uOpacity);
        }`,
    });

    this.planes = new THREE.Points(geo, this.planeMat);
    this.planes.frustumCulled = false;
    this.planes.renderOrder = 6;
    this.spin.add(this.planes);
  }

  /**
   * One glowing mote per lane, riding the same head position the comet shader
   * uses — so the lane reads as a shipment moving rather than a light effect.
   * Sixteen CPU curve samples a frame is nothing; the tubes stay on the GPU.
   */
  _buildCargo() {
    const n = this.arcs.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aOn', new THREE.BufferAttribute(new Float32Array(n), 1));

    this.cargoMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 5.5 * gl.dpr }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aOn;
        uniform float uSize;
        varying float vOn;
        void main() {
          vOn = aOn;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Hide the ones that have rotated round the back.
          vec3 nrm = normalize(mat3(modelViewMatrix) * normalize(position));
          vOn *= smoothstep(-0.15, 0.25, nrm.z);
          gl_PointSize = uSize * (1.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vOn;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          float core = smoothstep(0.25, 0.0, d);
          gl_FragColor = vec4(1.0, 0.86, 0.66, core * vOn * uOpacity);
        }`,
    });

    this.cargo = new THREE.Points(geo, this.cargoMat);
    this.cargo.frustumCulled = false;
    this.cargo.renderOrder = 4;
    this.spin.add(this.cargo);
  }

  /** Warm motes drifting behind the globe, for depth and a sense of scale. */
  _buildEmbers() {
    const COUNT = gl.reduced ? 120 : 700;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // Shell well outside the globe so nothing sits on the surface.
      const a = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const r = 2.4 + Math.random() * 3.4;
      const s = Math.sqrt(1 - z * z);
      pos[i * 3] = Math.cos(a) * s * r;
      pos[i * 3 + 1] = z * r;
      pos[i * 3 + 2] = Math.sin(a) * s * r;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.emberMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSize: { value: 2.2 * gl.dpr }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uSize, uFade;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.18 + aSeed * 28.0) * 0.13;
          p.x += cos(uTime * 0.15 + aSeed * 21.0) * 0.13;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.20 + aSeed * 0.55) * uFade
             * (0.45 + 0.55 * sin(uTime * 0.8 + aSeed * 40.0) * 0.5 + 0.275);
          gl_PointSize = uSize * (1.0 / -mv.z) * 3.4;
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

    this.embers = new THREE.Points(geo, this.emberMat);
    this.embers.frustumCulled = false;
    this.root.add(this.embers);
  }

  /** A slow inclined ring, reading as traffic in orbit around the network. */
  _buildOrbit() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff8a3c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.0035, 3, 200), mat);
    ring.rotation.x = Math.PI / 2 - 0.42;
    ring.rotation.z = 0.3;
    this.orbit = ring;
    this.orbitMat = mat;
    this.root.add(ring);
  }

  _buildHubs() {
    this.hubs = [];
    const geo = new THREE.SphereGeometry(0.012, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

    const ringGeo = new THREE.RingGeometry(0.02, 0.028, 24);

    Object.values(HUBS).forEach(([lat, lon], i) => {
      const p = latLonToVec3(lat, lon, RADIUS * 1.005);

      const dot = new THREE.Mesh(geo, mat);
      dot.position.copy(p);
      this.spin.add(dot);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff5500, transparent: true, opacity: 0.6,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(p);
      ring.lookAt(0, 0, 0);
      this.spin.add(ring);

      this.hubs.push({ ring, ringMat, phase: i * 0.45 });
    });
  }

  /**
   * Pin the origin label to India by projecting the point into screen space
   * each frame. Kept in the DOM rather than drawn in GL so the type stays
   * crisp, and hidden once the point rotates round the back.
   */
  _placeLabel(dive) {
    if (this._labelEl === undefined) {
      this._labelEl = document.querySelector('[data-globe-label]') || null;
      this._labelAnchor = latLonToVec3(HOME[0], HOME[1], RADIUS * 1.02);
    }
    if (!this._labelEl) return;

    const world = this._labelAnchor.clone();
    this.spin.localToWorld(world);

    // Facing check before projection - behind the globe means hidden.
    const toCam = this.camera.position.clone().sub(world).normalize();
    const normal = world.clone().sub(this.root.position).normalize();
    const facing = normal.dot(toCam);

    const ndc = world.project(this.camera);
    const r = this.el.getBoundingClientRect();
    const x = (ndc.x * 0.5 + 0.5) * r.width;
    const y = (-ndc.y * 0.5 + 0.5) * r.height;

    const vis = facing > 0.06 ? this.reveal.v * (1 - range(dive, 0.0, 0.35)) : 0;
    this._labelEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    this._labelEl.style.opacity = vis.toFixed(3);
  }

  setReveal(v) { this.reveal.v = v; }

  update(dt, t) {
    const p = trackProgress(this.track);

    // Idle spin, plus a gentle lean toward the cursor.
    this.spin.rotation.y += dt * 0.055;

    this._targetRot.x = gl.pointer.y * 0.16;
    this._targetRot.y = gl.pointer.x * 0.22;
    this.root.rotation.x += (12 * DEG + this._targetRot.x - this.root.rotation.x) * 0.045;
    this.root.rotation.y += (this._targetRot.y - this.root.rotation.y) * 0.045;

    // --- The dive -----------------------------------------------------------
    // The first half of the pin holds the globe; the second half flies the
    // camera down through the limb until the atmosphere fills the frame.
    const dive = easeInOut(range(p, 0.42, 1.0));
    this.camera.position.z = THREE.MathUtils.lerp(4.25, 1.02, dive);
    this.root.position.y = -dive * 0.30;
    this.root.rotation.z = -14 * DEG + dive * 0.12;

    if (this.dotMat) {
      this.dotMat.uniforms.uTime.value = t;
      this.dotMat.uniforms.uReveal.value = this.reveal.v;
      // Surface detail washes out as we enter the haze.
      this.dotMat.uniforms.uColor.value.setRGB(1, 1, 1).multiplyScalar(1 - dive * 0.75);
    }

    const laneFade = this.reveal.v * (1 - range(dive, 0.25, 0.75));
    const cargoPos = this.cargo.geometry.attributes.position;
    const cargoOn = this.cargo.geometry.attributes.aOn;

    this.arcs.forEach((arc, i) => {
      // Pulses loop with a pause between runs so the lanes feel like traffic.
      const cycle = ((t * arc.speed + arc.offset) % 1.85) / 1.0;
      const head = cycle > 1 ? -1 : cycle;
      arc.mat.uniforms.uHead.value = head;
      arc.mat.uniforms.uOpacity.value = laneFade;

      // Park the mote at the pulse head, or stow it while the lane rests.
      if (head >= 0) {
        const pt = arc.curve.getPointAt(THREE.MathUtils.clamp(head, 0, 1));
        cargoPos.setXYZ(i, pt.x, pt.y, pt.z);
        // Fade in and out at the ends rather than popping at the hubs.
        cargoOn.setX(i, Math.min(range(head, 0, 0.06), 1 - range(head, 0.92, 1)));
      } else {
        cargoOn.setX(i, 0);
      }
    });
    cargoPos.needsUpdate = true;
    cargoOn.needsUpdate = true;
    this.cargoMat.uniforms.uOpacity.value = laneFade;

    // Flights run their own, faster cycle.
    const airFade = laneFade;
    const planePos = this.planes.geometry.attributes.position;
    const planeOn = this.planes.geometry.attributes.aOn;
    this.air.forEach((a, i) => {
      const cycle = ((t * a.speed + a.offset) % 1.45) / 1.0;
      const head = cycle > 1 ? -1 : cycle;
      a.mat.uniforms.uHead.value = head;
      a.mat.uniforms.uOpacity.value = airFade;
      if (head >= 0) {
        const pt = a.curve.getPointAt(THREE.MathUtils.clamp(head, 0, 1));
        planePos.setXYZ(i, pt.x, pt.y, pt.z);
        planeOn.setX(i, Math.min(range(head, 0, 0.05), 1 - range(head, 0.94, 1)));
      } else {
        planeOn.setX(i, 0);
      }
    });
    planePos.needsUpdate = true;
    planeOn.needsUpdate = true;
    this.planeMat.uniforms.uOpacity.value = airFade;

    this._placeLabel(dive);

    // Embers thin out as we drop into the haze; the orbit ring goes with them.
    this.emberMat.uniforms.uTime.value = t;
    this.emberMat.uniforms.uFade.value = this.reveal.v * (1 - range(dive, 0.1, 0.55));
    this.embers.rotation.y += dt * 0.012;

    this.orbit.rotation.z += dt * 0.07;
    this.orbitMat.opacity = 0.30 * this.reveal.v * (1 - range(dive, 0.05, 0.45));

    for (const h of this.hubs) {
      const k = (t * 0.6 + h.phase) % 1;
      h.ring.scale.setScalar(1 + k * 1.9);
      h.ringMat.opacity = (1 - k) * 0.55 * this.reveal.v * (1 - range(dive, 0.1, 0.5));
    }

    if (this.atmo) {
      const u = this.atmo.material.uniforms;
      // Deep ember at altitude, opening to a darker rust as we sink in — a
      // bright wash at full dive put far too much orange on the screen.
      u.uColor.value.setHex(0xe04a0c).lerp(new THREE.Color(0x8a3208), range(dive, 0.25, 0.9));
      // The rim broadens into a full glow as we sink into it.
      u.uPower.value = THREE.MathUtils.lerp(4.2, 0.8, dive);
      u.uStrength.value = THREE.MathUtils.lerp(0.30, 1.55, dive);
      // Once inside, the glow surrounds us rather than hugging one edge.
      u.uWrap.value = range(dive, 0.2, 0.8);
      this.atmo.scale.setScalar(THREE.MathUtils.lerp(1, 1.22, dive));
    }

    // Diving toward an unlit sphere just goes black, so warm the surface up on
    // the way down - we are heading for the growing belts, not open water.
    this.ocean.material.color.setHex(0x0b0b0f)
      .lerp(new THREE.Color(0x341806), range(dive, 0.15, 1.0));
  }
}

export function createGlobe(el, track) {
  const g = new Globe(el, track);
  return gl.add(g);
}
