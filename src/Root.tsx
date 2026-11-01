import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {FPS, TOTAL_SEC} from './lib/schedule';
import {Episode, ShortProps, Timeline} from './lib/types';
import {Short} from './Short';

const calc: CalculateMetadataFunction<ShortProps> = async ({props}) => {
  const [episode, timeline] = await Promise.all([
    fetch(staticFile(`ep/${props.ep}/episode.json`)).then((r) => r.json() as Promise<Episode>),
    fetch(staticFile(`ep/${props.ep}/timeline.json`)).then((r) => r.json() as Promise<Timeline>),
  ]);
  return {props: {...props, episode, timeline}};
};

export const Root: React.FC = () => (
  <Composition
    id="Short"
    component={Short}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={TOTAL_SEC * FPS}
    defaultProps={{ep: 'ep01-artillery', offline: false} as ShortProps}
    calculateMetadata={calc}
  />
);
