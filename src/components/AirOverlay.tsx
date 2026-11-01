// 공중전 동적 레이어 — Canvas 2D, 블러·필터 없음 (발광은 굵은 반투명 선 3단)
import {MAP_H, MAP_W} from '../lib/camera';
import {AirPlan, jetPos, jetProgress} from '../lib/air';
import {alongPath} from '../lib/armor';
import {clamp01} from '../lib/schedule';
import {COLORS, Episode, LngLat} from '../lib/types';
import {circle, FLASH2, geoCircle, glowStroke, label, path, radial} from './MapOverlay';

type C = CanvasRenderingContext2D;
type P = (ll: LngLat) => [number, number];
type XY = [number, number];

const off = (x: number, y: number, m = 160) => x < -m || x > MAP_W + m || y < -m || y > MAP_H + m;

/** 전투기 실루엣 (화면 방향 ang, 크기 s) */
const jetGlyph = (ctx: C, x: number, y: number, ang: number, s: number, fill: string, edge = '#000') => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(s * 1.25, 0); // 기수
  ctx.lineTo(s * 0.15, -s * 0.22);
  ctx.lineTo(-s * 0.25, -s * 1.0); // 주익
  ctx.lineTo(-s * 0.5, -s * 1.0);
  ctx.lineTo(-s * 0.45, -s * 0.25);
  ctx.lineTo(-s * 0.95, -s * 0.5); // 꼬리
  ctx.lineTo(-s * 1.05, -s * 0.5);
  ctx.lineTo(-s * 0.9, 0);
  ctx.lineTo(-s * 1.05, s * 0.5);
  ctx.lineTo(-s * 0.95, s * 0.5);
  ctx.lineTo(-s * 0.45, s * 0.25);
  ctx.lineTo(-s * 0.5, s * 1.0);
  ctx.lineTo(-s * 0.25, s * 1.0);
  ctx.lineTo(s * 0.15, s * 0.22);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
};

/** 위경도 이동 방향을 화면 각도로 */
const screenAng = (pp: P, a: LngLat, b: LngLat) => {
  const A = pp(a);
  const B = pp(b);
  return Math.atan2(B[1] - A[1], B[0] - A[0]);
};

