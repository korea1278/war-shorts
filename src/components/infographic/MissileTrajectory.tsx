// 변칙 궤도 vs 요격 미사일 궤적 (EP06~)
//  - 북한 KN-23: 붉은 궤적선, 종말 단계에서 다시 솟구치는 풀업(Pull-up) 기동 + 예상 궤도(점선) 비교
//  - 아군 요격탄: 고도별 포대에서 수직 상승 → 표적과 교차 → 섬광 + 충격파(Shockwave) 링 + 파편
//  모든 위치는 sim(초의 순수 함수)에서 계산. 블러·필터 없음
import React from 'react';
import {Blast, icPoint, KCOLOR, rocketXY, Sim, uAt, whXY} from '../../ep06/sim';

const RED = '#FF2828';
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const poly = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

/** 진행 방향 삼각형 탄두 */
const Head: React.FC<{x: number; y: number; ang: number; color: string; r?: number}> = ({x, y, ang, color, r = 13}) => (
  <g transform={`translate(${x} ${y}) rotate(${ang})`}>
    <circle r={r * 2.1} fill={color} fillOpacity={0.22} />
    <path d={`M${r * 1.8} 0 L${-r} ${r * 0.9} L${-r * 0.5} 0 L${-r} ${-r * 0.9} Z`} fill="#fff" stroke={color} strokeWidth={4} strokeLinejoin="round" />
  </g>
);

const angle = (a: [number, number], b: [number, number]) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

const Trail: React.FC<{pts: [number, number][]; color: string; width: number; op: number}> = ({pts, color, width, op}) => {
  if (pts.length < 2) return null;
  const d = poly(pts);
  return (
    <g opacity={op} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={color} strokeOpacity={0.18} strokeWidth={width * 3.2} />
      <path d={d} stroke={color} strokeOpacity={0.45} strokeWidth={width * 1.8} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  );
};

const BlastFx: React.FC<{b: Blast; sec: number}> = ({b, sec}) => {
  const e = (sec - b.t) / (b.ground ? 1.4 : 0.9);
  if (e < 0 || e > 1) return null;
  const s = b.size;
  return (
    <g>
      <circle cx={b.x} cy={b.y} r={s * (0.35 + 0.9 * Math.sqrt(e))} fill="#fff" fillOpacity={Math.max(0, 1 - e * 2.2)} />
      <circle cx={b.x} cy={b.y} r={s * (0.5 + 0.9 * e)} fill={b.color} fillOpacity={0.55 * (1 - e)} />
      {[0, 1].map((i) => {
        const k = clamp01(e * 1.3 - i * 0.25);
        return k > 0 ? <circle key={i} cx={b.x} cy={b.y} r={s * (0.6 + 2.4 * k)} fill="none" stroke={b.color} strokeWidth={10 * (1 - k) + 2} strokeOpacity={1 - k} /> : null;
      })}
      {Array.from({length: 8}).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        const r0 = s * (0.5 + 1.6 * e), r1 = r0 + s * 0.45 * (1 - e);
        return <line key={i} x1={b.x + Math.cos(a) * r0} y1={b.y + Math.sin(a) * r0} x2={b.x + Math.cos(a) * r1} y2={b.y + Math.sin(a) * r1}
          stroke="#fff" strokeWidth={6} strokeLinecap="round" opacity={1 - e} />;
      })}
    </g>
  );
};

/** 추적 박스 (네 모서리) */
const Bracket: React.FC<{x: number; y: number; s?: number; color?: string}> = ({x, y, s = 46, color = '#FFD000'}) => {
  const c = s * 0.45;
  const d = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    `M${x + sx * s} ${y + sy * s - sy * c} L${x + sx * s} ${y + sy * s} L${x + sx * s - sx * c} ${y + sy * s}`).join('');
  return <path d={d} fill="none" stroke={color} strokeWidth={6} strokeLinecap="square" />;
};

type Props = {
  sim: Sim;
  sec: number;
  showPredicted: boolean; // 풀업 장면: 예상 궤도 점선
  trackFrom: number; // 이 시각부터 풀업 탄두 추적 박스
  pullupLabelAt: number;
};

