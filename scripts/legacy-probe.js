/* Injecté dans legacy/calepinage.html par extract-legacy.ts.
   Utilise window.__legacy (exposé par un ajout en mémoire à la fin de l'IIFE legacy). */
window.__dump = async function (cfg) {
  const L = window.__legacy;
  const area = (p) => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  };
  const normalized = () => {
    const P = L.proj();
    return JSON.parse(
      JSON.stringify({ surfaces: P.surfaces, active: P.active, room: P.room }, (k, v) =>
        ['id', 'photo', 'photoRot', 'view', 'sel', 'rsel', 'fsel', 'nums', 'target', 'shade', 'name', 'role'].includes(
          k,
        )
          ? undefined
          : v,
      ),
    );
  };

  L.applyState(cfg.project);
  const m = L.model();
  const input = normalized();
  if (!m) return { input, error: L.err() };

  const all = m.all;
  const idx = new Map(all.map((p, i) => [p, i]));
  const pieces = all.map((p) => ({
    surface: p.surf,
    zone: p.z,
    full: p.full,
    thin: p.thin,
    vis: p.vis.length,
    outline: p.outline.length,
    minD: p.minD,
    pw: p.pw,
    ph: p.ph,
    fw: p.fw,
    fh: p.fh,
    rect: p.rect,
    notch: !!p.notch,
    atFold: !!p.atFold,
    drill: p.drill ? p.drill.split(',').length : 0,
    req: p.req,
    shape: p.shape,
    kind: p.kind,
    par: p.par,
    key: p.key,
    color: p.color,
    tA: p.tA,
    tW: p.tW,
    tH: p.tH,
    box: p.box,
    reused: !!p.reused,
    source: p.src ? p.src.n : null,
    reveal: p.reveal || null,
    plinth: !!p.plinth,
    parts: p.parts ? p.parts.length : 0,
    area: p.parts ? p.parts.reduce((t, q) => t + area(q), 0) : null,
  }));
  const groups = m.groups.map((g) => ({
    key: g.key,
    shape: g.shape,
    W: g.W,
    H: g.H,
    tA: g.tA,
    label: g.label,
    color: g.color,
    box: g.box,
    kind: g.kind,
    full: g.full,
    cuts: g.cuts.map((p) => idx.get(p)),
    tiles: g.tiles.map((t) => ({ n: t.n, pieces: t.pieces.map((p) => idx.get(p)) })),
  }));
  const met = L.metrics();
  const metrics = {
    posed: met.posed,
    needed: met.needed,
    order: met.order,
    m2: met.m2,
    boxes: met.boxes,
    cuts: met.cuts,
    thin: met.thin,
    vis: met.vis,
    reused: met.reused,
    minCut: met.minCut,
  };
  const shopping = L.shoppingItems(m.groups, m.glueAll).map((it) => ({ key: it.key, mult: it.mult, qty: it.qty }));
  const glue = m.glueAll.map((x) => ({
    surface: x.si,
    zone: x.i,
    notch: x.g.notch,
    double: x.g.dbl,
    kgPerM2: x.g.kg,
    note: x.g.note,
    S: x.g.S,
    m2: x.m2,
    kg: x.kg,
    jointKg: x.jointKg,
    n: x.n,
    long: x.long,
  }));
  const layout = { over: m.lay.over, left: m.lay.left, rects: m.lay.rects };
  const out = { input, pieces, groups, metrics, shopping, glue, layout, note: L.note() };

  if (cfg.optimize) {
    L.setGoal(cfg.optimize.goal);
    await L.optimize(cfg.optimize.zones);
    out.optimized = L.proj().surfaces[0].zones.map((z) => ({ dx: z.dx, dy: z.dy, start: z.start }));
    const after = L.metrics();
    out.optimizedMetrics = { needed: after.needed, thin: after.thin, vis: after.vis };
  }
  return out;
};
