// EP12 한국 해군 3,000톤급 잠수함 SLBM (1080x1920 · 30fps)
//  상단(Y 0~480) 제원 카드 · 중앙(Y 470~1390) 수중 발사 시뮬레이션 · 자막 바닥 Y 1478(bottom 23%) · 최하단 20% 비움
//  Frame 0: 썸네일 1프레임 (ShortsThumbnail)
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {CtaOverlay} from '../components/CtaOverlay';
import {ShortsThumbnail} from '../components/ShortsThumbnail';
import {SoundTrack} from '../components/SoundTrack';
import {Subtitles} from '../components/Subtitles';
import {TopStats} from '../components/TopStats';
import {fontCss, usePretendard} from '../lib/font';
import {Timeline} from '../lib/types';
import {slbmPlan, SlbmEpisode} from './plan';
import {SlbmStage} from './SlbmStage';

export type SlbmProps = {
  ep: string;
  episode?: SlbmEpisode;
  timeline?: Timeline;
  geo?: Parameters<typeof SlbmStage>[0]['geo'];
};

export const SlbmShort: React.FC<SlbmProps> = ({ep, episode, timeline, geo}) => {
  usePretendard();
  if (!episode || !timeline || !geo) return null;
  const p = slbmPlan(episode, timeline);
  return (
    <AbsoluteFill style={{background: '#05070a', fontFamily: 'Pretendard, sans-serif'}}>
      <style>{fontCss()}</style>
      <SlbmStage p={p} d={episode.slbm} geo={geo} />
      <TopStats episode={episode} timeline={timeline} />
      {/* 자막은 하단 전용 레이어 한 곳에서만 렌더 */}
      <Subtitles timeline={timeline} episode={episode} />
      <CtaOverlay episode={episode} timeline={timeline} />
      <SoundTrack ep={ep} episode={episode} timeline={timeline} />
      <Sequence from={0} durationInFrames={1} layout="none">
        <AbsoluteFill>
          <ShortsThumbnail />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
