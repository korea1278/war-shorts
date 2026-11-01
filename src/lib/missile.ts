// 탄도미사일 정밀 타격 시나리오 (EP03~): 1단계 고각 발사·상승 → 2단계 수직 낙하·지하 관통·매몰
import {clamp01, cueTime, Sfx, SFX_GAIN_OTHER, videoSec} from './schedule';
import {Episode, LngLat, Timeline} from './types';

export type MissilePlan = {
  t2: number;
  T: number;
  launchAt: number; // 점화
  arcAt: number; // 예상 탄도 점선 등장
  lockAt: number; // 표적 링 등장
  apexAt: number; // 정점 도달 (1단계 끝 무렵)
  impactAt: number; // 지표면 충돌
  plungeAt: number; // 화면 안으로 수직 낙하 시작
  buryAt: number; // 심도 폭발·매몰
  apexKm: number;
  maxMach: number;
};

const cache = new Map<string, MissilePlan>();

export const buildMissilePlan = (ep: Episode, tl: Timeline): MissilePlan => {
  const T = videoSec(tl);
  const key = ep.id + tl.phase2At + T;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = ep.map.missile!;
  const t2 = tl.phase2At;
  const launchAt = 0.7;
  const impactAt = Math.max(t2 + 3.2, cueTime(tl, m.impactCue, t2 + 4.5) - 0.1);
  const buryAt = Math.max(impactAt + 1.8, cueTime(tl, m.buryCue, impactAt + 2.6));
  const plan: MissilePlan = {
    t2,
    T,
    launchAt,
    arcAt: launchAt + 1.6,
    lockAt: Math.min(t2 - 2, launchAt + 3.2),
    apexAt: t2 - 0.2,
    impactAt,
    plungeAt: impactAt - 2.3,
    buryAt,
    apexKm: m.apexKm ?? 160,
    maxMach: m.maxMach ?? 10,
  };
  cache.set(key, plan);
  return plan;
};

/**
 * 미사일 상태: 지상 궤적 비율 g(0~1), 고도 km, 속도(마하)
 * 상승: 수직에 가깝게 솟구친 뒤 북서쪽으로 기울어짐 / 하강: 수평 이동을 먼저 끝내고 마지막은 수직 낙하
 */
export const missileState = (p: MissilePlan, sec: number) => {
  if (sec < p.launchAt) return {g: 0, alt: 0, mach: 0, phase: 'pad' as const};
  if (sec < p.apexAt) {
    const s = clamp01((sec - p.launchAt) / (p.apexAt - p.launchAt));
    const se = 1 - Math.pow(1 - s, 1.6);
    return {g: 0.5 * Math.pow(s, 1.7), alt: p.apexKm * (1 - Math.pow(1 - se, 2.2)), mach: Math.min(7.5, 0.5 + 9 * s), phase: 'up' as const};
  }
  if (sec < p.impactAt) {
    const s = clamp01((sec - p.apexAt) / (p.impactAt - p.apexAt));
    return {g: 0.5 + 0.5 * (1 - Math.pow(1 - s, 3.2)), alt: p.apexKm * (1 - Math.pow(s, 1.25)), mach: 7.5 + (p.maxMach - 7.5) * s, phase: 'down' as const};
  }
  return {g: 1, alt: 0, mach: 0, phase: 'hit' as const};
};

export const groundAt = (a: LngLat, b: LngLat, g: number): LngLat => [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g];

/** 화면 흔들림 (지진 진동): 충돌·매몰 순간 */
export const shakeAt = (p: MissilePlan, sec: number): [number, number] => {
  let x = 0;
  let y = 0;
  const hit = (t0: number, amp: number, dur: number, f: number) => {
    const q = sec - t0;
    if (q < 0 || q > dur) return;
    const k = amp * Math.pow(1 - q / dur, 2);
    x += k * Math.sin(q * f * 6.283 + 1.3);
    y += k * Math.sin(q * f * 1.37 * 6.283);
  };
  hit(p.impactAt, 20, 0.9, 13);
  hit(p.buryAt, 30, 1.6, 7);
  return [x, y];
};

/** 효과음: 로켓 점화·발사 굉음, 초음속 재진입 굉음, 지하 관통 강타음(Thud), 심도 폭발음(Deep Boom) — 전부 30% */
export const buildMissileSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  const p = buildMissilePlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    const d = dur ? Math.min(dur, p.T - at) : undefined;
    out.push({file, at, volume: volume * SFX_GAIN_OTHER, dur: d});
  };
  add('heartbeat.mp3', 0, 0.3, 3);
  add('rocket.mp3', p.launchAt - 0.15, 1.0); // 육중한 로켓 점화·발사
  add('boom.mp3', p.launchAt, 0.55);
  add('wind.mp3', p.launchAt + 2.5, 0.4, p.t2 - p.launchAt - 2.5); // 상승 중 바람
  add('radar.mp3', p.lockAt, 0.6);
  add('radar.mp3', p.lockAt + 0.5, 0.6);
  // 통계 카드
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((s, i) => {
    const at = cueTime(tl, s.cue, i < 2 ? 1.5 + i * 0.6 : p.t2 + 0.6 + (i - 2) * 0.5);
    add('pop.mp3', at, 0.6);
    add('typewriter.mp3', at + 0.05, 0.3, 0.9);
  });
  add('whoosh.mp3', p.t2 - 0.25, 0.7);
  add('drum.mp3', p.t2, 0.6);
  add('reentry.mp3', p.impactAt - 3.2, 1.0); // 초음속 대기 재진입 굉음 (끝 소닉붐이 충돌 직전)
  add('whoosh.mp3', p.plungeAt + 0.6, 0.6);
  add('thud.mp3', p.impactAt, 1.0); // 지하 관통 강타음
  add('hit.mp3', p.impactAt + 0.02, 0.7);
  add('deepboom.mp3', p.buryAt, 1.0); // 심도 폭발음
  add('boom.mp3', p.buryAt + 0.05, 0.6);
  add('drum.mp3', p.buryAt, 0.6);
  return out;
};
