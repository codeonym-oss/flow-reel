// The Orbit logo (GH-109 decision 005): a round player with an empty play shape, wrapped by a timeline cut into clips that
// ends in a playhead, tilted −10°. `phase` turns the timeline around the player; `small` is the one-turn cut used under
// 24 px (decision 006).

type Point = [number, number];

const f = (q: Point) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`;

/** A triangle with circular corners of radius `r`. */
export function roundTriangle(v: [Point, Point, Point], r: number): string {
  const cut = v.map((V, i) => {
    const P = v[(i + 2) % 3]!, N = v[(i + 1) % 3]!;
    const unit = (A: Point): Point => { const dx = A[0] - V[0], dy = A[1] - V[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    const u1 = unit(P), u2 = unit(N), angle = Math.acos(u1[0] * u2[0] + u1[1] * u2[1]), t = r / Math.tan(angle / 2);
    return [[V[0] + u1[0] * t, V[1] + u1[1] * t], [V[0] + u2[0] * t, V[1] + u2[1] * t]] as [Point, Point];
  });
  return `M${f(cut[0]![1])}` + [1, 2, 0].map((i) => `L${f(cut[i]![0])}A${r} ${r} 0 0 1 ${f(cut[i]![1])}`).join("") + "Z";
}

interface Sample { u: number; p: Point; front: boolean; gap: boolean }

/** The timeline's back and front ribbons and its head. */
export function orbit(phase: number, small: boolean) {
  const rot = -24 * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
  const turns = small ? 0 : 1, a0 = (-150 + phase) * Math.PI / 180, a1 = a0 + turns * 2 * Math.PI + 290 * Math.PI / 180, count = small ? 300 : 900;
  const point = (t: number, u: number): Point => {
    const k = small ? 0.95 : 0.68 + 0.32 * u, x = 47 * k * Math.cos(t), y = 18 * k * Math.sin(t);
    return [50 + x * cr - y * sr, 50 + x * sr + y * cr];
  };
  const width = (u: number) => small ? 2 + 5 * u : 0.5 + 4.2 * Math.pow(u, 1.2);
  const clip = (u: number) => !small && u < 0.9 && (u * 9) % 1 > 0.92;
  const samples: Sample[] = [];
  for (let i = 0; i <= count; i++) {
    const u = i / count, t = a0 + (a1 - a0) * u;
    samples.push({ u, p: point(t, u), front: Math.sin(t) >= 0, gap: clip(u) });
  }
  const band = (run: Sample[]) => {
    const left: Point[] = [], right: Point[] = [];
    run.forEach((s, i) => {
      const a = run[Math.max(0, i - 1)]!.p, b = run[Math.min(run.length - 1, i + 1)]!.p;
      const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, h = width(s.u) / 2;
      left.push([s.p[0] - dy / m * h, s.p[1] + dx / m * h]);
      right.push([s.p[0] + dy / m * h, s.p[1] - dx / m * h]);
    });
    return "M" + left.map(f).join("L") + "L" + right.reverse().map(f).join("L") + "Z";
  };
  const runs = { back: [] as string[], front: [] as string[] };
  let current: Sample[] = [];
  const flush = () => { if (current.length > 1) runs[current[0]!.front ? "front" : "back"].push(band(current)); };
  for (const s of samples) {
    if (s.gap) { flush(); current = []; continue; }
    if (current.length && s.front !== current[0]!.front) {
      current.push(s);
      flush();
      current = [current[current.length - 2]!, s];
    } else current.push(s);
  }
  flush();
  const head = samples[samples.length - 1]!;
  return { back: runs.back.join(""), front: runs.front.join(""), head: { x: head.p[0], y: head.p[1], r: small ? 8 : 5.6 }, headFront: head.front };
}

/** The colors on each background: the gradient's two ends, then the timeline. */
export const ORBIT_ON = {
  black: ["#ffd400", "#10b981", "#10b981"],
  white: ["#e8b500", "#059669", "#059669"],
} as const;
