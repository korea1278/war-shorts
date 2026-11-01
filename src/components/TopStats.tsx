import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {cueTime, videoSec} from '../lib/schedule';
import {COLORS, Episode, Stat, Timeline} from '../lib/types';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const Card: React.FC<{s: Stat; at: number; outAt: number}> = ({s, at, outAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  if (sec < at || sec > outAt + 0.4) return <div style={{flex: 1}} />;
  const sc = spring({frame: frame - at * fps, fps, config: {damping: 13, stiffness: 160, mass: 0.7}});
  const out = interpolate(sec, [outAt, outAt + 0.35], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cnt = interpolate(sec, [at + 0.1, at + 1.15], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const eased = 1 - Math.pow(1 - cnt, 3);
  const col = s.side === 'nk' ? COLORS.nk : COLORS.rok;
  const bump = 1 + 0.06 * Math.max(0, Math.sin(Math.min(1, (sec - at - 1.1) / 0.3) * Math.PI));
  return (
    <div style={{
      flex: 1, height: 236, borderRadius: 22, background: 'rgba(8,12,18,0.88)', border: `4px solid ${col}`,
      boxShadow: `0 0 0 3px ${col}55, 0 0 0 7px ${col}22`, // 블러 없는 2중 외곽선 발광 transform: `scale(${(0.6 + 0.4 * sc) * out})`, opacity: Math.min(1, sc * 1.4) * out,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden',
    }}>
      <div style={{width: '100%', background: col, color: '#fff', fontSize: 36, fontWeight: 900, textAlign: 'center', padding: '6px 0 8px', letterSpacing: 1}}>
        {s.label}
      </div>
      <div style={{fontSize: 36, color: '#dfe6ee', fontWeight: 900, marginTop: 10}}>{s.prefix.trim()}</div>
      <div style={{display: 'flex', alignItems: 'baseline', transform: `scale(${bump})`, marginTop: -2}}>
        <span style={{fontSize: 100, fontWeight: 900, color: s.side === 'nk' ? '#fff' : '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: -2}}>
          {fmt(s.value * eased)}
        </span>
        <span style={{fontSize: 52, fontWeight: 900, color: COLORS.yellow, marginLeft: 6}}>{s.suffix}</span>
      </div>
    </div>
  );
};

export const TopStats: React.FC<{episode: Episode; timeline: Timeline}> = ({episode, timeline}) => {
  const t2 = timeline.phase2At;
  const p1 = episode.stats.phase1;
  const p2 = episode.stats.phase2;
  const frame = useCurrentFrame();
  const sec = frame / 30;
  const titleIn = interpolate(sec, [0, 0.35], [0, 1], {extrapolateRight: 'clamp'});
  const p2Badge = sec >= t2;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 480}}>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(#05070a 0%, #05070a 70%, rgba(5,7,10,0) 100%)'}} />
      <div style={{position: 'absolute', top: 34, width: '100%', textAlign: 'center', opacity: titleIn, transform: `translateY(${(1 - titleIn) * -20}px)`}}>
        <div style={{fontSize: 60, fontWeight: 900, color: '#fff', lineHeight: 1.1, WebkitTextStroke: '8px #000', paintOrder: 'stroke fill'}}>{episode.title[0]}</div>
        <div style={{fontSize: 80, fontWeight: 900, color: COLORS.yellow, lineHeight: 1.12, WebkitTextStroke: '9px #000', paintOrder: 'stroke fill'}}>{episode.title[1]}</div>
      </div>
      <div style={{position: 'absolute', top: 222, left: 28, right: 28, display: 'flex', gap: 22}}>
        {(p2Badge ? p2 : p1).map((s, i) => {
          const fallback = p2Badge ? t2 + 1.5 + i * 5 : 2.5 + i * 4;
          const at = Math.min(cueTime(timeline, s.cue, fallback), p2Badge ? videoSec(timeline) - 1 : t2 - 0.5);
          return <Card key={`${p2Badge ? 2 : 1}-${i}`} s={s} at={p2Badge ? Math.max(at, t2 + 0.2) : at} outAt={p2Badge ? 99 : t2 - 0.25} />;
        })}
      </div>
    </div>
  );
};
