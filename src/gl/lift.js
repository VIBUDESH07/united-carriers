import * as THREE from 'three';
import gl from './renderer.js';
import { trackProgress, range, makeSprite, easeInOut } from './util.js';

// Machine height, and where the spreader sits inside the artwork (fractions of
// the sprite, measured from its top-left). Used to park the load on the boom.
const MACHINE_H = 14;
const MACHINE_ASPECT = 1400 / 981;

// Measured off the artwork: the hazard-striped spreader beam sits at 14% across
// and its UNDERSIDE - where a hanging box's roof meets it - at 21.8% down.
const SPREADER_FX = 0.140;
const SPREADER_UNDER_FY = 0.218;
const SPREADER_DX = (SPREADER_FX - 0.5) * MACHINE_H * MACHINE_ASPECT;
const SPREADER_UNDER_DY = (0.5 - SPREADER_UNDER_FY) * MACHINE_H;

/**
 * The terminal act.
 *
 * A reach stacker rolls in, takes the top box off a stack and carries it away.
 * Scroll scrubs the whole move, so the machine only works while the reader is
 * actually moving - stop, and it stops with you.
 */
export class Lift {
  constructor(el, track) {
    this.el = el;
    this.track = track || el;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
    this.camera.position.set(0, 6, 36);

    this.scene.add(new THREE.AmbientLight(0xffffff, 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(-6, 14, 10);
    this.scene.add(key);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this._buildGround();
    this._buildStack();
    this._buildMachine();
    this._buildDust();
  }

  _buildGround() {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vW;
        float grid(vec2 p, float w) {
          vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
          return 1.0 - min(min(g.x, g.y) / w, 1.0);
        }
        void main() {
          // Yard paving, dissolving toward the horizon.
          float g = grid(vec2(vW.x, vW.z) * 0.22, 1.3) * 0.30;
          float fade = 1.0 - smoothstep(6.0, 90.0, abs(vW.z));
          gl_FragColor = vec4(vec3(0.10, 0.13, 0.30), g * fade * 0.9);
        }`,
    });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(300, 220), mat);
    g.rotation.x = -Math.PI / 2;
    g.renderOrder = 0;   // yard deck sits under everything else in the act
    this.groundMat = mat;
    this.root.add(g);
  }

  _buildStack() {
    // Door-end cutouts, stood on the deck in a short stack.
    this.blue = makeSprite('assets/container-blue.webp', 4.2);
    this.orange = makeSprite('assets/container-orange.webp', 4.2);
    this.grey = makeSprite('assets/container-grey.webp', 3.6);

    // The reach stacker's boom reaches to the LEFT in the artwork, so the stack
    // sits to its left and the machine works in from the right.
    this.blue.position.set(-5.5, 2.1, 0);
    this.orange.position.set(-10.6, 2.1, -1.5);
    this.grey.position.set(-5.5, 6.0, 0);

    this.blue.renderOrder = 3;
    this.orange.renderOrder = 3;
    this.grey.renderOrder = 5;      // the load always reads in front of the stack
    this.root.add(this.blue, this.orange, this.grey);

    // Contact shadows so the boxes sit on the ground rather than float.
    this.shadows = [];
    [[-5.5, 0], [-10.6, -1.5]].forEach(([x, z]) => {
      const s = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 2.6),
        new THREE.MeshBasicMaterial({
          color: 0x000814, transparent: true, opacity: 0, depthWrite: false,
        })
      );
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.03, z + 1.1);
      s.renderOrder = 1;
      this.root.add(s);
      this.shadows.push(s);
    });
  }

  _buildMachine() {
    // Sized so the spreader at the boom tip lands just above the stack.
    this.machine = makeSprite('assets/reach-stacker.webp', MACHINE_H);
    this.machine.position.set(30, MACHINE_H / 2, 1.5);
    this.machine.renderOrder = 4;
    this.root.add(this.machine);

    // A crane holding the skyline behind the yard.
    this.crane = makeSprite('assets/crane.webp', 9);
    this.crane.position.set(14, 4.5, -26);
    this.crane.renderOrder = 2;     // skyline, behind the working plant
    this.root.add(this.crane);
  }

  /** Dust hanging in the yard air, stirred along by the machine. */
  _buildDust() {
    const COUNT = gl.reduced ? 60 : 260;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.dustMat = new THREE.ShaderMaterial({
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
          p.x += sin(uTime * 0.35 + aSeed * 26.0) * 1.6;
          p.y += cos(uTime * 0.28 + aSeed * 18.0) * 0.8;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.18 + aSeed * 0.4) * uFade;
          gl_PointSize = uSize * (1.0 / -mv.z) * 40.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          gl_FragColor = vec4(0.65, 0.72, 0.95, smoothstep(0.25, 0.0, d) * vA);
        }`,
    });
    this.root.add(new THREE.Points(geo, this.dustMat));
  }

