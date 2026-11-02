// 야간 불빛 지도 전환 레이어
//  주간 위성 지도 위에 NASA 야간 불빛(Black Marble, GIBS) 모자이크를 크로스페이드로 덮음.
//  야간 타일을 못 받았으면 주요 도시 불빛을 벡터(방사형 그라데이션, 필터 없음)로 대체
import React from 'react';
import {Img, staticFile} from 'remotion';
import {Proj} from '../../ep05/layout';

type Rect = {left: number; top: number; width: number; height: number};

// 대체용 도시 불빛: [경도, 위도, 세기]
const CITY_LIGHTS: [number, number, number][] = [
  [126.98, 37.57, 1.0], [126.7, 37.46, 0.8], [127.03, 37.27, 0.8], [126.85, 37.65, 0.6], [127.13, 37.42, 0.7],
  [129.07, 35.18, 0.95], [128.6, 35.87, 0.85], [129.31, 35.54, 0.8], [128.68, 35.23, 0.7], [127.38, 36.35, 0.75],
  [126.85, 35.16, 0.75], [127.15, 35.82, 0.55], [127.49, 36.64, 0.55], [129.36, 36.02, 0.5], [127.73, 37.88, 0.4],
  [128.9, 37.75, 0.4], [126.57, 33.5, 0.45], [127.0, 36.8, 0.5], [128.34, 36.12, 0.4], [126.98, 37.0, 0.55],
  [125.75, 39.03, 0.32], // 평양만 희미하게
];

export const NightMapOverlay: React.FC<{
  opacity: number;
  nightRect?: Rect & {file: string};
  pr: Proj;
}> = ({opacity, nightRect, pr}) => {
  if (opacity <= 0) return null;
  return (
    <div style={{position: 'absolute', inset: 0, opacity}}>
      {/* 바다·북한은 칠흑 */}
      <div style={{position: 'absolute', inset: 0, background: '#010207'}} />
      {nightRect ? (
        <Img src={staticFile(nightRect.file)} style={{position: 'absolute', left: nightRect.left, top: nightRect.top, width: nightRect.width, height: nightRect.height}} />
      ) : (
        <svg width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
          <defs>
            <radialGradient id="city-glow">
              <stop offset="0%" stopColor="#fff6d8" stopOpacity={1} />
              <stop offset="25%" stopColor="#ffd27a" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#ff9a2e" stopOpacity={0} />
            </radialGradient>
          </defs>
          {CITY_LIGHTS.map(([lon, lat, w], i) => (
            <circle key={i} cx={pr.x(lon)} cy={pr.y(lat)} r={18 + 70 * w} fill="url(#city-glow)" opacity={0.5 + 0.5 * w} />
          ))}
        </svg>
      )}
    </div>
  );
};