export const drawAir = (ctx: C, sec: number, ep: Episode, plan: AirPlan, pp: P) => {
  const a = ep.map.air!;
  const p2 = sec >= plan.t2;

  // ── 1단계: 남하 경로 붉은 궤적 + 진격 화살표 ──
  const routeK = clamp01(sec / 0.8) * (p2 ? 0.45 : 1);
  a.routes.forEach((r, ri) => {
    const lead = Math.min(0.97, jetProgress(plan, plan.jets.find((j) => j.route === ri && j.k === 0)!, sec) + 0.08);
    const pts: XY[] = [];
    const N = 30;
    for (let i = 0; i <= N; i++) pts.push(pp(alongPath(r, (lead * i) / N).p));
    path(ctx, pts);
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -sec * 60;
    glowStroke(ctx, COLORS.nk, 4, '#ffb4b4', routeK);
    ctx.setLineDash([]);
    // 화살촉
    if (pts.length > 2) {
      const [x, y] = pts[pts.length - 1];
      const [px, py] = pts[pts.length - 3];
      const ang = Math.atan2(y - py, x - px);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.globalAlpha = routeK;
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(-14, -18);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-14, 18);
      ctx.closePath();
      ctx.fillStyle = COLORS.nk;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  });

  // 지명 라벨
  ep.map.labels
    .filter((l) => l.phase === 0 || (l.phase === 2 && p2) || (l.phase === 1 && !p2))
    .forEach((l) => {
      const [x, y] = pp(l.pos);
      if (off(x, y, 0)) return;
      label(ctx, x, y - 30, l.text, l.size, '#ffe9a8');
    });

  // ── 2단계: 아군 AESA 부채꼴 레이더 빔 ──
  const R = a.radarKm ?? 200;
  const brg = a.radarBearing ?? 0;
  const spread = a.radarSpread ?? 70;
  const radarK = clamp01((sec - plan.radarAt) / 0.8);
  if (radarK > 0) {
    a.kf21.slice(0, 1).forEach((c) => {
      const grow = R * (0.15 + 0.85 * (1 - Math.pow(1 - radarK, 2)));
      const fan: LngLat[] = [c, ...geoCircle(c, grow, 40, brg - spread / 2, brg + spread / 2), c];
      const fp = fan.map(pp);
      path(ctx, fp, true);
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = COLORS.chunmoo;
      ctx.fill();
      ctx.globalAlpha = 1;
      glowStroke(ctx, COLORS.chunmoo, 3, '#c8f6ff', 0.9);
      // 스윕 빔 (좌우로 훑음)
      const sw = brg + (spread / 2) * Math.sin(sec * 2.6);
      const beam: LngLat[] = [c, ...geoCircle(c, grow, 8, sw - 4, sw + 4), c];
      path(ctx, beam.map(pp), true);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#9ff3ff';
      ctx.fill();
      ctx.globalAlpha = 1;
      // 동심 거리 링 (50km 간격)
      for (let km = 50; km <= grow; km += 50) {
        path(ctx, geoCircle(c, km, 30, brg - spread / 2, brg + spread / 2).map(pp));
        ctx.strokeStyle = 'rgba(160,240,255,0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (radarK >= 1) {
        const lp = pp(geoCircle(c, R, 1, brg + spread / 2 - 6, brg + spread / 2 - 6)[0]);
        label(ctx, Math.min(MAP_W - 200, Math.max(200, lp[0])), Math.max(60, lp[1]), `AESA 탐지 ${R}km+`, 34, '#00E5FF');
      }
    });
  }

  // ── 북한 전투기 ──
  plan.jets.forEach((j, ji) => {
    const kill = plan.killAt[ji];
    if (sec >= kill + 0.9) return;
    const now = jetPos(ep, plan, ji, Math.min(sec, kill));
    const prev = jetPos(ep, plan, ji, Math.min(sec, kill) - 0.6);
    const [x, y] = pp(now.p);
    if (off(x, y)) return;
    if (sec < kill) {
      const ang = screenAng(pp, prev.p, now.p);
      // 비행운
      const [tx, ty] = pp(prev.p);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255,90,90,0.55)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
      circle(ctx, x, y, 22, 'rgba(255,40,40,0.18)');
      jetGlyph(ctx, x, y, ang, 15, COLORS.nk);
      // 북한기 교전 거리 (작은 붉은 원) — 2단계 초반만
      if (p2 && j.k === 0 && a.nkRadarKm && sec < plan.fireAt) {
        path(ctx, geoCircle(now.p, a.nkRadarKm, 28).map(pp), true);
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255,120,120,0.85)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // 포착 박스 (록온)
      const lockK = clamp01((sec - plan.lockAt - (j.k + j.route) * 0.05) / 0.25);
      if (lockK > 0) {
        const s = 30 + 20 * (1 - lockK);
        ctx.globalAlpha = lockK * (0.75 + 0.25 * Math.sin(sec * 16 + ji));
        ctx.strokeStyle = COLORS.yellow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          ctx.moveTo(x + sx * s, y + sy * s * 0.6);
          ctx.lineTo(x + sx * s, y + sy * s);
          ctx.lineTo(x + sx * s * 0.6, y + sy * s);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      // 공중 폭발: 섬광 → 불덩이 → 파편
      const q = sec - kill;
      const r = 20 + 70 * Math.pow(q / 0.9, 0.5);
      circle(ctx, x, y, r, radial(ctx, x, y, r, FLASH2), 1 - q / 0.9);
      for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * Math.PI * 2 + ji;
        const d = 18 + 90 * q;
        circle(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d + 40 * q * q, 5 * (1 - q / 0.9), '#ffcf6a', 1 - q / 0.9);
      }
      if (q < 0.12) circle(ctx, x, y, 90, 'rgba(255,255,255,0.5)', 1 - q / 0.12);
    }
  });

  // ── 미티어 궤적 (푸른 선, 화면에서 위로 솟는 곡선) ──
  plan.meteors.forEach((m, n) => {
    const q = (sec - m.launch) / m.flight;
    if (q < 0 || q > 1.25) return;
    const from = a.kf21[m.shooter];
    const to = jetPos(ep, plan, m.jet, m.launch + m.flight).p;
    const A = pp(from);
    const B = pp(to);
    const dist = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const h = Math.min(160, dist * 0.18) * (n % 2 ? 1 : -0.6);
    const at = (t: number): XY => {
      const nx = -(B[1] - A[1]) / (dist || 1);
      const ny = (B[0] - A[0]) / (dist || 1);
      const b = 4 * t * (1 - t) * h;
      return [A[0] + (B[0] - A[0]) * t + nx * b, A[1] + (B[1] - A[1]) * t + ny * b];
    };
    const head = Math.min(1, q);
    const tail = Math.max(0, head - 0.35);
    const pts: XY[] = [];
    for (let i = 0; i <= 14; i++) pts.push(at(tail + ((head - tail) * i) / 14));
    path(ctx, pts);
    const fade = q > 1 ? 1 - (q - 1) / 0.25 : 1;
    glowStroke(ctx, '#1e90ff', 3.2, '#d6f3ff', fade);
    if (q < 1) {
      const [hx, hy] = at(head);
      circle(ctx, hx, hy, 12, radial(ctx, hx, hy, 12, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(0,229,255,0)']]));
    }
  });

  // ── 아군 KF-21 편대 ──
  if (p2 || sec > plan.t2 - 1.5) {
    const k = clamp01((sec - (plan.t2 - 1.5)) / 0.8);
    a.kf21.forEach((c, i) => {
      const [x, y] = pp(c);
      if (off(x, y)) return;
      ctx.globalAlpha = k;
      circle(ctx, x, y, 30, 'rgba(0,102,255,0.25)', k);
      ctx.globalAlpha = 1;
      const ang = screenAng(pp, c, geoCircle(c, 10, 1, brg, brg)[0]);
      ctx.globalAlpha = k;
      jetGlyph(ctx, x, y, ang, i === 0 ? 22 : 18, '#4da3ff', '#001a40');
      ctx.globalAlpha = 1;
    });
    const [lx, ly] = pp(a.kf21[0]);
    ctx.globalAlpha = k;
    label(ctx, Math.min(MAP_W - 200, Math.max(200, lx)), Math.min(MAP_H - 120, ly + 72), a.kf21Label ?? 'KF-21 · F-35A 편대', 32, '#4da3ff');
    ctx.globalAlpha = 1;
  }

  // 1단계 상단 경고 라벨
  if (!p2) {
    const lead = jetPos(ep, plan, 0, sec).p;
    const [x, y] = pp(lead);
    const k = clamp01((sec - 1.2) / 0.5) * (0.8 + 0.2 * Math.sin(sec * 8));
    if (!off(x, y, 0)) {
      ctx.globalAlpha = k;
      label(ctx, Math.min(MAP_W - 220, Math.max(220, x)), Math.max(70, y - 60), '북한 전투기 대규모 남하', 34, '#ff6b6b');
      ctx.globalAlpha = 1;
    }
  }

  // 격추 카운터
  if (sec >= plan.fireAt) {
    const killed = plan.killAt.filter((t) => t <= sec).length;
    label(ctx, MAP_W / 2, 250, `미티어 요격 · 격추 ${killed}기`, 36, COLORS.yellow);
  }
};