export const MissileTrajectory: React.FC<Props> = ({sim, sec, showPredicted, trackFrom, pullupLabelAt}) => {
  const items: React.ReactNode[] = [];
  // 북한 탄두
  sim.warheads.forEach((w) => {
    const tNow = Math.min(sec, w.end);
    const u = uAt(w.keys, tNow);
    if (u === null) return;
    const fade = sec > w.end ? 1 - clamp01((sec - w.end) / 0.7) : 1;
    if (fade <= 0) return;
    const u0 = w.keys[0][1];
    const n = 48;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) pts.push(whXY(w, u0 + ((u - u0) * i) / n));
    if (showPredicted && w.pullup && sec < w.end) {
      const pred: [number, number][] = [];
      for (let i = 0; i <= 30; i++) pred.push(whXY(w, 0.5 + (0.5 * i) / 30, false));
      items.push(<path key={`pr${w.id}`} d={poly(pred)} fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={5} strokeDasharray="16 14" />);
    }
    items.push(<Trail key={`t${w.id}`} pts={pts} color={RED} width={7} op={fade} />);
    if (sec < w.end) {
      const a = whXY(w, Math.max(u0, u - 0.01));
      const b = whXY(w, u);
      items.push(<Head key={`h${w.id}`} x={b[0]} y={b[1]} ang={angle(a, b)} color={RED} />);
      if (w.pullup && sec >= trackFrom) items.push(<Bracket key={`b${w.id}`} x={b[0]} y={b[1]} />);
    }
  });
  // 장사정포탄 (낮은 포물선)
  sim.rockets.forEach((r) => {
    if (sec < r.t0) return;
    const fade = sec > r.end ? 1 - clamp01((sec - r.end) / 0.5) : 1;
    if (fade <= 0) return;
    const u = clamp01((Math.min(sec, r.end) - r.t0) / r.dur);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 24; i++) pts.push(rocketXY(r, (u * i) / 24));
    items.push(<Trail key={`rt${r.id}`} pts={pts} color={RED} width={4} op={fade * 0.9} />);
    if (sec < r.end) {
      const a = rocketXY(r, Math.max(0, u - 0.02));
      const b = rocketXY(r, u);
      items.push(<Head key={`rh${r.id}`} x={b[0]} y={b[1]} ang={angle(a, b)} color={RED} r={8} />);
    }
  });
  // 아군 요격탄
  sim.interceptors.forEach((ic, i) => {
    if (sec < ic.t0) return;
    const fade = sec > ic.t1 ? 1 - clamp01((sec - ic.t1) / 0.6) : 1;
    if (fade <= 0) return;
    const s = Math.pow(clamp01((sec - ic.t0) / (ic.t1 - ic.t0)), 1.25);
    const pts: [number, number][] = [];
    for (let k = 0; k <= 24; k++) pts.push(icPoint(ic, (s * k) / 24));
    const col = KCOLOR[ic.kind];
    items.push(<Trail key={`it${i}`} pts={pts} color={col} width={ic.kind === 'lamd' ? 4 : 6} op={fade} />);
    if (sec < ic.t1) {
      const a = icPoint(ic, Math.max(0, s - 0.03));
      const b = icPoint(ic, s);
      items.push(<Head key={`ih${i}`} x={b[0]} y={b[1]} ang={angle(a, b)} color={col} r={ic.kind === 'lamd' ? 8 : 11} />);
    }
    // 발사 불꽃
    const f = sec - ic.t0;
    if (f < 0.35) items.push(<circle key={`if${i}`} cx={ic.fx} cy={icPoint(ic, 0)[1]} r={26 + 60 * f} fill="#FFE27A" fillOpacity={0.8 * (1 - f / 0.35)} />);
  });
  sim.blasts.forEach((b, i) => items.push(<BlastFx key={`bl${i}`} b={b} sec={sec} />));
  // 풀업 정점 경고 라벨
  const pw = sim.warheads.find((w) => w.pullup);
  if (pw && sec > pullupLabelAt - 0.2 && sec < pullupLabelAt + 2.4) {
    const [x, y] = whXY(pw, 0.66);
    const k = clamp01((sec - pullupLabelAt + 0.2) / 0.25);
    items.push(
      <g key="pl" transform={`translate(${x} ${y - 120}) scale(${0.6 + 0.4 * k})`} opacity={k}>
        <rect x={-150} y={-46} width={300} height={78} rx={14} fill="#FF2828" stroke="#000" strokeWidth={6} />
        <text x={0} y={12} textAnchor="middle" fontSize={44} fontWeight={900} fill="#fff" stroke="#000" strokeWidth={6} paintOrder="stroke"
          style={{fontFamily: 'Pretendard, sans-serif'}}>풀업 기동!</text>
        <path d="M-16 32 L16 32 L0 70 Z" fill="#FF2828" stroke="#000" strokeWidth={5} strokeLinejoin="round" />
      </g>,
    );
  }
  return <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>{items}</svg>;
};
