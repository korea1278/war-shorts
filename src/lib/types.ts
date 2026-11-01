export type LngLat = [number, number];

export type Stat = {
  label: string;
  prefix: string;
  value: number;
  suffix: string;
  side: 'nk' | 'rok';
  cue?: string; // 이 글자가 들어간 자막이 나올 때 카드 등장
  decimals?: number; // 소수점 자리 (예: 2.5km)
  note?: string; // 숫자 아래 작은 설명 (예: "(야간 불가)")
};

/** 기갑전 시나리오 */
export type ArmorMap = {
  axes: {name?: string; path: LngLat[]}[]; // 북한 기갑 남하 축선 (1단계 붉은 화살표)
  nkTanks: LngLat[]; // 2단계 교전 시 북한 전차 위치
  k2: {pos: LngLat; name?: string}[]; // 아군 K2 위치
  rangeLabel?: string; // 조준선 거리 표기 (예: "2.5km")
  nightCue?: string; // 이 자막부터 야간 화면
  ratioCue?: string; // 이 자막에서 교환비 문구
  ratioText?: string;
};

export type CamKey = {t: number; center: LngLat; zoom: number; pitch: number; bearing: number};

export type Episode = {
  id: string;
  title: [string, string];
  script: {t: string; say?: string; phase2?: boolean}[];
  scenario?: 'artillery' | 'armor';
  highlight?: string[]; // 자막 노랑 강조 단어 (숫자는 자동)
  stats: {phase1: Stat[]; phase2: Stat[]; vs?: boolean};
  map: {
    mosaics?: string[]; // 추가 상세 위성 모자이크 이름 (pipeline/tiles.py)
    armor?: ArmorMap;
    nkOrigins: LngLat[];
    targets: LngLat[];
    seoul: LngLat;
    radar: LngLat;
    k9Sites: {name: string; pos: LngLat; kind: 'k9' | 'chunmoo'}[];
    labels: {text: string; pos: LngLat; size: number; phase: 0 | 1 | 2}[];
    camera: {phase1: CamKey[]; phase2: CamKey[]};
  };
};

export type Chunk = {start: number; end: number; text: string; sentence: number; startFrame?: number; endFrame?: number};

export type Timeline = {
  engine: string;
  duration: number;
  audioSec?: number;
  durationInFrames?: number; // 오디오 길이 + 여운 1.5초 (prepare.py가 계산)
  videoSec?: number;
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
