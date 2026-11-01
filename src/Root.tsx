import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {DEFAULT_SEC, FPS, videoSec} from './lib/schedule';
import {Episode, ShortProps, Timeline} from './lib/types';
import {Short} from './Short';

const calc: CalculateMetadataFunction<ShortProps> = async ({props}) => {
  const [episode, timeline] = await Promise.all([
    fetch(staticFile(`ep/${props.ep}/episode.json`)).then((r) => r.json() as Promise<Episode>),
    fetch(staticFile(`ep/${props.ep}/timeline.json`)).then((r) => r.json() as Promise<Timeline>),
  ]);
  // 영상 길이 = TTS 실제 길이 + 여운 1.5초 (고정 1800프레임 제거)
  return {props: {...props, episode, timeline}, durationInFrames: Math.round(videoSec(timeline) * FPS)};
};

export const Root: React.FC = () => (
  <Composition
    id="Short"
    component={Short}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={DEFAULT_SEC * FPS}
    defaultProps={{ep: 'ep01-artillery', offline: false} as ShortProps}
    calculateMetadata={calc}
  />
);
