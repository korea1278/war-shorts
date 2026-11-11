// 야간 침투·열상 감시망 동적 레이어 (EP11~) — Canvas 2D, 블러·필터 없음
import {MAP_H, MAP_W} from '../lib/camera';
import {InfilPlan, mdlLat} from '../lib/infiltration';
import {clamp01, rand} from '../lib/schedule';
import {Episode, LngLat} from '../lib/types';
import {circle, geoCircle, glowStroke, label, path} from './MapOverlay';

type C = CanvasRenderingContext2D;
type P = (ll: LngLat) => [number, number];
const RED = '#FF3B30';
const YEL = '#FFE500';
const GREEN = '#39ff6a';
const clampX = (x: number, w = 200) => Math.min(MAP_W - w, Math.max(w, x));
// 지도 위쪽 96px는 상단 인포그래픽, 아래 120px는 자막 바에 덮이므로 라벨은 그 사이에만
const clampY = (y: number) => Math.min(MAP_H - 150, Math.max(150, y));
const fade = (sec: number, at: number, d = 0.4) => clamp01((sec - at) / d);
const lerp = (a: LngLat, b: LngLat, t: number): LngLat => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const along = (pts: LngLat[], q: number): {ll: LngLat; i: number} => {
  const segs = pts.length - 1;
  const m = clamp01(q) * segs;
  const i = Math.min(segs - 1, Math.floor(m));
  return {ll: lerp(pts[i], pts[i + 1], m - i), i};
};

const tag = (ctx: C, x: number, y: number, text: string, size: number, color: string, a = 1) => {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  label(ctx, clampX(x), clampY(y), text, size, color);
  ctx.globalAlpha = 1;
};

