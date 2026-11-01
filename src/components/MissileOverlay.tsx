// 탄도미사일 동적 레이어 — Canvas 2D, 블러·필터 없음 (발광은 굵은 반투명 선 3단)
import {MAP_H, MAP_W} from '../lib/camera';
import {groundAt, MissilePlan, missileState} from '../lib/missile';
import {clamp01} from '../lib/schedule';
import {COLORS, Episode, LngLat} from '../lib/types';
import {circle, EMBER, FLASH, FLASH2, geoCircle, glowStroke, label, path, radial} from './MapOverlay';

type C = CanvasRenderingContext2D;
type P = (ll: LngLat) => [number, number];
type XY = [number, number];

const K = 720; // 고도 → 화면 높이 압축 (높을수록 덜 늘어남)

export const drawMissile = (ctx: C, sec: number, ep: Episode, plan: MissilePlan, pp: P) => {
  const m = ep.map.missile!;
  const p2 = sec >= plan.t2;
  const L = m.launcher;
  const G = m.target;

  // 고도(km)를 화면 위쪽 오프셋으로: 그 지점의 1km 화면 크기 × 고도, tanh로 압축
  const air = (ll: LngLat, km: number): XY => {
    const a = pp(ll);
    const b = pp([ll[0] + 1 / (111 * Math.cos((ll[1] * Math.PI) / 180)), ll[1]]);
    const pxKm = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [a[0], a[1] - K * Math.tanh((km * pxKm) / K)];
  };
  const posAt = (t: number): XY => {
    const s = missileState(plan, t);
    return air(groundAt(L, G, s.g), s.alt);
  };
  const cur = missileState(plan, sec);

  // ── 1단계 대기권 경계선 (고도 100km) ──
  const edgeK = clamp01((cur.alt - 50) / 25) * clamp01((plan.t2 + 1.0 - sec) / 0.8);
  if (edgeK > 0) {
    const pts: XY[] = [];
    for (let i = -6; i <= 26; i++) pts.push(air(groundAt(L, G, i / 20), 100));
    path(ctx, pts);
    ctx.setLineDash([16, 12]);
    ctx.lineDashOffset = -sec * 40;
    ctx.strokeStyle = '#9fd3ff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8 * edgeK;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const lp = air(groundAt(L, G, 0.12), 100);
    ctx.globalAlpha = edgeK;
    label(ctx, Math.min(MAP_W - 230, Math.max(230, lp[0])), lp[1] + 52, '대기권 경계 · 고도 100km', 28, '#9fd3ff');
    if (cur.alt > 100) label(ctx, Math.min(MAP_W - 160, Math.max(160, lp[0])), lp[1] - 30, '우주 공간', 34, '#ffffff');
    ctx.globalAlpha = 1;
  }

  // ── 예상 탄도 (고각 궤적 점선) ──
  const arcK = clamp01((sec - plan.arcAt) / 0.8) * clamp01((plan.impactAt - sec) / 0.6);
  if (arcK > 0) {
    const pts: XY[] = [];
    const N = 64;
    for (let i = 0; i <= N; i++) pts.push(posAt(plan.launchAt + ((plan.impactAt - plan.launchAt) * i) / N));
    path(ctx, pts);
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.55 * arcK;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // ── 지하 벙커 (붉은 표적 링) ──
  const lockK = clamp01((sec - plan.lockAt) / 0.5);
  m.bunkers.forEach((b, i) => {
    const [x, y] = pp(b);
    if (x < -150 || x > MAP_W + 150 || y < -150 || y > MAP_H + 150) return;
    const main = b[0] === G[0] && b[1] === G[1];
    const dist = Math.hypot(b[0] - G[0], b[1] - G[1]) * 100; // 대략 km/1.1
    const buried = sec >= plan.buryAt + dist * 0.05;
    if (!buried) {
      if (lockK > 0) {
        const speed = sec >= plan.t2 ? 1.6 : 0.8;
        for (let k = 0; k < 2; k++) {
          const ph = (sec * speed + k / 2 + i * 0.13) % 1;
          path(ctx, geoCircle(b, (main ? 0.6 : 0.35) + ph * (main ? 2.2 : 1.1), 36).map(pp), true);
          ctx.strokeStyle = COLORS.nk;
          ctx.lineWidth = (main ? 5 : 3) * (1 - ph) + 0.5;
          ctx.globalAlpha = (1 - ph) * lockK;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // 벙커 아이콘: 땅속 사각 + 입구
      const s = main ? 16 : 11;
      ctx.fillStyle = '#1a0606';
      ctx.strokeStyle = COLORS.nk;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - s, y - s * 0.7, s * 2, s * 1.4, 3);
      ctx.fill();
      ctx.stroke();
      circle(ctx, x, y, s * 0.35, COLORS.nk, 0.7 + 0.3 * Math.sin(sec * 9 + i));
    } else {
      const r = (main ? 30 : 20) + 4 * Math.sin(sec * 10 + i);
      circle(ctx, x, y, r, radial(ctx, x, y, r, EMBER), 0.85);
      const s = main ? 15 : 11;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    }
  });
  // 주 표적 십자선
  if (lockK > 0 && sec < plan.buryAt) {
    const [x, y] = pp(G);
    const rot = sec * 1.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = lockK * (0.75 + 0.25 * Math.sin(sec * 14));
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
      ctx.lineTo(Math.cos(a) * 62, Math.sin(a) * 62);
    }
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ── 발사대 (TEL) + 점화 화염·연기 ──
  {
    const [x, y] = pp(L);
    if (x > -200 && x < MAP_W + 200 && y > -200 && y < MAP_H + 200) {
      const q = sec - plan.launchAt;
      // 연기 기둥 (반투명 원, 블러 없음)
      if (q > 0 && q < 9) {
        for (let k = 0; k < 9; k++) {
          const age = q - k * 0.18;
          if (age <= 0) continue;
          const fade = clamp01(1 - age / 7);
          const r = 14 + age * 16;
          circle(ctx, x + (k % 3 - 1) * age * 6, y - age * 10, r, '#c9ced4', 0.12 * fade);
        }
      }
      ctx.fillStyle = COLORS.rok;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x - 26, y - 9, 52, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dfe6ee';
      ctx.fillRect(x - 18, y - 22, 34, 9);
      if (q > -0.2 && q < 0.5) circle(ctx, x, y - 10, 70, radial(ctx, x, y - 10, 70, FLASH2), clamp01(1 - q / 0.5));
      ctx.font = '900 30px Pretendard';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#000';
      const t = m.launcherLabel ?? '현무-5 발사대';
      ctx.strokeText(t, x, y + 46);
      ctx.fillStyle = '#9cc8ff';
      ctx.fillText(t, x, y + 46);
    }
  }

  // ── 미사일 비행 (상승 → 하강) ──
  if (cur.phase === 'up' || (cur.phase === 'down' && sec < plan.plungeAt + 0.2)) {
    const fadeOut = cur.phase === 'down' ? clamp01((plan.plungeAt + 0.2 - sec) / 0.4) : 1;
    // 지나온 궤적 (얇게) + 최근 1.4초 (밝게)
    const past: XY[] = [];
    for (let i = 0; i <= 40; i++) past.push(posAt(plan.launchAt + ((sec - plan.launchAt) * i) / 40));
    path(ctx, past);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35 * fadeOut;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const recent: XY[] = [];
    for (let i = 0; i <= 16; i++) recent.push(posAt(Math.max(plan.launchAt, sec - 1.4 + (1.4 * i) / 16)));
    path(ctx, recent);
    const hot = cur.phase === 'down';
    glowStroke(ctx, hot ? '#ff6a1f' : '#ffb347', 6, '#ffffff', fadeOut);
    const head = posAt(sec);
    const prev = posAt(sec - 0.05);
    const ang = Math.atan2(head[1] - prev[1], head[0] - prev[0]);
    ctx.save();
    ctx.globalAlpha = fadeOut;
    ctx.translate(head[0], head[1]);
    ctx.rotate(ang);
    // 화염(상승) / 재진입 플라스마(하강)
    if (!hot) {
      const fl = 0.8 + 0.2 * Math.sin(sec * 40);
      ctx.fillStyle = '#ffcf6a';
      ctx.beginPath();
      ctx.moveTo(-14, -6); ctx.lineTo(-14 - 46 * fl, 0); ctx.lineTo(-14, 6); ctx.closePath();
      ctx.fill();
    } else {
      circle(ctx, 10, 0, 34, radial(ctx, 10, 0, 34, FLASH), 0.9);
    }
    ctx.fillStyle = '#f4f6f8';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 0); ctx.lineTo(8, -6); ctx.lineTo(-14, -6); ctx.lineTo(-14, 6); ctx.lineTo(8, 6); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ── 2단계: 수직 낙하 (화면 위 → 표적) ──
  const [gx, gy] = pp(G);
  if (p2 && sec >= plan.plungeAt && sec < plan.impactAt) {
    const q = clamp01((sec - plan.plungeAt) / (plan.impactAt - plan.plungeAt));
    const top = -120;
    const hy = top + (gy - top) * Math.pow(q, 2.1);
    const ty = Math.max(top, hy - 260 - 500 * q);
    path(ctx, [[gx, ty], [gx, hy]]);
    glowStroke(ctx, '#ff4a1f', 9 + 6 * q, '#fff4dc');
    // 충격파 원뿔
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx - 60 - 40 * q, hy - 150); ctx.lineTo(gx, hy + 10); ctx.lineTo(gx + 60 + 40 * q, hy - 150);
    ctx.stroke();
    ctx.globalAlpha = 1;
    circle(ctx, gx, hy, 46 + 20 * q, radial(ctx, gx, hy, 46 + 20 * q, FLASH), 0.95);
    circle(ctx, gx, hy, 12, '#fff');
  }
  // 낙하 경고 (화면 위쪽 붉은 화살표)
  if (p2 && sec < plan.impactAt) {
    const blink = Math.sin(sec * 12) > -0.2 ? 1 : 0.35;
    ctx.globalAlpha = blink * clamp01((sec - plan.t2) / 0.4);
    ctx.fillStyle = COLORS.nk;
    for (let k = 0; k < 3; k++) {
      const yy = 150 + k * 28;
      ctx.beginPath();
      ctx.moveTo(gx - 30, yy); ctx.lineTo(gx, yy + 20); ctx.lineTo(gx + 30, yy); ctx.lineTo(gx + 30, yy + 8); ctx.lineTo(gx, yy + 28); ctx.lineTo(gx - 30, yy + 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── 충돌: 섬광 + 지면 파동 링 ──
  const qi = sec - plan.impactAt;
  if (qi >= 0 && qi < 2.6) {
    if (qi < 0.9) circle(ctx, gx, gy, 60 + 220 * Math.sqrt(qi), radial(ctx, gx, gy, 60 + 220 * Math.sqrt(qi), FLASH2), 1 - qi / 0.9);
    for (let k = 0; k < 3; k++) {
      const q = qi - k * 0.35;
      if (q <= 0 || q > 1.8) continue;
      path(ctx, geoCircle(G, 0.4 + q * 3.2, 48).map(pp), true);
      ctx.strokeStyle = k ? '#ffb347' : '#ffffff';
      ctx.lineWidth = Math.max(0.5, 7 * (1 - q / 1.8));
      ctx.globalAlpha = 1 - q / 1.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (qi >= 0) {
    const r = 26 + 5 * Math.sin(sec * 9);
    circle(ctx, gx, gy, r, radial(ctx, gx, gy, r, EMBER), 0.9);
  }
  // ── 매몰 (심도 폭발): 지하에서 퍼지는 큰 파동 링 ──
  const qb = sec - plan.buryAt;
  if (qb >= 0 && qb < 3.2) {
    for (let k = 0; k < 4; k++) {
      const q = qb - k * 0.3;
      if (q <= 0 || q > 2.4) continue;
      path(ctx, geoCircle(G, 0.6 + q * 4.2, 56).map(pp), true);
      ctx.strokeStyle = k % 2 ? COLORS.nk : '#ff8a1f';
      ctx.lineWidth = Math.max(0.5, 10 * (1 - q / 2.4));
      ctx.globalAlpha = 0.9 * (1 - q / 2.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // 지명 라벨
  ep.map.labels
    .filter((l) => l.phase === 0 || (l.phase === 2 && p2) || (l.phase === 1 && !p2))
    .forEach((l) => {
      const [x, y] = pp(l.pos);
      if (x < -200 || x > MAP_W + 200 || y < -300 || y > MAP_H + 200) return;
      label(ctx, x, y - 40, l.text, l.size, '#ffe9a8');
    });
  if (lockK > 0 && sec < plan.buryAt + 0.4 && m.targetLabel) label(ctx, gx, gy + 92, m.targetLabel, 30, '#ff9a9a');

  // ── 관통 깊이 게이지 (충돌 → 매몰) ──
  const depthM = m.depthM ?? 100;
  const gk = clamp01(qi / 0.4);
  if (qi >= 0 && gk > 0) {
    const x0 = MAP_W - 150;
    const y0 = 250;
    const H = 430;
    const conc = 0.28; // 위 28%는 강화 콘크리트
    const d = clamp01((sec - plan.impactAt - 0.15) / Math.max(0.6, plan.buryAt - plan.impactAt - 0.2));
    const de = 1 - Math.pow(1 - d, 2);
    ctx.globalAlpha = gk;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.beginPath();
    ctx.roundRect(x0 - 16, y0 - 64, 148, H + 120, 12);
    ctx.fill();
    ctx.fillStyle = '#7d8590';
    ctx.fillRect(x0, y0, 52, H * conc);
    ctx.fillStyle = '#5b4632';
    ctx.fillRect(x0, y0 + H * conc, 52, H * (1 - conc));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, 52, H);
    // 관통 탄두 위치
    const yy = y0 + H * de;
    path(ctx, [[x0 + 26, y0], [x0 + 26, yy]]);
    glowStroke(ctx, '#ff6a1f', 6, '#fff4dc');
    circle(ctx, x0 + 26, yy, 11, '#fff');
    ctx.font = '900 24px Pretendard';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8edf2';
    ctx.fillText('콘크리트', x0 + 58, y0 + 30);
    ctx.fillText('암반', x0 + 58, y0 + H * conc + 34);
    ctx.fillStyle = '#ff9a9a';
    ctx.fillText('벙커', x0 + 58, y0 + H - 6);
    ctx.textAlign = 'center';
    ctx.font = '900 26px Pretendard';
    ctx.fillStyle = '#fff';
    ctx.fillText('관통 깊이', x0 + 58, y0 - 30);
    ctx.font = '900 38px Pretendard';
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(`-${Math.round(depthM * de)}m`, x0 + 58, y0 + H + 44);
    ctx.globalAlpha = 1;
  }

  // ── 고도·속도 계기 (비행 중) ──
  const hudK = clamp01((sec - plan.launchAt) / 0.4) * clamp01((plan.impactAt + 0.6 - sec) / 0.4);
  if (hudK > 0) {
    // 수직 낙하 구간은 화면 낙하와 같이 고도를 0까지 줄임
    let alt = cur.alt;
    if (sec >= plan.plungeAt && sec < plan.impactAt) {
      const a0 = missileState(plan, plan.plungeAt).alt;
      alt = a0 * (1 - Math.pow(clamp01((sec - plan.plungeAt) / (plan.impactAt - plan.plungeAt)), 2.1));
    }
    const mach = sec >= plan.impactAt ? plan.maxMach : cur.mach;
    ctx.globalAlpha = hudK;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.beginPath();
    ctx.roundRect(26, 690, 300, 132, 14);
    ctx.fill();
    ctx.strokeStyle = cur.phase === 'down' ? COLORS.nk : '#9fd3ff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '900 28px Pretendard';
    ctx.fillStyle = '#c8d2dc';
    ctx.fillText('고도', 46, 738);
    ctx.fillText('속도', 46, 796);
    ctx.font = '900 42px Pretendard';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.max(0, Math.round(alt))} km`, 118, 740);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(`마하 ${mach.toFixed(1)}`, 118, 798);
    ctx.globalAlpha = 1;
  }

  // ── 충돌 섬광 (지도 전체) ──
  if (qi >= 0 && qi < 0.35) {
    ctx.globalAlpha = 0.75 * (1 - qi / 0.35);
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.globalAlpha = 1;
  }

  // 매몰 문구
  const rk = clamp01(qb / 0.3);
  if (qb >= 0 && rk > 0 && m.buryText) {
    ctx.save();
    ctx.translate(MAP_W / 2, 210);
    ctx.scale(0.7 + 0.3 * clamp01(qb / 0.3), 0.7 + 0.3 * clamp01(qb / 0.3));
    ctx.globalAlpha = rk;
    ctx.font = '900 76px Pretendard';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#000';
    ctx.strokeText(m.buryText, 0, 0);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(m.buryText, 0, 0);
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
