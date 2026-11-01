import React from 'react';
import {Arc, clamp01, Plan, rand} from '../lib/schedule';
import {COLORS, Episode, LngLat, Timeline} from '../lib/types';

type Proj = (ll: LngLat) => [number, number];

const W = 1080;
const H = 1056;

const geoCircle = (c: LngLat, km: number, n = 48, a0 = 0, a1 = 360): LngLat[] => {
  const pts: LngLat[] = [];
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((c[1] * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([c[0] + Math.sin(a) * dLng, c[1] + Math.cos(a) * dLat]);
  }
  return pts;
};

const poly = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

const arcColor = (a: Arc) => (a.side === 'nk' ? COLORS.nk : a.side === 'chunmoo' ? COLORS.chunmoo : COLORS.rokLight);

/** 포물선 탄도: 지도 위 직선 경로를 화면에서 위로 들어 올린 곡선 */
const arcPoints = (a: Arc, project: Proj, p0: number, p1: number, n = 26): [number, number][] => {
  const A = project(a.from);
  const B = project(a.to);
  const dist = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const h = Math.max(70, Math.min(420, dist * (a.side === 'chunmoo' ? 0.32 : 0.45)));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = p0 + ((p1 - p0) * i) / n;
    pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - h * 4 * t * (1 - t)]);
  }
  return pts;
};

const Label: React.FC<{x: number; y: number; text: string; size: number; color?: string}> = ({x, y, text, size, color = '#fff'}) => {
  const w = text.length * size * 0.98 + 26;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-w / 2} y={-size * 0.82 - 10} width={w} height={size + 18} rx={8} fill="rgba(0,0,0,0.78)" stroke="rgba(255,255,255,0.25)" />
      <text textAnchor="middle" y={4} fontSize={size} fontFamily="Pretendard" fontWeight={900} fill={color}>{text}</text>
    </g>
  );
};