const bigX = (ctx: C, x: number, y: number, r: number, a: number, col = RED) => {
  if (a <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  glowStroke(ctx, col, 5, '#ffffff', a);
};

/** 야간 암전 (지형 위·국경 아래) — 2단계는 녹색 야시경 */
export const drawInfilNight = (ctx: C, sec: number, plan: InfilPlan) => {
  const g = fade(sec, plan.t2, 0.5);
  ctx.globalAlpha = 0.58 - 0.12 * g;
  ctx.fillStyle = '#020611';
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  if (g > 0) {
    ctx.globalAlpha = 0.34 * g;
    ctx.fillStyle = '#0a7a2a';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
  ctx.globalAlpha = 1;
};

/** 복엽기(AN-2) 실루엣: 위아래 두 장 날개 */
const biplane = (ctx: C, x: number, y: number, ang: number, s: number, fill: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = fill;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-s * 1.1, -s * 0.18, s * 2.1, s * 0.36, s * 0.15); // 동체
  ctx.fill();
  ctx.stroke();
  for (const dx of [s * 0.25, -s * 0.05]) {
    ctx.beginPath();
    ctx.roundRect(dx - s * 0.17, -s * 1.15, s * 0.34, s * 2.3, s * 0.1); // 날개 2장
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(-s * 1.05, -s * 0.5, s * 0.22, s, s * 0.08); // 꼬리날개
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

/** 공기부양정: 둥근 선체 + 프로펠러 두 개 */
const hovercraft = (ctx: C, x: number, y: number, ang: number, s: number, fill: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = fill;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-s, -s * 0.55, s * 2, s * 1.1, s * 0.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#000';
  for (const dy of [-0.28, 0.28]) {
    ctx.beginPath();
    ctx.arc(-s * 0.6, s * dy, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const dashed = (ctx: C, pts: [number, number][], col: string, core: number, a: number, speed = 70, sec = 0) => {
  if (a <= 0 || pts.length < 2) return;
  path(ctx, pts);
  ctx.setLineDash([14, 12]);
  ctx.lineDashOffset = -sec * speed;
  glowStroke(ctx, col, core, '#ffd0cc', a);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
};

/** 경로를 따라 진행한 부분까지의 화면 점 */
const partial = (pp: P, pts: LngLat[], q: number) => {
  const {ll, i} = along(pts, q);
  return [...pts.slice(0, i + 1), ll].map(pp);
};

const mdlLine = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  path(ctx, m.mdl.map(pp));
  const p2 = sec >= plan.t2;
  ctx.setLineDash([18, 10]);
  glowStroke(ctx, p2 ? GREEN : '#ffffff', 3, p2 ? '#d9ffe2' : '#ffffff', 0.8);
  ctx.setLineDash([]);
};

const mass = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  if (sec < plan.massAt) return;
  const drift = clamp01((sec - plan.routesAt) / 30) * 0.035;
  const hot = fade(sec, plan.thermalAt, 0.8);
  plan.dots.forEach((d) => {
    const k = fade(sec, d.onset, 0.3);
    if (k <= 0) return;
    const lat = Math.max(mdlLat(m.mdl, d.lng) + 0.02, d.lat - drift);
    const [x, y] = pp([d.lng, lat]);
    if (x < -10 || x > MAP_W + 10 || y < 0 || y > MAP_H) return;
    const blink = 0.65 + 0.35 * Math.sin(sec * 5 + d.seed);
    if (hot > 0) {
      // 열화상: 체온이 하얗게 빛남 (주황 테두리 → 흰 심)
      circle(ctx, x, y, 9 * hot, 'rgba(255,150,40,0.35)', k);
      circle(ctx, x, y, 5, hot > 0.5 ? '#ffffff' : '#ffd9a0', k);
    } else {
      circle(ctx, x, y, 6, 'rgba(255,59,48,0.3)', k * blink);
      circle(ctx, x, y, 4.2, RED, k);
    }
  });
};

const corps = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  const a = fade(sec, plan.corpsAt) * (1 - fade(sec, plan.airAt, 0.6));
  if (a <= 0) return;
  const [x, y] = pp(m.corps.pos);
  const r = 18 + ((sec * 30) % 30);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  glowStroke(ctx, RED, 3, RED, a * (1 - (r - 18) / 30));
  circle(ctx, x, y, 14, '#000', a);
  circle(ctx, x, y, 10, RED, a);
  // 11군단 → 휴전선 북쪽 집결지로 남하 화살표 3줄기
  const [w, s, e] = m.massBox;
  const q = clamp01((sec - plan.corpsAt - 0.3) / 1.6);
  [w + 0.2, (w + e) / 2, e - 0.3].forEach((lng, i) => {
    const to: LngLat = [lng, mdlLat(m.mdl, lng) + 0.12 + 0 * s];
    dashed(ctx, partial(pp, [m.corps.pos, to], q), RED, 2.6, a * 0.9, 60, sec + i);
  });
  tag(ctx, x + 40, y - 40, m.corps.label, 36, RED, a);
};

const air = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  // 세 갈래 예고 (옅은 점선) → 각자 큐에서 진하게
  const pre = fade(sec, plan.routesAt) * 0.35;
  const on = fade(sec, plan.airAt);
  const vis = 1 - fade(sec, plan.aaAt, 0.5) * 0.6;
  if (pre + on <= 0) return;
  const q = clamp01((sec - plan.airAt) / 5);
  m.an2Routes.forEach((r, ri) => {
    dashed(ctx, r.map(pp), RED, 2, pre * (1 - on) * vis, 0);
    if (on <= 0) return;
    dashed(ctx, partial(pp, r, q), RED, 3, on * vis, 70, sec);
    if (sec >= plan.aaAt) return; // 2단계 대공 장면에서 다시 날아옴
    const {ll, i} = along(r, q);
    const [x, y] = pp(ll);
    const [ax, ay] = pp(r[i]);
    const [bx, by] = pp(r[i + 1]);
    biplane(ctx, x, y + Math.sin(sec * 6 + ri) * 2, Math.atan2(by - ay, bx - ax), 21, '#ff8a80');
  });
  const [lx, ly] = pp(m.an2Routes[0][1]);
  tag(ctx, lx - 40, ly - 50, m.airLabel, 34, RED, on * (1 - fade(sec, plan.seaAt, 0.5)));
};

const sea = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  const pre = fade(sec, plan.routesAt) * 0.35;
  const on = fade(sec, plan.seaAt);
  if (pre + on <= 0) return;
  const q = clamp01((sec - plan.seaAt) / 4.5);
  m.seaRoutes.forEach((r, ri) => {
    dashed(ctx, r.map(pp), RED, 2, pre * (1 - on), 0);
    if (on <= 0) return;
    dashed(ctx, partial(pp, r, q), RED, 3, on, 90, sec);
    const {ll, i} = along(r, q);
    const [x, y] = pp(ll);
    const [ax, ay] = pp(r[i]);
    const [bx, by] = pp(r[i + 1]);
    const ang = Math.atan2(by - ay, bx - ax);
    // 뒤로 퍼지는 물보라 링
    for (let k = 0; k < 3; k++) {
      const ph = ((sec * 1.6 + k / 3 + ri) % 1);
      ctx.beginPath();
      ctx.arc(x - Math.cos(ang) * ph * 40, y - Math.sin(ang) * ph * 40, 6 + ph * 14, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = on * (1 - ph) * 0.5;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    hovercraft(ctx, x, y, ang, 19, '#ff8a80');
    if (sec < plan.tunnelAt) tag(ctx, x + (ri ? -40 : 40), y + 56, m.seaLabel, 32, RED, on);
  });
};

const tunnels = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  const pre = fade(sec, plan.routesAt) * 0.35;
  const on = fade(sec, plan.tunnelAt);
  if (pre + on <= 0) return;
  const q = clamp01((sec - plan.tunnelAt - 0.2) / 1.8);
  m.tunnels.forEach((t, i) => {
    const lat0 = mdlLat(m.mdl, t[0]);
    const a: LngLat = [t[0] + 0.02, lat0 + 0.1];
    const b: LngLat = [t[0] - 0.01, lat0 - 0.07]; // 연출상 과장한 길이
    const A = pp(a);
    const B = pp(b);
    path(ctx, [A, B]);
    ctx.setLineDash([5, 7]);
    glowStroke(ctx, RED, 2, '#ffd0cc', pre * (1 - on));
    ctx.setLineDash([]);
    if (on <= 0) return;
    const qi = clamp01(q - i * 0.08);
    const H: [number, number] = [A[0] + (B[0] - A[0]) * qi, A[1] + (B[1] - A[1]) * qi];
    path(ctx, [A, H]);
    ctx.setLineDash([5, 7]);
    glowStroke(ctx, RED, 3.2, '#ffd0cc', on);
    ctx.setLineDash([]);
    circle(ctx, A[0], A[1], 7, RED, on); // 입구
    circle(ctx, H[0], H[1], 9 + Math.sin(sec * 14 + i) * 2, '#ff8a80', on); // 굴착 선단
  });
  const [x, y] = pp(m.tunnels[1]);
  tag(ctx, x, y - 70, m.tunnelLabel, 34, RED, on * (1 - fade(sec, plan.t2, 0.4)));
};

const fan = (ctx: C, pp: P, c: LngLat, km: number, bearing: number, spread: number) =>
  path(ctx, [pp(c), ...geoCircle(c, km, 18, bearing - spread / 2, bearing + spread / 2).map(pp)], true);

const tods = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  const on = fade(sec, plan.todAt, 0.5);
  if (on <= 0) return;
  m.tods.forEach((t, i) => {
    const k = fade(sec, plan.todAt + i * 0.12, 0.4);
    const grow = 0.3 + 0.7 * k;
    fan(ctx, pp, t.pos, m.todKm * grow, t.bearing, 70);
    ctx.globalAlpha = 0.18 * k;
    ctx.fillStyle = GREEN;
    ctx.fill();
    ctx.globalAlpha = 1;
    glowStroke(ctx, GREEN, 2, '#d9ffe2', 0.75 * k);
    // 좌우로 훑는 스캔 선
    const sw = t.bearing + Math.sin(sec * 1.8 + i) * 33;
    path(ctx, [pp(t.pos), pp(geoCircle(t.pos, m.todKm * grow, 1, sw, sw)[0])]);
    glowStroke(ctx, GREEN, 2.6, '#ffffff', 0.9 * k);
    const [x, y] = pp(t.pos);
    ctx.globalAlpha = k;
    ctx.fillStyle = GREEN;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.strokeRect(x - 9, y - 9, 18, 18);
    ctx.globalAlpha = 1;
  });
  tag(ctx, MAP_W / 2, MAP_H - 170, sec >= plan.thermalAt ? m.thermalLabel : m.todLabel, 38, sec >= plan.thermalAt ? '#ffffff' : GREEN,
    on * (1 - fade(sec, plan.sensorAt - 0.2, 0.3)));
};

/** TOD 부채꼴 안의 침투 병력에 노란 포착 박스 */
const detections = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  if (sec < plan.todAt + 0.5) return;
  const drift = clamp01((sec - plan.routesAt) / 30) * 0.035;
  let n = 0;
  plan.dots.forEach((d) => {
    if (n >= 14 || rand(d.seed * 5.3) > 0.5) return;
    const lat = Math.max(mdlLat(m.mdl, d.lng) + 0.02, d.lat - drift);
    const inFan = m.tods.some((t) => {
      const dx = (d.lng - t.pos[0]) * 111 * Math.cos((lat * Math.PI) / 180);
      const dy = (lat - t.pos[1]) * 111;
      const dist = Math.hypot(dx, dy);
      const brg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
      const diff = Math.abs(((brg - t.bearing + 540) % 360) - 180);
      return dist < m.todKm && diff < 35;
    });
    if (!inFan) return;
    const at = plan.todAt + 0.6 + n * 0.22;
    n++;
    const k = fade(sec, at, 0.15);
    if (k <= 0) return;
    const [x, y] = pp([d.lng, lat]);
    const r = 16 + (1 - k) * 14;
    ctx.globalAlpha = k;
    ctx.strokeStyle = YEL;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  });
};

