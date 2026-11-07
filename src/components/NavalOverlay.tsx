// 해상 항모전 동적 레이어 (EP08~) — Canvas 2D, 블러·필터 없음 (발광은 굵은 반투명 선 3단)
import {MAP_H, MAP_W} from '../lib/camera';
import {fleetProgress, NavalPlan, shipPos} from '../lib/naval';
import {alongPath} from '../lib/armor';
import {clamp01, rand} from '../lib/schedule';
import {COLORS, Episode, LngLat} from '../lib/types';
import {circle, FLASH2, geoCircle, glowStroke, label, path, radial} from './MapOverlay';
import {jetGlyph} from './AirOverlay';

type C = CanvasRenderingContext2D;
type P = (ll: LngLat) => [number, number];
type XY = [number, number];

const off = (x: number, y: number, m = 160) => x < -m || x > MAP_W + m || y < -m || y > MAP_H + m;
const clampX = (x: number, w = 220) => Math.min(MAP_W - w, Math.max(w, x));
const ang = (pp: P, a: LngLat, b: LngLat) => {
  const A = pp(a);
  const B = pp(b);
  return Math.atan2(B[1] - A[1], B[0] - A[0]);
};

/** 함정 실루엣 (항모는 넓은 비행갑판, 호위함은 날렵한 선체) */
const shipGlyph = (ctx: C, x: number, y: number, a: number, s: number, fill: string, carrier: boolean) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  if (carrier) {
    ctx.moveTo(s * 1.5, -s * 0.12);
    ctx.lineTo(s * 1.1, -s * 0.42);
    ctx.lineTo(-s * 1.3, -s * 0.42);
    ctx.lineTo(-s * 1.4, -s * 0.2);
    ctx.lineTo(-s * 1.4, s * 0.3);
    ctx.lineTo(s * 0.9, s * 0.36);
    ctx.lineTo(s * 1.5, s * 0.1);
  } else {
    ctx.moveTo(s * 1.3, 0);
    ctx.lineTo(s * 0.4, -s * 0.28);
    ctx.lineTo(-s * 1.1, -s * 0.24);
    ctx.lineTo(-s * 1.1, s * 0.24);
    ctx.lineTo(s * 0.4, s * 0.28);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
  if (carrier) {
    // 함교(아일랜드) + 비행갑판 중앙선
    ctx.fillStyle = '#2a0000';
    ctx.fillRect(s * 0.1, s * 0.12, s * 0.42, s * 0.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(-s * 1.2, -s * 0.05);
    ctx.lineTo(s * 1.2, -s * 0.05);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
};

/** 잠수함 실루엣 */
const subGlyph = (ctx: C, x: number, y: number, s: number, fill: string) => {
  ctx.beginPath();
  ctx.ellipse(x, y, s * 1.4, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fillRect(x - s * 0.15, y - s * 0.62, s * 0.4, s * 0.36);
  ctx.strokeRect(x - s * 0.15, y - s * 0.62, s * 0.4, s * 0.36);
};

const bigX = (ctx: C, x: number, y: number, s: number, alpha: number) => {
  ctx.beginPath();
  ctx.moveTo(x - s, y - s);
  ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y - s);
  ctx.lineTo(x - s, y + s);
  glowStroke(ctx, '#FF3B30', 9, '#ff9a94', alpha);
};

/** 다각형 빗금 채우기 (clip → 대각선) */
const hatch = (ctx: C, pts: XY[], color: string, gap: number, width: number, alpha: number, shift = 0) => {
  if (alpha <= 0) return;
  ctx.save();
  path(ctx, pts, true);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let x = -MAP_H + (shift % gap); x < MAP_W + MAP_H; x += gap) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + MAP_H, MAP_H);
  }
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
};

const ellipseLL = (c: LngLat, rx: number, ry: number, n = 48): LngLat[] => {
  const out: LngLat[] = [];
  const dLng = rx / (111 * Math.cos((c[1] * Math.PI) / 180));
  const dLat = ry / 111;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([c[0] + Math.cos(a) * dLng, c[1] + Math.sin(a) * dLat]);
  }
  return out;
};

const shotColor = (k: 'base' | 'fleet' | 'slam') => (k === 'base' ? COLORS.chunmoo : k === 'fleet' ? COLORS.rokLight : COLORS.yellow);

