// EP13 반투명 Tactical HUD (지도 상단 모서리): 좌 = 좌표·고도·상태 / 우 = 회전 타깃 링 + 전력 게이지
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {clamp01} from '../lib/schedule';
import {BlackoutData, BlackoutPlan, waveKm} from './plan';

const BLUE = '#00E5FF';
const RED = '#FF3B30';
const YEL = '#FFE500';
const TOP = 590; // 상단 카드(~Y 564) 바로 아래

export const Hud: React.FC<{p: BlackoutPlan; d: BlackoutData}> = ({p, d}) => {
  const t = useCurrentFrame() / 30;
  if (t > p.T - 4) return null; // CTA 구간엔 정리
  const [lon, lat] = d.capital;
  const alt = t < p.jet0 ? 0 : t < p.release ? Math.round(9100 - 1600 * clamp01((t - p.jet0) / (p.release - p.jet0))) : 7500;
  const W = waveKm(p, t);
  const power = W < 0 ? 100 : Math.round(100 - 90 * clamp01(W / 560));
  const status =
    t >= p.waveEnd ? {txt: '전력망 암전', c: RED}
      : t >= p.wave ? {txt: '정전 확산 중', c: RED}
      : t >= p.land ? {txt: '합선 발생', c: BLUE}
      : t >= p.burst ? {txt: '섬유 살포', c: '#e6eef7'}
      : t >= p.jet0 ? {txt: '표적 접근', c: YEL}
      : {txt: '전력망 정상', c: '#7CFF8A'};
  const blink = Math.floor(t * 2) % 2 === 0;
  const box: React.CSSProperties = {
    position: 'absolute', top: TOP, background: 'rgba(0,10,20,0.55)', border: `2px solid ${BLUE}88`,
    borderRadius: 8, padding: '10px 14px', color: '#cfefff', fontFamily: 'Pretendard', fontWeight: 900, fontSize: 22, lineHeight: 1.35,
  };
  const ang = (t * 40) % 360;
  return (
    <>
      <div style={{...box, left: 24, width: 286}}>
        <div style={{color: BLUE, fontSize: 18, letterSpacing: 1}}>TACTICAL · 표적 좌표</div>
        <div style={{fontVariantNumeric: 'tabular-nums'}}>{lat.toFixed(2)}°N {lon.toFixed(2)}°E</div>
        <div style={{fontVariantNumeric: 'tabular-nums'}}>투하 고도 {alt ? alt.toLocaleString('en-US') + 'm' : '—'}</div>
        <div style={{color: status.c}}>
          <span style={{display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: status.c, marginRight: 8, opacity: blink ? 1 : 0.35}} />
          {status.txt}
        </div>
      </div>
      <div style={{...box, right: 24, width: 230, display: 'flex', alignItems: 'center', gap: 12}}>
        <svg width={74} height={74} viewBox="-40 -40 80 80">
          <circle r={34} fill="none" stroke={RED} strokeWidth={3} strokeDasharray="14 8" transform={`rotate(${ang})`} />
          <circle r={18} fill="none" stroke={RED} strokeWidth={2} opacity={0.7} />
          <path d="M-40,0 L-24,0 M24,0 L40,0 M0,-40 L0,-24 M0,24 L0,40" stroke={RED} strokeWidth={3} />
          <circle r={3} fill={RED} />
        </svg>
        <div style={{flex: 1}}>
          <div style={{color: BLUE, fontSize: 18}}>북한 전력</div>
          <div style={{fontSize: 34, color: power < 50 ? RED : '#fff', fontVariantNumeric: 'tabular-nums'}}>{power}%</div>
          <div style={{height: 8, background: '#1a2633', borderRadius: 4, overflow: 'hidden'}}>
            <div style={{width: `${power}%`, height: '100%', background: power < 50 ? RED : '#7CFF8A'}} />
          </div>
        </div>
      </div>
    </>
  );
};
