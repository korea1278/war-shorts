// 지도 위 동적 레이어 (탄도·폭발·레이더·마커·라벨) — 전부 Canvas 2D, 필터·블러 없음.
// 발광은 '굵은 반투명 선 3단 겹치기'로 표현
import {Arc, clamp01, Plan, rand} from '../lib/schedule';
import {MAP_H, MAP_W} from '../lib/camera';
import {COLORS, Episode, LngLat} from '../lib/types';

type P = (ll: LngLat) => [number, number];
type C = CanvasRenderingContext2D;

const geoCircle = (c: LngLat, km: number, n = 40, a0 = 0, a1 = 360): LngLat[] => {
  const out: LngLat[] = [];
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((c[1] * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([c[0] + Math.sin(a) * dLng, c[1] + Math.cos(a) * dLat]);
  }
  return out;
};

const path = (ctx: C, pts: [number, number][], close = false) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (close) ctx.closePath();
};

/** 발광 선: 넓고 옅게 → 중간 → 심 (3단) */
export const glowStroke = (ctx: C, color: string, core: number, coreColor = color, alpha = 1) => {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.16 * alpha;
  ctx.lineWidth = core * 4;
  ctx.stroke();
  ctx.globalAlpha = 0.32 * alpha;
  ctx.lineWidth = core * 2.1;
  ctx.stroke();
  ctx.globalAlpha = 0.95 * alpha;
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = core;
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const circle = (ctx: C, x: number, y: number, r: number, fill: string | CanvasGradient, alpha = 1) => {
  if (r <= 0 || alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const radial = (ctx: C, x: number, y: number, r: number, stops: [number, string][]) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
};
const FLASH: [number, string][] = [[0, 'rgba(255,248,224,1)'], [0.35, 'rgba(255,179,64,0.9)'], [1, 'rgba(255,61,0,0)']];
const FLASH2: [number, string][] = [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,207,106,0.95)'], [1, 'rgba(255,42,0,0)']];
const EMBER: [number, string][] = [[0, 'rgba(255,210,122,0.95)'], [1, 'rgba(255,69,0,0)']];

const arcColor = (a: Arc) => (a.side === 'nk' ? COLORS.nk : a.side === 'chunmoo' ? COLORS.chunmoo : COLORS.rokLight);

const arcPoints = (a: Arc, A: [number, number], B: [number, number], p0: number, p1: number, n = 22): [number, number][] => {
  const dist = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const h = Math.max(70, Math.min(420, dist * (a.side === 'chunmoo' ? 0.32 : 0.45)));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = p0 + ((p1 - p0) * i) / n;
    pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - h * 4 * t * (1 - t)]);
  }
  return pts;
};

const label = (ctx: C, x: number, y: number, text: string, size: number, color = '#fff') => {
  ctx.font = `900 ${size}px Pretendard`;
  const w = ctx.measureText(text).width + 26;
  const h = size + 18;
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size * 0.82 - 10, w, h, 8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y + 4);
};

