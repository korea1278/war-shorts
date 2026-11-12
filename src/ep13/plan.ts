// EP13 탄소섬유탄(정전폭탄) 북한 전력망 타격: 문장 scene 키 + 자막 큐 → 연출 시각(초) · 카메라
import {CamKey, Episode, LngLat, Timeline} from '../lib/types';
import {clamp01, cueTime, easeInOut, videoSec} from '../lib/schedule';

export type BlackoutScene = 'intro' | 'kosovo' | 'korea' | 'drop' | 'spark' | 'flash' | 'blackout' | 'dark' | 'cta';

export type BlackoutData = {
  capital: LngLat; // 평양 (투하 지점)
  jetPath: LngLat[]; // F-15K 비행 궤적 (평양 지점 = capital 포함)
  jetLabel: string;
  releaseCue: string; burstCue: string; webCue: string; landCue: string;
  massCue: string; waveCue: string; outCue: string; commsCue: string;
  targetLabel: string; commsLabel: string; blackoutLabel: string;
};

export type BlackoutEpisode = Omit<Episode, 'script' | 'map'> & {
  composition: string;
  blackout: BlackoutData;
  map: {mosaics: string[]; night: string; nightDefs?: Record<string, unknown>; mosaicDefs?: Record<string, unknown>};
  script: {t: string; say?: string; phase2?: boolean; subs?: string[]; scene: BlackoutScene}[];
};

export type BlackoutPlan = {
  T: number;
  kosovo: number; korea: number; // 궤적 등장
  jet0: number; release: number; // 전투기 출발 → 평양 상공 투하
  burst: number; web: number; land: number; // 자탄 확산 → 섬유 거미줄 → 착지
  spark: number; mass: number; flash: number; // 합선 스파크 → 수천 곳 → 연쇄 섬광
  wave: number; waveEnd: number; // 정전 파동 (평양 → 북한 전역)
  dark: number; out: number; comms: number; cta: number;
};

export const blackoutPlan = (ep: BlackoutEpisode, tl: Timeline): BlackoutPlan => {
  const T = videoSec(tl);
  const at = (scene: BlackoutScene, fb: number) => {
    const i = ep.script.findIndex((s) => s.scene === scene);
    return i >= 0 && tl.sentences[i] ? tl.sentences[i].start : fb;
  };
  const d = ep.blackout;
  const korea = at('korea', T * 0.25);
  const drop = at('drop', T * 0.33);
  const release = cueTime(tl, d.releaseCue, drop + 2.5);
  const burst = Math.max(release + 0.9, cueTime(tl, d.burstCue, release + 1.2));
  const web = Math.max(burst + 1, cueTime(tl, d.webCue, burst + 3));
  const spark = at('spark', web + 2);
  const blackout = at('blackout', spark + 8);
  const wave = Math.max(spark + 2, cueTime(tl, d.waveCue, blackout + 1.5));
  const dark = at('dark', wave + 3);
  return {
    T,
    kosovo: at('kosovo', T * 0.12),
    korea,
    jet0: korea,
    release,
    burst,
    web,
    land: Math.max(web + 0.8, cueTime(tl, d.landCue, spark + 1.2)),
    spark,
    mass: cueTime(tl, d.massCue, spark + 2.5),
    flash: at('flash', spark + 6),
    wave,
    waveEnd: Math.max(wave + 2.5, dark - 0.2),
    dark,
    out: cueTime(tl, d.outCue, dark + 1.2),
    comms: cueTime(tl, d.commsCue, dark + 2.5),
    cta: at('cta', T - 4),
  };
};

// ── 카메라: 한반도 전경 → 평양 근접 → 정전 파동 때 다시 전경 (남한 불빛과 대비) ──
const WIDE: Omit<CamKey, 't'> = {center: [127.35, 38.25], zoom: 6.55, pitch: 32, bearing: 0};

