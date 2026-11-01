export type LngLat = [number, number];

export type Stat = {
  label: string;
  prefix: string;
  value: number;
  suffix: string;
  side: 'nk' | 'rok' | 'gray';
  numPrefix?: string; // 숫자 앞 단위 (예: "마하" 10)
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

/** 탄도미사일 정밀 타격 시나리오 (EP03~) */
export type MissileMap = {
  launcher: LngLat; // 아군 발사대
  launcherLabel?: string;
  target: LngLat; // 주 표적(지휘부 벙커)
  targetLabel?: string;
  bunkers: LngLat[]; // 주변 지하 벙커 (매몰 연출)
  apexKm?: number; // 정점 고도 (km, 연출용)
  maxMach?: number; // 낙하 최대 속도
  impactCue?: string; // 이 자막에서 지표면 충돌
  buryCue?: string; // 이 자막에서 심도 폭발·매몰
  buryText?: string; // 매몰 순간 큰 문구
  depthM?: number; // 관통 깊이 게이지 최대값 (m)
};

export type CamKey = {t: number; center: LngLat; zoom: number; pitch: number; bearing: number};

export type Episode = {
  id: string;
  title: [string, string];
  script: {t: string; say?: string; phase2?: boolean}[];
  scenario?: 'artillery' | 'armor' | 'missile';
  cta?: boolean; // 끝 4초 구독·좋아요 뱃지 (기본 켜짐, false면 끔)
  highlight?: string[]; // 자막 노랑 강조 단어 (숫자는 자동)
  stats: {phase1: Stat[]; phase2: Stat[]; vs?: boolean; vsPhase2?: boolean};
  map: {
    mosaics?: string[]; // 추가 상세 위성 모자이크 이름 (pipeline/tiles.py)
    armor?: ArmorMap;
    missile?: MissileMap;
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
  gray: '#8a96a3',
  yellow: '#FFD000',
  fire: '#ff8a1f',
};
