// 해상 항모전 시나리오 (EP08~): 1단계 중국 항모전단 서해 진입 · 얕은 수심 킬존 · 300km 타격권
//   → 2단계 서해안 암벽 기지 초음속 지대함 미사일 + 2함대 해성 + F-15K 슬램이알 3방향 동시 타격 → 항모의 무덤
import {alongPath} from './armor';
import {clamp01, cueTime, rand, Sfx, SFX_GAIN_OTHER, videoSec} from './schedule';
import {Episode, LngLat, Timeline} from './types';
import {RESULT_SEC} from './result';

export type Ship = {carrier: number; escort: number; off: LngLat}; // escort -1 = 항모 본함
export type Shot = {kind: 'base' | 'fleet' | 'slam'; from: LngLat; ship: number; launch: number; flight: number};

export type NavalPlan = {
  t2: number;
  T: number;
  endAt: number;
  depthAt: number;
  jetAt: number;
  killAt: number;
  rangeAt: number;
  launchAt: number;
  fleetAt: number;
  slamAt: number;
  graveAt: number;
  arriveAt: number; // 항모전단이 중간선 앞에 멈추는 시각
  ships: Ship[];
  shots: Shot[];
  hitAt: number[]; // 함정별 첫 피격 시각
};

const cache = new Map<string, NavalPlan>();

export const buildNavalPlan = (ep: Episode, tl: Timeline): NavalPlan => {
  const T = videoSec(tl);
  const key = ep.id + tl.phase2At + T;
  const c = cache.get(key);
  if (c) return c;
  const n = ep.map.naval!;
  const t2 = tl.phase2At;
  const endAt = T - RESULT_SEC;
  const depthAt = Math.max(0.3, cueTime(tl, n.depthCue, 0.3));
  const jetAt = cueTime(tl, n.jetCue, t2 * 0.45);
  const killAt = cueTime(tl, n.killCue, t2 * 0.7);
  const rangeAt = Math.max(killAt + 0.8, cueTime(tl, n.rangeCue, killAt + 2));
  const launchAt = Math.max(t2 + 0.4, cueTime(tl, n.launchCue, t2 + 2) - 0.1);
  const fleetAt = Math.max(launchAt + 1.5, cueTime(tl, n.fleetCue, launchAt + 4));
  const slamAt = Math.max(fleetAt + 1.2, cueTime(tl, n.slamCue, fleetAt + 3));
  const graveAt = Math.min(endAt - 1.0, Math.max(slamAt + 2.5, cueTime(tl, n.graveCue, slamAt + 4)));
  const arriveAt = Math.max(4, killAt - 0.5);

  const per = n.escortsPerCarrier ?? 4;
  const ships: Ship[] = [];
  n.carriers.forEach((_, ci) => ships.push({carrier: ci, escort: -1, off: [0, 0]}));
  n.carriers.forEach((_, ci) => {
    for (let k = 0; k < per; k++) {
      const a = ((k + 0.5) / per) * Math.PI * 2 + ci * 0.6;
      const d = 0.2 + rand(ci * 13 + k) * 0.07;
      ships.push({carrier: ci, escort: k, off: [Math.cos(a) * d * 1.25, Math.sin(a) * d]});
    }
  });
  const escorts = ships.map((_, i) => i).filter((i) => ships[i].escort >= 0);
  // 호위함을 동쪽(한국 쪽)에 가까운 순서로 정렬: 바깥 방어선부터 무너짐
  const lastPos = (i: number) => shipPosAt(ep, ships[i], 1);
  escorts.sort((i, j) => lastPos(j)[0] - lastPos(i)[0]);
  const shots: Shot[] = [];
  const salvo = (kind: Shot['kind'], targets: number[], from: LngLat[], at: number, flight: number, per2 = 1) => {
    targets.forEach((ship, k) => {
      for (let m = 0; m < per2; m++) {
        const s = k * per2 + m;
        shots.push({kind, from: from[s % from.length], ship, launch: at + s * 0.16 + rand(s * 7 + ship) * 0.05, flight: flight + (rand(s * 11 + ship) - 0.5) * 0.3});
      }
    });
  };
  const bases = n.bases.map((b) => b.pos);
  const q = Math.ceil(escorts.length / 3);
  salvo('base', escorts.slice(0, q), bases, launchAt + 0.3, 2.4);
  salvo('fleet', escorts.slice(q, 2 * q), n.fleet, fleetAt + 0.2, 2.0);
  salvo('slam', escorts.slice(2 * q), n.f15k, slamAt + 0.3, 1.8);
  // 항모 본함: 무덤 자막 직전 도착하도록 기지에서 마지막 일제 사격
  const carriers = ships.map((_, i) => i).filter((i) => ships[i].escort < 0);
  salvo('base', carriers, bases, Math.max(slamAt + 0.6, graveAt - 2.3), 2.2, 3);
  const hitAt = ships.map(() => Infinity);
  shots.forEach((s) => (hitAt[s.ship] = Math.min(hitAt[s.ship], s.launch + s.flight)));
  const plan = {t2, T, endAt, depthAt, jetAt, killAt, rangeAt, launchAt, fleetAt, slamAt, graveAt, arriveAt, ships, shots, hitAt};
  cache.set(key, plan);
  return plan;
};

