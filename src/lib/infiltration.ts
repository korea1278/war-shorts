// 야간 침투 vs 열상 감시망 (EP11~): 1단계 특수작전군 집결 → 하늘(AN-2)·바다(공기부양정)·땅 밑(땅굴) 세 갈래 침투
//   → 2단계 녹색 야시경 전환 → TOD 부채꼴 스캔·열원 포착 → 무인 센서망 경보 → 비호복합·방공포 대공 화망
// 모든 연출 시각은 자막 큐(그 글자가 실제로 발음되는 시각)에서 나온다 → 대본과 장면이 어긋나지 않음
import {clamp01, cueTime, rand, Sfx, SFX_GAIN_OTHER, videoSec} from './schedule';
import {Episode, LngLat, Timeline} from './types';
import {RESULT_SEC} from './result';

export type InfilDot = {lng: number; lat: number; seed: number; onset: number};

export type InfilPlan = {
  t2: number; T: number; endAt: number;
  massAt: number; corpsAt: number; routesAt: number; airAt: number; seaAt: number; tunnelAt: number;
  todAt: number; thermalAt: number; sensorAt: number; alarmAt: number; aaAt: number; netAt: number; finalAt: number;
  dots: InfilDot[];
};

/** 군사분계선 위도 (경도에서 선형 보간) */
export const mdlLat = (mdl: LngLat[], lng: number) => {
  if (lng <= mdl[0][0]) return mdl[0][1];
  for (let i = 0; i < mdl.length - 1; i++) {
    const [a, b] = [mdl[i], mdl[i + 1]];
    if (lng <= b[0]) return a[1] + ((b[1] - a[1]) * (lng - a[0])) / (b[0] - a[0]);
  }
  return mdl[mdl.length - 1][1];
};

const cache = new Map<string, InfilPlan>();

export const buildInfilPlan = (ep: Episode, tl: Timeline): InfilPlan => {
  const T = videoSec(tl);
  const key = ep.id + tl.phase2At + T;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = ep.map.infil!;
  const t2 = tl.phase2At;
  const endAt = T - RESULT_SEC;
  const massAt = cueTime(tl, m.massCue, 0.3);
  const corpsAt = cueTime(tl, m.corpsCue, massAt + 4);
  const routesAt = cueTime(tl, m.routesCue, corpsAt + 3);
  const airAt = cueTime(tl, m.airCue, routesAt + 2);
  const seaAt = cueTime(tl, m.seaCue, airAt + 5);
  const tunnelAt = cueTime(tl, m.tunnelCue, seaAt + 5);
  const todAt = cueTime(tl, m.todCue, t2 + 2.5);
  const thermalAt = cueTime(tl, m.thermalCue, todAt + 5);
  const sensorAt = cueTime(tl, m.sensorCue, thermalAt + 4);
  const alarmAt = cueTime(tl, m.alarmCue, sensorAt + 3);
  const aaAt = cueTime(tl, m.aaCue, alarmAt + 4);
  const netAt = cueTime(tl, m.netCue, aaAt + 1.5);
  const finalAt = Math.min(endAt - 0.5, cueTime(tl, m.finalCue, netAt + 4));

  const [w, s, e, n] = m.massBox;
  const dots: InfilDot[] = [];
  for (let i = 0; dots.length < m.massCount && i < m.massCount * 6; i++) {
    const lng = w + (e - w) * rand(i * 7.31 + 1);
    const lat = s + (n - s) * Math.pow(rand(i * 3.17 + 2), 1.6); // 휴전선 가까이 더 촘촘히
    if (lat < mdlLat(m.mdl, lng) + 0.05) continue;
    dots.push({lng, lat, seed: i, onset: massAt + rand(i * 1.91) * 1.6});
  }
  const plan = {t2, T, endAt, massAt, corpsAt, routesAt, airAt, seaAt, tunnelAt, todAt, thermalAt, sensorAt, alarmAt, aaAt, netAt, finalAt, dots};
  cache.set(key, plan);
  return plan;
};

export const buildInfilSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  const p = buildInfilPlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    out.push({file, at, volume: volume * SFX_GAIN_OTHER, dur: dur ? Math.min(dur, p.T - at) : undefined});
  };
  add('wind.mp3', 0.1, 0.55, p.T - 1);
  add('heartbeat.mp3', 0.1, 0.8, 4.5);
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((s, i) => {
    const at = cueTime(tl, s.cue, p.t2 * 0.5 + i);
    add('pop.mp3', at, 0.6);
    add('typewriter.mp3', at + 0.05, 0.3, 0.9);
  });
  add('drum.mp3', p.corpsAt, 0.55);
  add('jet.mp3', p.airAt, 0.45, 4.5);
  add('water.mp3', p.seaAt, 0.7, 4.5);
  add('thud.mp3', p.tunnelAt + 0.2, 0.5);
  add('thud.mp3', p.tunnelAt + 1.1, 0.45);
  add('whoosh.mp3', p.t2 - 0.25, 0.75);
  add('hit.mp3', p.t2, 0.45);
  for (let t = p.todAt; t < p.sensorAt; t += 1.6) add('radar.mp3', t, 0.6);
  for (let i = 0; i < 6; i++) add('typewriter.mp3', p.todAt + 0.7 + i * 0.4, 0.25, 0.3);
  add('heartbeat.mp3', p.thermalAt, 0.7, 3);
  add('radar.mp3', p.alarmAt, 0.9);
  add('radar.mp3', p.alarmAt + 0.35, 0.9);
  add('radar.mp3', p.alarmAt + 0.7, 0.9);
  add('jet.mp3', p.aaAt, 0.35, 3);
  add('mg.mp3', p.netAt + 0.3, 0.55, 2.2);
  add('boom.mp3', p.netAt + 1.4, 0.6);
  add('deepboom.mp3', p.finalAt, 0.6);
  return out;
};
