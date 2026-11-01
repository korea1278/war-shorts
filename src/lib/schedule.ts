import {CamKey, Episode, LngLat, Timeline} from './types';

export const FPS = 30;
export const DEFAULT_SEC = 60;
/** 영상 길이(초) = 나레이션 실제 길이 + 여운 (timeline.json) */
export const videoSec = (tl: Timeline) => tl.videoSec ?? (tl.durationInFrames ? tl.durationInFrames / FPS : DEFAULT_SEC);
/** 카메라 키프레임은 60초 기준(1단계 25초·2단계 35초)으로 작성 → 실제 구간 길이에 비율로 맞춤 */
const NOMINAL = {phase1: 25, phase2: 35};

// 결정적 난수 (렌더 탭마다 결과가 같아야 함)
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** 자막 중 keyword가 처음 들어간 덩어리의 시작 시각 */
export const cueTime = (tl: Timeline, keyword: string | undefined, fallback: number) => {
  if (!keyword) return fallback;
  const c = tl.chunks.find((ch) => ch.text.includes(keyword));
  return c ? c.start : fallback;
};

export type Arc = {
  from: LngLat;
  to: LngLat;
  launch: number; // 초
  flight: number;
  side: 'nk' | 'k9' | 'chunmoo';
  originIdx: number;
};

export type Blast = {pos: LngLat; t: number; size: number; side: 'nk' | 'rok'};

export type Plan = {
  t2: number;
  arcs: Arc[];
  blasts: Blast[];
  destroyedAt: number[]; // 원점별 파괴 시각
  radarStart: number;
  traceStart: number;
  traceEnd: number;
  counterStart: number;
};

const cache = new Map<string, Plan>();

export const buildPlan = (ep: Episode, tl: Timeline): Plan => {
  const key = ep.id + tl.phase2At + tl.duration + videoSec(tl);
  const T = videoSec(tl);
  const hit = cache.get(key);
  if (hit) return hit;
  const m = ep.map;
  const t2 = tl.phase2At;
  const arcs: Arc[] = [];
  const blasts: Blast[] = [];

  // 1단계: 북측 갱도 진지 → 서울·수도권 (동시에 8~10줄 보이게 0.25초 간격, '16,000발'부터 더 촘촘히)
  const heavy = cueTime(tl, '16,000발', t2 * 0.55);
  let t = 1.0;
  let n = 0;
  while (t < t2 - 1.2) {
    const oi = Math.floor(rand(n * 3 + 1) * m.nkOrigins.length);
    const ti = Math.floor(rand(n * 7 + 2) * m.targets.length);
    const flight = 2.1 + rand(n * 11 + 3) * 0.6;
    const jitter: LngLat = [(rand(n * 13) - 0.5) * 0.05, (rand(n * 17) - 0.5) * 0.04];
    const to: LngLat = [m.targets[ti][0] + jitter[0], m.targets[ti][1] + jitter[1]];
    arcs.push({from: m.nkOrigins[oi], to, launch: t, flight, side: 'nk', originIdx: oi});
    blasts.push({pos: to, t: t + flight, size: 0.8 + rand(n * 19) * 0.5, side: 'nk'});
    t += t < heavy ? 0.3 : 0.2;
    n++;
  }

  // 2단계: 레이더 탐지 → 역추적 → K9·천무 반격
  const radarStart = t2 + 0.6;
  const traceStart = Math.max(t2 + 2.2, cueTime(tl, '역추적', t2 + 3) - 1.2);
  const traceEnd = traceStart + 2.6;
  const counterStart = Math.min(cueTime(tl, 'K9', traceEnd + 0.5), traceEnd + 1.5);
  const end = T - 2.2;
  const destroyedAt = m.nkOrigins.map(() => Infinity);
  t = counterStart;
  n = 0;
  while (t < end) {
    const site = m.k9Sites[n % m.k9Sites.length];
    const oi = Math.floor(rand(n * 5 + 101) * m.nkOrigins.length);
    const origin = m.nkOrigins[oi];
    const isRocket = site.kind === 'chunmoo';
    const flight = isRocket ? 1.5 + rand(n + 7) * 0.3 : 1.9 + rand(n + 9) * 0.4;
    const from: LngLat = [site.pos[0] + (rand(n * 23) - 0.5) * 0.04, site.pos[1] + (rand(n * 29) - 0.5) * 0.03];
    const to: LngLat = [origin[0] + (rand(n * 31) - 0.5) * 0.03, origin[1] + (rand(n * 37) - 0.5) * 0.02];
    arcs.push({from, to, launch: t, flight, side: isRocket ? 'chunmoo' : 'k9', originIdx: oi});
    blasts.push({pos: to, t: t + flight, size: 1.1 + rand(n * 41) * 0.6, side: 'rok'});
    if (destroyedAt[oi] === Infinity) destroyedAt[oi] = t + flight + 0.6;
    t += 0.17;
    n++;
  }
  // 아직 안 맞은 원점도 마무리 일제 타격
  destroyedAt.forEach((d, i) => {
    if (d === Infinity) {
      const lt = Math.max(counterStart, end - 3) + i * 0.1;
      const site = m.k9Sites[i % m.k9Sites.length];
      arcs.push({from: site.pos, to: m.nkOrigins[i], launch: lt, flight: 1.8, side: 'k9', originIdx: i});
      blasts.push({pos: m.nkOrigins[i], t: lt + 1.8, size: 1.5, side: 'rok'});
      destroyedAt[i] = lt + 2.4;
    }
  });
  const plan = {t2, arcs, blasts, destroyedAt, radarStart, traceStart, traceEnd, counterStart};
  cache.set(key, plan);
  return plan;
};

