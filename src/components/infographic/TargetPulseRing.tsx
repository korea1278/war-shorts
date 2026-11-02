// 특정 도시 강조 펄스 링: 외곽으로 퍼지는 동심원(Ripple) SVG + 뱃지 팝업
import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {HARD_TEXT} from './CountUpText';

type Props = {
  x: number; // 화면 좌표 (링 중심)
  y: number;
  startFrame: number;
  color?: string;
  badge: string;
  badgeSide?: 'left' | 'right' | 'top';
  maxR?: number;
};

export const TargetPulseRing: React.FC<Props> = ({x, y, startFrame, color = '#FFD000', badge, badgeSide = 'left', maxR = 230}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < startFrame) return null;
  const f = frame - startFrame;
  const period = 30; // 1초마다 새 링
  const rings = [0, 1, 2].map((i) => {
    const local = (f - (i * period) / 3 + period * 3) % period;
    const p = local / period;
    return {r: 16 + maxR * p, op: (1 - p) * interpolate(f, [0, 6], [0, 1], {extrapolateRight: 'clamp'})};
  });
  const pop = spring({frame: f - 6, fps, config: {damping: 9, stiffness: 170, mass: 0.7}});
  const dot = spring({frame: f, fps, config: {damping: 8, stiffness: 220}});
  const bw = 600;
  const bx = badgeSide === 'left' ? x - bw - 70 : badgeSide === 'right' ? x + 70 : x - bw / 2;
  const by = badgeSide === 'top' ? y - 250 : y - 210;
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
        {rings.map((r, i) => (
          <g key={i} opacity={r.op}>
            <circle cx={x} cy={y} r={r.r} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={22} />
            <circle cx={x} cy={y} r={r.r} fill="none" stroke={color} strokeWidth={7} />
          </g>
        ))}
        {/* 조준 십자 + 중심점 */}
        <g transform={`translate(${x} ${y}) scale(${dot})`}>
          <circle r={34} fill="none" stroke="#000" strokeWidth={12} />
          <circle r={34} fill="none" stroke={color} strokeWidth={6} />
          <circle r={12} fill={color} stroke="#000" strokeWidth={4} />
          {[0, 90, 180, 270].map((a) => (
            <line key={a} x1={0} y1={-46} x2={0} y2={-72} stroke={color} strokeWidth={7} strokeLinecap="round" transform={`rotate(${a})`} />
          ))}
        </g>
        {/* 뱃지 연결선 */}
        <line x1={x} y1={y} x2={badgeSide === 'left' ? bx + bw : badgeSide === 'right' ? bx : x} y2={by + 140}
          stroke={color} strokeWidth={5} strokeDasharray="14 10" opacity={pop > 0.05 ? 1 : 0} />
      </svg>
      <div style={{
        position: 'absolute', left: bx, top: by, width: bw, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${Math.max(0, pop)})`, transformOrigin: badgeSide === 'left' ? '100% 100%' : badgeSide === 'right' ? '0% 100%' : '50% 100%',
        background: '#0b0d12', border: `6px solid ${color}`, borderRadius: 26, boxShadow: '0 10px 0 #000',
      }}>
        <div style={{...HARD_TEXT, fontSize: 58, color: '#fff', WebkitTextStroke: '6px #000', whiteSpace: 'nowrap', textAlign: 'center'}}>
          {badge.split('=').map((part, i) => (
            <span key={i} style={{color: i === 1 ? color : '#fff'}}>{i ? '= ' : ''}{part.trim()}{i ? '' : ' '}</span>
          ))}
        </div>
      </div>
    </>
  );
};