const sensors = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  const on = fade(sec, plan.sensorAt, 0.5);
  if (on <= 0) return;
  const [w, e] = [m.mdl[0][0], m.mdl[m.mdl.length - 1][0]];
  const alarm = sec >= plan.alarmAt;
  let i = 0;
  for (let lng = w; lng <= e; lng += 0.045, i++) {
    const k = fade(sec, plan.sensorAt + (lng - w) * 0.6, 0.2);
    if (k <= 0) continue;
    const [x, y] = pp([lng, mdlLat(m.mdl, lng) - 0.03]);
    const trig = alarm && rand(i * 2.7) < 0.28;
    const blink = 0.5 + 0.5 * Math.sin(sec * 8 + i);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = k;
    ctx.fillStyle = trig ? RED : GREEN;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (trig) {
      const ph = (sec - plan.alarmAt + rand(i) * 0.6) % 0.9;
      if (ph > 0) {
        ctx.beginPath();
        ctx.arc(x, y, 8 + ph * 40, 0, Math.PI * 2);
        glowStroke(ctx, RED, 2.4, '#ffd0cc', (1 - ph / 0.9) * blink);
      }
    }
  }
  const lab = alarm ? m.alarmLabel : m.sensorLabel;
  const pulse = alarm ? 0.65 + 0.35 * Math.sin(sec * 9) : 1;
  tag(ctx, MAP_W / 2, MAP_H - 170, lab, alarm ? 44 : 38, alarm ? RED : GREEN, on * pulse * (1 - fade(sec, plan.aaAt - 0.2, 0.3)));
};

