// 방공 포대 누끼 일러스트 (순수 SVG 벡터, 옆에서 본 실루엣)
//  L-SAM 발사대 · 천궁-II 발사대 · 패트리어트 차량 · 그린파인 레이더 · LAMD 발사대
import React from 'react';

const OUT = '#000';
const BODY = '#6b7a5a'; // 국방색
const DARK = '#3f4a35';

const Truck: React.FC<{w: number; children?: React.ReactNode}> = ({w, children}) => (
  <svg width={w} height={w * 0.62} viewBox="0 0 200 124" style={{overflow: 'visible'}}>
    {children}
    {/* 차대·운전석 */}
    <rect x={8} y={84} width={186} height={16} rx={3} fill={DARK} stroke={OUT} strokeWidth={4} />
    <path d="M150 84 L150 56 L178 56 L194 72 L194 84 Z" fill={BODY} stroke={OUT} strokeWidth={4} strokeLinejoin="round" />
    <path d="M160 62 L176 62 L186 74 L160 74 Z" fill="#cfe8ff" stroke={OUT} strokeWidth={3} />
    {[30, 62, 128, 172].map((x) => (
      <g key={x}>
        <circle cx={x} cy={104} r={15} fill="#222" stroke={OUT} strokeWidth={4} />
        <circle cx={x} cy={104} r={6} fill="#888" />
      </g>
    ))}
  </svg>
);

/** L-SAM: 큰 원통 캐니스터 2개, 높은 각도 */
export const LsamLauncher: React.FC<{w: number}> = ({w}) => (
  <Truck w={w}>
    <g transform="translate(26 84) rotate(-58)">
      <rect x={0} y={-30} width={120} height={28} rx={6} fill={BODY} stroke={OUT} strokeWidth={4} />
      <rect x={0} y={-2} width={120} height={28} rx={6} fill={BODY} stroke={OUT} strokeWidth={4} />
      <rect x={112} y={-30} width={10} height={56} fill="#00E5FF" stroke={OUT} strokeWidth={3} />
    </g>
  </Truck>
);

/** 천궁-II: 수직 발사관 8개 (2x4) */
export const CheongungLauncher: React.FC<{w: number}> = ({w}) => (
  <Truck w={w}>
    <rect x={30} y={8} width={92} height={76} rx={4} fill={BODY} stroke={OUT} strokeWidth={4} />
    {[0, 1, 2, 3].map((c) => [0, 1].map((r) => (
      <circle key={`${c}${r}`} cx={44 + c * 22} cy={30 + r * 32} r={9} fill={DARK} stroke="#00FF66" strokeWidth={3} />
    )))}
  </Truck>
);

/** 패트리어트: 사각 캐니스터 4개, 비스듬히 */
export const PatriotLauncher: React.FC<{w: number}> = ({w}) => (
  <Truck w={w}>
    <g transform="translate(24 84) rotate(-38)">
      {[0, 1].map((r) => [0, 1].map((c) => (
        <rect key={`${r}${c}`} x={c * 62} y={-28 - r * 26} width={60} height={24} rx={2} fill={BODY} stroke={OUT} strokeWidth={4} />
      )))}
      <rect x={118} y={-54} width={8} height={50} fill="#fff" stroke={OUT} strokeWidth={3} />
    </g>
  </Truck>
);

/** 그린파인 레이더: 크게 기울어진 평판 안테나 */
export const GreenPineRadar: React.FC<{w: number}> = ({w}) => (
  <Truck w={w}>
    <path d="M70 84 L86 56" stroke={OUT} strokeWidth={8} />
    <g transform="translate(86 56) rotate(-20)">
      <rect x={-64} y={-86} width={128} height={92} rx={6} fill="#4e5d43" stroke={OUT} strokeWidth={5} />
      {[0, 1, 2, 3, 4].map((i) => <line key={`h${i}`} x1={-56} x2={56} y1={-72 + i * 18} y2={-72 + i * 18} stroke="#9fd18a" strokeWidth={2.5} />)}
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={`v${i}`} x1={-48 + i * 19} x2={-48 + i * 19} y1={-80} y2={0} stroke="#9fd18a" strokeWidth={2.5} />)}
    </g>
  </Truck>
);

/** LAMD: 소형 발사관 다수 */
export const LamdLauncher: React.FC<{w: number}> = ({w}) => (
  <Truck w={w}>
    <g transform="translate(28 84) rotate(-62)">
      <rect x={0} y={-50} width={96} height={74} rx={4} fill={BODY} stroke={OUT} strokeWidth={4} />
      {[0, 1, 2, 3, 4].map((r) => <line key={r} x1={6} x2={96} y1={-42 + r * 15} y2={-42 + r * 15} stroke={OUT} strokeWidth={3} />)}
      <rect x={92} y={-50} width={8} height={74} fill="#FFD000" stroke={OUT} strokeWidth={3} />
    </g>
  </Truck>
);

/** 수도권 스카이라인 */
export const Skyline: React.FC<{w: number}> = ({w}) => {
  const b = [[0, 60], [26, 96], [50, 70], [70, 130], [96, 84], [118, 150], [140, 74], [162, 110], [186, 64], [206, 92], [228, 56]];
  return (
    <svg width={w} height={w * 0.66} viewBox="0 0 250 165" style={{overflow: 'visible'}}>
      {b.map(([x, h], i) => (
        <g key={i}>
          <rect x={x} y={165 - h} width={22} height={h} fill="#26344a" stroke="#000" strokeWidth={3} />
          {Array.from({length: Math.floor(h / 20)}).map((_, j) => (
            <rect key={j} x={x + 6} y={165 - h + 8 + j * 20} width={10} height={7} fill="#FFD36B" opacity={(i + j) % 3 ? 0.9 : 0.35} />
          ))}
        </g>
      ))}
      <rect x={124} y={0} width={10} height={20} fill="#26344a" stroke="#000" strokeWidth={3} />
    </svg>
  );
};