export const blackoutCam = (p: BlackoutPlan, d: BlackoutData, sec: number): CamKey => {
  const [cx, cy] = d.capital;
  const keys: CamKey[] = [
    {t: 0, ...WIDE},
    {t: p.jet0, ...WIDE, zoom: 6.7, pitch: 36},
    {t: p.release - 0.6, center: [cx + 0.35, cy - 0.25], zoom: 8.1, pitch: 46, bearing: -8},
    {t: p.burst + 0.4, center: [cx, cy - 0.04], zoom: 9.0, pitch: 52, bearing: -12},
    {t: p.mass, center: [cx + 0.02, cy - 0.02], zoom: 9.4, pitch: 56, bearing: -16},
    {t: p.wave, center: [cx + 0.4, cy - 0.15], zoom: 8.2, pitch: 48, bearing: -10},
    {t: p.waveEnd, center: [127.2, 38.5], zoom: 6.75, pitch: 36, bearing: 0},
    {t: p.T, center: [127.2, 38.45], zoom: 6.9, pitch: 38, bearing: 0},
  ];
  let i = 0;
  while (i < keys.length - 2 && sec >= keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const k = easeInOut(clamp01((sec - a.t) / Math.max(0.001, b.t - a.t)));
  const L = (x: number, y: number) => x + (y - x) * k;
  return {
    t: sec,
    center: [L(a.center[0], b.center[0]), L(a.center[1], b.center[1])],
    zoom: L(a.zoom, b.zoom),
    pitch: L(a.pitch, b.pitch),
    bearing: L(a.bearing, b.bearing),
  };
};

// ── 전력망 재료 (연출용 근사 좌표) ──
// 도시 불빛: [경도, 위도, 세기, 평양에서 거리 순 파동 도달용]
export const CITIES: {name: string; pos: LngLat; size: number}[] = [
  {name: '평양', pos: [125.754, 39.031], size: 1.0},
  {name: '남포', pos: [125.4, 38.73], size: 0.45},
  {name: '사리원', pos: [125.75, 38.51], size: 0.35},
  {name: '안주', pos: [125.66, 39.62], size: 0.3},
  {name: '순천', pos: [125.93, 39.42], size: 0.3},
  {name: '개성', pos: [126.55, 37.97], size: 0.35},
  {name: '해주', pos: [125.72, 38.04], size: 0.3},
  {name: '신의주', pos: [124.4, 40.1], size: 0.4},
  {name: '원산', pos: [127.44, 39.15], size: 0.4},
  {name: '함흥', pos: [127.54, 39.92], size: 0.5},
  {name: '강계', pos: [126.6, 40.97], size: 0.3},
  {name: '김책', pos: [129.2, 40.67], size: 0.3},
  {name: '혜산', pos: [128.18, 41.4], size: 0.25},
  {name: '청진', pos: [129.78, 41.8], size: 0.45},
  {name: '나선', pos: [130.3, 42.3], size: 0.25},
];

// 송전망 간선 (도시 인덱스 쌍)
export const GRID: [number, number][] = [
  [0, 1], [0, 2], [0, 4], [4, 3], [3, 7], [2, 6], [2, 5], [0, 8], [8, 9], [4, 10], [9, 11], [11, 13], [13, 14], [11, 12], [10, 12],
];

// 평양 주변 변전소 (연출용 근사 위치)
export const SUBSTATIONS: LngLat[] = [
  [125.70, 39.07], [125.80, 39.00], [125.66, 38.99], [125.86, 39.08], [125.75, 39.13],
  [125.92, 38.98], [125.60, 39.06], [125.78, 38.93], [125.95, 39.11], [125.68, 39.16],
];

/** 평양에서 km (평면 근사) */
export const kmFrom = (a: LngLat, b: LngLat) => {
  const dx = (a[0] - b[0]) * 111 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (a[1] - b[1]) * 111;
  return Math.hypot(dx, dy);
};

/** 정전 파동 반경 (km): 평양에서 북한 전역(약 520km)까지 */
export const waveKm = (p: BlackoutPlan, sec: number) => {
  if (sec < p.wave) return -1;
  const k = clamp01((sec - p.wave) / Math.max(0.5, p.waveEnd - p.wave));
  return 2 + 560 * (1 - Math.pow(1 - k, 2.2));
};
