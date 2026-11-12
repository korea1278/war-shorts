import React from 'react';
import {CalculateMetadataFunction, Composition, Still, staticFile} from 'remotion';
import {EP12_THUMB, EP13_THUMB, ShortsThumbnail} from './components/ShortsThumbnail';
import {BlackoutProps, BlackoutShort} from './ep13/BlackoutShort';
import {BlackoutEpisode} from './ep13/plan';
import {SlbmProps, SlbmShort} from './ep12/SlbmShort';
import {SlbmEpisode} from './ep12/plan';
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

// EP12 SLBM 수중 발사 (1080x1920): 에피소드·타임라인·국경을 미리 읽음
const calcSlbm: CalculateMetadataFunction<SlbmProps> = async ({props}) => {
  const [episode, timeline, geo] = await Promise.all([
    fetch(staticFile(`ep/${props.ep}/episode.json`)).then((r) => r.json() as Promise<SlbmEpisode>),
    fetch(staticFile(`ep/${props.ep}/timeline.json`)).then((r) => r.json() as Promise<Timeline>),
    fetch(staticFile('geo/korea.json')).then((r) => r.json()),
  ]);
  return {props: {...props, episode, timeline, geo}, durationInFrames: Math.round(videoSec(timeline) * FPS)};
};

// EP13 탄소섬유탄 정전 타격 (1080x1920): 에피소드·타임라인 (지도 재료는 컴포넌트가 직접 로드)
const calcBlackout: CalculateMetadataFunction<BlackoutProps> = async ({props}) => {
  const [episode, timeline] = await Promise.all([
    fetch(staticFile(`ep/${props.ep}/episode.json`)).then((r) => r.json() as Promise<BlackoutEpisode>),
    fetch(staticFile(`ep/${props.ep}/timeline.json`)).then((r) => r.json() as Promise<Timeline>),
  ]);
  return {props: {...props, episode, timeline}, durationInFrames: Math.round(videoSec(timeline) * FPS)};
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
    {/* EP12 한국 해군 3,000톤급 잠수함 SLBM: 1080x1920 · 30fps · 길이 = 나레이션 + 1.5초 · Frame 0 썸네일 */}
    <Composition
      id="ep12-slbm"
      component={SlbmShort}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={58 * FPS}
      defaultProps={{ep: 'ep12-slbm'} as SlbmProps}
      calculateMetadata={calcSlbm}
    />
    {/* EP13 북한 전력망 탄소섬유탄(정전폭탄): 1080x1920 · 30fps · 길이 = 나레이션 + 1.5초 · Frame 0 썸네일 */}
    <Composition
      id="ep13-blackout"
      component={BlackoutShort}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={57 * FPS}
      defaultProps={{ep: 'ep13-blackout'} as BlackoutProps}
      calculateMetadata={calcBlackout}
    />
    {/* 쇼츠 썸네일 (EP12~): 1080x1920 단일 프레임 → public/thumbnails/shorts_epNN.png */}
    <Still id="shorts-thumbnail" component={ShortsThumbnail} width={1080} height={1920} defaultProps={{copy: EP12_THUMB}} />
    <Still id="shorts-thumbnail-ep13" component={ShortsThumbnail} width={1080} height={1920} defaultProps={{copy: EP13_THUMB}} />
  </>
);
