// 수직 고도 레이어 인포그래픽 (EP06~)
//  상층 L-SAM(시안) / 중·하층 천궁-II·PAC-3(그린) / 저고도 LAMD(옐로) 밴드 + 우측 0~60km 눈금자
//  순수 SVG, 블러·필터 없음 (발광은 반투명 굵은 선 겹치기)
import React from 'react';

export type GridLayer = {key: string; name: string; range: string; from: number; to: number; color: string};

type Props = {
  layers: GridLayer[];
  width: number;
  height: number;
  yAlt: (km: number) => number;
  topAlt: number;
  rulerX: number; // 눈금자 세로선 x
  active?: string; // 강조 레이어 key
  reveal?: number; // 0~1 밴드가 아래에서 위로 채워짐
};

export const AltitudeLayerGrid: React.FC<Props> = ({layers, width, height, yAlt, topAlt, rulerX, active, reveal = 1}) => {
  const ticks: number[] = [];
  for (let k = 0; k <= Math.floor(topAlt / 5) * 5; k += 5) ticks.push(k);
  const revealAlt = topAlt * reveal;
  return (
    <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {layers.map((l) => {
        const on = active === l.key;
        const top = Math.min(l.to, Math.max(l.from, revealAlt));
        if (top <= l.from) return null;
        const y0 = yAlt(top), y1 = yAlt(l.from);
        return (
          <g key={l.key}>
            <rect x={0} y={y0} width={rulerX} height={y1 - y0} fill={l.color} fillOpacity={on ? 0.24 : 0.09} />
            {/* 사선 해칭 (강조 레이어만) */}
            {on && Array.from({length: Math.ceil(rulerX / 70) + 6}).map((_, i) => (
              <line key={i} x1={i * 70 - (y1 - y0)} y1={y1} x2={i * 70} y2={y0} stroke={l.color} strokeOpacity={0.1} strokeWidth={10} />
            ))}
            {top >= l.to && (
              <>
                <line x1={0} x2={rulerX} y1={y0} y2={y0} stroke={l.color} strokeOpacity={0.25} strokeWidth={on ? 16 : 8} />
                <line x1={0} x2={rulerX} y1={y0} y2={y0} stroke={l.color} strokeWidth={on ? 5 : 3} strokeDasharray={on ? undefined : '18 12'} />
              </>
            )}
          </g>
        );
      })}
      {/* 레이어 이름표 (왼쪽 아래 모서리) */}
      {layers.map((l) => {
        const on = active === l.key;
        if (revealAlt < l.to - 0.01) return null;
        const y1 = yAlt(l.from);
        const y0 = yAlt(l.to);
        const h = y1 - y0;
        const fs = Math.min(on ? 58 : 44, h * 0.36);
        return (
          <g key={`t${l.key}`} opacity={on || !active ? 1 : 0.55}>
            <text x={30} y={y0 + fs + 12} fontSize={fs} fontWeight={900} fill={l.color} stroke="#000" strokeWidth={9} paintOrder="stroke"
              style={{fontFamily: 'Pretendard, sans-serif'}}>{l.name}<tspan fill="#fff" fontSize={fs * 0.62} dx={14}>{l.range}</tspan></text>
          </g>
        );
      })}
      {/* 우측 고도 눈금자 0~60km */}
      <g style={{fontFamily: 'Pretendard, sans-serif'}}>
        <rect x={rulerX} y={yAlt(topAlt) - 20} width={width - rulerX} height={yAlt(0) - yAlt(topAlt) + 40} fill="rgba(0,0,0,0.55)" />
        <line x1={rulerX + 4} x2={rulerX + 4} y1={yAlt(topAlt)} y2={yAlt(0)} stroke="#fff" strokeWidth={5} />
        {ticks.map((k) => {
          const major = k % 10 === 0;
          const y = yAlt(k);
          return (
            <g key={k}>
              <line x1={rulerX + 4} x2={rulerX + (major ? 34 : 20)} y1={y} y2={y} stroke="#fff" strokeWidth={major ? 5 : 3} />
              {major && (
                <text x={rulerX + 40} y={k === 0 ? y - 8 : y + 12} fontSize={34} fontWeight={900} fill="#fff" stroke="#000" strokeWidth={6} paintOrder="stroke">{k}</text>
              )}
            </g>
          );
        })}
        <text x={rulerX + 14} y={yAlt(topAlt) - 34} fontSize={30} fontWeight={900} fill="#FFD000" stroke="#000" strokeWidth={6} paintOrder="stroke">고도 km</text>
      </g>
    </svg>
  );
};
