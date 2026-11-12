// EP13 중앙 무대 (Y 384~1440, 1080x1056 Canvas 2D 한 장)
//  ① 한반도 위성 야경(지형은 어둡게 + NASA Black Marble 불빛 가산 합성) + 3D 원근 카메라(src/lib/camera.ts)
//  ② F-15K 비행 궤적 → 평양 상공 투하 → 자탄 수백 개 확산 → 은백색 탄소섬유 거미줄
//  ③ 변전소·송전선 푸른 합선 스파크 (수천 곳) → 평양발 정전 파동 → 북한 전역 암전 (남한 불빛과 대비)
//  전부 frame/30 기반 결정론 · 난수는 시드 고정 rand(i) · CSS/캔버스 filter·blur 없음 (발광은 반투명 선·스프라이트 겹치기)
import React, {useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import {Cam, drawGround, makeCam, MAP_H, MAP_W, Mosaic, projectLL, projectW, toWorld} from '../lib/camera';
import {clamp01, rand} from '../lib/schedule';
import {LngLat} from '../lib/types';
import {BlackoutData, BlackoutPlan, blackoutCam, CITIES, GRID, kmFrom, SUBSTATIONS, waveKm} from './plan';

export const STAGE_TOP = 384;
const BLUE = '#00E5FF';
const YEL = '#FFE500';
const RED = '#FF3B30';
const WARM = '#FFC46B';

type Ring = Float64Array;
type Assets = {day: Mosaic[]; night: Mosaic[]; nk: Ring[]; kr: Ring[]; warm: HTMLCanvasElement; blue: HTMLCanvasElement; white: HTMLCanvasElement};

let assetsPromise: Promise<Assets> | null = null;

const sprite = (rgb: string) => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(255,255,255,1)`);
  gr.addColorStop(0.18, `rgba(${rgb},0.95)`);
  gr.addColorStop(0.5, `rgba(${rgb},0.28)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
};

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('이미지 로드 실패 ' + src));
    im.src = src;
  });

