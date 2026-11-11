import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, Episode, Timeline} from '../lib/types';

/** shorts23 세이프존: 자막 바 바닥 Y (1920 × 0.77 ≈ bottom 23%) */
export const SUB_BOTTOM_Y = 1478;

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
  if (episode.subtitleZone === 'shorts23') {
    // EP11~ 유튜브 쇼츠 UI 세이프존: 자막 바 바닥을 bottom 23%(Y 1478)에 고정 → 채널명·제목·음원 바(하단 0~20%)에 가리지 않음.
    // 1줄 기준 Y 약 1380~1478, 우측 150px(좋아요·공유 버튼) 마진. 자막은 이 컨테이너 한 곳에서만 렌더링
    const W = 1080 - 40 - 150;
    const len = c ? c.text.length : 1;
    const one = Math.min(68, Math.floor((W - 56) / (len * 0.98)));
    const two = one < 54;
    const fs = two ? Math.min(56, Math.floor(((W - 56) * 2) / (len * 1.04))) : one;
    const k = c ? interpolate(sec, [cStart, cStart + 0.1], [0, 1], {extrapolateRight: 'clamp'}) : 0;
    return (
      <div style={{position: 'absolute', left: 0, top: 1320, width: 1080, height: 600, background: 'linear-gradient(rgba(5,7,10,0) 0%, rgba(5,7,10,0.85) 10%, #05070a 20%, #05070a 100%)'}}>
        {c && (
          <div style={{position: 'absolute', left: 40, width: W, bottom: 600 - (SUB_BOTTOM_Y - 1320), display: 'flex', justifyContent: 'center'}}>
            <div style={{
              background: 'rgba(0,0,0,0.62)', borderRadius: 20, padding: two ? '6px 24px 8px' : '8px 28px 12px', maxWidth: W, boxSizing: 'border-box',
              transform: `scale(${0.94 + 0.06 * k})`, transformOrigin: '50% 100%', opacity: 0.5 + 0.5 * k,
              fontSize: fs, lineHeight: two ? 1.1 : 1.15, fontWeight: 900, color: '#fff', textAlign: 'center',
              wordBreak: 'keep-all', whiteSpace: 'pre-wrap', WebkitTextStroke: '10px #000', paintOrder: 'stroke fill',
            }}>
              {renderText(c.text, HL, warn, yellow)}
            </div>
          </div>
        )}
        {/* 출처 표기만 세이프존 경계(Y 1500~) — 그 아래(하단 20%)는 비움 */}
        <div style={{position: 'absolute', top: 1500 - 1320, left: 40, width: W, textAlign: 'center', fontSize: 22, color: 'rgba(255,255,255,0.5)', fontWeight: 900}}>
          {episode.disclaimer ?? '※ 공개 자료를 바탕으로 한 가상 시나리오입니다'}
        </div>
      </div>
    );
  }
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
