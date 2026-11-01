// 끝 4초 결과 카드 (EP04~, episode.result가 있을 때)
//  - 총 프레임 - 120프레임에 진입, 화면 중앙 Y 480~1250 안에서만 단독 렌더 (하단 자막과 물리적으로 분리)
//  - 블러 없는 외곽선 발광만 사용
import React from 'react';
import {interpolate, spring, useCurrentFrame} from 'remotion';
import {FPS} from '../lib/schedule';
import {resultStartFrame} from '../lib/result';
import {Episode, Timeline} from '../lib/types';

export const RESULT_TOP = 480;
export const RESULT_BOTTOM = 1250;

/** 지도 레이어 80% 블랙 딤 (지도 영역 안에만) */
export const MapDim: React.FC<{episode: Episode; timeline: Timeline}> = ({episode, timeline}) => {
  const frame = useCurrentFrame();
  if (!episode.result) return null;
  const f = frame - resultStartFrame(timeline);
  if (f < 0) return null;
  const k = interpolate(f, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  return <div style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', opacity: k}} />;
};

export const ResultCard: React.FC<{episode: Episode; timeline: Timeline}> = ({episode, timeline}) => {
  const frame = useCurrentFrame();
  const r = episode.result;
  if (!r) return null;
  const f = frame - resultStartFrame(timeline);
  if (f < 0) return null;
  const sp = spring({frame: f, fps: FPS, config: {damping: 11, stiffness: 190, mass: 0.8}});
  const scale = 0.82 + 0.18 * sp;
  const opacity = interpolate(f, [0, 5], [0, 1], {extrapolateRight: 'clamp'});
  // 타격 순간 화면 흔들림 (카드만, transform)
  const shake = f < 10 ? 10 * (1 - f / 10) * Math.sin(f * 2.4) : 0;
  const stroke = {WebkitTextStroke: '2px #000', paintOrder: 'stroke fill'} as const;
  return (
    <div style={{position: 'absolute', left: 0, top: RESULT_TOP, width: 1080, height: RESULT_BOTTOM - RESULT_TOP,
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity, overflow: 'hidden'}}>
      <div style={{
        width: 920, maxHeight: RESULT_BOTTOM - RESULT_TOP - 30, boxSizing: 'border-box',
        transform: `translateX(${shake.toFixed(1)}px) scale(${scale})`,
        background: 'rgba(4,10,18,0.96)', border: '5px solid #00E5FF', borderRadius: 30,
        boxShadow: '0 0 0 4px rgba(0,229,255,0.35), 0 0 0 12px rgba(0,229,255,0.12)',
        padding: '34px 40px 38px', display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 900, color: '#FFD700', letterSpacing: 2}}>
          {/* 서버에 이모지 글꼴이 없어 훈장은 SVG로 */}
          <svg width="26" height="30" viewBox="0 0 26 30">
            <path d="M5 0h6l2 8 2-8h6l-5 11H10z" fill="#d32f2f" />
            <circle cx="13" cy="20" r="9" fill="#FFD700" stroke="#7a5b00" strokeWidth="2" />
            <path d="M13 14l1.8 3.7 4 .6-2.9 2.8.7 4L13 23.2l-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#7a5b00" />
          </svg>
          <span>[ {r.label} ]</span>
        </div>
        <div style={{fontSize: 52, fontWeight: 900, color: '#00E5FF', marginTop: 16, textAlign: 'center', whiteSpace: 'nowrap', ...stroke}}>
          {r.title}
        </div>
        <div style={{width: '100%', height: 3, background: 'rgba(0,229,255,0.35)', margin: '24px 0 10px'}} />
        {r.rows.map((row, i) => {
          const k = spring({frame: f - 8 - i * 6, fps: FPS, config: {damping: 14, stiffness: 180}});
          return (
            <div key={i} style={{width: '100%', display: 'flex', alignItems: 'flex-start', gap: 18, padding: '16px 0',
              borderBottom: i < r.rows.length - 1 ? '2px solid rgba(255,255,255,0.12)' : 'none',
              opacity: k, transform: `translateX(${(1 - k) * 40}px)`}}>
              <div style={{flex: '0 0 210px', fontSize: 34, fontWeight: 900, color: '#9fb3c8', whiteSpace: 'nowrap'}}>• {row.k}</div>
              <div style={{flex: 1, fontSize: 38, fontWeight: 900, color: i === 0 ? '#FFD000' : '#fff', lineHeight: 1.2, wordBreak: 'keep-all'}}>{row.v}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