export const drawOverlay = (ctx: C, sec: number, episode: Episode, plan: Plan, project: P) => {
  const m = episode.map;
  const p2 = sec >= plan.t2;
  const inView = ([x, y]: [number, number]) => x > -200 && x < MAP_W + 200 && y > -300 && y < MAP_H + 200;
  const prj = new Map<string, [number, number]>();
  const pp = (ll: LngLat) => {
    const k = ll[0] + ',' + ll[1];
    let v = prj.get(k);
    if (!v) prj.set(k, (v = project(ll)));
    return v;
  };

  // 1단계 착탄 뒤 남는 불길
  const fireFade = clamp01(1 - (sec - (plan.t2 + 1.5)) / 2.5);
  if (fireFade > 0) {
    plan.blasts.forEach((b, i) => {
      if (b.side !== 'nk' || sec <= b.t + 0.3 || i % 2) return;
      const [x, y] = pp(b.pos);
      if (!inView([x, y])) return;
      const fl = 0.6 + 0.4 * Math.sin(sec * 9 + i * 1.7);
      const r = 10 + 8 * fl;
      circle(ctx, x, y, r, radial(ctx, x, y, r, EMBER), 0.75 * fireFade);
    });
  }

  // 서울 타깃 펄스 링 (1단계)
  if (!p2) {
    for (let k = 0; k < 3; k++) {
      const ph = (sec * 0.85 + k / 3) % 1;
      path(ctx, geoCircle(m.seoul, 4 + ph * 22).map(pp), true);
      ctx.strokeStyle = COLORS.nk;
      ctx.lineWidth = 4 - ph * 3;
      ctx.globalAlpha = (1 - ph) * 0.95;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    path(ctx, geoCircle(m.seoul, 3).map(pp), true);
    ctx.fillStyle = COLORS.nk;
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(sec * 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    const [sx, sy] = pp(m.seoul);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 34, sy); ctx.lineTo(sx + 34, sy);
    ctx.moveTo(sx, sy - 34); ctx.lineTo(sx, sy + 34);
    ctx.stroke();
  }

  // 레이더 (2단계)
  const radar = pp(m.radar);
  const radarOn = p2 && sec >= plan.radarStart && sec < plan.traceEnd + 2.5;
  if (radarOn) {
    const k = clamp01((sec - plan.radarStart) / 0.6) * clamp01((plan.traceEnd + 2.5 - sec) / 0.8);
    const ang = ((sec - plan.radarStart) * 260) % 360;
    ctx.globalAlpha = k * 0.7;
    ctx.strokeStyle = COLORS.rokLight;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    [25, 50, 70].forEach((km) => {
      path(ctx, geoCircle(m.radar, km).map(pp), true);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    path(ctx, [radar, ...geoCircle(m.radar, 70, 16, ang - 40, ang).map(pp)], true);
    ctx.globalAlpha = k * 0.32;
    ctx.fillStyle = COLORS.rokLight;
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, radar[0], radar[1], 24, COLORS.rokLight, 0.3 * k);
    circle(ctx, radar[0], radar[1], 11, COLORS.rokLight, k);
  }

  // 역추적 선
  if (p2 && sec >= plan.traceStart && sec < plan.counterStart + 3) {
    const fade = clamp01((plan.counterStart + 3 - sec) / 1.0);
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -sec * 60;
    ctx.strokeStyle = COLORS.chunmoo;
    ctx.lineWidth = 3;
    m.nkOrigins.forEach((o, i) => {
      const k = clamp01((sec - (plan.traceStart + i * 0.18)) / 1.0);
      if (k <= 0) return;
      const B = pp(o);
      ctx.globalAlpha = 0.85 * fade;
      ctx.beginPath();
      ctx.moveTo(radar[0], radar[1]);
      ctx.lineTo(radar[0] + (B[0] - radar[0]) * k, radar[1] + (B[1] - radar[1]) * k);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // 북측 갱도 진지
  m.nkOrigins.forEach((o, i) => {
    const [x, y] = pp(o);
    if (!inView([x, y])) return;
    const dead = sec >= plan.destroyedAt[i];
    const fired = !p2 && plan.arcs.some((a) => a.side === 'nk' && a.originIdx === i && sec >= a.launch && sec < a.launch + 0.22);
    const locked = p2 && sec >= plan.traceStart + i * 0.18 + 1.0;
    if (fired) circle(ctx, x, y, 30, radial(ctx, x, y, 30, FLASH));
    if (!dead) {
      ctx.beginPath();
      ctx.moveTo(x, y - 17); ctx.lineTo(x + 15, y + 11); ctx.lineTo(x - 15, y + 11); ctx.closePath();
      ctx.fillStyle = COLORS.nk; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    } else {
      const r = 22 + 5 * Math.sin(sec * 10 + i);
      circle(ctx, x, y, r, radial(ctx, x, y, r, EMBER), 0.9);
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 14); ctx.lineTo(x + 14, y + 14); ctx.moveTo(x + 14, y - 14); ctx.lineTo(x - 14, y + 14);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (locked && !dead) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(sec * 14);
      ctx.strokeStyle = COLORS.chunmoo; ctx.lineWidth = 3;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(x + 28 * sx, y + 14 * sy); ctx.lineTo(x + 28 * sx, y + 28 * sy); ctx.lineTo(x + 14 * sx, y + 28 * sy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });

  // 아군 K9·천무 진지
  if (p2) {
    const appear = clamp01((sec - (plan.counterStart - 1.2)) / 0.5);
    if (appear > 0) {
      m.k9Sites.forEach((s) => {
        const [x, y] = pp(s.pos);
        const col = s.kind === 'chunmoo' ? COLORS.chunmoo : COLORS.rokLight;
        const fired = plan.arcs.some((a) => a.side !== 'nk' && Math.hypot(a.from[0] - s.pos[0], a.from[1] - s.pos[1]) < 0.05 && sec >= a.launch && sec < a.launch + 0.2);
        if (fired) circle(ctx, x, y, 34, radial(ctx, x, y, 34, FLASH2));
        const h = 15 * appear;
        ctx.globalAlpha = appear;
        ctx.fillStyle = col; ctx.fillRect(x - h, y - h, h * 2, h * 2);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.strokeRect(x - h, y - h, h * 2, h * 2);
        ctx.font = '900 30px Pretendard';
        ctx.textAlign = 'center';
        ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
        const t = `${s.name} ${s.kind === 'chunmoo' ? '천무' : 'K9'}`;
        ctx.strokeText(t, x, y - 26);
        ctx.fillStyle = col; ctx.fillText(t, x, y - 26);
        ctx.globalAlpha = 1;
      });
    }
  }

  // 탄도 궤적
  plan.arcs.forEach((a) => {
    if (sec < a.launch || sec > a.launch + a.flight) return;
    const p = (sec - a.launch) / a.flight;
    const pe = a.side === 'nk' ? p : Math.pow(p, 0.92);
    const A = pp(a.from);
    const B = pp(a.to);
    const col = arcColor(a);
    path(ctx, arcPoints(a, A, B, 0, 1, 26));
    ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.22; ctx.stroke(); ctx.globalAlpha = 1;
    const trail = arcPoints(a, A, B, Math.max(0, pe - (a.side === 'nk' ? 0.42 : 0.5)), pe);
    path(ctx, trail);
    glowStroke(ctx, col, a.side === 'chunmoo' ? 5 : 6);
    path(ctx, trail.slice(Math.floor(trail.length * 0.6)));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.stroke();
    const head = trail[trail.length - 1];
    circle(ctx, head[0], head[1], 18, col, 0.35);
    circle(ctx, head[0], head[1], 7, '#fff');
  });

  // 폭발
  plan.blasts.forEach((b, i) => {
    if (sec < b.t || sec > b.t + 1.0) return;
    const [x, y] = pp(b.pos);
    if (!inView([x, y])) return;
    const k = sec - b.t;
    const r = (16 + 70 * Math.sqrt(k)) * b.size * (b.side === 'rok' ? 1.35 : 1);
    circle(ctx, x, y, r * 0.75, radial(ctx, x, y, r * 0.75, b.side === 'rok' ? FLASH2 : FLASH), 1 - k);
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(0.1, 3 * (1 - k));
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    if (k < 0.12) circle(ctx, x, y, 14 * b.size, '#fff');
    if (b.side === 'rok') {
      for (let j = 0; j < 5; j++) {
        const ang = rand(i * 7 + j) * Math.PI * 2;
        circle(ctx, x + Math.cos(ang) * r * 0.9, y + Math.sin(ang) * r * 0.9 * 0.6 - k * 20, 3.5, '#ffd27a', 1 - k);
      }
    }
  });

  // 지명 라벨
  m.labels.filter((l) => l.phase === 0 || (l.phase === 2 && p2) || (l.phase === 1 && !p2)).forEach((l) => {
    const [x, y] = pp(l.pos);
    if (!inView([x, y])) return;
    const seoul = l.text === '서울';
    label(ctx, x, y - (seoul ? 62 : 44), l.text, l.size, seoul ? '#fff' : '#ffe9a8');
  });
  if (radarOn) label(ctx, radar[0], radar[1] - 44, '대포병 탐지레이더', 30, COLORS.chunmoo);

  // 위·아래 가장자리 페이드
  const g = ctx.createLinearGradient(0, 0, 0, MAP_H);
  g.addColorStop(0, 'rgba(5,7,10,0.85)');
  g.addColorStop(0.16, 'rgba(5,7,10,0)');
  g.addColorStop(0.82, 'rgba(5,7,10,0)');
  g.addColorStop(1, 'rgba(5,7,10,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
};
