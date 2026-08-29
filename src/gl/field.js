import * as THREE from 'three';
import gl from './renderer.js';
import { trackProgress, range, makeSprite, easeInOut, NOISE_GLSL } from './util.js';

/**
 * The origin act, for the About page.
 *
 * Furrows running to a warm horizon, with the grower working a row. This is the
 * "direct farm sourcing" claim made literal — everything the rest of the site
 * describes starts here. Scroll walks the camera down the rows and lifts it as
 * the field opens out.
 */

const ROW_GAP = 3.1;
const ROWS = 16;

const GROUND_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  varying vec3 vW;
  ${NOISE_GLSL}

  void main() {
    // Tilled earth, warming toward the light at the far end.
    vec3 soil = vec3(0.075, 0.050, 0.034);
    vec3 lit  = vec3(0.30, 0.155, 0.045);
    float toHorizon = smoothstep(20.0, 260.0, -vW.z);
    vec3 col = mix(soil, lit, toHorizon);

    // Furrows: ridges running away from the camera.
    float row = abs(fract(vW.x / ${ROW_GAP.toFixed(1)}) - 0.5) * 2.0;
    float ridge = smoothstep(0.75, 1.0, row);
    col += vec3(0.16, 0.085, 0.026) * ridge * (1.0 - toHorizon * 0.5);

    // Clods and unevenness so the soil is not a flat plane.
    float grain = fbm(vW.xz * 0.35, 4);
    col *= 0.82 + grain * 0.42;

    // Low sun washing across from the left.
    float sun = smoothstep(90.0, -60.0, vW.x) * toHorizon;
    col += vec3(0.34, 0.16, 0.04) * sun * 0.5;

    gl_FragColor = vec4(col, uReveal);
  }
`;

export class Field {
  constructor(el, track) {
    this.el = el;
    this.track = track || el;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1a0d05, 0.0075);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);

    this.scene.add(new THREE.AmbientLight(0xffd9a8, 2.2));
    const sun = new THREE.DirectionalLight(0xffb066, 1.0);
    sun.position.set(-40, 26, -30);
    this.scene.add(sun);

    this._buildGround();
    this._buildCrop();
    this._buildGrower();
    this._buildPollen();
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
    const g = new THREE.Mesh(new THREE.PlaneGeometry(600, 700, 1, 1), this.groundMat);
    g.rotation.x = -Math.PI / 2;
    g.position.z = -260;
    g.renderOrder = 0;
    this.scene.add(g);
  }

  /** Instanced plants, set out in rows that run away from the camera. */
  _buildCrop() {
    const PER_ROW = gl.reduced ? 26 : 70;
    const COUNT = ROWS * PER_ROW;

    // A squat cone reads as a leafy clump at this distance and costs nothing.
    const geo = new THREE.ConeGeometry(0.62, 1.15, 6);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);

    const greens = [0x4e6b21, 0x5d7a26, 0x425c1b, 0x6b8a2e, 0x39501a];
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      const x = (r - ROWS / 2) * ROW_GAP + (Math.random() - 0.5) * 0.3;
      for (let n = 0; n < PER_ROW; n++) {
        const z = 6 - n * 5.2 - Math.random() * 2.4;
        dummy.position.set(x + (Math.random() - 0.5) * 0.7, 0.55, z);
        dummy.rotation.y = Math.random() * Math.PI;
        const s = 0.8 + Math.random() * 0.55;
        dummy.scale.set(s, s * (0.85 + Math.random() * 0.4), s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col.setHex(greens[i % greens.length]));
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.renderOrder = 1;
    this.crop = mesh;
    this.scene.add(mesh);
  }

  _buildGrower() {
    this.grower = makeSprite('assets/farmer.webp', 4.2);
    this.grower.position.set(5.2, 2.4, -14);
    this.grower.renderOrder = 3;
    this.scene.add(this.grower);
  }

  /** Chaff and pollen hanging in the low sun. */
  _buildPollen() {
    const COUNT = gl.reduced ? 180 : 1100;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = Math.random() * 16;
      pos[i * 3 + 2] = 8 - Math.random() * 200;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.pollenMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSize: { value: 2.1 * gl.dpr }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uSize, uFade;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.5 + aSeed * 30.0) * 1.1;
          p.x += cos(uTime * 0.35 + aSeed * 24.0) * 1.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.22 + aSeed * 0.5) * uFade;
          gl_PointSize = uSize * (1.0 / -mv.z) * 60.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          gl_FragColor = vec4(1.0, 0.82, 0.48, smoothstep(0.25, 0.0, d) * vA);
        }`,
    });

    const pts = new THREE.Points(geo, this.pollenMat);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    this.scene.add(pts);
  }

  update(dt, t) {
    const p = trackProgress(this.track);
    const walk = easeInOut(p);

    // Down the rows, lifting as the field opens out.
    this.camera.position.set(
      Math.sin(p * 1.5) * 3.0 + gl.pointer.x * 1.4,
      THREE.MathUtils.lerp(2.6, 26, walk) - gl.pointer.y * 0.8,
      THREE.MathUtils.lerp(10, -120, walk)
    );
    this.camera.lookAt(0, THREE.MathUtils.lerp(1.6, 4.0, walk), this.camera.position.z - 34);

    const reveal = range(p, 0.01, 0.10);
    this.groundMat.uniforms.uTime.value = t;
    this.groundMat.uniforms.uReveal.value = reveal;
    this.pollenMat.uniforms.uTime.value = t;
    this.pollenMat.uniforms.uFade.value = reveal * (1 - range(p, 0.9, 1.0));

    // The grower stays ahead of the camera until we climb away from the row.
    // Stay ahead of the camera and off to the right, so the caption in the
    // bottom-left corner never has the figure sitting on top of it.
    this.grower.position.z = this.camera.position.z - 17;
    this.grower.position.x = 5.2 + Math.sin(t * 0.4) * 0.3;
    this.grower.position.y = 2.4 + Math.sin(t * 1.4) * 0.06;
    this.grower.material.opacity = range(p, 0.04, 0.16) * (1 - range(p, 0.42, 0.62));
  }
}

export function createField(el, track) {
  return gl.add(new Field(el, track));
}
