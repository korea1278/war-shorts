// 기갑전 동적 레이어 — Canvas 2D, 블러 없음
import {alongPath, ArmorPlan, axisProgress} from '../lib/armor';
import {MAP_H, MAP_W} from '../lib/camera';
import {clamp01} from '../lib/schedule';
import {COLORS, Episode, LngLat} from '../lib/types';
import {circle, EMBER, FLASH2, geoCircle, glowStroke, label, path, radial} from './MapOverlay';

type C = CanvasRenderingContext2D;
type P = (ll: LngLat) => [number, number];

const LASER = '#00e5ff';

/** 전차 아이콘: 차체 + 포탑 + 포신 (ang: 화면 각도, 포신 방향) */
const tank = (ctx: C, x: number, y: number, ang: number, color: string, scale = 1, alpha = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-15, -10, 30, 20, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-1, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(25, 0);
  ctx.stroke();
  ctx.restore();
};

const screenDir = (pp: P, a: LngLat, b: LngLat) => {
  const A = pp(a);
  const B = pp(b);
  return Math.atan2(B[1] - A[1], B[0] - A[0]);
};

export const drawArmor = (ctx: C, sec: number, ep: Episode, plan: ArmorPlan, pp: P) => {
  const a = ep.map.armor!;
  const p2 = sec >= plan.t2;

  // 야간 화면 (자막 '야간' 부터) — 지면을 남색으로 어둡게
  const night = clamp01((sec - plan.nightAt) / 0.8);
  if (night > 0) {
    ctx.globalAlpha = 0.62 * night;
    ctx.fillStyle = '#01081a';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.globalAlpha = 1;
  }

  // ── 1단계: 북측에서 남하하는 붉은 기갑 웨이브 화살표 ──
  const p1Fade = clamp01(1 - (sec - plan.t2) / 1.2);
  if (p1Fade > 0) {
    a.axes.forEach((ax, i) => {
      const prog = axisProgress(plan, i, Math.min(sec, plan.t2));
      if (prog <= 0) return;
      const N = 30;
      const pts: [number, number][] = [];
      for (let k = 0; k <= N; k++) pts.push(pp(alongPath(ax.path, (prog * k) / N).p));
      path(ctx, pts);
      glowStroke(ctx, COLORS.nk, 11, '#ff6a6a', 0.9 * p1Fade);
      // 화살촉
      const tip = pts[pts.length - 1];
      const prev = pts[pts.length - 3] ?? pts[0];
      const ang = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
      ctx.save();
      ctx.globalAlpha = p1Fade;
      ctx.translate(tip[0], tip[1]);
      ctx.rotate(ang);
      ctx.fillStyle = COLORS.nk;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(-14, -24);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-14, 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // 화살 뒤를 따라오는 전차 무리 (3개 파도 × 4대)
      for (let w = 0; w < 3; w++) {
        for (let k = 0; k < 4; k++) {
          const u = prog - 0.05 - w * 0.13 - k * 0.025;
          if (u <= 0) continue;
          const here = alongPath(ax.path, u).p;
          const ahead = alongPath(ax.path, Math.min(1, u + 0.02)).p;
          const [x, y] = pp(here);
          const off = (k % 2 ? 1 : -1) * (10 + 6 * w);
          tank(ctx, x + off, y, screenDir(pp, here, ahead), COLORS.nk, 0.85, p1Fade);
        }
      }
    });
  }

  // ── 2단계: K2 방어선 · 2.5km 타깃 링 · 레이저 조준 · 선제 타격 ──
  if (p2) {
    const k = clamp01((sec - plan.ringAt) / 0.5);
    // K2 사거리 링 (2.5km, 실제 축척)
    a.k2.forEach((u, i) => {
      const ph = (sec * 0.7 + i * 0.27) % 1;
      path(ctx, geoCircle(u.pos, 2.5, 48).map(pp), true);
      ctx.setLineDash([12, 9]);
      ctx.strokeStyle = COLORS.rokLight;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.75 * k;
      ctx.stroke();
      ctx.setLineDash([]);
      path(ctx, geoCircle(u.pos, 0.3 + ph * 1.2, 32).map(pp), true);
      ctx.strokeStyle = COLORS.rok;
      ctx.lineWidth = 4 - ph * 3;
      ctx.globalAlpha = (1 - ph) * k;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // 북한 전차 (격파 전엔 조금씩 전진)
    a.nkTanks.forEach((t, i) => {
      const dead = sec >= plan.deadAt[i];
      const creep = Math.min(sec, plan.deadAt[i]) - plan.t2;
      const pos: LngLat = [t[0], t[1] - creep * 0.00018];
      const [x, y] = pp(pos);
      if (!dead) {
        if (night > 0) circle(ctx, x, y, 22, '#ffffff', 0.25 * night); // 열상 화면에서 하얗게 보임
        tank(ctx, x, y, screenDir(pp, pos, [pos[0], pos[1] - 0.01]), COLORS.nk, 1.05);
      } else {
        const r = 24 + 5 * Math.sin(sec * 11 + i);
        circle(ctx, x, y, r, radial(ctx, x, y, r, EMBER), 0.9);
        ctx.beginPath();
        ctx.moveTo(x - 13, y - 13); ctx.lineTo(x + 13, y + 13); ctx.moveTo(x + 13, y - 13); ctx.lineTo(x - 13, y + 13);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      }
    });

    // 조준선·사격
    plan.shots.forEach((s, i) => {
      const u = a.k2[s.k2];
      const t = a.nkTanks[s.target];
      const creep = Math.min(sec, plan.deadAt[s.target]) - plan.t2;
      const tp: LngLat = [t[0], t[1] - creep * 0.00018];
      const A = pp(u.pos);
      const B = pp(tp);
      if (sec >= s.lockAt && sec < s.hitAt + 0.15) {
        const draw = clamp01((sec - s.lockAt) / 0.35);
        path(ctx, [A, [A[0] + (B[0] - A[0]) * draw, A[1] + (B[1] - A[1]) * draw]]);
        glowStroke(ctx, LASER, 2.6, '#e8fdff', 0.95);
        // 록온 브래킷
        if (draw >= 1) {
          const blink = 0.6 + 0.4 * Math.sin(sec * 30);
          ctx.globalAlpha = blink;
          ctx.strokeStyle = LASER;
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.moveTo(B[0] + 26 * sx, B[1] + 12 * sy);
            ctx.lineTo(B[0] + 26 * sx, B[1] + 26 * sy);
            ctx.lineTo(B[0] + 12 * sx, B[1] + 26 * sy);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // 첫 조준에는 거리 표기
        if (i === 0 && a.rangeLabel) {
          const mx = (A[0] + B[0]) / 2;
          const my = (A[1] + B[1]) / 2;
          label(ctx, mx + 70, my, a.rangeLabel, 34, LASER);
        }
      }
      // 120mm 포구 섬광 + 예광탄
      if (sec >= s.fireAt && sec < s.fireAt + 0.18) circle(ctx, A[0], A[1], 34, radial(ctx, A[0], A[1], 34, FLASH2));
      if (sec >= s.fireAt && sec < s.hitAt) {
        const q = (sec - s.fireAt) / (s.hitAt - s.fireAt);
        const hx = A[0] + (B[0] - A[0]) * q;
        const hy = A[1] + (B[1] - A[1]) * q;
        const tx = A[0] + (B[0] - A[0]) * Math.max(0, q - 0.35);
        const ty = A[1] + (B[1] - A[1]) * Math.max(0, q - 0.35);
        path(ctx, [[tx, ty], [hx, hy]]);
        glowStroke(ctx, '#ffd27a', 4, '#ffffff');
      }
      // 명중 폭발
      if (sec >= s.hitAt && sec < s.hitAt + 1.0) {
        const q = sec - s.hitAt;
        const r = (20 + 80 * Math.sqrt(q)) * 1.1;
        circle(ctx, B[0], B[1], r * 0.75, radial(ctx, B[0], B[1], r * 0.75, FLASH2), 1 - q);
        ctx.globalAlpha = (1 - q) * 0.8;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(0.1, 3 * (1 - q));
        ctx.beginPath();
        ctx.arc(B[0], B[1], r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (q < 0.1) circle(ctx, B[0], B[1], 16, '#fff');
      }
    });

    // K2 전차 (북쪽을 겨눔)
    a.k2.forEach((u) => {
      const [x, y] = pp(u.pos);
      const s = 0.6 + 0.4 * k;
      tank(ctx, x, y, screenDir(pp, u.pos, [u.pos[0], u.pos[1] + 0.01]), COLORS.rok, 1.15 * s, k);
      ctx.globalAlpha = k;
      ctx.font = '900 28px Pretendard';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000';
      ctx.strokeText(u.name ?? 'K2', x, y + 44);
      ctx.fillStyle = '#9cc8ff';
      ctx.fillText(u.name ?? 'K2', x, y + 44);
      ctx.globalAlpha = 1;
    });
  }

  // 지명 라벨
  ep.map.labels
    .filter((l) => l.phase === 0 || (l.phase === 2 && p2) || (l.phase === 1 && !p2))
    .forEach((l) => {
      const [x, y] = pp(l.pos);
      if (x < -200 || x > MAP_W + 200 || y < -300 || y > MAP_H + 200) return;
      label(ctx, x, y - 40, l.text, l.size, '#ffe9a8');
    });

  // 교환비 문구
  const rk = clamp01((sec - plan.ratioAt) / 0.3);
  if (rk > 0 && a.ratioText) {
    ctx.save();
    ctx.translate(MAP_W / 2, 210);
    ctx.scale(0.7 + 0.3 * rk, 0.7 + 0.3 * rk);
    ctx.globalAlpha = rk;
    ctx.font = '900 76px Pretendard';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#000';
    ctx.strokeText(a.ratioText, 0, 0);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(a.ratioText, 0, 0);
    ctx.restore();
  }

  // 위·아래 가장자리 페이드
  const g = ctx.createLinearGradient(0, 0, 0, MAP_H);
  g.addColorStop(0, 'rgba(5,7,10,0.85)');
  g.addColorStop(0.16, 'rgba(5,7,10,0)');
  g.addColorStop(0.82, 'rgba(5,7,10,0)');
  g.addColorStop(1, 'rgba(5,7,10,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
};
