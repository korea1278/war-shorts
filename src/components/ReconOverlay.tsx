// 정찰 공백 동적 레이어 (EP09~) — Canvas 2D, 블러·필터 없음
import {MAP_H, MAP_W} from '../lib/camera';
import {cellClear, ReconPlan, SAT_LAT0, SAT_LAT1, satTrackLon} from '../lib/recon';
import {clamp01} from '../lib/schedule';
import {COLORS, Episode, LngLat} from '../lib/types';
import {circle, geoCircle, glowStroke, label, path} from './MapOverlay';
import {jetGlyph} from './AirOverlay';

type C = CanvasRenderingContext2D;
type P = (ll: LngLat) => [number, number];
const CYAN = '#00e5ff';
const RED = '#FF3B30';
const YEL = '#FFE500';
const clampX = (x: number, w = 200) => Math.min(MAP_W - w, Math.max(w, x));
const clampY = (y: number) => Math.min(MAP_H - 60, Math.max(240, y));
const fade = (sec: number, at: number, d = 0.4) => clamp01((sec - at) / d);

const bigX = (ctx: C, x: number, y: number, r: number, a: number) => {
  if (a <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  glowStroke(ctx, RED, 5, '#ffd0cc', a);
};

const tag = (ctx: C, x: number, y: number, text: string, size: number, color: string, a = 1) => {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  label(ctx, clampX(x), clampY(y), text, size, color);
  ctx.globalAlpha = 1;
};

const net = (ctx: C, pp: P, ep: Episode, plan: ReconPlan, sec: number) => {
  const r = ep.map.recon!;
  const on = fade(sec, 0.1, 0.6);
  const off = 1 - fade(sec, plan.linkAt + 0.3, 1.3);
  if (on * off <= 0) return;
  const lost = fade(sec, plan.u2At, 0.8);
  r.hubs.forEach((h, hi) => {
    const col = lost > 0.5 ? RED : CYAN;
    [1, 0.66, 0.33].forEach((m, i) => {
      if (hi && i) return;
      path(ctx, geoCircle(h.pos, r.netKm * m * (hi ? 0.62 : 1), 56).map(pp));
      glowStroke(ctx, col, i ? 1.6 : 2.6, col, on * off * (i ? 0.5 : 0.85));
    });
  });
  // 회전 스윕 (오산 중심)
  const a0 = (sec * 80) % 360;
  const h = r.hubs[0].pos;
  for (let k = 0; k < 7; k++) {
    const pts = [pp(h), ...geoCircle(h, r.netKm, 6, a0 - k * 6 - 6, a0 - k * 6).map(pp)];
    path(ctx, pts, true);
    ctx.globalAlpha = on * off * 0.2 * (1 - k / 7);
    ctx.fillStyle = lost > 0.5 ? RED : CYAN;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const hubs = (ctx: C, pp: P, ep: Episode) => {
  ep.map.recon!.hubs.forEach((h) => {
    const [x, y] = pp(h.pos);
    circle(ctx, x, y, 13, '#000');
    circle(ctx, x, y, 9, '#fff');
    if (h.name) tag(ctx, x + (h.labelDx ?? 0), y + (h.labelDy ?? -30), h.name, 32, '#fff');
  });
};

const fighters = (ctx: C, pp: P, ep: Episode, plan: ReconPlan, sec: number) => {
  const r = ep.map.recon!;
  const [ax, ay] = pp(r.f16.from);
  const [bx, by] = pp(r.f16.to);
  const a = Math.atan2(by - ay, bx - ax);
  const q = clamp01((sec - plan.f16At) / 3.2);
  const e = q * q;
  for (let i = 0; i < 4; i++) {
    const ox = ((i % 2) * 2 - 1) * (18 + i * 16);
    const oy = i * 22 - 26;
    const x = ax + (bx - ax) * Math.max(0, e - i * 0.02) + ox;
    const y = ay + (by - ay) * Math.max(0, e - i * 0.02) + oy;
    if (q >= 1) continue;
    if (q > 0) {
      path(ctx, [[x, y], [x - Math.cos(a) * 170 * Math.min(1, q * 3), y - Math.sin(a) * 170 * Math.min(1, q * 3)]]);
      glowStroke(ctx, COLORS.rokLight, 2.4, '#ffffff', 0.7);
    }
    jetGlyph(ctx, x, y, a, 21, COLORS.rokLight);
  }
  const k = fade(sec, plan.f16At) * (1 - fade(sec, plan.f16At + 3.4));
  tag(ctx, bx - 120, by + 66, r.f16.label, 34, YEL, k);
  // 에이텐: 이미 떠난 자리 표시
  const ka = fade(sec, plan.a10At) * (1 - fade(sec, plan.t2 - 0.5));
  if (ka > 0) {
    const [x, y] = pp(r.a10.pos);
    jetGlyph(ctx, x, y, -Math.PI / 2, 26, 'rgba(180,190,200,0.55)');
    bigX(ctx, x, y, 34, ka);
    tag(ctx, x - 30, y + 84, r.a10.label, 32, '#d7dde4', ka);
  }
  // 다연장로켓 진지 소멸
  const km = fade(sec, plan.mlrsAt);
  if (km > 0) {
    r.mlrs.forEach((m, i) => {
      const gone = fade(sec, plan.mlrsAt + 1.1 + i * 0.25, 0.5);
      const [x, y] = pp(m.pos);
      ctx.globalAlpha = km * (1 - gone * 0.75);
      ctx.fillStyle = COLORS.rokLight;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.fillRect(x - 24, y - 12, 48, 24);
      ctx.strokeRect(x - 24, y - 12, 48, 24);
      ctx.fillStyle = '#04223f';
      for (let k = 0; k < 3; k++) ctx.fillRect(x - 17 + k * 13, y - 7, 8, 14);
      ctx.globalAlpha = 1;
      bigX(ctx, x, y, 28, gone * (1 - fade(sec, plan.t2 - 0.5)));
    });
    const [x, y] = pp(r.mlrs[0].pos);
    tag(ctx, x + 250, y + 74, r.mlrsLabel, 34, YEL, km * (1 - fade(sec, plan.t2 - 0.5)));
  }
};

const intel = (ctx: C, pp: P, ep: Episode, plan: ReconPlan, sec: number) => {
  const r = ep.map.recon!;
  const hub = pp(r.hubs[0].pos);
  // 유투 정찰기: 휴전선 상공 왕복 → 멈춤
  const track = r.u2Track;
  const fin = plan.u2At + 0.9;
  const tt = Math.min(sec, fin);
  const ph = (tt * 0.1) % 2;
  const u = ph < 1 ? ph : 2 - ph;
  const m = u * (track.length - 1);
  const i = Math.min(track.length - 2, Math.floor(m));
  const f = m - i;
  const ll: LngLat = [track[i][0] + (track[i + 1][0] - track[i][0]) * f, track[i][1] + (track[i + 1][1] - track[i][1]) * f];
  const [x, y] = pp(ll);
  const gone = fade(sec, fin, 0.5);
  const vis = 1 - fade(sec, plan.blindAt, 0.6);
  if (vis > 0) {
    path(ctx, track.map(pp));
    ctx.setLineDash([12, 12]);
    glowStroke(ctx, gone > 0 ? RED : '#ffffff', 2, gone > 0 ? RED : '#ffffff', 0.55 * vis);
    ctx.setLineDash([]);
    if (gone < 1) {
      path(ctx, [[x, y], hub]);
      ctx.setLineDash([8, 10]);
      ctx.lineDashOffset = -sec * 60;
      glowStroke(ctx, CYAN, 2.2, '#c9fbff', 0.8 * (1 - gone));
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    jetGlyph(ctx, x, y, ph < 1 ? 0 : Math.PI, 27, gone > 0 ? RED : '#ffffff');
    if (sec < plan.mlrsAt || sec >= plan.t2) tag(ctx, x, y - 54, gone > 0 ? '유투 정찰 중단' : r.u2Label, 32, gone > 0 ? RED : '#fff', vis);
  }
  // 미군 위성 데이터 링크
  const cut = fade(sec, plan.linkAt + 0.5, 0.2);
  const lv = 1 - fade(sec, plan.linkAt + 1.8, 0.5);
  if (lv > 0) {
    const S: [number, number] = [MAP_W - 150, 262];
    const midX = S[0] + (hub[0] - S[0]) * (cut ? 0.5 : 1);
    const midY = S[1] + (hub[1] - S[1]) * (cut ? 0.5 : 1);
    path(ctx, [S, [midX, midY]]);
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -sec * 90;
    glowStroke(ctx, cut ? RED : CYAN, 3, cut ? '#ffd0cc' : '#c9fbff', lv);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    circle(ctx, S[0], S[1], 15, cut ? RED : CYAN, lv);
    if (sec >= plan.linkAt) tag(ctx, S[0] - 60, S[1] + 62, cut ? '데이터 링크 단절' : '미군 위성 데이터 링크', 32, cut ? RED : CYAN, lv);
    if (cut) bigX(ctx, midX, midY, 30, lv);
  }
};

const blind = (ctx: C, pp: P, ep: Episode, plan: ReconPlan, sec: number) => {
  if (sec < plan.blindAt) return;
  const r = ep.map.recon!;
  plan.cells.forEach((c) => {
    const k = fade(sec, c.onset, 0.22);
    if (k <= 0) return;
    const clear = cellClear(plan, c.lng + c.w / 2, c.lat + c.h / 2, sec);
    const a = k * 0.94 * (1 - clear * 0.92);
    if (a <= 0.01) return;
    const pts = [[c.lng, c.lat], [c.lng + c.w, c.lat], [c.lng + c.w, c.lat + c.h], [c.lng, c.lat + c.h]].map((q) => pp(q as LngLat));
    path(ctx, pts, true);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000';
    ctx.fill();
    const flash = 1 - clamp01((sec - c.onset) / 0.5);
    ctx.globalAlpha = Math.max(0.1, flash * 0.9) * k * (1 - clear);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  const pulse = 0.7 + 0.3 * Math.sin(sec * 7);
  const gapBoost = sec >= plan.gapAt;
  tag(ctx, MAP_W / 2, 240, gapBoost ? r.gapLabel : r.blindLabel, gapBoost ? 46 : 40, RED, fade(sec, plan.blindAt + 0.8) * pulse);
};

const hidden = (ctx: C, pp: P, ep: Episode, plan: ReconPlan, sec: number) => {
  const r = ep.map.recon!;
  if (sec < plan.hiddenAt) return;
  r.hidden.forEach((h, i) => {
    const at = plan.hiddenAt + i * 0.55;
    const k = fade(sec, at, 0.25);
    if (k <= 0) return;
    const [x, y] = pp(h.pos);
    const blink = 0.55 + 0.45 * Math.sin(sec * 9 + i);
    path(ctx, geoCircle(h.pos, 14 + ((sec * 16 + i * 5) % 16), 24).map(pp));
    glowStroke(ctx, RED, 2.2, RED, k * blink);
    ctx.globalAlpha = k;
    ctx.font = '900 56px Pretendard';
    ctx.textAlign = 'center';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#000';
    ctx.strokeText('?', x, y + 20);
    ctx.fillStyle = RED;
    ctx.fillText('?', x, y + 20);
    ctx.globalAlpha = 1;
  });
  const k = fade(sec, plan.hiddenAt + 0.6) * (1 - fade(sec, plan.satAt - 0.2));
  tag(ctx, MAP_W / 2, MAP_H - 150, r.hiddenLabel, 38, YEL, k);
};

const sats = (ctx: C, pp: P, ep: Episode, plan: ReconPlan, sec: number) => {
  const r = ep.map.recon!;
  if (sec < plan.satAt) return;
  plan.passes.forEach((s, i) => {
    const on = fade(sec, plan.satAt + i * 0.12, 0.35);
    const line: LngLat[] = [];
    for (let k = 0; k <= 12; k++) {
      const lat = SAT_LAT0 + ((SAT_LAT1 - SAT_LAT0) * k) / 12;
      line.push([satTrackLon(s.lon0, lat), lat]);
    }
    path(ctx, line.map(pp));
    ctx.setLineDash([6, 12]);
    glowStroke(ctx, YEL, 1.8, YEL, on * 0.65);
    ctx.setLineDash([]);
    const q = (sec - s.start) / s.dur;
    if (q >= 0 && q <= 1) {
      const lat = SAT_LAT0 + (SAT_LAT1 - SAT_LAT0) * q;
      const [x, y] = pp([satTrackLon(s.lon0, lat), lat]);
      circle(ctx, x, y, 26, 'rgba(255,229,0,0.28)');
      ctx.fillStyle = YEL;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.strokeRect(x - 9, y - 9, 18, 18);
      ctx.fillStyle = CYAN;
      ctx.fillRect(x - 32, y - 5, 20, 10);
      ctx.fillRect(x + 12, y - 5, 20, 10);
    }
  });
  const k = fade(sec, plan.satAt + 0.2) * (1 - fade(sec, plan.gapAt - 0.2));
  tag(ctx, MAP_W / 2, MAP_H - 150, sec >= plan.revisitAt ? r.revisitLabel : r.satLabel, 38, YEL, k);
};

export const drawRecon = (ctx: C, sec: number, ep: Episode, plan: ReconPlan, pp: P) => {
  net(ctx, pp, ep, plan, sec);
  ep.map.labels.forEach((l) => {
    if (l.phase === 1 && sec >= plan.t2) return;
    if (l.phase === 2 && sec < plan.t2) return;
    const [x, y] = pp(l.pos);
    if (x < -50 || x > MAP_W + 50 || y < 180 || y > MAP_H) return;
    label(ctx, clampX(x, 90), y, l.text, l.size, '#fff');
  });
  fighters(ctx, pp, ep, plan, sec);
  intel(ctx, pp, ep, plan, sec);
  blind(ctx, pp, ep, plan, sec);
  hidden(ctx, pp, ep, plan, sec);
  sats(ctx, pp, ep, plan, sec);
  hubs(ctx, pp, ep);
};