/** 항모 항적 진행도 0~1 (도착 후 정지) */
export const fleetProgress = (p: NavalPlan, sec: number) => {
  const k = clamp01((sec - 0.3) / Math.max(1, p.arriveAt - 0.3));
  return 1 - Math.pow(1 - k, 1.8);
};

const shipPosAt = (ep: Episode, s: Ship, u: number): LngLat => {
  const c = alongPath(ep.map.naval!.carriers[s.carrier].path, u).p;
  return [c[0] + s.off[0], c[1] + s.off[1]];
};

export const shipPos = (ep: Episode, p: NavalPlan, i: number, sec: number): LngLat => {
  const s = p.ships[i];
  const u = fleetProgress(p, Math.min(sec, p.hitAt[i]));
  return shipPosAt(ep, s, u);
};

/** 효과음 (전부 30%): 함대 항진 물살·함재기·레이더·심장박동 → 미사일 점화·초음속 굉음·명중 폭발 */
export const buildNavalSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  const p = buildNavalPlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    out.push({file, at, volume: volume * SFX_GAIN_OTHER, dur: dur ? Math.min(dur, p.T - at) : undefined});
  };
  add('water.mp3', 0.2, 0.8, Math.max(2, p.arriveAt));
  add('wind.mp3', 0.2, 0.5, p.t2);
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((s, i) => {
    const at = cueTime(tl, s.cue, i < 2 ? 1.0 + i * 0.6 : p.t2 + 0.6 + (i - 2) * 0.5);
    add('pop.mp3', at, 0.6);
    add('typewriter.mp3', at + 0.05, 0.3, 0.9);
  });
  add('jet.mp3', p.jetAt, 0.7, 4);
  add('heartbeat.mp3', p.killAt, 0.7, 3);
  for (let k = 0; k < 3; k++) add('radar.mp3', p.rangeAt + k * 0.9, 0.7);
  add('whoosh.mp3', p.t2 - 0.25, 0.7);
  add('drum.mp3', p.t2, 0.6);
  let last = -9;
  [...p.shots].sort((a, b) => a.launch - b.launch).forEach((s) => {
    if (s.launch - last < 0.45) return;
    add(s.kind === 'slam' ? 'jet.mp3' : 'rocket.mp3', s.launch, s.kind === 'slam' ? 0.5 : 0.5, 1.6);
    add('whoosh.mp3', s.launch + 0.05, 0.55);
    if (s.kind === 'base') add('reentry.mp3', s.launch + 0.6, 0.35, 1.8);
    last = s.launch;
  });
  last = -9;
  [...p.hitAt].filter(Number.isFinite).sort((a, b) => a - b).forEach((t, i) => {
    if (t - last < 0.3) return;
    add(i % 2 ? 'boom.mp3' : 'artillery_far.mp3', t, i % 2 ? 0.55 : 0.8);
    last = t;
  });
  add('deepboom.mp3', p.graveAt, 0.75);
  add('thud.mp3', p.graveAt + 0.05, 0.6);
  return out;
};
