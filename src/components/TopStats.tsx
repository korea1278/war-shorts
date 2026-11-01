// 상단 인포그래픽 (Y 0~480)
//  - 0초부터 고정 뱃지 [ ● 가상 군사 시뮬레이션 IF ]
//  - 타이틀 64px · 3px 검정 외곽선 · 블러 없는 진한 그림자. 카드가 나오기 전에는 타이틀을 아래로 내려
//    상단 빈 공간이 생기지 않게 하고, 첫 카드가 나올 때 위로 올라감
import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {cueTime, videoSec} from '../lib/schedule';
import {COLORS, Episode, Stat, Timeline} from '../lib/types';

const fmt = (n: number, dec = 0) =>
  dec ? n.toFixed(dec) : Math.round(n).toLocaleString('en-US');

const CARD_TOP = 262;
const CARD_H = 212;

const Card: React.FC<{s: Stat; at: number; outAt: number}> = ({s, at, outAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  if (sec < at || sec > outAt + 0.4) return <div style={{flex: 1}} />;
  const sc = spring({frame: frame - at * fps, fps, config: {damping: 13, stiffness: 160, mass: 0.7}});
  const out = interpolate(sec, [outAt, outAt + 0.35], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cnt = interpolate(sec, [at + 0.1, at + 1.15], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const eased = 1 - Math.pow(1 - cnt, 3);
  const col = s.side === 'nk' ? COLORS.nk : s.side === 'gray' ? COLORS.gray : COLORS.rok;
  const bump = 1 + 0.06 * Math.max(0, Math.sin(Math.min(1, (sec - at - 1.1) / 0.3) * Math.PI));
  const numSize = s.note ? 76 : 88;
  return (
    <div
      style={{
        flex: 1,
        height: CARD_H,
        borderRadius: 22,
        background: 'rgba(8,12,18,0.9)',
        border: `4px solid ${col}`,
        boxShadow: `0 0 0 3px ${col}55, 0 0 0 7px ${col}22`, // 블러 없는 2중 외곽선 발광
        transform: `scale(${(0.6 + 0.4 * sc) * out})`,
        opacity: Math.min(1, sc * 1.4) * out,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{width: '100%', background: col, color: '#fff', fontSize: 32, fontWeight: 900, textAlign: 'center', padding: '5px 0 7px'}}>
        {s.label}
      </div>
      <div style={{fontSize: 34, color: '#dfe6ee', fontWeight: 900, marginTop: 6, whiteSpace: 'nowrap'}}>{s.prefix.trim()}</div>
      <div style={{display: 'flex', alignItems: 'baseline', transform: `scale(${bump})`, marginTop: -4}}>
        {s.numPrefix && <span style={{fontSize: numSize * 0.52, fontWeight: 900, color: COLORS.yellow, marginRight: 10}}>{s.numPrefix}</span>}
        <span style={{fontSize: numSize, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: -2}}>
          {fmt(s.value * eased, s.decimals)}
        </span>
        <span style={{fontSize: numSize * 0.52, fontWeight: 900, color: COLORS.yellow, marginLeft: 6}}>{s.suffix}</span>
      </div>
      {s.note && <div style={{fontSize: 30, fontWeight: 900, color: COLORS.yellow, marginTop: -6, whiteSpace: 'nowrap'}}>{s.note}</div>}
    </div>
  );
};

const Badge: React.FC = () => (
  <div style={{position: 'absolute', top: 24, width: '100%', display: 'flex', justifyContent: 'center'}}>
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '8px 26px 10px', borderRadius: 999,
        background: 'rgba(0,0,0,0.85)', border: '3px solid #ff2828', fontSize: 34, fontWeight: 900, color: '#fff',
      }}
    >
      <span style={{color: '#ff2828'}}>[</span>
      {/* 이모지 글꼴이 없는 서버에서도 똑같이 보이도록 빨간 원을 직접 그림 */}
      <span style={{width: 26, height: 26, borderRadius: 13, background: '#ff2828', border: '3px solid #ffb3b3', display: 'inline-block'}} />
      <span>가상 군사 시뮬레이션 IF</span>
      <span style={{color: '#ff2828'}}>]</span>
    </div>
  </div>
);

export const TopStats: React.FC<{episode: Episode; timeline: Timeline}> = ({episode, timeline}) => {
  const t2 = timeline.phase2At;
  const p1 = episode.stats.phase1;
  const p2 = episode.stats.phase2;
  const frame = useCurrentFrame();
  const sec = frame / 30;
  const p2On = sec >= t2;
  const T = videoSec(timeline);
  const timing = (s: Stat, i: number, phase2: boolean) => {
    const fallback = phase2 ? t2 + 0.6 + i * 0.5 : 1.5 + i * 0.6;
    const at = Math.min(cueTime(timeline, s.cue, fallback), phase2 ? T - 1 : t2 - 0.5);
    return phase2 ? Math.max(at, t2 + 0.2) : at;
  };
  const firstCard = Math.min(...p1.map((s, i) => timing(s, i, false)));
  // 카드 전에는 타이틀을 아래(빈 공간 가운데)로, 카드가 나오면 위로
  const lift = spring({frame: frame - (firstCard - 0.35) * 30, fps: 30, config: {damping: 16, stiffness: 120}});
  const titleY = interpolate(lift, [0, 1], [176, 92]);
  const titleIn = interpolate(sec, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'});
  const stroke = {WebkitTextStroke: '3px #000', paintOrder: 'stroke fill', textShadow: '4px 4px 0 #000, 0 5px 0 #000'} as const;
  const size = (t: string) => Math.min(64, Math.floor(1010 / (t.length * 0.93)));
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 480}}>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(#05070a 0%, #05070a 72%, rgba(5,7,10,0) 100%)'}} />
      <Badge />
      <div style={{position: 'absolute', top: titleY, width: '100%', textAlign: 'center', opacity: titleIn, lineHeight: 1.18}}>
        <div style={{fontSize: size(episode.title[0]), fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', ...stroke}}>{episode.title[0]}</div>
        <div style={{fontSize: size(episode.title[1]), fontWeight: 900, color: COLORS.yellow, whiteSpace: 'nowrap', ...stroke}}>{episode.title[1]}</div>
      </div>
      <div style={{position: 'absolute', top: CARD_TOP, left: 28, right: 28, display: 'flex', gap: 22, alignItems: 'center'}}>
        {(p2On ? p2 : p1).map((s, i) => (
          <React.Fragment key={`${p2On ? 2 : 1}-${i}`}>
            {i === 1 && (p2On ? episode.stats.vsPhase2 ?? episode.stats.vs : episode.stats.vs) && sec >= timing((p2On ? p2 : p1)[0], 0, p2On) && <div style={{fontSize: 40, fontWeight: 900, color: COLORS.yellow, ...stroke}}>VS</div>}
            <Card s={s} at={timing(s, i, p2On)} outAt={p2On ? 999 : t2 - 0.25} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
