// 영토 하이라이트 & 국기 패턴
//  북한: #FF3B30 반투명(0.6) + 인공기 clip-path / 남한: #0066FF 반투명(0.6) + 태극기 clip-path
//  중앙 군사분계선: 네온 화이트 디바이더 (블러 없이 반투명 굵은 선 3단 겹치기)
import React, {useMemo} from 'react';
import {LngLat} from '../../lib/types';
import {GeoFeature} from '../../ep05/types';
import {Proj} from '../../ep05/layout';
import {NkFlag, Taegukgi} from './assets';

export const NK_RED = '#FF3B30';
export const ROK_BLUE = '#0066FF';

/** MultiPolygon → SVG path (1.2px 미만 점 생략) + 경계 상자 */
export const geoPath = (f: GeoFeature, pr: Proj, minArea = 40) => {
  let d = '';
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of f.geometry.coordinates) {
    const ring = poly[0].map((c) => pr.p(c as [number, number]));
    // 아주 작은 섬은 생략 (렌더 부담·지저분함 방지)
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      a += ax * by - bx * ay;
    }
    if (Math.abs(a / 2) < minArea) continue;
    let last: [number, number] | null = null;
    ring.forEach(([x, y], i) => {
      if (last && i < ring.length - 1 && Math.hypot(x - last[0], y - last[1]) < 1.2) return;
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      last = [x, y];
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    });
    d += 'Z';
  }
  return {d, box: {x: x0, y: y0, w: x1 - x0, h: y1 - y0}};
};

type Props = {
  geo: {features: GeoFeature[]};
  pr: Proj;
  mdl: LngLat[];
  reveal: number; // 0~1 영토 채우기
  line: number; // 0~1 군사분계선 그려짐
  fillOpacity?: number; // 기본 0.6
  flagOpacity?: number; // 국기 패턴 진하기
  pulseNk?: number; // 0~1 북한 영역 강조 펄스
  pulseRok?: number;
};

export const TerritoryHighlight: React.FC<Props> = ({geo, pr, mdl, reveal, line, fillOpacity = 0.6, flagOpacity = 0.34, pulseNk = 0, pulseRok = 0}) => {
  const shapes = useMemo(() => {
    const get = (iso: 'KOR' | 'PRK') => {
      const f = geo.features.find((x) => x.properties.iso === iso);
      return f ? geoPath(f, pr) : null;
    };
    return {nk: get('PRK'), rok: get('KOR')};
  }, [geo, pr]);
  const mdlPts = mdl.map((c) => pr.p(c));
  const mdlD = mdlPts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const mdlLen = mdlPts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - mdlPts[i - 1][0], p[1] - mdlPts[i - 1][1]) : 0), 0);
  const dash = {strokeDasharray: mdlLen, strokeDashoffset: mdlLen * (1 - line)};
  const flag = (box: {x: number; y: number; w: number; h: number}, kind: 'nk' | 'rok') => {
    // 영토 상자를 덮도록 국기를 키움 (cover)
    const ratio = kind === 'nk' ? 2 : 1.5;
    const w = Math.max(box.w, box.h * ratio) * 1.05;
    const x = box.x + box.w / 2 - w / 2;
    const y = box.y + box.h / 2 - w / ratio / 2;
    return kind === 'nk' ? <NkFlag x={x} y={y} w={w} /> : <Taegukgi x={x} y={y} w={w} />;
  };
  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs>
        {shapes.nk && <clipPath id="clip-nk"><path d={shapes.nk.d} /></clipPath>}
        {shapes.rok && <clipPath id="clip-rok"><path d={shapes.rok.d} /></clipPath>}
      </defs>
      {shapes.nk && (
        <g opacity={reveal}>
          <path d={shapes.nk.d} fill={NK_RED} fillOpacity={Math.min(0.85, fillOpacity + 0.2 * pulseNk)} />
          <g clipPath="url(#clip-nk)" opacity={flagOpacity}>{flag(shapes.nk.box, 'nk')}</g>
          <path d={shapes.nk.d} fill="none" stroke="#ff8a80" strokeWidth={4 + 4 * pulseNk} strokeLinejoin="round" />
        </g>
      )}
      {shapes.rok && (
        <g opacity={reveal}>
          <path d={shapes.rok.d} fill={ROK_BLUE} fillOpacity={Math.min(0.85, fillOpacity + 0.2 * pulseRok)} />
          <g clipPath="url(#clip-rok)" opacity={flagOpacity}>{flag(shapes.rok.box, 'rok')}</g>
          <path d={shapes.rok.d} fill="none" stroke="#7fb2ff" strokeWidth={4 + 4 * pulseRok} strokeLinejoin="round" />
        </g>
      )}
      {/* 군사분계선 네온 화이트 디바이더 */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={mdlD} stroke="#fff" strokeOpacity={0.16} strokeWidth={30} style={dash} />
        <path d={mdlD} stroke="#fff" strokeOpacity={0.38} strokeWidth={15} style={dash} />
        <path d={mdlD} stroke="#fff" strokeWidth={6} style={dash} />
      </g>
    </svg>
  );
};