const antiAir = (ctx: C, pp: P, ep: Episode, plan: InfilPlan, sec: number) => {
  const m = ep.map.infil!;
  const on = fade(sec, plan.aaAt - 0.3, 0.5);
  if (on <= 0) return;
  m.aaSites.forEach((s, i) => {
    const k = fade(sec, plan.aaAt - 0.3 + i * 0.12, 0.4);
    path(ctx, geoCircle(s, m.aaKm * (0.4 + 0.6 * k), 40).map(pp), true);
    ctx.globalAlpha = 0.16 * k;
    ctx.fillStyle = GREEN;
    ctx.fill();
    ctx.globalAlpha = 1;
    glowStroke(ctx, GREEN, 2.2, '#d9ffe2', 0.85 * k);
    const [x, y] = pp(s);
    circle(ctx, x, y, 11, '#000', k);
    circle(ctx, x, y, 7, GREEN, k);
  });
  // AN-2가 다시 남하 → 화망 진입 → 예광탄 → 격추
  const killAt = plan.netAt + 1.4;
  m.an2Routes.forEach((r, ri) => {
    const q = 0.55 + 0.45 * clamp01((sec - plan.aaAt) / Math.max(0.8, killAt - plan.aaAt));
    const {ll, i} = along(r, q);
    const [x, y] = pp(ll);
    const [ax, ay] = pp(r[i]);
    const [bx, by] = pp(r[i + 1]);
    const dead = fade(sec, killAt + ri * 0.25, 0.2);
    if (dead < 1) biplane(ctx, x, y, Math.atan2(by - ay, bx - ax), 21, '#ff8a80');
    if (sec >= plan.netAt && dead < 1) {
      // 가장 가까운 방공 진지 2곳에서 예광탄
      const near = [...m.aaSites].sort((a, b) => Math.hypot(a[0] - ll[0], a[1] - ll[1]) - Math.hypot(b[0] - ll[0], b[1] - ll[1])).slice(0, 2);
      near.forEach((s, j) => {
        const [sx, sy] = pp(s);
        for (let k = 0; k < 4; k++) {
          const ph = (sec * 3 + k / 4 + j * 0.37) % 1;
          const tx = sx + (x - sx) * ph;
          const ty = sy + (y - sy) * ph;
          path(ctx, [[tx, ty], [tx + (x - sx) * 0.08, ty + (y - sy) * 0.08]]);
          glowStroke(ctx, YEL, 2.4, '#ffffff', 0.95);
        }
      });
    }
    if (dead > 0) {
      circle(ctx, x, y, 34 * dead, 'rgba(255,190,80,0.5)', 1 - fade(sec, killAt + ri * 0.25 + 0.5, 0.5));
      bigX(ctx, x, y, 22, dead);
    }
  });
  tag(ctx, MAP_W / 2, MAP_H - 170, m.aaLabel, 38, GREEN, on * (1 - fade(sec, plan.finalAt - 0.2, 0.3)));
};

