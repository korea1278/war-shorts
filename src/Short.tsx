import React, {useEffect, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, staticFile} from 'remotion';
import {MapCanvas} from './components/MapCanvas';
import {SoundTrack} from './components/SoundTrack';
import {Subtitles} from './components/Subtitles';
import {TopStats} from './components/TopStats';
import {CtaOverlay} from './components/CtaOverlay';
import {ShortProps} from './lib/types';

const fontCss = `@font-face{font-family:'Pretendard';src:url('${staticFile('fonts/Pretendard-Black.woff2')}') format('woff2');font-weight:100 900;font-display:block;}`;

const useFont = () => {
  const [h] = useState(() => delayRender('폰트 로드', {timeoutInMilliseconds: 60000}));
  useEffect(() => {
    const f = new FontFace('Pretendard', `url(${staticFile('fonts/Pretendard-Black.woff2')})`, {weight: '100 900'});
    f.load()
      .then((ff) => (document.fonts as unknown as {add: (x: FontFace) => void}).add(ff))
      .catch((e) => console.warn('font', e))
      .finally(() => continueRender(h));
  }, [h]);
};

export const Short: React.FC<ShortProps> = ({ep, offline = false, episode, timeline}) => {
  useFont();
  if (!episode || !timeline) return null;
  return (
    <AbsoluteFill style={{background: '#05070a', fontFamily: 'Pretendard, sans-serif'}}>
      <style>{fontCss}</style>
      {/* 중앙 지도: Y 384 ~ 1440 */}
      <div style={{position: 'absolute', left: 0, top: 384, width: 1080, height: 1056, overflow: 'hidden'}}>
        <MapCanvas episode={episode} timeline={timeline} offline={offline} />
      </div>
      {/* 상단 인포그래픽: Y 0 ~ 480 */}
      <TopStats episode={episode} timeline={timeline} />
      {/* 하단 자막: Y 1440 ~ 1920 */}
      <Subtitles timeline={timeline} episode={episode} />
      {/* 끝 4초: 구독·좋아요 CTA (자막 위) */}
      <CtaOverlay episode={episode} timeline={timeline} />
      <SoundTrack ep={ep} episode={episode} timeline={timeline} />
    </AbsoluteFill>
  );
};
