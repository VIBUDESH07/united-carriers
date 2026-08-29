import * as THREE from 'three';

/**
 * One WebGLRenderer, many on-page scenes.
 *
 * Every 3D moment on this site (hero globe, the scroll journey, the two service
 * tiles, the footer logo) is a "view" anchored to a DOM element. Each frame we
 * walk the registered views, scissor the shared canvas to the element's box and
 * draw only that view. Beats spinning up five WebGL contexts, and it keeps the
 * 3D perfectly locked to the layout while Lenis smooth-scrolls the page.
 */
class GLCore {
  constructor() {
    this.views = [];
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerPx = new THREE.Vector2(-9999, -9999);
    this.running = false;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'gl';

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearAlpha(0);
    this.renderer.autoClear = false;
    this.renderer.setScissorTest(true);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);

    document.body.appendChild(this.canvas);

    // Lets the stylesheet drop the opaque fallback backgrounds that would
    // otherwise sit on top of the shared canvas.
    document.documentElement.classList.add('has-webgl');

    this._onResize = this._onResize.bind(this);
    this._onPointer = this._onPointer.bind(this);
    this._tick = this._tick.bind(this);

    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('pointermove', this._onPointer, { passive: true });

    this._onResize();
  }

  _onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    for (const v of this.views) if (v.resize) v.resize(this.width, this.height);
  }

  _onPointer(e) {
    this.pointerPx.set(e.clientX, e.clientY);
    this.pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
  }

  /** @param {{el:HTMLElement, scene:THREE.Scene, camera:THREE.Camera, update?:Function}} view */
  add(view) {
    view.visible = false;
    this.views.push(view);
    if (view.resize) view.resize(this.width, this.height);
    return view;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.renderer.setAnimationLoop(this._tick);
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    const t = this.clock.elapsedTime;

    this.renderer.clear(true, true, true);

    for (const view of this.views) {
      const el = view.el;
      if (!el || !el.isConnected) continue;

      const r = el.getBoundingClientRect();

      // Cull anything fully off-screen, with a small margin so scenes are warm
      // by the time they scroll in.
      const margin = 120;
      const onScreen =
        r.bottom > -margin &&
        r.top < this.height + margin &&
        r.right > -margin &&
        r.left < this.width + margin &&
        r.width > 0 &&
        r.height > 0;

      if (!onScreen) {
        if (view.visible && view.onExit) view.onExit();
        view.visible = false;
        continue;
      }
      if (!view.visible && view.onEnter) view.onEnter();
      view.visible = true;

      // How far through its own scroll span this view is: 0 entering from the
      // bottom, 1 leaving past the top. Scenes use it to drive their motion.
      view.progress = THREE.MathUtils.clamp(
        (this.height - r.top) / (this.height + r.height),
        0,
        1
      );
      // 0 -> 1 -> 0 bell over the same span, for fades.
      view.inView = 1 - Math.abs(view.progress * 2 - 1);

      if (view.update) view.update(dt, t, this);

      // WebGL's origin is bottom-left; the DOM's is top-left.
      const left = Math.floor(r.left);
      const bottom = Math.floor(this.height - r.bottom);
      const w = Math.floor(r.width);
      const h = Math.floor(r.height);

      this.renderer.setViewport(left, bottom, w, h);
      this.renderer.setScissor(left, bottom, w, h);

      const cam = view.camera;
      if (cam.isPerspectiveCamera && cam.aspect !== w / h) {
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }

      this.renderer.render(view.scene, cam);
    }
  }
}

export const gl = new GLCore();
export default gl;
