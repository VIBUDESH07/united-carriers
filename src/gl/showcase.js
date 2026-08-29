import * as THREE from 'three';
import gl from './renderer.js';

/**
 * The small square scenes that sit inside the services block - one for the
 * crane, one for the truck. Each floats its cutout above a grid pad with a ring
 * of containers orbiting it, and leans toward the cursor.
 */
export class Showcase {
  constructor(el, opts = {}) {
    this.el = el;
    this.opts = Object.assign({ src: '', scale: 2.4, accent: 0xff5500, spin: 0.25 }, opts);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    this.camera.position.set(0, 0.55, 6.2);
    this.camera.lookAt(0, 0.35, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 5, 3);
    this.scene.add(key);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this._buildBackdrop();
    this._buildPad();
    this._buildSubject();
    this._buildOrbit();
  }

  /**
   * The tile's dark panel, drawn in the scene rather than in CSS. The shared
   * canvas sits above the section background, so an opaque CSS background here
   * would hide the very scene it is meant to frame.
   */
  _buildBackdrop() {
    const mat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: { uAccent: { value: new THREE.Color(this.opts.accent) } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uAccent;
        varying vec2 vUv;
        void main() {
          // Near-black, lifted slightly toward the accent in the lower corner.
          vec3 base = vec3(0.043, 0.043, 0.059);
          float glow = smoothstep(1.0, 0.0, distance(vUv, vec2(0.5, 0.15))) * 0.16;
          gl_FragColor = vec4(base + uAccent * glow, 1.0);
        }`,
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), mat);
    backdrop.position.z = -16;
    backdrop.renderOrder = -1;
    this.scene.add(backdrop);
  }

  _buildPad() {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uAccent: { value: new THREE.Color(this.opts.accent) },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uAccent;
        uniform float uTime;
        varying vec2 vUv;
        float grid(vec2 p, float w) {
          vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
          return 1.0 - min(min(g.x, g.y) / w, 1.0);
        }
        void main() {
          vec2 p = (vUv - 0.5) * 14.0;
          float g = grid(p, 1.3) * 0.5;
          // Ring pulse travelling out from the centre of the pad.
          float r = length(vUv - 0.5) * 2.0;
          float pulse = smoothstep(0.06, 0.0, abs(fract(r * 1.6 - uTime * 0.22) - 0.5) - 0.44);
          float vignette = 1.0 - smoothstep(0.15, 0.85, r);
          gl_FragColor = vec4(uAccent, (g * 0.55 + pulse * 0.25) * vignette);
        }`,
    });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), mat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -1.25;
    this.padMat = mat;
    this.root.add(pad);
  }

  _buildSubject() {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false,
    });
    this.subject = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.subjectMat = mat;
    this.root.add(this.subject);

    new THREE.TextureLoader().load(this.opts.src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, gl.renderer.capabilities.getMaxAnisotropy());
      mat.map = tex;
      mat.needsUpdate = true;
      const a = tex.image.width / tex.image.height;
      const h = this.opts.scale;
      this.subject.geometry.dispose();
      this.subject.geometry = new THREE.PlaneGeometry(h * a, h);
      this._ready = true;
    });
  }

  _buildOrbit() {
    const COUNT = 10;
    const geo = new THREE.BoxGeometry(0.62, 0.28, 0.28);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    const palette = [0xff5500, 0xf0a81e, 0xffffff, 0x1c1c1c];
    const color = new THREE.Color();
    for (let i = 0; i < COUNT; i++) mesh.setColorAt(i, color.setHex(palette[i % palette.length]));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.orbit = mesh;
    this._dummy = new THREE.Object3D();
    this.root.add(mesh);
  }

  update(dt, t) {
    const p = this.progress ?? 0;
    const reveal = THREE.MathUtils.clamp((p - 0.1) * 2.6, 0, 1);

    if (this._ready) this.subjectMat.opacity = reveal;
    this.padMat.uniforms.uTime.value = t;

    // Subject bobs, and the whole rig leans toward the cursor.
    this.subject.position.y = 0.72 + Math.sin(t * 0.9) * 0.09;
    this.root.rotation.y += (gl.pointer.x * 0.35 - this.root.rotation.y) * 0.05;
    this.root.rotation.x += (-gl.pointer.y * 0.12 - this.root.rotation.x) * 0.05;

    // Scroll rotates the rig a little, so the tile feels alive as it passes.
    this.root.rotation.y += (p - 0.5) * 0.0015;

    const d = this._dummy;
    for (let i = 0; i < this.orbit.count; i++) {
      const a = (i / this.orbit.count) * Math.PI * 2 + t * this.opts.spin;
      const r = 2.6 + Math.sin(t * 0.5 + i) * 0.12;
      d.position.set(Math.cos(a) * r, -0.9 + Math.sin(a * 2 + t * 0.4) * 0.35, Math.sin(a) * r * 0.55);
      d.rotation.set(0, -a + Math.PI / 2, Math.sin(a + t) * 0.06);
      d.scale.setScalar(reveal);
      d.updateMatrix();
      this.orbit.setMatrixAt(i, d.matrix);
    }
    this.orbit.instanceMatrix.needsUpdate = true;
  }
}

export function createShowcase(el, opts) {
  return gl.add(new Showcase(el, opts));
}
