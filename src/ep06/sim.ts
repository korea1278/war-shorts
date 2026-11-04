// 측면(고도) 시뮬레이션: 탄두·요격탄·폭발을 시간(초)의 순수 함수로 계산 → 어느 프레임이든 같은 결과
//  좌표는 무대(지도 영역 1440x1260) 안 픽셀. x: 왼쪽 북한 → 오른쪽 수도권, y: 고도(km) 위로
import {Plan} from './plan';

export const SV = {groundY: 1030, topAlt: 65, plotR: 1320};
export const KPX = (SV.groundY - 150) / SV.topAlt; // km당 픽셀 (60km ≈ y 218)
export const yAlt = (a: number) => SV.groundY - a * KPX;

/** 지상 포대 x 위치 */
export const BAT = {radar: 110, lsam: 320, cg: 530, pac: 710, seoul: 1010, lamd: 1225, dome: 1075};

export type Kind = 'lsam' | 'cg' | 'pac' | 'lamd';
export const KCOLOR: Record<Kind, string> = {lsam: '#00E5FF', cg: '#00FF66', pac: '#FFFFFF', lamd: '#FFD000'};

const PULL_U = 0.66; // 풀업 정점 위치 (경로 비율)

export type Warhead = {
  id: number;
  A0: number; // 시작 고도
  B: number; // 풀업 상승량 (km)
  xT: number; // 낙하 지점 x
  keys: [number, number][]; // (초, 경로비율 u) 키프레임
  end: number; // 사라지는 시각 (요격 또는 충돌)
  killed: boolean;
  pullup: boolean; // 풀업 연출 대상 (예상 궤도 점선·추적 박스)
};

export type Rocket = {id: number; x0: number; x1: number; H: number; t0: number; dur: number; end: number};
export type Interceptor = {kind: Kind; fx: number; t0: number; t1: number; tx: number; ty: number};
export type Blast = {t: number; x: number; y: number; color: string; size: number; ground?: boolean};

export const whAlt = (w: Warhead, u: number, withPull = true) =>
  w.A0 * Math.pow(Math.max(0, 1 - u), 1.15) + (withPull ? w.B * Math.exp(-(((u - PULL_U) / 0.07) ** 2)) : 0);
export const whXY = (w: Warhead, u: number, withPull = true): [number, number] =>
  [-70 + (w.xT + 70) * u, yAlt(whAlt(w, u, withPull))];

/** 키프레임 보간 (첫 키 이전이면 null) */
export const uAt = (keys: [number, number][], t: number): number | null => {
  if (t < keys[0][0]) return null;
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, ua] = keys[i];
    const [tb, ub] = keys[i + 1];
    if (t <= tb) return ua + (ub - ua) * ((t - ta) / Math.max(1e-3, tb - ta));
  }
  return keys[keys.length - 1][1];
};

const solveU = (w: Warhead, alt: number, from: number) => {
  for (let u = from; u <= 1; u += 0.0005) if (whAlt(w, u) <= alt) return u;
  return 0.97;
};

export const rocketXY = (r: Rocket, u: number): [number, number] => [r.x0 + (r.x1 - r.x0) * u, yAlt(r.H * Math.sin(Math.PI * u))];

export type Sim = ReturnType<typeof buildSim>;

export const buildSim = (p: Plan) => {
  const warheads: Warhead[] = [];
  const interceptors: Interceptor[] = [];
  const blasts: Blast[] = [];
  const kills: number[] = [];
  const intercept = (kind: Kind, t1: number, [tx, ty]: [number, number], flight: number, fx = BAT[kind]) => {
    interceptors.push({kind, fx, t0: t1 - flight, t1, tx, ty});
    blasts.push({t: t1, x: tx, y: ty, color: KCOLOR[kind], size: kind === 'lamd' ? 46 : 70});
    kills.push(t1);
  };
  // ① L-SAM 상층 요격 (고도 52~58km) 3발
  [56, 53, 58].forEach((alt, i) => {
    const w: Warhead = {id: i, A0: [78, 81, 76][i], B: 18, xT: 1000 + i * 45, keys: [], end: 0, killed: true, pullup: false};
    const uk = solveU(w, alt, 0);
    const tk = p.lsamHit + i * 0.32;
    w.keys = [[p.lsam + 0.05 + i * 0.3, 0], [tk, uk]];
    w.end = tk;
    warheads.push(w);
    intercept('lsam', tk, whXY(w, uk), 1.25);
  });
  // ② 풀업으로 상층을 뚫은 3발 → 천궁-II·PAC-3 (고도 24~34km)
  [32, 25, 29].forEach((alt, i) => {
    const w: Warhead = {id: 3 + i, A0: [77, 80, 83][i], B: 18, xT: 1040 + i * 40, keys: [], end: 0, killed: true, pullup: true};
    const ta = p.pullupAt + i * 0.28; // 풀업 정점 통과
    const uk = solveU(w, alt, 0.685);
    const tk = p.midHit + i * 0.3;
    const keys: [number, number][] = [[p.lsam + 0.35 + i * 0.45, 0.06], [ta - 1.5, 0.52], [ta, PULL_U], [ta + 0.9, 0.685], [tk, uk]];
    w.keys = keys.filter((k, j) => j === 0 || (k[0] > keys[j - 1][0] + 0.05));
    w.end = tk;
    warheads.push(w);
    intercept(i === 1 ? 'pac' : 'cg', tk, whXY(w, uk), 1.3);
  });
  // ③ 끝내 뚫고 내려오는 1발 (100% 방패는 없다)
  const leak: Warhead = {id: 6, A0: 79, B: 18, xT: BAT.seoul + 60, keys: [[p.outro - 1.4, 0.1], [p.outro + 0.35, 0.62], [p.outro + 1.05, 1]], end: p.outro + 1.05, killed: false, pullup: false};
  warheads.push(leak);
  blasts.push({t: leak.end, x: whXY(leak, 1)[0], y: SV.groundY - 6, color: '#FF2828', size: 120, ground: true});

  // ④ 장사정포탄 10발 (고도 15km 이하) → LAMD
  const rockets: Rocket[] = [];
  for (let i = 0; i < 10; i++) {
    const r: Rocket = {id: i, x0: 10 + (i % 3) * 45, x1: 930 + ((i * 53) % 260), H: 7 + ((i * 7) % 6), t0: p.lamd + 0.15 + i * 0.2, dur: 3.3, end: 0};
    let tk = p.lamdHit + i * 0.13;
    const uk = Math.max(0.42, Math.min(0.9, (tk - r.t0) / r.dur));
    tk = r.t0 + uk * r.dur;
    r.end = tk;
    rockets.push(r);
    intercept('lamd', tk, rocketXY(r, uk), 0.85, BAT.lamd - 30 + (i % 3) * 30);
  }
  kills.sort((a, b) => a - b);
  return {warheads, rockets, interceptors, blasts, kills};
};

/** 요격탄 위치: 수직 상승 후 표적으로 휘는 2차 베지어 */
export const icPoint = (ic: Interceptor, s: number): [number, number] => {
  const x0 = ic.fx, y0 = SV.groundY - 40;
  const cx = ic.fx, cy = ic.ty + (y0 - ic.ty) * 0.3;
  const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
  return [a * x0 + b * cx + c * ic.tx, a * y0 + b * cy + c * ic.ty];
};
