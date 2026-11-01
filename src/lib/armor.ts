// 기갑전 시나리오 일정 (EP02~): 1단계 북한 기갑 남하 → 2단계 K2 원거리 선제 타격
import {clamp01, cueTime, rand, Sfx, SFX_GAIN_LOUD, SFX_GAIN_OTHER, videoSec} from './schedule';
import {Episode, LngLat, Timeline} from './types';

export type Shot = {k2: number; target: number; lockAt: number; fireAt: number; hitAt: number};

export type ArmorPlan = {
  t2: number;
  T: number;
  axisStart: number[]; // 축선별 화살표 출발 시각
  shots: Shot[];
  deadAt: number[]; // 북한 전차별 격파 시각
  nightAt: number;
  ratioAt: number;
  ringAt: number;
};

const cache = new Map<string, ArmorPlan>();

export const buildArmorPlan = (ep: Episode, tl: Timeline): ArmorPlan => {
  const T = videoSec(tl);
  const key = ep.id + tl.phase2At + T;
  const hit = cache.get(key);
  if (hit) return hit;
  const a = ep.map.armor!;
  const t2 = tl.phase2At;
  const axisStart = a.axes.map((_, i) => 0.6 + i * 1.1);
  const ringAt = t2 + 0.3;
  // "1초 만에 자동 조준": 조준선 → 0.9초 뒤 발사 → 0.22초 뒤 명중
  const start = Math.max(t2 + 1.0, cueTime(tl, '2.5km', t2 + 1.5) - 0.3);
  const n = a.nkTanks.length;
  const span = T - 2.6 - start;
  const gap = Math.max(0.55, Math.min(2.2, span / n));
  const shots: Shot[] = [];
  const deadAt = a.nkTanks.map(() => Infinity);
  for (let i = 0; i < n; i++) {
    const lockAt = start + i * gap;
    const target = i; // 앞줄부터 차례로
    // 가장 가까운 K2가 쏨
    let best = 0;
    let bd = Infinity;
    a.k2.forEach((k, j) => {
      const d = Math.hypot(k.pos[0] - a.nkTanks[target][0], k.pos[1] - a.nkTanks[target][1]) + rand(i * 13 + j) * 0.004;
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    const fireAt = lockAt + 0.9;
    const hitAt = fireAt + 0.22;
    shots.push({k2: best, target, lockAt, fireAt, hitAt});
    deadAt[target] = hitAt;
  }
  const nightAt = a.nightCue ? cueTime(tl, a.nightCue, Infinity) : Infinity;
  const ratioAt = a.ratioCue ? cueTime(tl, a.ratioCue, Infinity) : Infinity;
  const plan = {t2, T, axisStart, shots, deadAt, nightAt, ratioAt, ringAt};
  cache.set(key, plan);
  return plan;
};

/** 축선 위 위치 (u: 0~1, 경로 길이 비율) */
export const alongPath = (path: LngLat[], u: number): {p: LngLat; dir: number} => {
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
    seg.push(d);
    total += d;
  }
  let want = clamp01(u) * total;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, want / seg[i]) : 0;
      const A = path[i];
      const B = path[i + 1];
      return {p: [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k], dir: Math.atan2(-(B[1] - A[1]), B[0] - A[0])};
    }
    want -= seg[i];
  }
  return {p: path[path.length - 1], dir: 0};
};

/** 1단계 화살표 진행도 (2단계 직전 92%까지) */
export const axisProgress = (plan: ArmorPlan, i: number, sec: number) => {
  const k = clamp01((sec - plan.axisStart[i]) / Math.max(1, plan.t2 - 0.8 - plan.axisStart[i]));
  return 0.92 * (1 - Math.pow(1 - k, 2.2));
};

/** 효과음: 디젤 엔진(전차 기동음)·120mm 주포·록온 비프·whoosh — 모두 기존 대비 30% */
const LOUD = new Set(['artillery.mp3', 'boom.mp3', 'hit.mp3', 'radar.mp3', 'whoosh.mp3']);

export const buildArmorSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  const p = buildArmorPlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    const d = dur ? Math.min(dur, p.T - at) : undefined;
    out.push({file, at, volume: volume * (LOUD.has(file) ? SFX_GAIN_LOUD : SFX_GAIN_OTHER), dur: d});
  };
  add('heartbeat.mp3', 0, 0.35, 5);
  add('tank.mp3', 0, 0.9, p.T); // 묵직한 디젤 엔진·궤도 기동음 (끝까지)
  p.axisStart.forEach((t) => add('whoosh.mp3', t, 0.45));
  add('drum.mp3', cueTime(tl, '하지만', p.t2 * 0.4), 0.5);
  // 통계 카드
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((s, i) => {
    const at = cueTime(tl, s.cue, i < 2 ? 1.5 : p.t2 + 0.6);
    add('pop.mp3', at, 0.6);
    add('typewriter.mp3', at + 0.05, 0.3, 0.9);
  });
  add('whoosh.mp3', p.t2 - 0.25, 0.7);
  add('drum.mp3', p.t2, 0.7);
  p.shots.forEach((s, i) => {
    add('radar.mp3', s.lockAt, 0.7); // 록온 비프
    add('artillery.mp3', s.fireAt, 0.9); // 120mm 주포
    add(i % 2 ? 'hit.mp3' : 'boom.mp3', s.hitAt, 0.8);
  });
  if (p.nightAt < Infinity) add('wind.mp3', p.nightAt, 0.5, 6);
  const last = tl.sentences[tl.sentences.length - 1];
  if (last) {
    add('drum.mp3', last.start, 0.7);
    add('boom.mp3', last.start + 0.1, 0.6);
  }
  return out;
};