export const drawNaval = (ctx: C, sec: number, ep: Episode, plan: NavalPlan, pp: P) => {
  const n = ep.map.naval!;
  const p2 = sec >= plan.t2;

  // ── 얕은 서해: 수심 음영 + 등심선 빗금 (1단계 내내, 2단계엔 옅게) ──
  const seaPts = n.sea.map(pp);
  const dk = clamp01((sec - plan.depthAt) / 0.8) * (p2 ? 0.5 : 1);
  if (dk > 0) {
    path(ctx, seaPts, true);
    ctx.globalAlpha = 0.16 * dk;
    ctx.fillStyle = '#00c8ff';
    ctx.fill();
    ctx.globalAlpha = 1;
    hatch(ctx, seaPts, 'rgba(160,235,255,1)', 26, 2, 0.22 * dk, sec * 8);
    path(ctx, seaPts, true);
    ctx.setLineDash([12, 10]);
    glowStroke(ctx, '#00c8ff', 2.5, '#bff3ff', 0.7 * dk);
    ctx.setLineDash([]);
    const [x, y] = pp(n.depthLabelPos);
    if (!off(x, y, 0) && !p2) {
      ctx.globalAlpha = dk * (0.85 + 0.15 * Math.sin(sec * 4));
      label(ctx, clampX(x, 240), y, n.depthLabel ?? '평균 수심 44m · 얕은 바다', 36, '#7fe6ff');
      ctx.globalAlpha = 1;
    }
  }

  // ── 서해 중간선 (흰 점선) ──
  const mk = clamp01((sec - 1.0) / 0.8);
  path(ctx, n.medianLine.map(pp));
  ctx.setLineDash([22, 14]);
  ctx.lineDashOffset = -sec * 30;
  glowStroke(ctx, '#ffffff', 3, '#ffffff', 0.85 * mk);
  ctx.setLineDash([]);
  const ml = pp(n.medianLine[0]);
  if (!off(ml[0], ml[1], 0) && mk > 0) {
    ctx.globalAlpha = mk;
    label(ctx, clampX(ml[0], 160), Math.max(150, ml[1] + 40), n.medianLabel ?? '서해 중간선', 30, '#ffffff');
    ctx.globalAlpha = 1;
  }

  // 지명 라벨
  ep.map.labels
    .filter((l) => l.phase === 0 || (l.phase === 2 && p2) || (l.phase === 1 && !p2))
    .forEach((l) => {
      const [x, y] = pp(l.pos);
      if (off(x, y, 0)) return;
      label(ctx, x, y - 30, l.text, l.size, '#ffe9a8');
    });

  // ── 킬존 (얕은 수심 → 대잠·회피 기동 불가) ──
  const kk = clamp01((sec - plan.killAt) / 0.6);
  if (kk > 0) {
    const kz = ellipseLL(n.killZone.center, n.killZone.rxKm, n.killZone.ryKm).map(pp);
    const pulse = 0.75 + 0.25 * Math.sin(sec * 6);
    const graveBlink = sec > plan.graveAt ? 0.6 + 0.4 * Math.sin(sec * 14) : 1;
    path(ctx, kz, true);
    ctx.globalAlpha = 0.16 * kk * graveBlink;
    ctx.fillStyle = '#FF3B30';
    ctx.fill();
    ctx.globalAlpha = 1;
    hatch(ctx, kz, '#FF3B30', 22, 4, 0.45 * kk * graveBlink, -sec * 20);
    path(ctx, kz, true);
    glowStroke(ctx, '#FF3B30', 4, '#ffb0ab', kk * pulse);
    const top = kz.reduce((a, b) => (b[1] < a[1] ? b : a));
    ctx.globalAlpha = kk * pulse * (p2 ? 1 - clamp01((sec - plan.t2) / 0.5) : 1);
    if (ctx.globalAlpha > 0) label(ctx, clampX(top[0], 260), Math.max(150, top[1] - 26), n.killZone.label ?? '킬존 · 대잠·회피 기동 불가', 34, '#ff6b62');
    ctx.globalAlpha = 1;
    // 잠수함: 수면 가까이 드러남 + 은신 불가
    n.subs.forEach((s, i) => {
      const [x, y] = pp(s);
      if (off(x, y)) return;
      const blink = 0.6 + 0.4 * Math.sin(sec * 8 + i);
      ctx.globalAlpha = kk;
      subGlyph(ctx, x, y, 20, '#b02020');
      ctx.globalAlpha = kk * blink;
      ctx.strokeStyle = COLORS.yellow;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 40, y - 24, 80, 44);
      ctx.globalAlpha = 1;
      if (i === 0) {
        ctx.globalAlpha = kk;
        label(ctx, clampX(x, 200), Math.min(MAP_H - 120, y + 62), '잠수함 은신 불가', 30, COLORS.yellow);
        ctx.globalAlpha = 1;
      }
    });
  }

  // ── 300km 초음속 타격권 (서해안 암벽 기지) ──
  const rk = clamp01((sec - plan.rangeAt) / 1.4);
  if (rk > 0) {
    const R = n.rangeKm * (1 - Math.pow(1 - rk, 2.2));
    n.bases.forEach((b, i) => {
      const ring = geoCircle(b.pos, R, 64).map(pp);
      path(ctx, ring, true);
      ctx.globalAlpha = (p2 ? 0.06 : 0.12) * (i ? 0.6 : 1);
      ctx.fillStyle = COLORS.rok;
      ctx.fill();
      ctx.globalAlpha = 1;
      glowStroke(ctx, COLORS.chunmoo, 3, '#c8f6ff', (p2 ? 0.55 : 0.95) * (i ? 0.7 : 1));
      for (let km = 100; km < R; km += 100) {
        path(ctx, geoCircle(b.pos, km, 48).map(pp), true);
        ctx.strokeStyle = 'rgba(160,240,255,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    if (rk >= 1 && !p2) {
      const lp = pp(geoCircle(n.bases[0].pos, n.rangeKm, 1, 300, 300)[0]);
      label(ctx, clampX(lp[0], 260), Math.max(150, lp[1]), n.rangeLabel ?? `초음속 타격권 ${n.rangeKm}km`, 36, '#00E5FF');
    }
  }
  // 암벽 기지 마커 (타격권 등장부터)
  if (sec > plan.rangeAt - 0.5) {
    const bk = clamp01((sec - plan.rangeAt + 0.5) / 0.5);
    n.bases.forEach((b, i) => {
      const [x, y] = pp(b.pos);
      if (off(x, y, 0)) return;
      ctx.globalAlpha = bk;
      ctx.fillStyle = COLORS.rok;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 18, y + 14);
      ctx.lineTo(x, y - 18);
      ctx.lineTo(x + 18, y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 2단계: 발사 섬광
      const lf = sec - plan.launchAt;
      if (lf > 0 && lf < 1.2) circle(ctx, x, y, 70 * (0.4 + lf), radial(ctx, x, y, 70 * (0.4 + lf), FLASH2), 1 - lf / 1.2);
      if (i === 0) label(ctx, clampX(x, 200), Math.min(MAP_H - 110, y + 60), b.name ?? '서해안 암벽 기지', 30, '#4da3ff');
      ctx.globalAlpha = 1;
    });
  }

  // ── 항모전단 항적 (붉은 점선 + 화살촉) ──
  const u = fleetProgress(plan, sec);
  const tk = clamp01(sec / 0.8) * (p2 ? 0.5 : 1);
  n.carriers.forEach((cv) => {
    const pts: XY[] = [];
    for (let i = 0; i <= 30; i++) pts.push(pp(alongPath(cv.path, (u * i) / 30).p));
    path(ctx, pts);
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -sec * 50;
    glowStroke(ctx, COLORS.nk, 4, '#ffb4b4', tk);
    ctx.setLineDash([]);
    // 진행 방향 화살표 (항적 앞쪽)
    if (!p2 && u < 0.995) {
      const head = pp(alongPath(cv.path, Math.min(1, u + 0.12)).p);
      const tail = pp(alongPath(cv.path, Math.min(1, u + 0.02)).p);
      const a = Math.atan2(head[1] - tail[1], head[0] - tail[0]);
      ctx.save();
      ctx.translate(head[0], head[1]);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(-14, -18);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-14, 18);
      ctx.closePath();
      ctx.fillStyle = COLORS.nk;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.globalAlpha = tk;
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  });

  // ── 함정 (항모 + 호위함) ──
  plan.ships.forEach((s, i) => {
    const hit = plan.hitAt[i];
    const now = shipPos(ep, plan, i, sec);
    const [x, y] = pp(now);
    if (off(x, y)) return;
    const cv = n.carriers[s.carrier];
    const a = ang(pp, alongPath(cv.path, Math.max(0, fleetProgress(plan, Math.min(sec, hit)) - 0.05)).p, alongPath(cv.path, Math.min(1, fleetProgress(plan, Math.min(sec, hit)) + 0.05)).p);
    const carrier = s.escort < 0;
    if (sec < hit) {
      // 항적 물보라
      circle(ctx, x, y, carrier ? 46 : 24, 'rgba(255,40,40,0.18)');
      shipGlyph(ctx, x, y, a, carrier ? 30 : 13, carrier ? '#ff3a3a' : '#d42a2a', carrier);
      if (carrier) label(ctx, clampX(x, 140), y - 52, cv.name, 30, '#ff8a8a');
      // 록온 박스 (자기 미사일 발사 후 명중 전까지)
      const lock = plan.shots.find((sh) => sh.ship === i && sec > sh.launch);
      if (lock) {
        const sz = carrier ? 54 : 30;
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(sec * 16 + i);
        ctx.strokeStyle = COLORS.yellow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          ctx.moveTo(x + sx * sz, y + sy * sz * 0.6);
          ctx.lineTo(x + sx * sz, y + sy * sz);
          ctx.lineTo(x + sx * sz * 0.6, y + sy * sz);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      const q = sec - hit;
      // 섬광 → 불덩이 → 파편, 이후 화염·연기 표식
      if (q < 1.0) {
        const r = (carrier ? 40 : 22) + (carrier ? 130 : 70) * Math.pow(q, 0.5);
        circle(ctx, x, y, r, radial(ctx, x, y, r, FLASH2), 1 - q);
        for (let k = 0; k < 8; k++) {
          const aa = (k / 8) * Math.PI * 2 + i;
          const d = 18 + (carrier ? 130 : 80) * q;
          circle(ctx, x + Math.cos(aa) * d, y + Math.sin(aa) * d + 30 * q * q, 6 * (1 - q), '#ffcf6a', 1 - q);
        }
        if (q < 0.12) circle(ctx, x, y, carrier ? 160 : 90, 'rgba(255,255,255,0.5)', 1 - q / 0.12);
      }
      const sink = clamp01(1 - q / 6);
      ctx.globalAlpha = 0.25 + 0.5 * sink;
      shipGlyph(ctx, x, y, a + 0.25, carrier ? 30 : 13, '#3a1a1a', carrier);
      ctx.globalAlpha = 1;
      const fl = 0.7 + 0.3 * Math.sin(sec * 18 + i * 3);
      circle(ctx, x, y, (carrier ? 26 : 14) * fl, radial(ctx, x, y, (carrier ? 26 : 14) * fl, [[0, 'rgba(255,230,150,0.95)'], [1, 'rgba(255,60,0,0)']]), 0.9);
      for (let k = 0; k < 3; k++) {
        const t = (sec * 0.6 + k / 3) % 1;
        circle(ctx, x + 10 * Math.sin(k + sec), y - 20 - 60 * t, (carrier ? 22 : 12) * (0.6 + t), 'rgba(40,40,40,0.5)', 0.6 * (1 - t));
      }
    }
  });

  // ── 함재기 초계 비행 (항모 상공 선회) ──
  const jk = clamp01((sec - plan.jetAt) / 0.6);
  if (jk > 0) {
    n.carriers.forEach((_, ci) => {
      const hit = plan.hitAt[ci];
      const fade = sec > hit ? 1 - clamp01((sec - hit) / 0.5) : 1;
      if (fade <= 0) return;
      const [cx, cy] = pp(shipPos(ep, plan, ci, sec));
      for (let k = 0; k < 4; k++) {
        const th = sec * 0.9 + (k / 4) * Math.PI * 2 + ci;
        const R = 95 + 18 * Math.sin(k * 2.1);
        const x = cx + Math.cos(th) * R;
        const y = cy + Math.sin(th) * R * 0.55;
        ctx.globalAlpha = jk * fade;
        jetGlyph(ctx, x, y, th + Math.PI / 2, 11, COLORS.nk);
        ctx.globalAlpha = 1;
      }
    });
    if (!p2 && sec < plan.killAt) {
      const [cx, cy] = pp(shipPos(ep, plan, 0, sec));
      ctx.globalAlpha = jk;
      label(ctx, clampX(cx, 200), Math.min(MAP_H - 110, cy + 112), n.jetLabel ?? '함재기 젠-15 초계', 30, '#ff8a8a');
      ctx.globalAlpha = 1;
    }
  }

  // ── 아군 2함대 · F-15K (2단계 직전부터) ──
  const ak = clamp01((sec - (plan.t2 - 0.8)) / 0.8);
  if (ak > 0) {
    n.fleet.forEach((f, i) => {
      const [x, y] = pp(f);
      if (off(x, y)) return;
      ctx.globalAlpha = ak;
      circle(ctx, x, y, 26, 'rgba(0,102,255,0.25)', ak);
      shipGlyph(ctx, x, y, Math.PI, 14, '#4da3ff', false);
      ctx.globalAlpha = 1;
      if (i === 0) {
        ctx.globalAlpha = ak;
        label(ctx, clampX(x, 170), Math.max(150, y - 46), n.fleetLabel ?? '해군 2함대', 30, '#4da3ff');
        ctx.globalAlpha = 1;
      }
    });
    const fk = clamp01((sec - (plan.fleetAt - 0.6)) / 0.6);
    if (fk > 0) {
      n.f15k.forEach((f, i) => {
        const [x, y] = pp(f);
        if (off(x, y)) return;
        const [tx, ty] = pp(shipPos(ep, plan, plan.ships.length - 1, sec));
        ctx.globalAlpha = fk;
        jetGlyph(ctx, x, y, Math.atan2(ty - y, tx - x), i ? 15 : 18, '#4da3ff', '#001a40');
        ctx.globalAlpha = 1;
      });
      const [lx, ly] = pp(n.f15k[0]);
      ctx.globalAlpha = fk;
      label(ctx, clampX(lx, 170), Math.min(MAP_H - 110, ly + 56), n.f15kLabel ?? 'F-15K 편대', 30, '#4da3ff');
      ctx.globalAlpha = 1;
    }
  }

  // ── 미사일 궤적 ──
  plan.shots.forEach((s, k) => {
    const q = (sec - s.launch) / s.flight;
    if (q < 0 || q > 1.25) return;
    const A = pp(s.from);
    const B = pp(shipPos(ep, plan, s.ship, s.launch + s.flight));
    const dist = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    // 초음속 지대함은 높게 솟았다가 해면 밀착 돌입, 나머지는 낮은 곡선
    const h = s.kind === 'base' ? Math.min(260, dist * 0.35) : Math.min(120, dist * 0.16) * (k % 2 ? 1 : -1);
    const at = (t: number): XY => {
      if (s.kind === 'base') return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - h * 4 * t * (1 - t)];
      const nx = -(B[1] - A[1]) / dist;
      const ny = (B[0] - A[0]) / dist;
      const b = 4 * t * (1 - t) * h;
      return [A[0] + (B[0] - A[0]) * t + nx * b, A[1] + (B[1] - A[1]) * t + ny * b];
    };
    const head = Math.min(1, q);
    const tail = Math.max(0, head - 0.35);
    const pts: XY[] = [];
    for (let i = 0; i <= 14; i++) pts.push(at(tail + ((head - tail) * i) / 14));
    path(ctx, pts);
    const fade = q > 1 ? 1 - (q - 1) / 0.25 : 1;
    const col = shotColor(s.kind);
    glowStroke(ctx, col, 4.5, '#ffffff', fade);
    if (q < 1) {
      const [hx, hy] = at(head);
      circle(ctx, hx, hy, 20, radial(ctx, hx, hy, 20, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(0,229,255,0)']]));
    }
  });

  // ── 상단 상태 라벨 ──
  if (!p2) {
    const [x, y] = pp(shipPos(ep, plan, 0, sec));
    const k = clamp01((sec - 1.5) / 0.5) * (0.8 + 0.2 * Math.sin(sec * 8)) * (sec < plan.jetAt ? 1 : 0);
    if (k > 0 && !off(x, y, 0)) {
      ctx.globalAlpha = k;
      label(ctx, clampX(x, 260), Math.max(150, y - 110), n.warnLabel ?? '중국 항모전단 서해 진입', 34, '#ff6b6b');
      ctx.globalAlpha = 1;
    }
  } else {
    const sunk = plan.hitAt.filter((t) => t <= sec).length;
    if (sec >= plan.launchAt + 1) label(ctx, MAP_W / 2, 250, `3방향 동시 타격 · 격침 ${sunk}척`, 36, COLORS.yellow);
  }

  // ── 항모의 무덤: 붉은 X ──
  if (sec >= plan.graveAt) {
    const g = clamp01((sec - plan.graveAt) / 0.35);
    plan.ships.forEach((s, i) => {
      if (s.escort >= 0) return;
      const [x, y] = pp(shipPos(ep, plan, i, sec));
      bigX(ctx, x, y, 60 * (1.6 - 0.6 * g), g);
    });
    const [x, y] = pp(n.killZone.center);
    ctx.globalAlpha = g;
    label(ctx, clampX(x, 240), Math.min(MAP_H - 130, y + 150 + 10 * rand(1)), n.graveLabel ?? '서해 = 항모의 무덤', 44, '#FF3B30');
    ctx.globalAlpha = 1;
  }
};
