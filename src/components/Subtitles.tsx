import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, Episode, Timeline} from '../lib/types';

// 숫자·핵심 무기명은 노란색 강조 (단어 목록은 episode.json highlight)
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// EP07~: warn 단어는 경고 레드(#FF3B30), highlightColor로 강조 노랑 색 지정(기본 #FFD000)
// autoHighlight=false(EP10~): 숫자 자동 강조를 끄고 지정한 단어만 문맥에 맞게 강조
const makeHL = (words: string[], warn: string[], auto = true) =>
  new RegExp(`(${[...warn.map(esc), ...words.map(esc), ...(auto ? ['[A-Z]?-?\\d[\\d,.]*[^\\s,.?]*'] : [])].join('|')})`, 'g');

const renderText = (text: string, HL: RegExp, warn: string[], yellow: string) => {
  const parts = text.split(HL);
  return parts.map((p, i) =>
    i % 2 === 1 ? <span key={i} style={{color: warn.includes(p) ? '#FF3B30' : yellow}}>{p}</span> : <span key={i}>{p}</span>,
  );
};

export const Subtitles: React.FC<{timeline: Timeline; episode: Episode}> = ({timeline, episode}) => {
  const warn = episode.warn ?? [];
  const yellow = episode.highlightColor ?? COLORS.yellow;
  const HL = makeHL(episode.highlight ?? ['K9', '천무', '장사정포', '대포병 탐지레이더'], warn, episode.autoHighlight !== false);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  // 단일 활성화 보장: 정수 프레임 [startFrame, endFrame) 로 판정, 다음 자막 시작에서 반드시 끊음.
  // 문장 사이 간격이 5프레임 미만이면 직전 자막을 다음 시작까지 늘려 잔상·깜빡임 없이 명확히 교체(Cut)
  const fr = timeline.chunks.map((ch, i) => {
    const sf = ch.startFrame ?? Math.round(ch.start * fps);
    let ef = ch.endFrame ?? Math.round(ch.end * fps);
    const next = timeline.chunks[i + 1];
    if (next) {
      const nsf = next.startFrame ?? Math.round(next.start * fps);
      if (nsf - ef < 5) ef = nsf;
      ef = Math.min(ef, nsf);
    }
    return [sf, ef] as const;
  });
  const active = fr.map(([sf, ef], i) => (sf <= frame && frame < ef ? i : -1)).filter((i) => i >= 0);
  const c = active.length ? timeline.chunks[active[active.length - 1]] : undefined;
  const cStart = c ? fr[timeline.chunks.indexOf(c)][0] / fps : 0;
  if (episode.layout === 'safe') {
    // Safe Area: 자막은 Y 1550~1720 고정, 우측 150px 마진 (유튜브 좋아요·공유 버튼 영역 침범 금지)
    const W = 1080 - 40 - 150;
    const len = c ? c.text.length : 1;
    const one = Math.min(74, Math.floor((W - 56) / (len * 0.98)));
    const two = one < 56;
    const fs = two ? Math.min(64, Math.floor(((W - 56) * 2) / (len * 1.04))) : one;
    const k = c ? interpolate(sec, [cStart, cStart + 0.1], [0, 1], {extrapolateRight: 'clamp'}) : 0;
    return (
      <div style={{position: 'absolute', left: 0, top: 1440, width: 1080, height: 480, background: 'linear-gradient(rgba(5,7,10,0) 0%, #05070a 22%, #05070a 100%)'}}>
        {c && (
          <div style={{position: 'absolute', top: 110, left: 40, width: W, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{
              background: 'rgba(0,0,0,0.62)', borderRadius: 20, padding: two ? '8px 26px 10px' : '14px 28px 18px', maxWidth: W, boxSizing: 'border-box',
              transform: `scale(${0.94 + 0.06 * k})`, opacity: 0.5 + 0.5 * k,
              fontSize: fs, lineHeight: two ? 1.1 : 1.15, fontWeight: 900, color: '#fff', textAlign: 'center',
              wordBreak: 'keep-all', whiteSpace: 'pre-wrap', WebkitTextStroke: '10px #000', paintOrder: 'stroke fill',
            }}>
              {renderText(c.text, HL, warn, yellow)}
            </div>
          </div>
        )}
        <div style={{position: 'absolute', bottom: 34, left: 40, width: W, textAlign: 'center', fontSize: 24, color: 'rgba(255,255,255,0.5)', fontWeight: 900}}>
          {episode.disclaimer ?? '※ 공개 자료를 바탕으로 한 가상 시나리오입니다'}
        </div>
      </div>
    );
  }
  return (
    <div style={{position: 'absolute', left: 0, top: 1440, width: 1080, height: 480, background: 'linear-gradient(rgba(5,7,10,0) 0%, #05070a 22%, #05070a 100%)'}}>
      {c && (() => {
        const k = interpolate(sec, [cStart, cStart + 0.12], [0, 1], {extrapolateRight: 'clamp'});
        return (
          <div style={{position: 'absolute', top: 70, left: 40, right: 40, display: 'flex', justifyContent: 'center'}}>
            <div style={{
              background: 'rgba(0,0,0,0.62)', borderRadius: 24, padding: '22px 34px 26px', maxWidth: 1000,
              transform: `scale(${0.92 + 0.08 * k})`, opacity: 0.4 + 0.6 * k,
              fontSize: 84, lineHeight: 1.22, fontWeight: 900, color: '#fff', textAlign: 'center',
              wordBreak: 'keep-all', whiteSpace: 'pre-wrap', WebkitTextStroke: '12px #000', paintOrder: 'stroke fill',
            }}>
              {renderText(c.text, HL, warn, yellow)}
            </div>
          </div>
        );
      })()}
      <div style={{position: 'absolute', bottom: 34, width: '100%', textAlign: 'center', fontSize: 26, color: 'rgba(255,255,255,0.5)', fontWeight: 900}}>
        {episode.disclaimer ?? '※ 공개 자료를 바탕으로 한 가상 시나리오입니다'}
      </div>
    </div>
  );
};
