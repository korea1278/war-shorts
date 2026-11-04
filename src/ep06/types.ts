// EP06 한국형 다층 방공망 시뮬레이션 (QHD 1440x2560) 타입
import {LngLat, Timeline} from '../lib/types';
import {GeoFeature, Mosaic} from '../ep05/types';

export type DefenseScene = 'intro' | 'launch' | 'lsam' | 'pullup' | 'mid' | 'lamd' | 'outro' | 'cta';

export type ThreatCard = {label: string; value: number; unit?: string; prefix?: string; decimals?: number; cue?: string};

/** 고도 레이어 (km) */
export type Layer = {key: 'high' | 'mid' | 'low'; name: string; range: string; from: number; to: number; color: string};

export type DefenseEpisode = {
  id: string;
  composition: string;
  scenario: 'defense';
  layout: 'safe';
  title: [string, string];
  disclaimer?: string;
  cta?: boolean;
  highlight?: string[];
  script: {t: string; say?: string; scene: DefenseScene}[];
  threat: {cards: ThreatCard[]; source?: string};
  layers: Layer[];
  lsam: {hitCue: string; caption: string; alt: number; note?: string};
  pullup: {cue: string; caption: string; sub?: string};
  mid: {fireCue: string; hitCue: string; caption: string; cards: {name: string; range: string; color: string}[]};
  lamd: {cue: string; hitCue: string; caption: string; range: string; status: string};
  outro: {coreCue: string; line1: string; pillars: {name: string; desc: string; on: boolean}[]; source?: string};
  map: {
    fit: [number, number, number, number];
    mosaicDefs: Record<string, [number, [number, number, number, number]]>;
    day: string;
    mdl: LngLat[];
    pyongyang: LngLat;
    seoul: LngLat;
    launchSites: LngLat[];
    targets: LngLat[];
    labels: {nk: LngLat; rok: LngLat};
  };
};

export type DefenseProps = {
  ep: string;
  episode?: DefenseEpisode;
  timeline?: Timeline;
  geo?: {features: GeoFeature[]};
  mosaics?: Record<string, Mosaic>;
};
