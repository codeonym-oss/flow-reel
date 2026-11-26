// The Orbit logo as a component. It turns while `spinning`, unless the person asked for less motion.
import { useEffect, useId, useState } from "preact/hooks";
import { ORBIT_ON, orbit, roundTriangle } from "./orbit.ts";

const PLAY = roundTriangle([[42, 37], [65, 50], [42, 63]], 3.4);
const INNER = roundTriangle([[46.4, 44.4], [56.6, 50], [46.4, 55.6]], 1.2);

export function Logo({ size = 34, light, spinning = false }: { size?: number; light: boolean; spinning?: boolean }) {
  const [phase, setPhase] = useState(0);
  const id = useId().replace(/[^\w-]/g, "");
  useEffect(() => {
    if (!spinning || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = 0, frame = 0;
    const tick = (now: number) => {
      if (last) setPhase((p) => (p + (now - last) * 0.12) % 360);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spinning]);
  const small = size < 24;
  const [a, b, line] = light ? ORBIT_ON.white : ORBIT_ON.black;
  const o = orbit(phase, small);
  const head = <circle cx={o.head.x} cy={o.head.y} r={o.head.r} fill={line} />;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color={b} /><stop offset="1" stop-color={a} /></linearGradient>
        <mask id={`k${id}`} maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
          <rect x="-50" y="-50" width="200" height="200" fill="#fff" />
          <path d={o.front} fill="#000" stroke="#000" stroke-width={small ? 5 : 4.4} stroke-linejoin="round" />
          {o.headFront && <circle cx={o.head.x} cy={o.head.y} r={o.head.r + 2.4} fill="#000" />}
          <path d={PLAY} fill="#000" />
          {!small && <path d={INNER} fill="#fff" />}
        </mask>
      </defs>
      <g transform="rotate(-10 50 50)">
        <path d={o.back} fill={line} />
        {!o.headFront && head}
        <circle cx="50" cy="50" r={small ? 25 : 23} fill={`url(#g${id})`} mask={`url(#k${id})`} />
        <path d={o.front} fill={line} />
        {o.headFront && head}
      </g>
    </svg>
  );
}
