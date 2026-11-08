// 정찰 공백 시나리오 (EP09~): 1단계 주한미군 전투력 이탈 → 2단계 유투·위성 링크 단절 → 흑색 블라인드 → 사이오 위성 통과
import {clamp01, cueTime, rand, Sfx, SFX_GAIN_OTHER, videoSec} from './schedule';
import {Episode, LngLat, Timeline} from './types';
import {RESULT_SEC} from './result';

export type BlindCell = {lng: number; lat: number; w: number; h: number; onset: number};

export type ReconPlan = {
  t2: number; T: number; endAt: number;
  f16At: number; a10At: number; mlrsAt: number; u2At: number; linkAt: number;
  blindAt: number; hiddenAt: number; satAt: number; revisitAt: number; gapAt: number;
  cells: BlindCell[];
  passes: {start: number; dur: number; lon0: number}[];
};

const inside = (p: LngLat, poly: LngLat[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

const cache = new Map<string, ReconPlan>();

export const buildReconPlan = (ep: Episode, tl: Timeline): ReconPlan => {
  const T = videoSec(tl);
  const key = ep.id + tl.phase2At + T;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = ep.map.recon!;
  const t2 = tl.phase2At;
  const endAt = T - RESULT_SEC;
  const f16At = cueTime(tl, r.f16Cue, t2 * 0.45);
  const a10At = cueTime(tl, r.a10Cue, f16At + 2.5);
  const mlrsAt = cueTime(tl, r.mlrsCue, a10At + 3);
  const u2At = cueTime(tl, r.u2Cue, t2 + 2);
  const linkAt = cueTime(tl, r.linkCue, u2At + 2);
  const blindAt = cueTime(tl, r.blindCue, linkAt + 2);
  const hiddenAt = cueTime(tl, r.hiddenCue, blindAt + 4);
  const satAt = cueTime(tl, r.satCue, hiddenAt + 4);
  const revisitAt = cueTime(tl, r.revisitCue, satAt + 3);
  const gapAt = Math.min(endAt - 0.8, cueTime(tl, r.gapCue, revisitAt + 4));

  const lngs = r.blindZones.flat().map((p) => p[0]);
  const lats = r.blindZones.flat().map((p) => p[1]);
  const [w, h] = [0.2, 0.16];
  const cells: BlindCell[] = [];
  const hub = r.hubs[0].pos;
  const maxD = 5;
  let seed = 0;
  for (let lng = Math.min(...lngs); lng < Math.max(...lngs); lng += w) {
    for (let lat = Math.min(...lats); lat < Math.max(...lats); lat += h) {
      const c: LngLat = [lng + w / 2, lat + h / 2];
      seed++;
      if (!r.blindZones.some((z) => inside(c, z))) continue;
      // 먼 곳부터 안쪽으로 한 칸씩 꺼짐
      const d = clamp01(Math.hypot(c[0] - hub[0], c[1] - hub[1]) / maxD);
      const order = (1 - d) * 0.72 + rand(seed * 3.7) * 0.28;
      cells.push({lng, lat, w, h, onset: blindAt + order * 3.2});
    }
  }
  const dur = 2.2;
  const passStart = satAt + 0.5;
  const dt = Math.max(0.5, (gapAt - passStart - dur) / 4);
  const passes = r.satLons.map((lon0, i) => ({start: passStart + i * dt, dur, lon0}));
  const plan = {t2, T, endAt, f16At, a10At, mlrsAt, u2At, linkAt, blindAt, hiddenAt, satAt, revisitAt, gapAt, cells, passes};
  cache.set(key, plan);
  return plan;
};

export const SAT_LAT0 = 32.5;
export const SAT_LAT1 = 41.8;
export const satTrackLon = (lon0: number, lat: number) => lon0 - (lat - 37) * 0.22;

/** 위성 통과 띠 안에서 블라인드가 걷히는 정도 (0~1) */
export const cellClear = (p: ReconPlan, lng: number, lat: number, sec: number) => {
  let best = 0;
  for (const s of p.passes) {
    const q = (sec - s.start) / s.dur;
    if (q < 0 || q > 1.3) continue;
    const satLat = SAT_LAT0 + (SAT_LAT1 - SAT_LAT0) * q;
    if (Math.abs(lng - satTrackLon(s.lon0, lat)) > 0.62) continue;
    const ahead = satLat - lat;
    if (ahead < -0.1 || ahead > 1.5) continue;
    best = Math.max(best, ahead < 0.3 ? clamp01((ahead + 0.1) / 0.4) : clamp01((1.5 - ahead) / 0.9));
  }
  return best;
};

export const buildReconSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  const p = buildReconPlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    out.push({file, at, volume: volume * SFX_GAIN_OTHER, dur: dur ? Math.min(dur, p.T - at) : undefined});
  };
  add('wind.mp3', 0.1, 0.5, p.T - 1);
  add('heartbeat.mp3', 0.1, 0.8, 5);
  for (let t = 0.6; t < Math.min(p.linkAt, p.t2 + 2); t += 2.2) add('radar.mp3', t, 0.6);
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((s, i) => {
    const at = cueTime(tl, s.cue, p.t2 * 0.5 + i);
    add('pop.mp3', at, 0.6);
    add('typewriter.mp3', at + 0.05, 0.3, 0.9);
  });
  add('jet.mp3', p.f16At, 0.8, 3.5);
  add('tank.mp3', p.mlrsAt, 0.5, 2.5);
  add('whoosh.mp3', p.t2 - 0.25, 0.7);
  add('drum.mp3', p.t2, 0.6);
  add('hit.mp3', p.linkAt + 0.6, 0.5);
  for (let i = 0; i < 8; i++) add('typewriter.mp3', p.blindAt + i * 0.42, 0.25, 0.3);
  add('heartbeat.mp3', p.hiddenAt, 0.9, 4);
  p.passes.forEach((s) => add('whoosh.mp3', s.start + 0.4, 0.3));
  add('clock.mp3', p.revisitAt, 0.5, 3);
  add('deepboom.mp3', p.gapAt, 0.75);
  add('thud.mp3', p.gapAt + 0.05, 0.6);
  return out;
};
