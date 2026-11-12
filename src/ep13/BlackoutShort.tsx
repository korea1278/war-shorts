// EP13 북한 전력망 탄소섬유탄(정전폭탄) 투하 시뮬레이션 (1080x1920 · 30fps)
//  상단(Y 0~564) 제원·전력 마비 카드 · 중앙(Y 384~1440) 3D 위성 야경 지도 + HUD · 자막 바닥 Y 1478(bottom 23%) · 최하단 20% 비움
//  Frame 0: 썸네일 1프레임 (ShortsThumbnail, EP13 카피)
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {CtaOverlay} from '../components/CtaOverlay';
import {EP13_THUMB, ShortsThumbnail} from '../components/ShortsThumbnail';
import {SoundTrack} from '../components/SoundTrack';
import {Subtitles} from '../components/Subtitles';
import {TopStats} from '../components/TopStats';
import {fontCss, usePretendard} from '../lib/font';
import {Episode, Timeline} from '../lib/types';
import {BlackoutStage} from './BlackoutStage';
import {Hud} from './Hud';
import {blackoutPlan, BlackoutEpisode} from './plan';

export type BlackoutProps = {ep: string; episode?: BlackoutEpisode; timeline?: Timeline};

export const BlackoutShort: React.FC<BlackoutProps> = ({ep, episode, timeline}) => {
  usePretendard();
  if (!episode || !timeline) return null;
  const p = blackoutPlan(episode, timeline);
  const e = episode as unknown as Episode;
  return (
    <AbsoluteFill style={{background: '#05070a', fontFamily: 'Pretendard, sans-serif'}}>
      <style>{fontCss()}</style>
      <BlackoutStage p={p} d={episode.blackout} dayLayers={episode.map.mosaics} nightLayer={episode.map.night} />
      <Hud p={p} d={episode.blackout} />
      <TopStats episode={e} timeline={timeline} />
      {/* 자막은 하단 전용 레이어 한 곳에서만 렌더 */}
      <Subtitles timeline={timeline} episode={e} />
      <CtaOverlay episode={e} timeline={timeline} />
      <SoundTrack ep={ep} episode={e} timeline={timeline} />
      <Sequence from={0} durationInFrames={1} layout="none">
        <AbsoluteFill>
          <ShortsThumbnail copy={EP13_THUMB} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
