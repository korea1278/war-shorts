// QHD 1440x2560 레이아웃 · 메르카토르 투영 · 타임라인 큐
import {Timeline} from '../lib/types';
import {InfographicEpisode, Mosaic, SceneKey} from './types';

export const QW = 1440;
export const QH = 2560;
export const FPS = 30;
/** 기존 1080 규격 컴포넌트(자막·CTA)를 QHD에 그대로 쓰기 위한 배율 (벡터라 선명함 유지) */
export const UP = QW / 1080;

// 화면 배치 (1080 Safe Area 규격 ×4/3)
export const BADGE_Y = 173;
export const TITLE_Y = 236;
export const PANEL = {top: 440, h: 300};
export const MAP = {top: 760, h: 1260, padT: 30, padB: 130};

const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const rad = (lon: number) => (lon * Math.PI) / 180;

export type Proj = {k: number; x: (lon: number) => number; y: (lat: number) => number; p: (ll: [number, number]) => [number, number]};

/** fit [서,남,동,북]을 지도 프레임 높이에 맞추고 가로 중앙 정렬 */
export const makeProj = (fit: [number, number, number, number]): Proj => {
  const [w, s, e, n] = fit;
  const k = (MAP.h - MAP.padT - MAP.padB) / (merc(n) - merc(s));
  const cx = rad((w + e) / 2);
  const x = (lon: number) => QW / 2 + k * (rad(lon) - cx);
  const y = (lat: number) => MAP.padT + k * (merc(n) - merc(lat));
  return {k, x, y, p: ([lon, lat]) => [x(lon), y(lat)]};
};

/** 모자이크(월드 픽셀 기준) → 지도 프레임 안 위치·크기 */
export const mosaicRect = (m: Mosaic, pr: Proj, fit: [number, number, number, number]) => {
  const per = (2 * Math.PI) / (256 * 2 ** m.z); // 픽셀당 라디안
  const cx = rad((fit[0] + fit[2]) / 2);
  const left = QW / 2 + pr.k * (m.x0 * per - Math.PI - cx);
  const top = MAP.padT + pr.k * (merc(fit[3]) - (Math.PI - m.y0 * per));
  return {left, top, width: m.w * per * pr.k, height: m.h * per * pr.k};
};

/** 장면 시작 시각(초): 해당 scene의 첫 문장 시작 */
export const sceneAt = (ep: InfographicEpisode, tl: Timeline, key: SceneKey, fallback = 0) => {
  const i = ep.script.findIndex((l) => l.scene === key);
  return i >= 0 && tl.sentences[i] ? tl.sentences[i].start : fallback;
};
export const sceneEnd = (ep: InfographicEpisode, tl: Timeline, key: SceneKey, fallback = 0) => {
  let last = -1;
  ep.script.forEach((l, i) => l.scene === key && (last = i));
  return last >= 0 && tl.sentences[last] ? tl.sentences[last].end : fallback;
};

/** 자막 중 keyword가 처음 나오는 시각 */
export const cueAt = (tl: Timeline, keyword: string | undefined, fallback: number) => {
  if (!keyword) return fallback;
  const c = tl.chunks.find((ch) => ch.text.includes(keyword));
  return c ? c.start : fallback;
};

export const videoSec = (tl: Timeline) => tl.videoSec ?? (tl.durationInFrames ? tl.durationInFrames / FPS : 34);

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** 카메라: 지도 좌표 (fx,fy)를 화면 (sx,sy)에 배율 s로 */
export type Cam = {t: number; s: number; fx: number; fy: number; sx: number; sy: number};
export const camAt = (keys: Cam[], sec: number): Cam => {
  if (sec <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (sec <= b.t) {
      const p = easeInOut(clamp01((sec - a.t) / Math.max(0.001, b.t - a.t)));
      const l = (u: number, v: number) => u + (v - u) * p;
      return {t: sec, s: l(a.s, b.s), fx: l(a.fx, b.fx), fy: l(a.fy, b.fy), sx: l(a.sx, b.sx), sy: l(a.sy, b.sy)};
    }
  }
  return keys[keys.length - 1];
};
export const camApply = (c: Cam, [x, y]: [number, number]): [number, number] => [c.sx + c.s * (x - c.fx), c.sy + c.s * (y - c.fy)];
