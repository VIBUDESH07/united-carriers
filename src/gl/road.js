import * as THREE from 'three';
import gl from './renderer.js';
import { trackProgress, range, makeSprite, NOISE_GLSL } from './util.js';

/**
 * The linehaul act.
 *
 * Straight down onto a highway that bends across the frame, with the truck
 * driven along the curve by scroll. The road is real geometry swept from a
 * spline, so markings and shoulders follow the bend instead of being painted
 * on a flat quad.
 */

const HALF_W = 5.2;

// Explicit paint order for the act: ground, then tarmac, then what sits on it.
const ORDER_ROAD = 1;
const ORDER_PORT = 2;
const ORDER_TRUCK = 5;

const ROAD_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uLen;
  varying vec2 vUv;

  ${NOISE_GLSL}

  void main() {
    float u = vUv.x;              // 0..1 across the carriageway
    float v = vUv.y * uLen;       // metres along it

    // Asphalt with a bit of tonal grain.
    float grain = fbm(vec2(u * 40.0, v * 0.9), 3);
    vec3 col = mix(vec3(0.055, 0.058, 0.070), vec3(0.10, 0.105, 0.125), grain);

    // Continuous edge lines.
    float edge = smoothstep(0.045, 0.028, abs(u - 0.055))
               + smoothstep(0.045, 0.028, abs(u - 0.945));

    // Broken centre line.
    float dash = step(0.45, fract(v * 0.16));
    float centre = smoothstep(0.020, 0.008, abs(u - 0.5)) * dash;

    col = mix(col, vec3(0.88, 0.89, 0.92), clamp(edge, 0.0, 1.0) * 0.85);
    col = mix(col, vec3(0.95, 0.93, 0.80), centre * 0.9);

    // Soft shoulders so the ribbon does not end on a hard edge.
    float a = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.94, u);
    // And fade the two ends into the ground.
    a *= smoothstep(0.0, 0.03, vUv.y) * smoothstep(1.0, 0.97, vUv.y);

    gl_FragColor = vec4(col, a);
  }
`;

export class Road {
  constructor(el, track) {
    this.el = el;
    this.track = track || el;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
    this.camera.up.set(0, 0, -1);   // looking straight down: tell it which way is north

    this.scene.add(new THREE.AmbientLight(0xffffff, 2.5));

    this._buildCurve();
    this._buildGround();
    this._buildRoad();
    this._buildTruck();
    this._buildProps();
  }

  _buildCurve() {
    // A long run north with two lazy bends, so the act has something to turn on.
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 120),
      new THREE.Vector3(4, 0, 70),
      new THREE.Vector3(-16, 0, 22),
      new THREE.Vector3(-12, 0, -30),
      new THREE.Vector3(14, 0, -74),
      new THREE.Vector3(10, 0, -130),
    ]);
    this.curve.curveType = 'catmullrom';
    this.curve.tension = 0.5;
    this.length = this.curve.getLength();
  }

  _buildGround() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vW;
        ${NOISE_GLSL}
        void main() {
          // Dry scrub either side of the carriageway.
          float n = fbm(vW.xz * 0.05, 4);
          vec3 col = mix(vec3(0.055, 0.060, 0.085), vec3(0.10, 0.105, 0.14), n);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat);
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.05;
    g.renderOrder = -2;
    this.scene.add(g);
  }

  /** Sweep the carriageway along the spline as an indexed ribbon. */
  _buildRoad() {
    const SEG = 320;
    const pos = [], uv = [], idx = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      // Perpendicular in the ground plane.
      const side = new THREE.Vector3().crossVectors(tan, up).normalize();

      pos.push(p.x - side.x * HALF_W, 0, p.z - side.z * HALF_W);
      pos.push(p.x + side.x * HALF_W, 0, p.z + side.z * HALF_W);
      uv.push(0, t, 1, t);

      if (i < SEG) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);

    this.roadMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: ROAD_FRAG,
      transparent: true,
      uniforms: { uTime: { value: 0 }, uLen: { value: this.length } },
    });

    const road = new THREE.Mesh(geo, this.roadMat);
    road.position.y = 0.02;
    // The ribbon bakes absolute world coordinates into its vertices, so its
    // object origin sits at (0,0,0) - nowhere near the stretch it draws.
    // Three sorts transparent objects by that origin, which let the road paint
    // over the truck on the early part of the run. Order the act explicitly.
    road.renderOrder = ORDER_ROAD;
    this.scene.add(road);
  }

  _buildTruck() {
    // A group carries the heading; the sprite itself just lies flat.
    this.truckRig = new THREE.Group();
    this.truck = makeSprite('assets/truck-yard.webp', 11);
    this.truck.rotation.x = -Math.PI / 2;
    this.truckRig.add(this.truck);
    this.truckRig.position.y = 0.35;
    this.truck.renderOrder = ORDER_TRUCK;
    this.scene.add(this.truckRig);
  }

  _buildProps() {
    // The berth the run is heading for, laid flat at the end of the road.
    this.port = makeSprite('assets/port.webp', 78);
    this.port.rotation.x = -Math.PI / 2;
    this.port.position.set(44, 0.1, -128);
    this.port.rotation.z = 0.22;
    this.port.renderOrder = ORDER_PORT;
    this.scene.add(this.port);
  }

  update(dt, t) {
    const p = trackProgress(this.track);
    this.roadMat.uniforms.uTime.value = t;

    // Scroll is distance travelled.
    const s = THREE.MathUtils.clamp(p, 0.001, 0.999);
    const pt = this.curve.getPointAt(s);
    const tan = this.curve.getTangentAt(s);

    this.truckRig.position.set(pt.x, 0.35, pt.z);
    // The cab is at the LEFT of the artwork, so the truck's nose is -X. Steer to
    // the tangent, then add half a turn or it drives the road backwards.
    this.truckRig.rotation.y = Math.atan2(-tan.z, tan.x) + Math.PI;
    this.truck.material.opacity = range(p, 0.01, 0.08);

    this.port.material.opacity = range(p, 0.72, 0.95) * 0.95;

    // Camera rides above and slightly ahead, climbing as the run goes on.
    const alt = THREE.MathUtils.lerp(46, 96, p);
    const ahead = this.curve.getPointAt(Math.min(0.999, s + 0.05));
    this.camera.position.set(
      THREE.MathUtils.lerp(pt.x, ahead.x, 0.4) + gl.pointer.x * 2,
      alt,
      THREE.MathUtils.lerp(pt.z, ahead.z, 0.4) + alt * 0.05
    );
    this.camera.lookAt(pt.x, 0, pt.z);
  }
}

export function createRoad(el, track) {
  return gl.add(new Road(el, track));
}
