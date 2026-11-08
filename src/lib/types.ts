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
  valueText?: string; // 숫자 대신 고정 글자 (예: "20~30") — 카운트업 없이 표시
};

/** 공중전 시나리오 (EP04~) */
export type AirMap = {
  routes: LngLat[][]; // 북한 편대 남하 경로 (1단계 붉은 궤적·화살표)
  jetsPerRoute?: number; // 경로당 전투기 수 (연출용)
  kf21: LngLat[]; // 아군 KF-21·F-35A 편대 위치
  kf21Label?: string;
  radarKm?: number; // AESA 탐지 거리 (부채꼴 반경)
  radarBearing?: number; // 부채꼴 중심 방위 (도, 북=0)
  radarSpread?: number; // 부채꼴 각도 (도)
  nkRadarKm?: number; // 북한기 교전 거리 (작은 붉은 원)
  radarCue?: string; // 이 자막에서 AESA 빔 방사
  lockCue?: string; // 이 자막에서 표적 포착 박스
  fireCue?: string; // 이 자막에서 미티어 발사
  killCue?: string; // 이 자막에서 연속 공중 폭발 마무리
  radarLabel?: string; // 부채꼴 끝 라벨 (기본 "AESA 탐지 {radarKm}km+")
  missileName?: string; // 격추 카운터 미사일 이름 (기본 "미티어")
  bvrCue?: string; // EP07~: 이 자막부터 발사 직후까지 아군 선두기–적 선두기 BVR 교전선 + 거리 표기
  stealth?: StealthMap; // EP07~: 1단계 스텔스 침투 연출
};

/** EP07~: 북한 조기경보 레이더망 속 F-35A 스텔스 침투 (1단계) */
export type StealthMap = {
  cue: string; // 이 자막부터 레이더망·침투선 등장
  ewRadars: {pos: LngLat; km: number; name?: string}[]; // 북한 조기경보 레이더 기지 (탐지 반경 km)
  path: LngLat[]; // F-35A 침투 경로 (끝점 = 2단계 편대 선두 위치 권장)
  label?: string; // 침투기 라벨 (기본 "F-35A 스텔스 침투")
  noContact?: string; // 레이더 옆 문구 (기본 "탐지 실패")
};

/** 해상 항모전 시나리오 (EP08~): 항모전단 서해 진입 → 얕은 수심 킬존 → 지상·해상·공중 3방향 동시 타격 */
export type NavalMap = {
  carriers: {name: string; path: LngLat[]}[]; // 항모 항적 (1단계 붉은 점선, 끝점 = 정지 위치)
  escortsPerCarrier?: number; // 항모당 호위함 수 (기본 4)
  medianLine: LngLat[]; // 서해 중간선 (흰 점선)
  medianLabel?: string;
  sea: LngLat[]; // 얕은 수심 음영을 칠할 바다 다각형
  depthLabel?: string; depthLabelPos: LngLat; depthCue?: string;
  jetCue?: string; // 이 자막부터 항모 상공 함재기 초계 비행
  jetLabel?: string;
  killCue?: string; // 이 자막부터 킬존 + 잠수함 은신 불가 표시
  killZone: {center: LngLat; rxKm: number; ryKm: number; label?: string};
  subs: LngLat[]; // 호위 잠수함 위치
  rangeCue?: string; // 이 자막부터 타격권 원 확장
  rangeKm: number; rangeLabel?: string;
  bases: {pos: LngLat; name?: string}[]; // 서해안 암벽 기지 (미사일 발사 원점)
  fleet: LngLat[]; fleetLabel?: string; // 해군 2함대 함정
  f15k: LngLat[]; f15kLabel?: string; // F-15K 편대
  launchCue?: string; fleetCue?: string; slamCue?: string; graveCue?: string;
  graveLabel?: string; warnLabel?: string;
};

/** 정찰 공백 시나리오 (EP09~) */
export type ReconMap = {
  hubs: {pos: LngLat; name?: string; labelDx?: number; labelDy?: number}[]; // 첫 항목이 감시망 중심
  netKm: number;
  f16: {from: LngLat; to: LngLat; label: string}; f16Cue: string;
  a10: {pos: LngLat; label: string}; a10Cue: string;
  mlrs: {pos: LngLat}[]; mlrsLabel: string; mlrsCue: string;
  u2Track: LngLat[]; u2Label: string; u2Cue: string; linkCue: string;
  blindZones: LngLat[][]; blindCue: string; blindLabel: string;
  hidden: {pos: LngLat}[]; hiddenCue: string; hiddenLabel: string;
  satLons: number[]; satCue: string; satLabel: string; revisitCue: string; revisitLabel: string;
  gapCue: string; gapLabel: string;
};

/** 끝 4초 결과 카드 */
export type ResultData = {
  label: string;
  title: string;
  rows: {k: string; v: string}[];
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
  script: {t: string; say?: string; phase2?: boolean; subs?: string[]}[];
  scenario?: 'artillery' | 'armor' | 'missile' | 'air' | 'naval' | 'recon';
  layout?: 'safe'; // EP04~: 모바일 Safe Area 규격 (상단 120~350·자막 1550~1720·우측 150px 마진)
  result?: ResultData; // 있으면 끝 4초 결과 카드 + 스탯 페이드아웃 + 지도 80% 딤
  cta?: boolean; // 끝 4초 구독·좋아요 뱃지 (기본 켜짐, false면 끔)
  disclaimer?: string; // 자막 아래 작은 안내 문구 (기본: 가상 시나리오 안내)
  highlight?: string[]; // 자막 노랑 강조 단어 (숫자는 자동)
  highlightColor?: string; // 강조 노랑 색 (EP07: #FFE500, 기본 #FFD000)
  warn?: string[]; // 자막 경고 레드(#FF3B30) 단어 (EP07~)
  stats: {phase1: Stat[]; phase2: Stat[]; vs?: boolean; vsPhase2?: boolean};
  map: {
    mosaics?: string[]; // 추가 상세 위성 모자이크 이름 (pipeline/tiles.py)
    armor?: ArmorMap;
    missile?: MissileMap;
    air?: AirMap;
    naval?: NavalMap;
    recon?: ReconMap;
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
