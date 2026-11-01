// 공중전 시나리오 (EP04~): 1단계 북한 전투기 편대 대규모 남하 → 2단계 KF-21 AESA 초원거리 탐지 → 미티어 연속 요격
import {alongPath} from './armor';
import {clamp01, cueTime, rand, Sfx, SFX_GAIN_OTHER, videoSec} from './schedule';
import {Episode, LngLat, Timeline} from './types';
import {RESULT_SEC} from './result';

export type Jet = {route: number; k: number; off: LngLat; start: number; speed: number};
export type Meteor = {jet: number; shooter: number; launch: number; flight: number};

export type AirPlan = {
  t2: number;
  T: number;
  endAt: number; // 결과 카드 진입 (끝 4초)
  radarAt: number;
  lockAt: number;
  fireAt: number;
  killEnd: number;
  jets: Jet[];
  meteors: Meteor[];
  killAt: number[]; // 전투기별 격추 시각
};

const cache = new Map<string, AirPlan>();

export const buildAirPlan = (ep: Episode, tl: Timeline): AirPlan => {
  const T = videoSec(tl);
  const key = ep.id + tl.phase2At + T;
  const hit = cache.get(key);
  if (hit) return hit;
  const a = ep.map.air!;
  const t2 = tl.phase2At;
  const endAt = T - RESULT_SEC;
  const radarAt = Math.max(t2 + 0.3, cueTime(tl, a.radarCue, t2 + 0.6) - 0.1);
  const lockAt = Math.max(radarAt + 1.0, cueTime(tl, a.lockCue, radarAt + 2.5));
  const fireAt = Math.min(endAt - 4.0, Math.max(lockAt + 0.8, cueTime(tl, a.fireCue, lockAt + 2.5) - 0.3));
  const killEnd = Math.min(endAt - 0.4, Math.max(fireAt + 3.2, cueTime(tl, a.killCue, fireAt + 3.5) + 1.2));

  const per = a.jetsPerRoute ?? 7;
  const jets: Jet[] = [];
  a.routes.forEach((_, r) => {
    for (let k = 0; k < per; k++) {
      const n = r * 31 + k;
      // 편대 대형: 선두기 뒤로 V자 + 약간의 난수
      const row = Math.ceil(k / 2);
      const sideSign = k % 2 ? 1 : -1;
      const off: LngLat = [sideSign * row * 0.045 + (rand(n * 3) - 0.5) * 0.03, row * 0.05 + (rand(n * 7) - 0.5) * 0.02];
      jets.push({route: r, k, off, start: 0.3 + r * 0.35 + rand(n * 11) * 0.4, speed: 0.9 + rand(n * 13) * 0.2});
    }
  });

  // 미티어: 선두 편대부터 차례로, 발사 간격은 격추가 killEnd 안에 끝나게
  const order = jets.map((_, i) => i).sort((i, j) => jets[i].k - jets[j].k || jets[i].route - jets[j].route);
  const flight = 1.7;
  const span = Math.max(0.6, killEnd - flight - fireAt);
  const meteors: Meteor[] = order.map((ji, n) => ({
    jet: ji,
    shooter: n % a.kf21.length,
    launch: fireAt + (span * n) / Math.max(1, order.length - 1) + (rand(n * 17) - 0.5) * 0.08,
    flight: flight + (rand(n * 19) - 0.5) * 0.3,
  }));
  const killAt = jets.map(() => Infinity);
  meteors.forEach((m) => (killAt[m.jet] = m.launch + m.flight));
  const plan = {t2, T, endAt, radarAt, lockAt, fireAt, killEnd, jets, meteors, killAt};
  cache.set(key, plan);
  return plan;
};

/** 전투기 진행도: 1단계에 경로의 70%까지 남하, 2단계엔 천천히 계속 (격추 전까지) */
export const jetProgress = (p: AirPlan, j: Jet, sec: number) => {
  const k1 = clamp01((sec - j.start) / Math.max(1, p.t2 - j.start));
  const u1 = 0.7 * (1 - Math.pow(1 - k1, 1.4)) * j.speed;
  const u2 = sec > p.t2 ? 0.012 * (sec - p.t2) * j.speed : 0;
  return Math.min(0.97, u1 + u2);
};

export const jetPos = (ep: Episode, p: AirPlan, ji: number, sec: number): {p: LngLat; dir: number} => {
  const j = p.jets[ji];
  const {p: q, dir} = alongPath(ep.map.air!.routes[j.route], jetProgress(p, j, sec));
  return {p: [q[0] + j.off[0], q[1] + j.off[1]], dir};
};

/** 효과음: 제트 고속 비행음·AESA 레이더 핑·미티어 점화(Whoosh)·연속 원거리 공중 폭발 — 전부 30% */
export const buildAirSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  const p = buildAirPlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    const d = dur ? Math.min(dur, p.T - at) : undefined;
    out.push({file, at, volume: volume * SFX_GAIN_OTHER, dur: d});
  };
  // 제트 고속 비행음 (합성 jet.mp3: 저음 굉음 + 고음 터빈)
  add('jet.mp3', 0.2, 0.9, p.t2 - 0.2);
  add('jet.mp3', p.t2 - 0.4, 0.7, Math.max(1, p.fireAt - p.t2 + 1.5));
  // 통계 카드
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((s, i) => {
    const at = cueTime(tl, s.cue, i < 2 ? 1.0 + i * 0.6 : p.t2 + 0.6 + (i - 2) * 0.5);
    add('pop.mp3', at, 0.6);
    add('typewriter.mp3', at + 0.05, 0.3, 0.9);
  });
  add('whoosh.mp3', p.t2 - 0.25, 0.7);
  add('drum.mp3', p.t2, 0.6);
  // AESA 레이더 핑 (빔 방사 → 포착 순간 연속)
  for (let k = 0; k < 3; k++) add('radar.mp3', p.radarAt + k * 0.9, 0.7);
  add('radar.mp3', p.lockAt, 0.9);
  add('radar.mp3', p.lockAt + 0.35, 0.9);
  // 미티어 점화 (발사 묶음마다 한 번)
  let last = -9;
  p.meteors.forEach((m) => {
    if (m.launch - last >= 0.45) {
      add('rocket.mp3', m.launch, 0.45, 1.6);
      add('whoosh.mp3', m.launch + 0.05, 0.6);
      last = m.launch;
    }
  });
  // 연속 원거리 공중 폭발 (격추 시각들, 0.3초 간격으로 묶음)
  last = -9;
  [...p.killAt].filter((t) => Number.isFinite(t)).sort((x, y) => x - y).forEach((t, i) => {
    if (t - last >= 0.3) {
      add(i % 3 === 2 ? 'boom.mp3' : 'artillery_far.mp3', t, i % 3 === 2 ? 0.55 : 0.8);
      last = t;
    }
  });
  add('deepboom.mp3', p.killEnd - 0.2, 0.6);
  return out;
};
