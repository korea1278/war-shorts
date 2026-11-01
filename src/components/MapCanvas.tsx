// 중앙 지도 (Y 384~1440, 1080x1056) — WebGL 없이 Canvas 2D 한 장에 그린다.
//   ① 정적 재료(위성 모자이크 2장·국경 좌표)는 탭마다 한 번만 불러 메모리에 보관 (프레임마다 재요청 없음)
//   ② 매 프레임: 원근 지면 → 국경 발광(굵은 반투명 선 3단) → 탄도·폭발 등 동적 레이어
import React, {useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import {drawGround, makeCam, MAP_H, MAP_W, Mosaic, projectLL, projectW, toWorld} from '../lib/camera';
import {buildPlan, cameraAt, FPS} from '../lib/schedule';
import {COLORS, Episode, Timeline} from '../lib/types';
import {drawOverlay, glowStroke} from './MapOverlay';

type Assets = {layers: Mosaic[]; borders: {iso: string; rings: Float64Array[]}[]};

let assetsPromise: Promise<Assets> | null = null;

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('이미지 로드 실패 ' + src));
    im.src = src;
  });

const loadAssets = (offline: boolean): Promise<Assets> => {
  if (assetsPromise) return assetsPromise;
  assetsPromise = (async () => {
    // 캔버스 글자용 폰트를 먼저 확실히 로드
    const font = new FontFace('Pretendard', `url(${staticFile('fonts/Pretendard-Black.woff2')})`, {weight: '100 900'});
    (document.fonts as unknown as {add: (f: FontFace) => void}).add(await font.load());
    const geo = await fetch(staticFile('geo/korea.json')).then((r) => r.json());
    const borders = geo.features.map((f: {properties: {iso: string}; geometry: {type: string; coordinates: number[][][] | number[][][][]}}) => {
      const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      const rings: Float64Array[] = [];
      polys.forEach((poly) =>
        poly.forEach((ring) => {
          const a = new Float64Array(ring.length * 2);
          ring.forEach((pt, i) => {
            const [wx, wy] = toWorld([pt[0], pt[1]]);
            a[i * 2] = wx;
            a[i * 2 + 1] = wy;
          });
          rings.push(a);
        }),
      );
      return {iso: f.properties.iso, rings};
    });
    let layers: Mosaic[] = [];
    if (!offline) {
      const meta = await fetch(staticFile('tiles/mosaic.json')).then((r) => r.json());
      layers = await Promise.all(
        ['back', 'detail'].map(async (k) => {
          const m = meta[k];
          const img = await loadImg(staticFile(m.file));
          await img.decode();
          // 한 번 비트맵으로 풀어 두면 매 프레임 디코딩 없음
          const bmp = await createImageBitmap(img);
          return {img: bmp, z: m.z, x0: m.x0, y0: m.y0, w: m.w, h: m.h};
        }),
      );
    }
    return {layers, borders};
  })();
  return assetsPromise;
};

export const MapCanvas: React.FC<{episode: Episode; timeline: Timeline; offline: boolean}> = ({episode, timeline, offline}) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender('지도 재료 로드', {timeoutInMilliseconds: 110000}));
  const released = useRef(false);

  useLayoutEffect(() => {
    loadAssets(offline)
      .then((a) => setAssets(a))
      .catch((e) => {
        console.warn(e);
        setAssets({layers: [], borders: []});
      });
  }, [offline]);

  useLayoutEffect(() => {
    if (!assets || !canvas.current) return;
    const ctx = canvas.current.getContext('2d', {alpha: false, willReadFrequently: true})!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    const cam = makeCam(cameraAt(sec, episode, timeline));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1016';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    if (assets.layers.length) drawGround(ctx, cam, assets.layers);

    // 국경 발광 (은은한 맥동) — 북한 빨강, 한국 파랑
    const pulse = 0.85 + 0.15 * Math.sin(sec * 3.2);
    for (const iso of ['KOR', 'PRK']) {
      const col = iso === 'PRK' ? COLORS.nk : COLORS.rok;
      ctx.beginPath();
      assets.borders.filter((b) => b.iso === iso).forEach((b) =>
        b.rings.forEach((r) => {
          for (let i = 0; i < r.length; i += 2) {
            const [x, y] = projectW(cam, r[i], r[i + 1]);
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.closePath();
        }),
      );
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = col;
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      glowStroke(ctx, col, 3.2, iso === 'PRK' ? '#ffb4b4' : '#b8d4ff', pulse);
    }

    drawOverlay(ctx, sec, episode, buildPlan(episode, timeline), (ll) => projectLL(cam, ll));
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [assets, frame]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{position: 'absolute', inset: 0, width: MAP_W, height: MAP_H}}>
      <canvas ref={canvas} width={MAP_W} height={MAP_H} style={{position: 'absolute', inset: 0}} />
      {!offline && (
        <div style={{position: 'absolute', right: 14, bottom: 96, fontSize: 16, color: 'rgba(255,255,255,0.55)', fontFamily: 'Pretendard'}}>
          위성영상 © Esri
        </div>
      )}
    </div>
  );
};
