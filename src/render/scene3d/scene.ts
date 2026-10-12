/**
 * Scène three.js partagée (carrelage, parquet) : maillages prêts (MeshData), lumière avec ombres, caméra
 * orbitale (préréglages legacy), murs pleins, bas ou coupés côté caméra (façon maison de poupée).
 * Rendu à la demande : une image seulement quand la caméra ou les données changent (batterie).
 */
import {
  AmbientLight,
  BackSide,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RGBADepthPacking,
  Scene,
  ShapeUtils,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cameraFor, FOV, type CameraPreset } from './camera';
import { CUT_HEIGHT } from './cutaway';
import type { MeshData, SceneFrame } from './types';
import { brand } from '../../ui/brand';

/** Murs : pleins, coupés à hauteur d'appui partout (« bas ») ou seulement côté caméra (« coupés »). */
export type WallMode = 'full' | 'low' | 'cut';
const MODES: Record<WallMode, number> = { full: 0, low: 1, cut: 2 };

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
  private wallMode: WallMode = 'full';
  private highlight: Mesh[] = [];
  /** Uniformes partagés par tous les matériaux : mode des murs, hauteur de coupe, caméra, tranche. */
  private readonly cut = {
    uCutMode: { value: 0 },
    uCutY: { value: CUT_HEIGHT },
    uCam: { value: new Vector3() },
    uCap: { value: new Color(brand.charbon) },
  };
  private layout: SceneFrame | null = null;
  private frame = 0;
  private times: number[] = [];
  stats: SceneStats = { drawCalls: 0, triangles: 0, fps: 0 };
  onStats?: (s: SceneStats) => void;

  constructor(canvas: HTMLCanvasElement, opts: { shadowSize?: number; interactive?: boolean } = {}) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color(brand.ivoire);
    this.scene.add(new AmbientLight('#ffffff', 1.25));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(opts.shadowSize ?? 2048, opts.shadowSize ?? 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.01;
    this.scene.add(this.sun, this.sun.target);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    // aperçu : image fixe, la page défile normalement par-dessus
    this.controls.enabled = opts.interactive ?? true;
    this.controls.addEventListener('change', () => this.requestRender());
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  /** Remplace les maillages ; la caméra n'est recadrée que si `reframe`. */
  setData(meshes: MeshData[], layout: SceneFrame, reframe: CameraPreset | null): void {
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

  setWallMode(mode: WallMode): void {
    if (mode === this.wallMode) return;
    this.wallMode = mode;
    this.cut.uCutMode.value = MODES[mode];
    for (const m of this.meshes) {
      const mat = m.material as Material;
      if (mat.transparent) continue;
      mat.side = this.opaqueSide();
      mat.needsUpdate = true;
    }
    this.requestRender();
  }

  /** Point du sol (x, z en m) sous un point de l'écran, ou null. */
  pickGround(clientX: number, clientY: number): [number, number] | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3());
    return hit ? [hit.x, hit.z] : null;
  }

  /** Surbrillance pétrole d'un contour au sol (x, z en m), ou rien. */
  setHighlight(ring: readonly [number, number][] | null): void {
    for (const m of this.highlight) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
    this.highlight = [];
    if (ring && ring.length >= 3) {
      const y = 0.03;
      const pts = ring.map(([x, z]) => new Vector2(x, z));
      const fill = new BufferGeometry();
      const pos = ShapeUtils.triangulateShape(pts, []).flatMap((t) => t.flatMap((i) => [pts[i]!.x, y, pts[i]!.y]));
      fill.setAttribute('position', new Float32BufferAttribute(pos, 3));
      const band: number[] = [];
      const w = 0.05;
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i]!,
          [bx, bz] = ring[(i + 1) % ring.length]!;
        const l = Math.hypot(bx - ax, bz - az) || 1;
        const nx = (-(bz - az) / l) * w,
          nz = ((bx - ax) / l) * w;
        band.push(ax - nx, y, az - nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz);
        band.push(ax - nx, y, az - nz, bx + nx, y, bz + nz, ax + nx, y, az + nz);
      }
      const edge = new BufferGeometry();
      edge.setAttribute('position', new Float32BufferAttribute(band, 3));
      const mat = (opacity: number) =>
        new MeshBasicMaterial({ color: brand.petrole, transparent: true, opacity, depthTest: false, side: DoubleSide });
      this.highlight = [new Mesh(fill, mat(0.18)), new Mesh(edge, mat(0.9))];
      for (const h of this.highlight) h.renderOrder = 10;
      this.scene.add(...this.highlight);
    }
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
      this.cut.uCam.value.copy(this.camera.position);
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
    this.setHighlight(null);
    for (const t of this.textures.values()) t.dispose();
    this.renderer.dispose();
  }

  private measure(t: number, moving: boolean) {
    const info = this.renderer.info.render;
    this.times.push(t);
    if (this.times.length > 60) this.times.shift();
    const n = this.times.length;
    // dès trois images : un appareil lent (rendu logiciel) donne une mesure, pas 0
    const fps = n >= 3 ? ((n - 1) * 1000) / (this.times[n - 1]! - this.times[0]!) : this.stats.fps;
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
    const walls = d.wallNormals ?? new Array<number>((d.positions.length / 3) * 2).fill(0);
    g.setAttribute('wallNormal', new Float32BufferAttribute(walls, 2));
    const glass = (d.opacity ?? 1) < 1;
    const mat = new MeshLambertMaterial({
      vertexColors: true,
      map: d.photo ? this.texture(d.photo) : null,
      side: glass ? DoubleSide : this.opaqueSide(),
      // ombres comme sans coupe : faces arrière seules (moitié moins de travail qu'en double face)
      shadowSide: BackSide,
      transparent: glass,
      opacity: d.opacity ?? 1,
      depthWrite: !glass,
    });
    this.cutaway(mat, !glass);
    const m = new Mesh(g, mat);
    m.castShadow = d.castShadow;
    m.receiveShadow = d.receiveShadow;
    // ombres cohérentes avec la coupe : un mur coupé n'ombre plus la pièce
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    this.cutaway(depth, false);
    m.customDepthMaterial = depth;
    return m;
  }

  /**
   * Faces arrière dessinées seulement quand les murs sont coupés (leur tranche, en charbon) : murs pleins, elles
   * sont cachées et ne coûtent rien.
   */
  private opaqueSide() {
    return this.wallMode === 'full' ? FrontSide : DoubleSide;
  }

  /** Coupe des murs dans le shader : position monde et normale de mur par sommet ; fragments au-dessus jetés. */
  private cutaway(mat: Material, cap: boolean) {
    mat.customProgramCacheKey = () => `cutaway-${cap}`;
    mat.onBeforeCompile = (s: WebGLProgramParametersWithUniforms) => {
      Object.assign(s.uniforms, this.cut);
      s.vertexShader = s.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec2 wallNormal;\nvarying vec3 vCutPos;\nvarying vec2 vCutN;',
        )
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvCutPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCutN = wallNormal;',
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform int uCutMode;\nuniform float uCutY;\nuniform vec3 uCam;\nuniform vec3 uCap;\nvarying vec3 vCutPos;\nvarying vec2 vCutN;',
        )
        .replace(
          '#include <clipping_planes_fragment>',
          [
            '#include <clipping_planes_fragment>',
            'if (uCutMode > 0 && vCutPos.y > uCutY) {',
            '  bool wall = dot(vCutN, vCutN) > 0.25;',
            // cloison (normale doublée) : toujours coupée ; mur extérieur : coupé s'il regarde la caméra
            '  bool shared = dot(vCutN, vCutN) > 2.0;',
            '  if (uCutMode == 1 || (wall && (shared || dot(vCutN, uCam.xz - vCutPos.xz) > 0.0))) discard;',
            '}',
            // hors des murs repérés, faces arrière masquées comme avant (vues d'un mur, d'un sol)
            ...(cap ? ['if (!gl_FrontFacing && dot(vCutN, vCutN) <= 0.25) discard;'] : []),
          ].join('\n'),
        );
      if (cap)
        s.fragmentShader = s.fragmentShader.replace(
          '#include <opaque_fragment>',
          '#include <opaque_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(uCap, 1.0);',
        );
    };
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
  private placeSun(lay: SceneFrame) {
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
  private applyLimits(lay: SceneFrame) {
    const kind = lay.kind;
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