  update(dt, t) {
    const p = trackProgress(this.track);
    this.groundMat.uniforms.uTime.value = t;
    this.dustMat.uniforms.uTime.value = t;
    this.dustMat.uniforms.uFade.value = range(p, 0.04, 0.2);

    const fadeIn = range(p, 0.02, 0.14);

    // 1. The machine works in from stage right until the spreader is over the box.
    const roll = easeInOut(range(p, 0.0, 0.30));
    const parkX = this.grey.position.x - SPREADER_DX;   // spreader above the stack
    const machineX = THREE.MathUtils.lerp(30, parkX, roll);
    this.machine.position.x = machineX;
    // Suspension settles as it rolls, then a small idle rock.
    const rolling = roll > 0.02 && roll < 0.98 ? 1 : 0;
    this.machine.position.y = MACHINE_H / 2
      + Math.sin(t * 9.0) * 0.05 * rolling
      + Math.sin(t * 1.3) * 0.02;
    this.machine.rotation.z = Math.sin(t * 7.0) * 0.004 * rolling;
    this.machine.material.opacity = fadeIn;
    this.crane.material.opacity = fadeIn * 0.55;

    this.blue.material.opacity = fadeIn;
    this.orange.material.opacity = fadeIn;
    this.shadows.forEach((s) => { s.material.opacity = fadeIn * 0.42; });

    // 2. It takes the top box off the stack, up to the spreader.
    const hoist = easeInOut(range(p, 0.30, 0.62));
    // Hang the box off the beam: its roof meets the spreader's underside.
    const hung = MACHINE_H / 2 + SPREADER_UNDER_DY - this.grey.userData.height / 2;
    this.grey.material.opacity = fadeIn;
    this.grey.position.y = THREE.MathUtils.lerp(6.0, hung, hoist);
    this.grey.position.x = THREE.MathUtils.lerp(-5.5, machineX + SPREADER_DX, hoist);
    // The load sways while it is off the ground, and settles once it is seated.
    const airborne = hoist * (1 - range(p, 0.90, 1.0));
    this.grey.rotation.z = Math.sin(t * 1.9) * 0.035 * airborne
                         + Math.sin(hoist * Math.PI) * 0.03;
    this.grey.position.x += Math.sin(t * 1.9) * 0.12 * airborne;

    // 3. It backs out the way it came, box and all.
    const away = easeInOut(range(p, 0.62, 1.0));
    const carry = away * 26;
    this.machine.position.x += carry;
    this.grey.position.x += carry;

    // Camera eases in and follows the load a little.
    const push = easeInOut(p);
    this.camera.position.z = THREE.MathUtils.lerp(42, 34, push);
    this.camera.position.x = THREE.MathUtils.lerp(0, 10, push) + gl.pointer.x * 0.8;
    this.camera.position.y = THREE.MathUtils.lerp(6.0, 8.6, push) - gl.pointer.y * 0.5;
    this.camera.lookAt(this.camera.position.x * 0.55, 5.2, 0);
  }
}

export function createLift(el, track) {
  return gl.add(new Lift(el, track));
}
