// 순수 SVG 벡터 에셋 (외부 이미지·이모지 글꼴 불필요, 어떤 해상도에서도 선명)
//  전투기·군함·돈다발·핵 마크·태극기·인공기
import React from 'react';

const OUT = '#000';

/** 전투기 (위에서 본 실루엣, 기수=위쪽). heading: 0=북, 180=남 */
export const Jet: React.FC<{size: number; color: string; heading?: number}> = ({size, color, heading = 0}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{transform: `rotate(${heading}deg)`, overflow: 'visible'}}>
    <path d="M50 2 L56 28 L57 42 L95 64 L95 73 L57 64 L55 82 L69 92 L69 97 L50 93 L31 97 L31 92 L45 82 L43 64 L5 73 L5 64 L43 42 L44 28 Z"
      fill={color} stroke={OUT} strokeWidth={4} strokeLinejoin="round" />
    <path d="M50 12 L53 30 L47 30 Z" fill="#cfe8ff" stroke={OUT} strokeWidth={2} />
  </svg>
);

/** 군함 (옆에서 본 실루엣) */
export const Warship: React.FC<{width: number; color: string; flip?: boolean}> = ({width, color, flip}) => (
  <svg width={width} height={width * 0.42} viewBox="0 0 220 92" style={{transform: flip ? 'scaleX(-1)' : undefined, overflow: 'visible'}}>
    <path d="M2 58 L218 58 L198 84 L22 84 Z" fill={color} stroke={OUT} strokeWidth={4} strokeLinejoin="round" />
    <path d="M60 58 L66 38 L130 38 L134 58 Z" fill={color} stroke={OUT} strokeWidth={4} strokeLinejoin="round" />
    <path d="M84 38 L88 22 L114 22 L116 38 Z" fill={color} stroke={OUT} strokeWidth={4} strokeLinejoin="round" />
    <path d="M100 22 L100 4 M92 10 L108 10" stroke={OUT} strokeWidth={4} strokeLinecap="round" />
    <path d="M150 58 L152 48 L170 48 L172 58 Z M170 52 L196 46" fill={color} stroke={OUT} strokeWidth={4} strokeLinejoin="round" />
    <path d="M10 88 Q60 80 110 88 T210 88" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={4} />
  </svg>
);

/** 돈다발 (지폐 묶음) */
export const MoneyStack: React.FC<{width: number; bundles?: number}> = ({width, bundles = 3}) => {
  const h = 26;
  return (
    <svg width={width} height={width * ((bundles * h + 30) / 200)} viewBox={`0 0 200 ${bundles * h + 30}`} style={{overflow: 'visible'}}>
      {Array.from({length: bundles}).map((_, i) => {
        const y = (bundles - 1 - i) * h + 8;
        const off = (i % 2) * 8 - 4;
        return (
          <g key={i} transform={`translate(${off},${y})`}>
            <rect x={10} y={0} width={180} height={h} rx={4} fill="#e7c55a" stroke={OUT} strokeWidth={4} />
            <rect x={18} y={5} width={164} height={h - 10} rx={3} fill="none" stroke="#8a6d16" strokeWidth={2.5} />
            <circle cx={100} cy={h / 2} r={8} fill="#c9a33a" stroke="#8a6d16" strokeWidth={2.5} />
            <rect x={86} y={-2} width={28} height={h + 4} fill="#fff" stroke={OUT} strokeWidth={3} />
          </g>
        );
      })}
    </svg>
  );
};

/** 핵 마크 (방사능 3엽) */
export const NukeIcon: React.FC<{size: number}> = ({size}) => {
  const blade = (rot: number) => (
    <path key={rot} transform={`rotate(${rot} 50 50)`} d="M50 50 L50 14 A36 36 0 0 1 81.2 32 Z" fill="#000" />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={47} fill="#FFD000" stroke="#000" strokeWidth={5} />
      <g>{[0, 120, 240].map((r) => blade(r))}</g>
      <circle cx={50} cy={50} r={12} fill="#FFD000" />
      <circle cx={50} cy={50} r={8} fill="#000" />
    </svg>
  );
};

/** 태극기 (3:2) — w x h 영역에 그림 */
export const Taegukgi: React.FC<{x: number; y: number; w: number}> = ({x, y, w}) => {
  const h = (w * 2) / 3;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = h / 4;
  const bar = h / 24; // 괘 막대 두께
  const len = h / 4;
  const gap = bar / 2;
  // 괘: 대각선 방향(각도), 3줄 각각 끊김 여부
  const trig = (ang: number, pattern: boolean[]) => {
    const d = r + h / 8 + (3 * bar + 2 * gap) / 2;
    const px = cx + Math.cos((ang * Math.PI) / 180) * d * 1.2;
    const py = cy + Math.sin((ang * Math.PI) / 180) * d;
    return (
      <g key={ang} transform={`translate(${px},${py}) rotate(${ang + 90})`}>
        {pattern.map((broken, i) => {
          const yy = (i - 1) * (bar + gap) - bar / 2;
          return broken ? (
            <g key={i}>
              <rect x={-len / 2} y={yy} width={len * 0.46} height={bar} fill="#000" />
              <rect x={len * 0.04} y={yy} width={len * 0.46} height={bar} fill="#000" />
            </g>
          ) : (
            <rect key={i} x={-len / 2} y={yy} width={len} height={bar} fill="#000" />
          );
        })}
      </g>
    );
  };
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" />
      <g transform={`rotate(${-33.7} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="#0047A0" />
        <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} A${r / 2} ${r / 2} 0 0 1 ${cx} ${cy} A${r / 2} ${r / 2} 0 0 0 ${cx - r} ${cy} Z`} fill="#CD2E3A" />
      </g>
      {trig(-146.3, [false, false, false])}
      {trig(33.7, [true, true, true])}
      {trig(-33.7, [true, false, true])}
      {trig(146.3, [false, true, false])}
    </g>
  );
};

/** 인공기 (2:1) — w x h 영역에 그림 */
export const NkFlag: React.FC<{x: number; y: number; w: number}> = ({x, y, w}) => {
  const h = w / 2;
  const u = h / 36;
  const cx = x + w * 0.36;
  const cy = y + h / 2;
  const r = h * 0.21;
  const star = Array.from({length: 10})
    .map((_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r * 0.95 : r * 0.38;
      return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
    })
    .join(' ');
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#024FA2" />
      <rect x={x} y={y + 6 * u} width={w} height={24 * u} fill="#fff" />
      <rect x={x} y={y + 7 * u} width={w} height={22 * u} fill="#ED1C27" />
      <circle cx={cx} cy={cy} r={r * 1.08} fill="#fff" />
      <polygon points={star} fill="#ED1C27" />
    </g>
  );
};
