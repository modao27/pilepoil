/**
 * Scène three.js : maillages de meshes.ts, lumière avec ombres, caméra orbitale (préréglages legacy).
 * Rendu à la demande : une image seulement quand la caméra ou les données changent (batterie).
 */
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MeshData } from './meshes';
import { cameraFor, FOV, type CameraPreset, type SceneLayout } from './placement';

/** Direction de la lumière (legacy LDIR), normalisée. */
const LDIR = new Vector3(-0.45, 0.75, 0.55).normalize();

export interface SceneStats {
  drawCalls: number;
  triangles: number;
  /** Images par seconde mesurées pendant le dernier mouvement de caméra. */
  fps: number;
}

export class Scene3D {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.05, 200);
  private readonly controls: OrbitControls;
  private readonly sun = new DirectionalLight('#ffffff', 2.1);
  private readonly textures = new Map<string, Texture>();
  private readonly loader = new TextureLoader();
  private meshes: Mesh[] = [];
  private layout: SceneLayout | null = null;
  private frame = 0;
  private times: number[] = [];
  stats: SceneStats = { drawCalls: 0, triangles: 0, fps: 0 };
  onStats?: (s: SceneStats) => void;

  constructor(canvas: HTMLCanvasElement, opts: { shadowSize?: number } = {}) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color('#e6eaec');
    this.scene.add(new AmbientLight('#ffffff', 1.25));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(opts.shadowSize ?? 2048, opts.shadowSize ?? 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.01;
    this.scene.add(this.sun, this.sun.target);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.addEventListener('change', () => this.requestRender());
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  /** Remplace les maillages ; la caméra n'est recadrée que si `reframe`. */
  setData(meshes: MeshData[], layout: SceneLayout, reframe: CameraPreset | null): void {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
    this.meshes = meshes.map((d) => this.toMesh(d));
    this.scene.add(...this.meshes);
    this.layout = layout;
    this.placeSun(layout);
    this.applyLimits(layout);
    if (reframe) this.setPreset(reframe);
    this.requestRender();
  }

  setPreset(p: CameraPreset): void {
    if (!this.layout) return;
    const c = cameraFor(this.layout, p);
    this.controls.target.set(...c.target);
    this.camera.position.set(...c.position);
    this.controls.update();
    this.requestRender();
  }

  /** Tourne la caméra (clavier) : radians autour de la verticale et en hauteur. */
  orbit(dYaw: number, dPitch: number): void {
    const off = this.camera.position.clone().sub(this.controls.target);
    const r = off.length();
    let yaw = Math.atan2(off.x, off.z) + dYaw,
      pitch = Math.asin(off.y / r) + dPitch;
    yaw = Math.min(this.controls.maxAzimuthAngle, Math.max(this.controls.minAzimuthAngle, yaw));
    pitch = Math.min(
      Math.PI / 2 - this.controls.minPolarAngle,
      Math.max(Math.PI / 2 - this.controls.maxPolarAngle, pitch),
    );
    this.camera.position.set(
      this.controls.target.x + r * Math.sin(yaw) * Math.cos(pitch),
      this.controls.target.y + r * Math.sin(pitch),
      this.controls.target.z + r * Math.cos(yaw) * Math.cos(pitch),
    );
    this.controls.update();
    this.requestRender();
  }

  /** Rotation automatique de la maquette (présentation) ; rendu continu tant qu'elle tourne. */
  setAutoRotate(on: boolean): void {
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 4;
    this.times = [];
    this.requestRender();
  }

  zoom(f: number): void {
    const off = this.camera.position.clone().sub(this.controls.target).multiplyScalar(f);
    const d = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, off.length()));
    this.camera.position.copy(this.controls.target).add(off.setLength(d));
    this.controls.update();
    this.requestRender();
  }

  requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame((t) => {
      this.frame = 0;
      const moving = this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.measure(t, moving);
      if (moving) this.requestRender();
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.controls.dispose();
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
    for (const t of this.textures.values()) t.dispose();
    this.renderer.dispose();
  }

  private measure(t: number, moving: boolean) {
    const info = this.renderer.info.render;
    this.times.push(t);
    if (this.times.length > 60) this.times.shift();
    const n = this.times.length;
    const fps = n > 10 ? ((n - 1) * 1000) / (this.times[n - 1]! - this.times[0]!) : this.stats.fps;
    this.stats = { drawCalls: info.calls, triangles: info.triangles, fps: Math.round(fps) };
    if (!moving) this.times = [];
    this.onStats?.(this.stats);
  }

  private toMesh(d: MeshData): Mesh {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(d.positions, 3));
    g.setAttribute('normal', new Float32BufferAttribute(d.normals, 3));
    g.setAttribute('color', new Float32BufferAttribute(d.colors, 3));
    if (d.photo) g.setAttribute('uv', new Float32BufferAttribute(d.uvs, 2));
    const mat = new MeshLambertMaterial({ vertexColors: true, map: d.photo ? this.texture(d.photo) : null });
    const m = new Mesh(g, mat);
    m.castShadow = d.castShadow;
    m.receiveShadow = d.receiveShadow;
    return m;
  }

  private texture(url: string): Texture {
    let t = this.textures.get(url);
    if (!t) {
      t = this.loader.load(url, () => this.requestRender());
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.textures.set(url, t);
    }
    return t;
  }

  /** Soleil orienté comme legacy, caméra d'ombre ajustée à la scène. */
  private placeSun(lay: SceneLayout) {
    const { x, z, h } = lay.bounds;
    const c = new Vector3((x[0] + x[1]) / 2, h / 2, (z[0] + z[1]) / 2);
    const span = Math.max(x[1] - x[0], z[1] - z[0], h, 1) + 2;
    this.sun.position.copy(c).addScaledVector(LDIR, span * 2);
    this.sun.target.position.copy(c);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -span;
    cam.right = cam.top = span;
    cam.near = 0.1;
    cam.far = span * 5;
    cam.updateProjectionMatrix();
  }

  /** Limites de caméra legacy : mur vu de face (lacet ±1,2), sol et pièce vus d'en haut. */
  private applyLimits(lay: SceneLayout) {
    const kind = lay.room ? 'room' : lay.instances[0]?.kind === 'floor' ? 'floor' : 'wall';
    const { x, z, h } = lay.bounds;
    const span = Math.max(x[1] - x[0], z[1] - z[0], h, 0.5);
    const base = (span * 0.55) / Math.tan(((FOV / 2) * Math.PI) / 180);
    this.controls.minDistance = base * 0.35;
    this.controls.maxDistance = base * 3;
    if (kind === 'wall') {
      this.controls.minAzimuthAngle = -1.2;
      this.controls.maxAzimuthAngle = 1.2;
      this.controls.minPolarAngle = Math.PI / 2 - 1.0;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    } else {
      this.controls.minAzimuthAngle = -Infinity;
      this.controls.maxAzimuthAngle = Infinity;
      this.controls.minPolarAngle = Math.PI / 2 - 1.5;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.12;
    }
  }
}
