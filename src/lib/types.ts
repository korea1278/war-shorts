export type LngLat = [number, number];

export type Stat = {
  label: string;
  prefix: string;
  value: number;
  suffix: string;
  side: 'nk' | 'rok';
  cue?: string; // 이 글자가 들어간 자막이 나올 때 카드 등장
};

export type CamKey = {t: number; center: LngLat; zoom: number; pitch: number; bearing: number};

export type Episode = {
  id: string;
  title: [string, string];
  script: {t: string; say?: string; phase2?: boolean}[];
  stats: {phase1: Stat[]; phase2: Stat[]};
  map: {
    nkOrigins: LngLat[];
    targets: LngLat[];
    seoul: LngLat;
    radar: LngLat;
    k9Sites: {name: string; pos: LngLat; kind: 'k9' | 'chunmoo'}[];
    labels: {text: string; pos: LngLat; size: number; phase: 0 | 1 | 2}[];
    camera: {phase1: CamKey[]; phase2: CamKey[]};
  };
};

export type Chunk = {start: number; end: number; text: string; sentence: number};

export type Timeline = {
  engine: string;
  duration: number;
  phase2At: number;
  sentences: {i: number; start: number; end: number; text: string}[];
  chunks: Chunk[];
};

export type ShortProps = {
  ep: string;
  offline?: boolean; // 로컬 점검: 위성 타일 대신 단색
  episode?: Episode;
  timeline?: Timeline;
};

export const COLORS = {
  nk: '#ff2828',
  rok: '#0066ff',
  rokLight: '#4da3ff',
  chunmoo: '#00e5ff',
  yellow: '#FFD000',
  fire: '#ff8a1f',
};
