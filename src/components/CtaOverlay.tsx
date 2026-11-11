// 끝 4초 구독·좋아요 CTA (EP03~ 모든 에피소드 기본, episode.cta=false면 끔)
//  - 하단 자막 바로 위, 네온 레드 뱃지 · 스케일 0.9 → 1.0 스프링 바운스 · 은은한 펄스
//  - 발광은 블러 없는 box-shadow 퍼짐 링으로만 (렌더 비용 0) · 이모지 글꼴이 없는 서버라 종·엄지는 SVG
import React from 'react';
import {interpolate, spring, useCurrentFrame} from 'remotion';
import {FPS, videoSec} from '../lib/schedule';
import {Episode, Timeline} from '../lib/types';

export const CTA_SEC = 4;
export const ctaOn = (ep: Episode) => ep.cta !== false;

const RED = '#ff1f3d';

const Bell: React.FC<{size: number; ring: number}> = ({size, ring}) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{transform: `rotate(${ring}deg)`, transformOrigin: '50% 12%'}}>
    <path d="M24 5c-1.7 0-3 1.3-3 3v1.3C14.6 10.8 11 16.3 11 23v9l-4 5v2h34v-2l-4-5v-9c0-6.7-3.6-12.2-10-13.7V8c0-1.7-1.3-3-3-3z" fill="#FFD000" stroke="#000" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M18.5 41a5.5 5.5 0 0 0 11 0z" fill="#FFD000" stroke="#000" strokeWidth="2.5" />
  </svg>
);

const Thumb: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path d="M6 20h8v22H6z" fill="#fff" stroke="#000" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M16 21l8-14c3 0 5 2 4.4 5.2L27 19h11c2.4 0 4 2.2 3.5 4.5l-3.4 15C37.7 40.5 36 42 34 42H16z" fill="#fff" stroke="#000" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>
);

export const CtaOverlay: React.FC<{episode: Episode; timeline: Timeline}> = ({episode, timeline}) => {
  const frame = useCurrentFrame();
  if (!ctaOn(episode)) return null;
  const T = videoSec(timeline);
  const start = (T - CTA_SEC) * FPS;
  if (frame < start) return null;
  const f = frame - start;
  const sp = spring({frame: f, fps: FPS, config: {damping: 7, stiffness: 170, mass: 0.6}}); // 바운스
  const scale = 0.9 + 0.1 * sp;
  const opacity = interpolate(f, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
  const pulse = 0.5 + 0.5 * Math.sin((f / FPS) * Math.PI * 2.2);
  const ring = f < 30 ? 16 * Math.sin(f * 0.9) * (1 - f / 30) : 6 * Math.sin(f * 0.5) * pulse;
  // 1.6초 뒤 [구독] 버튼이 한 번 눌림 → 회색 '구독중'
  const pressAt = 1.6 * FPS;
  const press = interpolate(f, [pressAt - 4, pressAt, pressAt + 5], [1, 0.9, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const subscribed = f >= pressAt;
  const likeAt = 2.3 * FPS;
  const likePop = spring({frame: f - likeAt, fps: FPS, config: {damping: 8, stiffness: 200}});
  const liked = f >= likeAt;
  const glow = `0 0 0 ${3 + 5 * pulse}px rgba(255,31,61,0.45), 0 0 0 ${10 + 9 * pulse}px rgba(255,31,61,0.18), 0 8px 0 #000`;
  // 표준(docs/SHORTS_STANDARD.md 2항): 자막이 같은 문장을 읽는 동안 뱃지에 또 쓰지 않음 → 버튼만
  const headline = episode.ctaHeadline ?? !episode.subtitleBottomY;
  const btn = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 30px 13px', borderRadius: 999,
    fontSize: 46, fontWeight: 900, border: '4px solid #000',
  } as const;
  return (
    // safe 레이아웃(EP04~): 결과 카드(480~1250)와 자막(1550~) 사이, 바닥이 Y 1535에 오도록 · 우측 150px 마진 안
    <div style={episode.layout === 'safe'
      ? {position: 'absolute', left: 40, width: 890, bottom: 1920 - (episode.ctaBottomY ?? 1535), display: 'flex', justifyContent: 'center', opacity}
      : {position: 'absolute', left: 0, top: 1236, width: 1080, display: 'flex', justifyContent: 'center', opacity}}>
      <div
        style={{
          transform: `scale(${scale * (episode.layout === 'safe' ? 0.82 : 1)})`, transformOrigin: episode.layout === 'safe' ? '50% 100%' : '50% 50%',
          background: 'rgba(10,0,4,0.93)', border: `5px solid ${RED}`, borderRadius: 34, boxShadow: glow,
          padding: '18px 34px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}
      >
        {headline && (
          <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 44, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap',
            WebkitTextStroke: '2px #000', paintOrder: 'stroke fill'}}>
            <Bell size={54} ring={ring} />
            다음 시뮬레이션이 궁금하다면?
          </div>
        )}
        <div style={{display: 'flex', gap: 22}}>
          <div style={{...btn, transform: `scale(${press})`, background: subscribed ? '#3a3f45' : RED, color: '#fff',
            boxShadow: subscribed ? 'none' : `0 0 0 ${2 + 4 * pulse}px rgba(255,255,255,0.35)`}}>
            <Bell size={40} ring={0} />
            {subscribed ? '구독중' : '구독'}
          </div>
          <div style={{...btn, background: liked ? '#ffffff' : '#1d2329', color: liked ? '#000' : '#fff',
            transform: `scale(${liked ? 1 + 0.12 * Math.sin(Math.min(1, likePop) * Math.PI) : 1})`}}>
            <Thumb size={40} />
            좋아요
          </div>
        </div>
      </div>
    </div>
  );
};