const scanlines = (ctx: C, sec: number, plan: InfilPlan) => {
  const g = fade(sec, plan.t2, 0.5);
  if (g <= 0) return;
  // 전환 순간 흰 섬광
  const flash = 1 - clamp01((sec - plan.t2) / 0.35);
  if (flash > 0) {
    ctx.globalAlpha = 0.55 * flash;
    ctx.fillStyle = '#e8ffe9';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
  ctx.globalAlpha = 0.07 * g;
  ctx.fillStyle = '#000';
  const off = Math.floor(sec * 40) % 6;
  for (let y = off; y < MAP_H; y += 6) ctx.fillRect(0, y, MAP_W, 2);
  ctx.globalAlpha = 1;
  // 야시경 모서리 표시
  ctx.globalAlpha = g * 0.9;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 4;
  const L = 60;
  const [x0, y0, x1, y1] = [24, 200, MAP_W - 24, MAP_H - 140]; // 위쪽은 상단 카드(화면 Y 560까지)에 가려지지 않게
  path(ctx, [[x0, y0 + L], [x0, y0], [x0 + L, y0]]); ctx.stroke();
  path(ctx, [[x1 - L, y0], [x1, y0], [x1, y0 + L]]); ctx.stroke();
  path(ctx, [[x0, y1 - L], [x0, y1], [x0 + L, y1]]); ctx.stroke();
  path(ctx, [[x1 - L, y1], [x1, y1], [x1, y1 - L]]); ctx.stroke();
  ctx.font = '900 26px Pretendard';
  ctx.textAlign = 'left';
  ctx.fillStyle = GREEN;
  if (Math.floor(sec * 2) % 2 === 0) ctx.fillText('● REC  THERMAL', x0 + 14, y0 + 40);
  ctx.globalAlpha = 1;
};

export const drawInfiltration = (ctx: C, sec: number, ep: Episode, plan: InfilPlan, pp: P) => {
  mdlLine(ctx, pp, ep, plan, sec);
  ep.map.labels.forEach((l) => {
    if (l.phase === 1 && sec >= plan.t2) return;
    if (l.phase === 2 && sec < plan.t2) return;
    const [x, y] = pp(l.pos);
    if (x < -50 || x > MAP_W + 50 || y < 150 || y > MAP_H - 150) return;
    label(ctx, clampX(x, 90), y, l.text, l.size, '#fff');
  });
  tunnels(ctx, pp, ep, plan, sec);
  tods(ctx, pp, ep, plan, sec);
  sensors(ctx, pp, ep, plan, sec);
  mass(ctx, pp, ep, plan, sec);
  detections(ctx, pp, ep, plan, sec);
  corps(ctx, pp, ep, plan, sec);
  sea(ctx, pp, ep, plan, sec);
  air(ctx, pp, ep, plan, sec);
  antiAir(ctx, pp, ep, plan, sec);
  // 마지막 질문: 적 침투선과 아군 감시망을 함께 고정
  const f = fade(sec, plan.finalAt) * (1 - fade(sec, plan.endAt - 0.2, 0.3));
  tag(ctx, MAP_W / 2, MAP_H - 170, ep.map.infil!.finalLabel, 42, YEL, f);
  scanlines(ctx, sec, plan);
};
