import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {DEFAULT_SEC, FPS, videoSec} from './lib/schedule';
import {Episode, ShortProps, Timeline} from './lib/types';
import {Short} from './Short';
import {MilitaryGap} from './ep05/MilitaryGap';
import {QH, QW} from './ep05/layout';
import {InfographicEpisode, InfographicProps, Mosaic} from './ep05/types';
import {MissileDefense} from './ep06/MissileDefense';
import {DefenseEpisode, DefenseProps} from './ep06/types';

const calc: CalculateMetadataFunction<ShortProps> = async ({props}) => {
  const [episode, timeline] = await Promise.all([
    fetch(staticFile(`ep/${props.ep}/episode.json`)).then((r) => r.json() as Promise<Episode>),
    fetch(staticFile(`ep/${props.ep}/timeline.json`)).then((r) => r.json() as Promise<Timeline>),
  ]);
  // 영상 길이 = TTS 실제 길이 + 여운 1.5초 (고정 1800프레임 제거)
  return {props: {...props, episode, timeline}, durationInFrames: Math.round(videoSec(timeline) * FPS)};
};

// QHD 인포그래픽 (EP05~): 에피소드·타임라인·국경·모자이크 목록을 미리 읽어 props로
const calcInfographic: CalculateMetadataFunction<InfographicProps> = async ({props}) => {
  const [episode, timeline, geo, mosaics] = await Promise.all([
    fetch(staticFile(`ep/${props.ep}/episode.json`)).then((r) => r.json() as Promise<InfographicEpisode>),
    fetch(staticFile(`ep/${props.ep}/timeline.json`)).then((r) => r.json() as Promise<Timeline>),
    fetch(staticFile('geo/korea.json')).then((r) => r.json()),
    fetch(staticFile('tiles/mosaic.json')).then((r) => (r.ok ? (r.json() as Promise<Record<string, Mosaic>>) : {})).catch(() => ({})),
  ]);
  return {props: {...props, episode, timeline, geo, mosaics}, durationInFrames: Math.round(videoSec(timeline) * FPS)};
};

// EP06 다층 방공망 (QHD): 같은 방식으로 에피소드·타임라인·국경·모자이크를 미리 읽음
const calcDefense: CalculateMetadataFunction<DefenseProps> = async ({props}) => {
  const [episode, timeline, geo, mosaics] = await Promise.all([
    fetch(staticFile(`ep/${props.ep}/episode.json`)).then((r) => r.json() as Promise<DefenseEpisode>),
    fetch(staticFile(`ep/${props.ep}/timeline.json`)).then((r) => r.json() as Promise<Timeline>),
    fetch(staticFile('geo/korea.json')).then((r) => r.json()),
    fetch(staticFile('tiles/mosaic.json')).then((r) => (r.ok ? (r.json() as Promise<Record<string, Mosaic>>) : {})).catch(() => ({})),
  ]);
  return {props: {...props, episode, timeline, geo, mosaics}, durationInFrames: Math.round(videoSec(timeline) * FPS)};
};

export const Root: React.FC = () => (
  <>
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
    {/* EP05 남북 군사·경제 격차: 1440x2560(QHD) → 유튜브 VP09/AV01 고화질 코덱 유도 */}
    <Composition
      id="ep05-military-gap"
      component={MilitaryGap}
      width={QW}
      height={QH}
      fps={FPS}
      durationInFrames={34 * FPS}
      defaultProps={{ep: 'ep05-military-gap'} as InfographicProps}
      calculateMetadata={calcInfographic}
    />
    {/* EP06 한국형 다층 방공망 시뮬레이션: 1440x2560(QHD) · 30fps · 길이 = 나레이션 + 1.5초 (목표 35초) */}
    <Composition
      id="ep06-missile-defense"
      component={MissileDefense}
      width={QW}
      height={QH}
      fps={FPS}
      durationInFrames={35 * FPS}
      defaultProps={{ep: 'ep06-missile-defense'} as DefenseProps}
      calculateMetadata={calcDefense}
    />
  </>
);