/** 카메라 키프레임 보간. t<0 은 구간 끝에서 거꾸로 센 시각 */
export const cameraAt = (sec: number, ep: Episode, tl: Timeline) => {
  const t2 = tl.phase2At;
  const inP2 = sec >= t2;
  const keys = inP2 ? ep.map.camera.phase2 : ep.map.camera.phase1;
  const base = inP2 ? t2 : 0;
  const len = inP2 ? videoSec(tl) - t2 : t2;
  const r = len / (inP2 ? NOMINAL.phase2 : NOMINAL.phase1);
  const abs = keys
    .map((k) => ({...k, t: base + Math.min(len, Math.max(0, k.t < 0 || Object.is(k.t, -0) ? len + k.t * r : k.t * r))}))
    .sort((a, b) => a.t - b.t);
  if (sec <= abs[0].t) return abs[0];
  for (let i = 0; i < abs.length - 1; i++) {
    const a = abs[i];
    const b = abs[i + 1];
    if (sec <= b.t) {
      const p = easeInOut(clamp01((sec - a.t) / (b.t - a.t)));
      return lerpCam(a, b, p);
    }
  }
  return abs[abs.length - 1];
};

const lerpCam = (a: CamKey, b: CamKey, p: number): CamKey => ({
  t: 0,
  center: [a.center[0] + (b.center[0] - a.center[0]) * p, a.center[1] + (b.center[1] - a.center[1]) * p],
  zoom: a.zoom + (b.zoom - a.zoom) * p,
  pitch: a.pitch + (b.pitch - a.pitch) * p,
  bearing: a.bearing + (b.bearing - a.bearing) * p,
});

/** 효과음 큐 (18종: 기존 17종 + 합성 레이더 비프) */
export type Sfx = {file: string; at: number; volume: number; dur?: number};

// 믹싱 (2026-11-01): 모든 효과음 기존 대비 30% — 나레이션(1.0)이 항상 위에
const LOUD = new Set(['artillery.mp3', 'artillery_far.mp3', 'boom.mp3', 'hit.mp3', 'radar.mp3', 'whoosh.mp3']);
export const SFX_GAIN_LOUD = 0.3;
export const SFX_GAIN_OTHER = 0.3; // EP02부터: 전체 효과음 30%

export const buildSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  const p = buildPlan(ep, tl);
  const T = videoSec(tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= T - 0.3) return;
    const d = dur ? Math.min(dur, T - at) : undefined;
    out.push({file, at, volume: volume * (LOUD.has(file) ? SFX_GAIN_LOUD : SFX_GAIN_OTHER), dur: d});
  };
  // 오프닝: 바람 + 심장박동 + 먼 포성
  add('wind.mp3', 0, 0.18, p.t2);
  add('heartbeat.mp3', 0, 0.35, 6);
  add('artillery_far.mp3', 0.6, 0.45);
  // 1단계 포격: 발사음 1.4초마다, 휘파람(whoosh) + 착탄 폭발 교차
  for (let t = 1.0; t < p.t2 - 1; t += 1.4) add('artillery.mp3', t, 0.38);
  for (let t = 2.2; t < p.t2 - 1; t += 2.8) add('whoosh.mp3', t, 0.22);
  p.blasts.filter((b) => b.side === 'nk').forEach((b, i) => {
    if (i % 4 === 0) add(i % 8 === 0 ? 'boom.mp3' : 'hit.mp3', b.t, 0.3);
  });
  add('artillery_far.mp3', cueTime(tl, '16,000발', 12), 0.5);
  add('clock.mp3', cueTime(tl, '1시간', 10), 0.3, 3);
  // 통계 카드 등장음
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((s, i) => {
    const at = cueTime(tl, s.cue, i < 2 ? 3 + i * 4 : p.t2 + 2 + (i - 2) * 5);
    add('pop.mp3', at, 0.5);
    add('typewriter.mp3', at + 0.05, 0.22, 0.9);
  });
  // 2단계 전환
  add('whoosh.mp3', p.t2 - 0.25, 0.6);
  add('drum.mp3', p.t2, 0.6);
  for (let i = 0; i < 7; i++) add('radar.mp3', p.radarStart + i * 0.55, 0.45);
  add('typewriter.mp3', p.traceStart, 0.25, 2.2);
  add('tank.mp3', p.counterStart - 0.5, 0.25, T - p.counterStart);
  for (let t = p.counterStart; t < T - 2.5; t += 1.1) add('artillery.mp3', t, 0.42);
  for (let t = p.counterStart + 0.4; t < T - 2.5; t += 2.2) add('whoosh.mp3', t, 0.25);
  p.blasts.filter((b) => b.side === 'rok').forEach((b, i) => {
    if (i % 3 === 0) add(i % 6 === 0 ? 'boom.mp3' : 'hit.mp3', b.t, 0.36);
  });
  // 마지막 문장: 결정타
  const last = tl.sentences[tl.sentences.length - 1];
  if (last) {
    add('drum.mp3', last.start, 0.55);
    add('boom.mp3', last.start + 0.1, 0.45);
  }
  return out;
};
