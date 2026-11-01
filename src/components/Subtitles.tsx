import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, Episode, Timeline} from '../lib/types';

// 숫자·핵심 무기명은 노란색 강조 (단어 목록은 episode.json highlight)
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const makeHL = (words: string[]) =>
  new RegExp(`(${[...words.map(esc), '[A-Z]?-?\\d[\\d,.]*[^\\s,.?]*'].join('|')})`, 'g');

const renderText = (text: string, HL: RegExp) => {
  const parts = text.split(HL);
  return parts.map((p, i) => (i % 2 === 1 ? <span key={i} style={{color: COLORS.yellow}}>{p}</span> : <span key={i}>{p}</span>));
};

export const Subtitles: React.FC<{timeline: Timeline; episode: Episode}> = ({timeline, episode}) => {
  const HL = makeHL(episode.highlight ?? ['K9', '천무', '장사정포', '대포병 탐지레이더']);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  const c = timeline.chunks.find((ch) => sec >= ch.start && sec < ch.end);
  return (
    <div style={{position: 'absolute', left: 0, top: 1440, width: 1080, height: 480, background: 'linear-gradient(rgba(5,7,10,0) 0%, #05070a 22%, #05070a 100%)'}}>
      {c && (() => {
        const k = interpolate(sec, [c.start, c.start + 0.12], [0, 1], {extrapolateRight: 'clamp'});
        return (
          <div style={{position: 'absolute', top: 70, left: 40, right: 40, display: 'flex', justifyContent: 'center'}}>
            <div style={{
              background: 'rgba(0,0,0,0.62)', borderRadius: 24, padding: '22px 34px 26px', maxWidth: 1000,
              transform: `scale(${0.92 + 0.08 * k})`, opacity: 0.4 + 0.6 * k,
              fontSize: 84, lineHeight: 1.22, fontWeight: 900, color: '#fff', textAlign: 'center',
              wordBreak: 'keep-all', whiteSpace: 'pre-wrap', WebkitTextStroke: '12px #000', paintOrder: 'stroke fill',
            }}>
              {renderText(c.text, HL)}
            </div>
          </div>
        );
      })()}
      <div style={{position: 'absolute', bottom: 34, width: '100%', textAlign: 'center', fontSize: 26, color: 'rgba(255,255,255,0.5)', fontWeight: 900}}>
        ※ 공개 자료를 바탕으로 한 가상 시나리오입니다
      </div>
    </div>
  );
};