export const MapOverlay: React.FC<{sec: number; episode: Episode; timeline: Timeline; plan: Plan; project: Proj}> = ({sec, episode, plan, project}) => {
  const m = episode.map;
  const p2 = sec >= plan.t2;
  const inView = ([x, y]: [number, number]) => x > -200 && x < W + 200 && y > -300 && y < H + 200;

  // 비행 중인 탄도
  const flying = plan.arcs.filter((a) => sec >= a.launch && sec <= a.launch + a.flight);
  // 폭발
  const blasts = plan.blasts.filter((b) => sec >= b.t && sec <= b.t + 1.0);
  // 1단계 착탄 뒤 남는 불길 (2단계 진입 1.5초 후 서서히 사라짐)
  const fires = plan.blasts.filter((b, i) => b.side === 'nk' && sec > b.t + 0.3 && i % 2 === 0);
  const fireFade = clamp01(1 - (sec - (plan.t2 + 1.5)) / 2.5);

  const seoul = project(m.seoul);
  const radar = project(m.radar);

  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="flash">
          <stop offset="0%" stopColor="#fff8e0" stopOpacity="1" />
          <stop offset="35%" stopColor="#ffb340" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff3d00" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="flashBlue">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="30%" stopColor="#ffcf6a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ff2a00" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ember">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ff4500" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070a" stopOpacity="0.85" />
          <stop offset="0.16" stopColor="#05070a" stopOpacity="0" />
          <stop offset="0.82" stopColor="#05070a" stopOpacity="0" />
          <stop offset="1" stopColor="#05070a" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* 남은 불길 */}
      {fireFade > 0 && fires.map((b, i) => {
        const [x, y] = project(b.pos);
        if (!inView([x, y])) return null;
        const fl = 0.6 + 0.4 * Math.sin(sec * 9 + i * 1.7);
        return <circle key={`f${i}`} cx={x} cy={y} r={10 + 8 * fl} fill="url(#ember)" opacity={0.75 * fireFade} />;
      })}

      {/* 서울 타깃 펄스 링 (1단계) */}
      {!p2 && [0, 1, 2].map((k) => {
        const ph = ((sec * 0.85 + k / 3) % 1);
        const ring = geoCircle(m.seoul, 4 + ph * 22).map(project);
        return <path key={`pr${k}`} d={poly(ring) + 'Z'} fill="none" stroke={COLORS.nk} strokeWidth={4 - ph * 3} opacity={(1 - ph) * 0.95} />;
      })}
      {!p2 && (
        <g>
          <path d={poly(geoCircle(m.seoul, 3).map(project)) + 'Z'} fill={COLORS.nk} opacity={0.35 + 0.25 * Math.sin(sec * 8)} />
          <line x1={seoul[0] - 34} y1={seoul[1]} x2={seoul[0] + 34} y2={seoul[1]} stroke="#fff" strokeWidth={2} />
          <line x1={seoul[0]} y1={seoul[1] - 34} x2={seoul[0]} y2={seoul[1] + 34} stroke="#fff" strokeWidth={2} />
        </g>
      )}

      {/* 레이더 (2단계) */}
      {p2 && sec >= plan.radarStart && sec < plan.traceEnd + 2.5 && (() => {
        const k = clamp01((sec - plan.radarStart) / 0.6) * clamp01((plan.traceEnd + 2.5 - sec) / 0.8);
        const ang = ((sec - plan.radarStart) * 260) % 360;
        const wedge = [radar, ...geoCircle(m.radar, 70, 16, ang - 40, ang).map(project)];
        return (
          <g opacity={k}>
            {[25, 50, 70].map((km) => (
              <path key={km} d={poly(geoCircle(m.radar, km).map(project)) + 'Z'} fill="none" stroke={COLORS.rokLight} strokeWidth={2} strokeDasharray="10 8" opacity={0.7} />
            ))}
            <path d={poly(wedge) + 'Z'} fill={COLORS.rokLight} opacity={0.32} />
            <circle cx={radar[0]} cy={radar[1]} r={24} fill={COLORS.rokLight} opacity={0.3} />
            <circle cx={radar[0]} cy={radar[1]} r={11} fill={COLORS.rokLight} />
          </g>
        );
      })()}

      {/* 역추적 선 */}
      {p2 && sec >= plan.traceStart && sec < plan.counterStart + 3 && m.nkOrigins.map((o, i) => {
        const st = plan.traceStart + i * 0.18;
        const k = clamp01((sec - st) / 1.0);
        if (k <= 0) return null;
        const A = radar;
        const B = project(o);
        const fade = clamp01((plan.counterStart + 3 - sec) / 1.0);
        return (
          <line key={`tr${i}`} x1={A[0]} y1={A[1]} x2={A[0] + (B[0] - A[0]) * k} y2={A[1] + (B[1] - A[1]) * k}
            stroke={COLORS.chunmoo} strokeWidth={3} strokeDasharray="14 10" strokeDashoffset={-sec * 60} opacity={0.85 * fade} />
        );
      })}

      {/* 북측 갱도 진지 */}
      {m.nkOrigins.map((o, i) => {
        const [x, y] = project(o);
        if (!inView([x, y])) return null;
        const dead = sec >= plan.destroyedAt[i];
        const fired = !p2 && plan.arcs.some((a) => a.side === 'nk' && a.originIdx === i && sec >= a.launch && sec < a.launch + 0.22);
        const locked = p2 && sec >= plan.traceStart + i * 0.18 + 1.0;
        return (
          <g key={`o${i}`} transform={`translate(${x},${y})`}>
            {fired && <circle r={30} fill="url(#flash)" />}
            {!dead ? (
              <path d="M0,-17 L15,11 L-15,11 Z" fill={COLORS.nk} stroke="#fff" strokeWidth={2.5} />
            ) : (
              <g>
                <circle r={22 + 5 * Math.sin(sec * 10 + i)} fill="url(#ember)" opacity={0.9} />
                <path d="M-14,-14 L14,14 M14,-14 L-14,14" stroke="#111" strokeWidth={7} />
                <path d="M-14,-14 L14,14 M14,-14 L-14,14" stroke="#fff" strokeWidth={3} />
              </g>
            )}
            {locked && !dead && (
              <g stroke={COLORS.chunmoo} strokeWidth={3} fill="none" opacity={0.6 + 0.4 * Math.sin(sec * 14)}>
                <path d="M-28,-14 L-28,-28 L-14,-28 M14,-28 L28,-28 L28,-14 M28,14 L28,28 L14,28 M-14,28 L-28,28 L-28,14" />
              </g>
            )}
          </g>
        );
      })}

      {/* 아군 K9·천무 진지 */}
      {p2 && m.k9Sites.map((s, i) => {
        const [x, y] = project(s.pos);
        const col = s.kind === 'chunmoo' ? COLORS.chunmoo : COLORS.rokLight;
        const fired = plan.arcs.some((a) => a.side !== 'nk' && Math.hypot(a.from[0] - s.pos[0], a.from[1] - s.pos[1]) < 0.05 && sec >= a.launch && sec < a.launch + 0.2);
        const appear = clamp01((sec - (plan.counterStart - 1.2)) / 0.5);
        return (
          <g key={`k${i}`} transform={`translate(${x},${y}) scale(${appear})`} opacity={appear}>
            {fired && <circle r={34} fill="url(#flashBlue)" />}
            <rect x={-15} y={-15} width={30} height={30} fill={col} stroke="#fff" strokeWidth={2.5} />
            <text y={-26} textAnchor="middle" fontSize={30} fontFamily="Pretendard" fontWeight={900} fill={col} stroke="#000" strokeWidth={5} paintOrder="stroke">
              {s.name} {s.kind === 'chunmoo' ? '천무' : 'K9'}
            </text>
          </g>
        );
      })}

      {/* 탄도 궤적 */}
      <g>
        {flying.map((a, i) => {
          const p = (sec - a.launch) / a.flight;
          const pe = a.side === 'nk' ? p : Math.pow(p, 0.92);
          const trail = arcPoints(a, project, Math.max(0, pe - (a.side === 'nk' ? 0.42 : 0.5)), pe);
          const full = arcPoints(a, project, 0, 1, 30);
          const head = trail[trail.length - 1];
          const col = arcColor(a);
          return (
            <g key={`a${i}`}>
              <path d={poly(full)} fill="none" stroke={col} strokeWidth={1.4} opacity={0.22} />
              {/* 발광: 블러 필터 대신 굵은 반투명 선을 겹침 (렌더 속도) */}
              <path d={poly(trail)} fill="none" stroke={col} strokeWidth={22} strokeLinecap="round" opacity={0.16} />
              <path d={poly(trail)} fill="none" stroke={col} strokeWidth={12} strokeLinecap="round" opacity={0.3} />
              <path d={poly(trail)} fill="none" stroke={col} strokeWidth={a.side === 'chunmoo' ? 5 : 6} strokeLinecap="round" opacity={0.95} />
              <path d={poly(trail.slice(Math.floor(trail.length * 0.6)))} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
              <circle cx={head[0]} cy={head[1]} r={18} fill={col} opacity={0.35} />
              <circle cx={head[0]} cy={head[1]} r={7} fill="#fff" />
            </g>
          );
        })}
      </g>

      {/* 폭발 */}
      {blasts.map((b, i) => {
        const [x, y] = project(b.pos);
        if (!inView([x, y])) return null;
        const k = (sec - b.t) / 1.0;
        const big = b.side === 'rok' ? 1.35 : 1;
        const r = (16 + 70 * Math.pow(k, 0.5)) * b.size * big;
        return (
          <g key={`b${i}`}>
            <circle cx={x} cy={y} r={r * 0.75} fill={b.side === 'rok' ? 'url(#flashBlue)' : 'url(#flash)'} opacity={1 - k} />
            <circle cx={x} cy={y} r={r} fill="none" stroke="#fff" strokeWidth={3 * (1 - k)} opacity={(1 - k) * 0.8} />
            {k < 0.12 && <circle cx={x} cy={y} r={14 * b.size} fill="#fff" />}
            {b.side === 'rok' && [0, 1, 2, 3, 4].map((j) => {
              const ang = rand(i * 7 + j) * Math.PI * 2;
              const d = r * 0.9;
              return <circle key={j} cx={x + Math.cos(ang) * d} cy={y + Math.sin(ang) * d * 0.6 - k * 20} r={3.5} fill="#ffd27a" opacity={1 - k} />;
            })}
          </g>
        );
      })}

      {/* 지명 라벨 */}
      {m.labels.filter((l) => l.phase === 0 || (l.phase === 2 && p2) || (l.phase === 1 && !p2)).map((l, i) => {
        const [x, y] = project(l.pos);
        if (!inView([x, y])) return null;
        const isSeoul = l.text === '서울';
        return <Label key={`l${i}`} x={x} y={y - (isSeoul ? 62 : 44)} text={l.text} size={l.size} color={isSeoul ? '#fff' : '#ffe9a8'} />;
      })}
      {p2 && sec >= plan.radarStart && sec < plan.traceEnd + 2.5 && (
        <Label x={radar[0]} y={radar[1] - 44} text="대포병 탐지레이더" size={30} color={COLORS.chunmoo} />
      )}

      {/* 위·아래 가장자리 페이드 (상단 카드·하단 자막과 자연스럽게 연결) */}
      <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" />
    </svg>
  );
};
