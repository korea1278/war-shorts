// 경량 3D 카메라: 웹 메르카토르 + 원근(틸트) + 회전. MapLibre와 같은 zoom·pitch·bearing 의미
// (zoom은 512px 타일 기준, 시야각 36.87° → 카메라 거리 = 1.5 × 화면 높이)
import {CamKey, LngLat} from './types';

export const MAP_W = 1080;
export const MAP_H = 1056;
const CX = MAP_W / 2;
const CY = MAP_H / 2;
const D = 1.5 * MAP_H;
export const WORLD_Z = 11; // 월드 픽셀 기준 줌 (256px 타일)

export const toWorld = (ll: LngLat): [number, number] => {
  const n = 256 * 2 ** WORLD_Z;
  const r = (ll[1] * Math.PI) / 180;
  return [((ll[0] + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
};

export type Cam = {cx: number; cy: number; s: number; cb: number; sb: number; cp: number; sp: number};

export const makeCam = (k: CamKey): Cam => {
  const [cx, cy] = toWorld(k.center);
  const b = (k.bearing * Math.PI) / 180;
  const p = (k.pitch * Math.PI) / 180;
  return {cx, cy, s: 2 ** (k.zoom - 10), cb: Math.cos(b), sb: Math.sin(b), cp: Math.cos(p), sp: Math.sin(p)};
};

/** 월드 픽셀 → 화면 좌표 */
export const projectW = (c: Cam, wx: number, wy: number): [number, number] => {
  const dx = (wx - c.cx) * c.s;
  const dy = (wy - c.cy) * c.s;
  const gx = dx * c.cb + dy * c.sb;
  const gy = -dx * c.sb + dy * c.cb;
  const depth = Math.max(80, D - gy * c.sp);
  const k = D / depth;
  return [CX + gx * k, CY + gy * c.cp * k];
};

export const projectLL = (c: Cam, ll: LngLat) => {
  const [wx, wy] = toWorld(ll);
  return projectW(c, wx, wy);
};

export type Mosaic = {img: CanvasImageSource; z: number; x0: number; y0: number; w: number; h: number};

/**
 * 지면(모자이크 이미지)을 원근으로 그린다: 화면을 가로 띠로 나눠 띠마다 정확한 아핀 변환으로 drawImage.
 * WebGL 없이 Canvas 2D drawImage 수십 번 → CPU에서도 프레임당 수십 ms.
 */
export const drawGround = (ctx: CanvasRenderingContext2D, c: Cam, layers: Mosaic[], strip = 22) => {
  for (let y0 = 0; y0 < MAP_H; y0 += strip) {
    const syc = y0 + strip / 2 - CY;
    const den = D * c.cp + syc * c.sp;
    if (den <= 1) continue;
    const gyc = (syc * D) / den;
    const depth = D - gyc * c.sp;
    const kx = D / depth;
    const ky = (D * D * c.cp) / (depth * depth);
    const a = kx * c.s * c.cb;
    const cc = kx * c.s * c.sb;
    const b = -ky * c.s * c.sb;
    const d = ky * c.s * c.cb;
    const e = CX - (a * c.cx + cc * c.cy);
    const f = CY + syc - ky * gyc - (b * c.cx + d * c.cy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0 - 0.5, MAP_W, strip + 1);
    ctx.clip();
    ctx.setTransform(a, b, cc, d, e, f);
    for (const m of layers) {
      const sc = 2 ** (WORLD_Z - m.z);
      ctx.drawImage(m.img, m.x0 * sc, m.y0 * sc, m.w * sc, m.h * sc);
    }
    ctx.restore();
  }
};