const loadAssets = (dayNames: string[], nightName: string): Promise<Assets> => {
  if (assetsPromise) return assetsPromise;
  assetsPromise = (async () => {
    const font = new FontFace('Pretendard', `url(${staticFile('fonts/Pretendard-Black.woff2')})`, {weight: '100 900'});
    (document.fonts as unknown as {add: (f: FontFace) => void}).add(await font.load());
    const geo = await fetch(staticFile('geo/korea.json')).then((r) => r.json());
    const rings = (iso: string) => {
      const out: Ring[] = [];
      geo.features
        .filter((f: {properties: {iso: string}}) => f.properties.iso === iso)
        .forEach((f: {geometry: {type: string; coordinates: number[][][] | number[][][][]}}) => {
          const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
          polys.forEach((poly) =>
            poly.forEach((ring) => {
              const a = new Float64Array(ring.length * 2);
              ring.forEach((pt, i) => {
                const [wx, wy] = toWorld([pt[0], pt[1]]);
                a[i * 2] = wx;
                a[i * 2 + 1] = wy;
              });
              out.push(a);
            }),
          );
        });
      return out;
    };
    const meta: Record<string, {file: string; z: number; x0: number; y0: number; w: number; h: number}> = await fetch(staticFile('tiles/mosaic.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const load = async (k: string): Promise<Mosaic | null> => {
      const m = meta[k];
      if (!m) return null;
      try {
        const img = await loadImg(staticFile(m.file));
        await img.decode();
        return {img: await createImageBitmap(img), z: m.z, x0: m.x0, y0: m.y0, w: m.w, h: m.h};
      } catch (e) {
        console.warn(e);
        return null;
      }
    };
    const day = (await Promise.all(dayNames.map(load))).filter(Boolean) as Mosaic[];
    const night = (await Promise.all([nightName].map(load))).filter(Boolean) as Mosaic[];
    return {day, night, nk: rings('PRK'), kr: rings('KOR'), warm: sprite('255,196,107'), blue: sprite('0,229,255'), white: sprite('230,240,255')};
  })();
  return assetsPromise;
};

// ── 결정론 재료 (모듈 로드 때 1번) ──
const gauss = (i: number) => {
  // Box-Muller (시드 고정)
  const u = Math.max(1e-6, rand(i * 2 + 1));
  const v = rand(i * 2 + 7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const offKm = (c: LngLat, dxKm: number, dyKm: number): LngLat => [c[0] + dxKm / (111 * Math.cos((c[1] * Math.PI) / 180)), c[1] + dyKm / 111];

// 도시 불빛 점들 (평양 = 촘촘한 대형 클러스터)
type Light = {pos: LngLat; r: number; a: number; km: number; seed: number};
const CAP = CITIES[0].pos;
const LIGHTS: Light[] = (() => {
  const out: Light[] = [];
  let s = 1000;
  CITIES.forEach((c) => {
    const n = Math.round(10 + c.size * 80);
    const spread = 2.5 + c.size * 7;
    for (let i = 0; i < n; i++) {
      s++;
      const p = offKm(c.pos, gauss(s) * spread, gauss(s + 5000) * spread * 0.8);
      out.push({pos: p, r: 0.6 + rand(s + 77) * 0.9 + (i === 0 ? c.size * 3 : 0), a: 0.45 + rand(s + 99) * 0.5, km: kmFrom(p, CAP), seed: s});
    }
  });
  return out;
})();

// 남한 도시 불빛 (정전 대비용 — 끝까지 켜짐. 실제 야경 타일이 없어도 대비가 보이게)
const SK: {pos: LngLat; size: number}[] = [
  {pos: [126.98, 37.55], size: 1.0}, {pos: [126.7, 37.46], size: 0.55}, {pos: [127.03, 37.27], size: 0.5},
  {pos: [127.38, 36.35], size: 0.5}, {pos: [128.6, 35.87], size: 0.6}, {pos: [129.07, 35.18], size: 0.7},
  {pos: [126.85, 35.16], size: 0.45}, {pos: [129.31, 35.54], size: 0.4}, {pos: [128.9, 37.75], size: 0.25},
  {pos: [129.36, 36.02], size: 0.3}, {pos: [128.68, 35.23], size: 0.35}, {pos: [127.15, 35.82], size: 0.3},
  {pos: [127.49, 36.64], size: 0.3}, {pos: [127.73, 37.88], size: 0.2},
];
const SK_LIGHTS: Light[] = (() => {
  const out: Light[] = [];
  let s = 50000;
  SK.forEach((c) => {
    const n = Math.round(12 + c.size * 110);
    const spread = 3 + c.size * 9;
    for (let i = 0; i < n; i++) {
      s++;
      const p = offKm(c.pos, gauss(s) * spread, gauss(s + 7000) * spread * 0.8);
      out.push({pos: p, r: 0.6 + rand(s + 77) * 0.9, a: 0.5 + rand(s + 99) * 0.5, km: 0, seed: s});
    }
  });
  return out;
})();

// 자탄 (평양 반경 ~22km, 40%는 변전소 근처)
type Bomblet = {to: LngLat; dur: number; seed: number; ang: number};
const N_BOMBLETS = 180;
const BOMBLETS: Bomblet[] = Array.from({length: N_BOMBLETS}, (_, i) => {
  const near = rand(i + 300) < 0.4;
  const base = near ? SUBSTATIONS[i % SUBSTATIONS.length] : CAP;
  const sp = near ? 1.6 : 9;
  return {to: offKm(base, gauss(i + 2000) * sp, gauss(i + 2600) * sp * 0.85), dur: 0.65 + rand(i + 900) * 0.35, seed: i, ang: rand(i + 40) * Math.PI * 2};
});
// 거미줄 연결: 각 자탄에서 가까운 2개
const WEB: [number, number][] = (() => {
  const out: [number, number][] = [];
  BOMBLETS.forEach((b, i) => {
    const ds = BOMBLETS.map((o, j) => [j, kmFrom(b.to, o.to)] as const).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]);
    ds.slice(0, 2).forEach(([j, d]) => {
      if (d < 6 && i < j) out.push([i, j]);
    });
  });
  return out;
})();

// 스파크 이벤트 (수천 곳: 불빛 점·변전소에서 시간차로 번쩍)
type SparkEv = {pos: LngLat; t: number; seed: number};

const ringPath = (ctx: CanvasRenderingContext2D, cam: Cam, rings: Ring[]) => {
  ctx.beginPath();
  rings.forEach((r) => {
    for (let i = 0; i < r.length; i += 2) {
      const [x, y] = projectW(cam, r[i], r[i + 1]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  });
};

const glow = (ctx: CanvasRenderingContext2D, color: string, core: number, coreColor = '#ffffff', alpha = 1) => {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.14 * alpha;
  ctx.lineWidth = core * 5;
  ctx.stroke();
  ctx.globalAlpha = 0.34 * alpha;
  ctx.lineWidth = core * 2.4;
  ctx.stroke();
  ctx.globalAlpha = 0.95 * alpha;
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = core;
  ctx.stroke();
  ctx.globalAlpha = 1;
};

/** 원(반경 km, 평양 중심)을 지면 원근으로 투영한 경로 */
const circleKm = (ctx: CanvasRenderingContext2D, pp: (ll: LngLat) => [number, number], c: LngLat, km: number, n = 72) => {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [x, y] = pp(offKm(c, Math.cos(a) * km, Math.sin(a) * km));
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
};

const chip = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size = 30, alpha = 1) => {
  if (!text || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${size}px Pretendard`;
  const w = ctx.measureText(text).width + 34;
  const h = size * 1.5;
  const x0 = Math.round(Math.max(12, Math.min(MAP_W - 160 - w, x - w / 2)));
  const y0 = Math.round(y - h / 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(x0 + 5, y0 + 5, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(x0, y0, w, h);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x0 + w / 2, y0 + h / 2 + 2);
  ctx.restore();
};

const drawSprite = (ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, r: number, a: number) => {
  if (a <= 0.01 || r <= 0.2) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
};

/** 번개(지그재그) 합선 아크 */
const arc = (ctx: CanvasRenderingContext2D, x: number, y: number, len: number, seed: number, alpha: number) => {
  const a0 = rand(seed) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let cx = x;
  let cy = y;
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const a = a0 + (rand(seed * 7 + i) - 0.5) * 1.6;
    cx += (Math.cos(a) * len) / n;
    cy += (Math.sin(a) * len) / n;
    ctx.lineTo(cx, cy);
  }
  glow(ctx, BLUE, 2, '#e8fdff', alpha);
};

/** F-15K 상면 실루엣 (원점 중심, 기수 = +x) */
const jetShape = (ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, s: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(14, -3);
  ctx.lineTo(2, -4);
  ctx.lineTo(-6, -20);
  ctx.lineTo(-12, -20);
  ctx.lineTo(-10, -5);
  ctx.lineTo(-20, -6);
  ctx.lineTo(-26, -13);
  ctx.lineTo(-30, -13);
  ctx.lineTo(-28, -3);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-28, 3);
  ctx.lineTo(-30, 13);
  ctx.lineTo(-26, 13);
  ctx.lineTo(-20, 6);
  ctx.lineTo(-10, 5);
  ctx.lineTo(-12, 20);
  ctx.lineTo(-6, 20);
  ctx.lineTo(2, 4);
  ctx.lineTo(14, 3);
  ctx.closePath();
  ctx.fillStyle = '#0b1220';
  ctx.fill();
  ctx.lineWidth = 2.5 / s;
  ctx.strokeStyle = '#9fdcff';
  ctx.stroke();
  ctx.restore();
};

/** 비행 궤적 위치: u 0~1 (경로 길이 비례) */
const along = (path: LngLat[], u: number): LngLat => {
  const seg = path.slice(1).map((p, i) => kmFrom(p, path[i]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = clamp01(u) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = clamp01(d / seg[i]);
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
    }
    d -= seg[i];
  }
  return path[path.length - 1];
};
const uAtCapital = (path: LngLat[], cap: LngLat) => {
  const seg = path.slice(1).map((p, i) => kmFrom(p, path[i]));
  const total = seg.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < path.length; i++) {
    if (kmFrom(path[i], cap) < 1) return acc / total;
    acc += seg[i] ?? 0;
  }
  return 0.7;
};

export const BlackoutStage: React.FC<{p: BlackoutPlan; d: BlackoutData; dayLayers: string[]; nightLayer: string}> = ({p, d, dayLayers, nightLayer}) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender('EP13 야경 지도 로드', {timeoutInMilliseconds: 110000}));
  const released = useRef(false);

  useLayoutEffect(() => {
    loadAssets(dayLayers, nightLayer)
      .then(setAssets)
      .catch((e) => {
        console.warn(e);
        setAssets({day: [], night: [], nk: [], kr: [], warm: sprite('255,196,107'), blue: sprite('0,229,255'), white: sprite('230,240,255')});
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!assets || !canvas.current) return;
    const ctx = canvas.current.getContext('2d', {alpha: false})!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    const cam = makeCam(blackoutCam(p, d, t));
    const pp = (ll: LngLat) => projectLL(cam, ll);
    const zs = 2 ** (blackoutCam(p, d, t).zoom - 8); // 화면 크기 배율 (줌 8 기준)
    const W = waveKm(p, t);
    const lit = (km: number) => (W < 0 ? 1 : clamp01((km - W) / 18 + 0.15)); // 파동이 지나가면 0

    // ① 지형(어둡게) + 야간 불빛(가산)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#02050b';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    if (assets.day.length) drawGround(ctx, cam, assets.day);
    ctx.fillStyle = 'rgba(2,6,18,0.78)';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    if (assets.night.length) {
      ctx.globalCompositeOperation = 'lighter';
      drawGround(ctx, cam, assets.night);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ② 국경 (은은하게) — 북한 붉은 테두리는 암전 후 맥동
    const darkK = clamp01((t - p.waveEnd) / 1.5);
    ringPath(ctx, cam, assets.kr);
    glow(ctx, '#0066ff', 1.6, '#9cc4ff', 0.55);
    ringPath(ctx, cam, assets.nk);
    glow(ctx, '#ff2828', 1.8 + darkK * 1.2, '#ffb0b0', 0.5 + darkK * (0.35 + 0.15 * Math.sin(t * 4)));

    // ③ 정전 파동: 지나간 북한 영역을 검게 덮음 (실제 야경 불빛까지)
    if (W > 0 && assets.nk.length) {
      ctx.save();
      ringPath(ctx, cam, assets.nk);
      ctx.clip('evenodd');
      circleKm(ctx, pp, CAP, W);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      circleKm(ctx, pp, CAP, Math.max(0, W - 30));
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fill();
      ctx.restore();
    }

    // ④ 송전망 간선 (전류 흐름 점선) → 파동이 지나가면 꺼짐
    ctx.globalCompositeOperation = 'lighter';
    GRID.forEach(([a, b], gi) => {
      const A = CITIES[a].pos;
      const B = CITIES[b].pos;
      const km = Math.min(kmFrom(A, CAP), kmFrom(B, CAP));
      const on = lit(km);
      const [x1, y1] = pp(A);
      const [x2, y2] = pp(B);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.setLineDash([]);
      glow(ctx, WARM, 1.3, '#ffe2b0', 0.25 + 0.45 * on);
      if (on > 0.05) {
        ctx.setLineDash([6, 16]);
        ctx.lineDashOffset = -(t * 60 + gi * 7);
        ctx.strokeStyle = '#fff2d0';
        ctx.globalAlpha = 0.7 * on;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    });

    // ⑤ 도시 불빛 (평양 대형 클러스터) — 파동 직전 깜빡이다 꺼짐
    LIGHTS.forEach((L) => {
      let a = L.a * (0.88 + 0.12 * Math.sin(t * 2.3 + L.seed));
      if (W >= 0) {
        const near = clamp01(1 - (L.km - W) / 25); // 파동 앞 25km에서 깜빡임
        const flick = near > 0 && near < 1 ? (rand(L.seed + Math.floor(t * 12)) > 0.45 ? 1 : 0.25) : 1;
        a *= lit(L.km) * flick;
      }
      if (a <= 0.02) return;
      const [x, y] = pp(L.pos);
      if (x < -40 || x > MAP_W + 40 || y < -40 || y > MAP_H + 40) return;
      drawSprite(ctx, assets.warm, x, y, (5 + L.r * 7) * Math.min(1.5, Math.max(0.55, zs)), a);
    });
    // 남한 불빛: 암전 뒤 대비가 살도록 끝까지 켜짐 (암전 후 살짝 더 밝게)
    const skBoost = 1 + 0.25 * clamp01((t - p.waveEnd) / 1.5);
    SK_LIGHTS.forEach((L) => {
      const [x, y] = pp(L.pos);
      if (x < -40 || x > MAP_W + 40 || y < -40 || y > MAP_H + 40) return;
      drawSprite(ctx, assets.warm, x, y, (5 + L.r * 7) * Math.min(1.5, Math.max(0.55, zs)), L.a * 0.8 * skBoost * (0.9 + 0.1 * Math.sin(t * 2 + L.seed)));
    });
    ctx.globalAlpha = 1;

    // ⑥ 표적: 평양 변전소 타깃 링 (한국형 정전탄 문장부터 표적 획득)
    const tgtOn = clamp01((t - p.korea - 0.5) / 0.6) * (1 - clamp01((t - p.wave) / 1.2));
    if (tgtOn > 0) {
      ctx.globalCompositeOperation = 'source-over';
      SUBSTATIONS.forEach((s, i) => {
        const k = clamp01((t - p.korea - 0.5 - i * 0.12) / 0.4) * tgtOn;
        if (k <= 0) return;
        const [x, y] = pp(s);
        const r = 7 * Math.min(2, Math.max(0.7, zs));
        ctx.globalAlpha = k;
        ctx.strokeStyle = YEL;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = 'rgba(255,229,0,0.25)';
        ctx.fillRect(x - r * 0.45, y - r * 0.45, r * 0.9, r * 0.9);
      });
      // 평양 중심 회전 조준 링
      const [cx, cy] = pp(CAP);
      const R = 46 + 10 * Math.min(2, zs);
      ctx.save();
      ctx.globalAlpha = tgtOn;
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.8);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 4;
      ctx.setLineDash([26, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(-t * 0.8);
      ctx.lineWidth = 5;
      [0, 1, 2, 3].forEach((q) => {
        ctx.save();
        ctx.rotate((q * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(R + 8, 0);
        ctx.lineTo(R + 30, 0);
        ctx.stroke();
        ctx.restore();
      });
      ctx.restore();
      ctx.globalAlpha = 1;
      if (t < p.release) chip(ctx, cx, cy - R - 42, d.targetLabel, RED, 28, tgtOn);
    }

    // ⑦ F-15K 비행 궤적 + 기체
    const uCap = uAtCapital(d.jetPath, CAP);
    if (t >= p.jet0) {
      const u =
        t <= p.release
          ? uCap * (1 - Math.pow(1 - clamp01((t - p.jet0) / Math.max(0.5, p.release - p.jet0)), 1.6))
          : uCap + (1 - uCap) * clamp01((t - p.release) / 6);
      const fade = 1 - clamp01((t - p.release - 5) / 1.2);
      if (fade > 0) {
        // 궤적 (지나온 길)
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        const N = 60;
        for (let i = 0; i <= N; i++) {
          const [x, y] = pp(along(d.jetPath, (u * i) / N));
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        glow(ctx, '#7fd8ff', 2.4, '#e6f8ff', 0.75 * fade);
        // 앞으로 갈 길 (점선)
        if (t < p.release) {
          ctx.beginPath();
          for (let i = 0; i <= 30; i++) {
            const [x, y] = pp(along(d.jetPath, u + ((uCap - u) * i) / 30));
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.setLineDash([10, 12]);
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const pos = along(d.jetPath, u);
        const ahead = along(d.jetPath, Math.min(1, u + 0.004));
        const [jx, jy] = pp(pos);
        const [ax, ay] = pp(ahead);
        const ang = Math.atan2(ay - jy, ax - jx);
        drawSprite(ctx, assets.blue, jx - Math.cos(ang) * 22, jy - Math.sin(ang) * 22, 26, 0.7 * fade);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = fade;
        jetShape(ctx, jx, jy, ang, 1.15);
        ctx.globalAlpha = 1;
        chip(ctx, jx + 10, jy - 52, d.jetLabel, BLUE, 26, fade * clamp01((t - p.jet0) / 0.5));
      }
    }

    // ⑧ 폭탄 낙하 (투하 → 공중 개방)
    const [capX, capY] = pp(CAP);
    const altPx = 150 * Math.min(1.6, Math.max(0.6, zs / 2));
    if (t >= p.release && t < p.burst) {
      const k = clamp01((t - p.release) / (p.burst - p.release));
      const bx = capX;
      const by = capY - altPx * (1.35 - k * 0.35);
      ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = 'rgba(255,229,0,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(capX, capY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = '#d9dee4';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = YEL;
      ctx.fillRect(-6, -4, 12, 4);
      ctx.restore();
    }

    // ⑨ 개방 섬광 + 자탄 확산 (낙하산 감속) + 섬유 거미줄
    const burstX = capX;
    const burstY = capY - altPx;
    if (t >= p.burst) {
      ctx.globalCompositeOperation = 'lighter';
      const fk = clamp01((t - p.burst) / 0.7);
      if (fk < 1) {
        drawSprite(ctx, assets.white, burstX, burstY, 40 + 160 * fk, 1 - fk);
        ctx.beginPath();
        ctx.arc(burstX, burstY, 20 + 220 * fk, 0, Math.PI * 2);
        glow(ctx, '#ffffff', 3, '#ffffff', 1 - fk);
      }
      const span = Math.max(1.5, p.land - p.burst);
      const fibOut = 1 - clamp01((t - p.flash - 1.5) / 2.5); // 섬유는 연쇄 섬광 뒤 타서 사라짐
      const pos: [number, number][] = BOMBLETS.map((b) => {
        const k = clamp01((t - p.burst) / (span * b.dur));
        const e = 1 - Math.pow(1 - k, 2.4);
        const [gx, gy] = pp(b.to);
        // 처음엔 바깥으로 튀어나갔다가 감속하며 내려앉음
        const pop = Math.sin(Math.min(1, k * 2.2) * Math.PI) * 26 * (1 - k);
        return [burstX + (gx - burstX) * e + Math.cos(b.ang) * pop, burstY + (gy - burstY) * e + Math.sin(b.ang) * pop * 0.6 - altPx * 0.15 * (1 - e) * 0];
      });
      // 섬유 거미줄 (자탄끼리 연결 + 자탄마다 늘어지는 가닥)
      const webK = clamp01((t - p.web) / 2.2) * fibOut;
      if (webK > 0) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#e6eef7';
        WEB.forEach(([i, j], wi) => {
          const kk = clamp01(webK * 1.4 - (wi % 9) * 0.05);
          if (kk <= 0) return;
          const [x1, y1] = pos[i];
          const [x2, y2] = pos[j];
          const mx = (x1 + x2) / 2 + Math.sin(t * 1.3 + wi) * 6;
          const my = (y1 + y2) / 2 + 8 + Math.cos(t * 1.1 + wi) * 4;
          ctx.globalAlpha = 0.42 * kk;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(mx, my, x1 + (x2 - x1) * kk, y1 + (y2 - y1) * kk);
          ctx.stroke();
        });
        BOMBLETS.forEach((b, i) => {
          const [x, y] = pos[i];
          for (let f = 0; f < 3; f++) {
            const a = b.ang + f * 2.1;
            const len = (16 + rand(i * 3 + f) * 38) * webK * Math.min(1.8, Math.max(0.7, zs / 2));
            ctx.globalAlpha = 0.5 * webK;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(
              x + Math.cos(a) * len * 0.3 + Math.sin(t * 2 + i) * 5, y + Math.sin(a) * len * 0.3 + 6,
              x + Math.cos(a + 0.5) * len * 0.7, y + Math.sin(a + 0.5) * len * 0.7 + 10,
              x + Math.cos(a + 0.2) * len, y + Math.sin(a + 0.2) * len + 14,
            );
            ctx.stroke();
          }
        });
        ctx.globalAlpha = 1;
      }
      // 자탄 본체 + 작은 감속 낙하산
      ctx.globalCompositeOperation = 'source-over';
      BOMBLETS.forEach((b, i) => {
        const k = clamp01((t - p.burst) / (span * b.dur));
        const o = 1 - clamp01((t - p.land - 1) / 1.5);
        if (o <= 0) return;
        const [x, y] = pos[i];
        ctx.globalAlpha = o;
        ctx.fillStyle = '#f2f6fa';
        ctx.fillRect(x - 2, y - 2, 4, 4);
        if (k < 0.95) {
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, y - 7, 4.5, Math.PI, 0);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    }

    // ⑩ 합선 스파크: 변전소 반복 섬광 → 수천 곳 동시 다발 → 연쇄 푸른 섬광
    if (t >= p.land - 0.3 && t < p.waveEnd + 1.5) {
      ctx.globalCompositeOperation = 'lighter';
      const sc = Math.min(2.2, Math.max(0.6, zs / 1.6));
      SUBSTATIONS.forEach((s, i) => {
        const period = 0.55 + rand(i + 61) * 0.5;
        const ph = ((t - p.land + rand(i + 5) * period) % period) / period;
        const on = ph < 0.35 ? 1 - ph / 0.35 : 0;
        const fade = 1 - clamp01((t - p.waveEnd) / 1.2);
        if (on <= 0) return;
        const [x, y] = pp(s);
        drawSprite(ctx, assets.blue, x, y, 34 * sc * (0.6 + on), on * fade);
        const seed = i * 131 + Math.floor((t - p.land) / period);
        for (let k = 0; k < 3; k++) arc(ctx, x, y, (18 + rand(seed + k) * 26) * sc, seed * 3 + k, on * fade);
        ctx.beginPath();
        ctx.arc(x, y, (10 + 40 * (1 - on)) * sc, 0, Math.PI * 2);
        glow(ctx, BLUE, 1.6, '#ffffff', on * 0.8 * fade);
      });
      // 수천 곳: 불빛 점 위에서 시간차 스파크 (평양에서 바깥으로 번짐)
      if (t >= p.mass) {
        const spreadKm = 6 + (t - p.mass) * 26;
        const count = Math.min(LIGHTS.length, 900);
        for (let i = 0; i < count; i++) {
          const L = LIGHTS[i];
          if (L.km > spreadKm) continue;
          if (W >= 0 && L.km < W - 20) continue; // 이미 꺼진 곳
          const period = 0.9 + rand(i + 3000) * 1.4;
          const ph = ((t + rand(i + 4000) * period) % period) / period;
          if (ph > 0.18) continue;
          const on = 1 - ph / 0.18;
          const [x, y] = pp(L.pos);
          if (x < -20 || x > MAP_W + 20 || y < -20 || y > MAP_H + 20) continue;
          drawSprite(ctx, assets.blue, x, y, 16 * sc * (0.5 + on), on * 0.9);
          if (rand(i + Math.floor(t * 8)) > 0.6) arc(ctx, x, y, 14 * sc, i * 17 + Math.floor(t * 10), on * 0.8);
        }
      }
      // 연쇄 섬광: 평양 상공 큰 푸른 플래시
      if (t >= p.flash && t < p.wave + 1) {
        for (let k = 0; k < 4; k++) {
          const tt = p.flash + k * 0.9;
          const q = clamp01((t - tt) / 0.35);
          if (q <= 0 || q >= 1) continue;
          const s = SUBSTATIONS[(k * 3) % SUBSTATIONS.length];
          const [x, y] = pp(s);
          drawSprite(ctx, assets.blue, x, y, (80 + 140 * q) * sc, 1 - q);
        }
      }
      ctx.globalAlpha = 1;
    }

    // ⑪ 정전 파동 링 (푸른 충격파) + 블랙아웃 라벨
    ctx.globalCompositeOperation = 'lighter';
    if (W > 0 && t < p.waveEnd + 0.8) {
      const a = 1 - clamp01((t - p.waveEnd) / 0.8);
      circleKm(ctx, pp, CAP, W);
      glow(ctx, BLUE, 3, '#dffbff', 0.9 * a);
      circleKm(ctx, pp, CAP, Math.max(1, W - 14));
      glow(ctx, '#0066ff', 2, BLUE, 0.4 * a);
    }
    ctx.globalCompositeOperation = 'source-over';

    // ⑫ 통신망 두절: 지휘 통신 거점 붉은 X
    if (t >= p.comms) {
      const k = clamp01((t - p.comms) / 0.5);
      [CAP, CITIES[8].pos, CITIES[9].pos, CITIES[7].pos, CITIES[13].pos].forEach((c, i) => {
        const kk = clamp01(k * 1.6 - i * 0.15);
        if (kk <= 0) return;
        const [x, y] = pp(c);
        const r = 14 * (0.6 + 0.4 * kk);
        ctx.beginPath();
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r);
        ctx.lineTo(x - r, y + r);
        glow(ctx, RED, 4, '#ffd0d0', kk);
      });
      chip(ctx, pp(CITIES[9].pos)[0], pp(CITIES[9].pos)[1] - 46, d.commsLabel, RED, 28, k);
    }
    if (t >= p.out) {
      const k = clamp01((t - p.out) / 0.5);
      chip(ctx, capX, capY + 54, d.blackoutLabel, RED, 34, k);
    }

    // 끝 CTA 구간: 무대 살짝 어둡게
    const ctaDim = clamp01((t - (p.T - 4)) / 0.6) * 0.35;
    if (ctaDim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${ctaDim})`;
      ctx.fillRect(0, 0, MAP_W, MAP_H);
    }

    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [assets, frame]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{position: 'absolute', left: 0, top: STAGE_TOP, width: MAP_W, height: MAP_H}}>
      <canvas ref={canvas} width={MAP_W} height={MAP_H} style={{position: 'absolute', inset: 0}} />
      {/* 상·하단 페이드 (상단 카드·하단 자막과 자연스럽게) */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 140, background: 'linear-gradient(#05070a, rgba(5,7,10,0))'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, background: 'linear-gradient(rgba(5,7,10,0), #05070a)'}} />
      <div style={{position: 'absolute', left: 16, bottom: 150, fontSize: 16, color: 'rgba(255,255,255,0.5)', fontFamily: 'Pretendard'}}>
        위성영상 © Esri · 야간 NASA Black Marble
      </div>
    </div>
  );
};
