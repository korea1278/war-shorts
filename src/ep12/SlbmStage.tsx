// EP12 중앙 무대 (Y 470~1390): 동해 심해 단면 → 콜드런치 사출 → 수면 돌파·점화 → 전술 지도 포물선 → 표적 타격
// 전부 SVG 벡터 · 필터/블러 없음 (발광은 반투명 도형 겹치기)
import React, {useMemo} from 'react';
import {interpolate, spring, useCurrentFrame} from 'remotion';
import {clamp01, easeInOut} from '../lib/schedule';
import {LngLat} from '../lib/types';
import {SlbmData, SlbmPlan} from './plan';

export const STAGE_TOP = 470;
export const STAGE_H = 920;
const W = 1080;
const SURF = 250; // 수면 (무대 좌표)
const SUB_Y = 620; // 잠수함 선체 중심선
const RED = '#FF3B30';
const YEL = '#FFE500';
const CYAN = '#38E1FF';

type Geo = {features: {properties: {iso: string}; geometry: {type: string; coordinates: number[][][][]}}[]};

const r01 = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(0.001, b - a));

// 전술 지도 투영 (위도 33.6~43, 경도 124~131.2 → 무대 안, 우측 15% 마진 왼쪽)
const proj = ([lon, lat]: LngLat | number[]): [number, number] => [212 + (lon - 124) * 71.8, 40 + (43 - lat) * 91.5];

/** 둥근 라벨 칩 */
const Chip: React.FC<{x: number; y: number; text: string; color: string; size?: number; o?: number; anchor?: 'start' | 'middle'}> = ({x, y, text, color, size = 30, o = 1, anchor = 'middle'}) => {
  if (!text) return null; // 빈 라벨 = 표시 안 함 (상단 카드·자막과 같은 글자 중복 방지)
  const w = text.length * size * 0.9 + 34;
  const x0 = anchor === 'middle' ? x - w / 2 : x;
  return (
    <g opacity={o}>
      <rect x={x0 + 5} y={y - size * 0.85 + 5} width={w} height={size * 1.5} rx={10} fill="#000" />
      <rect x={x0} y={y - size * 0.85} width={w} height={size * 1.5} rx={10} fill="rgba(0,0,0,0.78)" stroke={color} strokeWidth={4} />
      <text x={x0 + w / 2} y={y + size * 0.3} textAnchor="middle" fontSize={size} fontWeight={900} fill="#fff" style={{fontFamily: 'Pretendard'}}>
        {text}
      </text>
    </g>
  );
};

/** 도산안창호급 실루엣 (원점 = 선체 왼쪽 끝 중앙, 길이 520) */
const Submarine: React.FC<{hatch: number; vlsHi: number; xray: number}> = ({hatch, vlsHi, xray}) => (
  <g>
    <path d="M0,0 C0,-26 34,-40 90,-41 L430,-41 C470,-40 488,-22 500,-8 L522,-4 L522,4 L500,8 C484,26 466,40 430,41 L90,41 C34,40 0,26 0,0 Z" fill="none" stroke={CYAN} strokeWidth={12} opacity={0.12} />
    <path d="M0,0 C0,-26 34,-40 90,-41 L430,-41 C470,-40 488,-22 500,-8 L522,-4 L522,4 L500,8 C484,26 466,40 430,41 L90,41 C34,40 0,26 0,0 Z" fill="#101924" stroke="#6f97ba" strokeWidth={2.5} />
    <path d="M60,-30 L450,-30" stroke="#8fc0e6" strokeWidth={2.5} opacity={0.35} />
    {/* 함교탑 + 함교타 */}
    <path d="M150,-40 C153,-70 158,-88 172,-92 L238,-92 C246,-90 250,-82 254,-66 L264,-40 Z" fill="#101924" stroke="#6f97ba" strokeWidth={2.5} />
    <rect x={180} y={-118} width={5} height={28} fill="#1b2633" />
    <rect x={196} y={-108} width={4} height={18} fill="#1b2633" />
    <path d="M168,-62 L130,-58 L130,-53 L168,-55 Z" fill="#0b121a" stroke="#6f97ba" strokeWidth={1.5} />
    {/* X형 꼬리 */}
    <path d="M498,-8 L534,-40 L544,-37 L516,-2 Z M498,8 L534,40 L544,37 L516,2 Z" fill="#0b121a" stroke="#6f97ba" strokeWidth={1.5} />
    {/* 수직발사관 6문 (함교 뒤, 엑스레이로 발사관·미사일 보임) */}
    {Array.from({length: 6}, (_, i) => {
      const x = 278 + i * 24;
      const on = vlsHi > i / 6;
      return (
        <g key={i}>
          <rect x={x} y={-38} width={16} height={74} rx={3} fill="#38E1FF" opacity={0.18 * xray} stroke={CYAN} strokeOpacity={0.7 * xray} strokeWidth={2} />
          <path d={`M${x + 8},-34 C${x + 3},-26 ${x + 3},-20 ${x + 3},-16 L${x + 3},30 L${x + 13},30 L${x + 13},-16 C${x + 13},-20 ${x + 13},-26 ${x + 8},-34 Z`} fill="#e9eef3" opacity={xray * (i === 0 ? 1 - hatch * 0.999 : 1)} />
          <rect x={x - 2} y={-46} width={20} height={7} rx={2} fill={i === 0 && hatch > 0 ? '#FF9A1F' : on ? YEL : '#2c3e52'} transform={i === 0 ? `rotate(${-80 * hatch} ${x - 2} -42)` : undefined} />
          {on && <rect x={x - 6} y={-50} width={28} height={15} rx={4} fill="none" stroke={YEL} strokeWidth={2} opacity={0.6} />}
        </g>
      );
    })}
  </g>
);

export const SlbmStage: React.FC<{p: SlbmPlan; d: SlbmData; geo: Geo}> = ({p, d, geo}) => {
  const frame = useCurrentFrame();
  const t = frame / 30;

  // 지도 경로 (한 번만 계산)
  const paths = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of geo.features) {
      out[f.properties.iso] = f.geometry.coordinates
        .map((poly) => poly.map((ring) => ring.map((c, i) => `${i ? 'L' : 'M'}${proj(c).map((v) => v.toFixed(1)).join(',')}`).join('') + 'Z').join(''))
        .join('');
    }
    return out;
  }, [geo]);

  // ── 공통 시간 값 ──
  const mapK = ramp(t, p.track - 0.25, p.track + 0.35); // 심해 → 지도 전환
  const subX = lerp(1250, 250, easeInOut(ramp(t, 0, 3.2))) - Math.min(t, p.launch) * 4; // 진입 후 아주 천천히 전진
  const bob = Math.sin(t * 1.3) * 4;
  // VLS 근접: vls 장면에서 1.8배 줌, 발사 장면 시작에 원래대로
  const zIn = easeInOut(ramp(t, p.vls, p.vls + 0.9));
  const zOut = easeInOut(ramp(t, p.launch, p.launch + 0.7));
  const zoom = 1 + 0.8 * zIn * (1 - zOut);
  const vlsX = subX + 338;
  const vlsY = SUB_Y + bob;
  const xray = Math.max(ramp(t, p.vls + 0.3, p.vls + 1.0) * (1 - ramp(t, p.breach, p.breach + 0.5)), 0);
  const vlsHi = ramp(t, p.vls + 0.6, p.vls + 2.4);
  const hatch = easeInOut(ramp(t, p.launch + 0.3, p.eject));

  // 미사일 높이 (무대 y, 미사일 꼬리 기준)
  const mStart = vlsY - 4;
  let mY = mStart;
  let mOn = false;
  if (t >= p.eject && t < p.breach) {
    mOn = true;
    mY = lerp(mStart, SURF + 40, 1 - Math.pow(1 - ramp(t, p.eject, p.breach), 2));
  } else if (t >= p.breach) {
    mOn = true;
    const pop = ramp(t, p.breach, p.breach + 0.45);
    const climb = Math.pow(ramp(t, p.ignite, p.ignite + 2.2), 1.8);
    mY = lerp(SURF + 40, SURF - 70, 1 - Math.pow(1 - pop, 3)) - climb * 700;
  }
  const tubeX = subX + 278 + 8;
  const ignited = t >= p.ignite;
  const splash = t >= p.breach ? Math.max(0, 1 - (t - p.breach) / 1.6) : 0;
  const flash = t >= p.ignite ? Math.max(0, 1 - (t - p.ignite) / 0.9) : 0;
  const shake = t >= p.impact && t < p.impact + 0.6 ? Math.sin((t - p.impact) * 90) * 14 * (1 - (t - p.impact) / 0.6) : 0;

  // ── 심해 단면 ──
  const sea = (
    <g opacity={1 - mapK}>
      <defs>
        <linearGradient id="e12sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02040b" />
          <stop offset="1" stopColor="#0b2645" />
        </linearGradient>
        <linearGradient id="e12sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b3560" />
          <stop offset="0.4" stopColor="#05203f" />
          <stop offset="1" stopColor="#010812" />
        </linearGradient>
        <linearGradient id="e12ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd4ff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#9fd4ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="e12flash" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.2" stopColor="#FFF2A8" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#FF9A1F" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FF3B30" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={`translate(${vlsX} ${vlsY}) scale(${zoom}) translate(${-vlsX} ${-vlsY})`}>
        <rect x={-600} y={-600} width={W + 1200} height={SURF + 600} fill="url(#e12sky)" />
        <rect x={-600} y={SURF} width={W + 1200} height={STAGE_H + 600} fill="url(#e12sea)" />
        {[100, 330, 620, 860].map((x, i) => (
          <polygon key={i} points={`${x - 30},${SURF} ${x + 40},${SURF} ${x + 150},${SURF + 640} ${x},${SURF + 640}`} fill="url(#e12ray)" />
        ))}
        {/* 수온약층 (잠수함이 숨는 층) */}
        <path d={`M-600,${SUB_Y - 120} L${W + 600},${SUB_Y - 120}`} stroke="#7fc8ff" strokeWidth={2} strokeDasharray="10 14" opacity={0.3} />
        <text x={30} y={SUB_Y - 132} fontSize={24} fontWeight={900} fill="#7fc8ff" opacity={0.6} style={{fontFamily: 'Pretendard'}}>수온약층</text>
        {/* 부유물 */}
        {Array.from({length: 70}, (_, i) => (
          <circle key={i} cx={((r01(i) * W + t * (6 + r01(i + 9) * 10)) % (W + 40)) - 20} cy={SURF + 20 + r01(i + 50) * (STAGE_H - SURF)} r={0.8 + r01(i + 90) * 2.2} fill="#9fc7ee" opacity={0.2} />
        ))}
        {/* 소나 핑 (발사 전까지 2.2초마다) */}
        {t < p.launch &&
          [0, 1].map((k) => {
            const ph = ((t + k * 1.1) % 2.2) / 2.2;
            return <ellipse key={k} cx={subX + 260} cy={vlsY} rx={80 + ph * 520} ry={(80 + ph * 520) * 0.32} fill="none" stroke={CYAN} strokeWidth={3} opacity={0.5 * (1 - ph)} />;
          })}
        {/* 정찰위성 + 초계기 탐색 (탐지 실패) */}
        {t >= p.stealth - 0.3 && t < p.vls + 0.6 && (() => {
          const o = ramp(t, p.stealth - 0.3, p.stealth + 0.3) * (1 - ramp(t, p.vls, p.vls + 0.6));
          const px = lerp(-150, 1100, ramp(t, p.stealth - 0.3, p.vls + 0.6));
          const fail = t > p.stealth + 1.2;
          return (
            <g opacity={o}>
              {/* 초계기 탐색 원뿔: 수온약층 위에서 멈춤 */}
              <polygon points={`${px},${170} ${px - 150},${SUB_Y - 125} ${px + 150},${SUB_Y - 125}`} fill={RED} opacity={0.12} />
              <polygon points={`${px},${170} ${px - 150},${SUB_Y - 125} ${px + 150},${SUB_Y - 125}`} fill="none" stroke={RED} strokeWidth={3} strokeDasharray="12 10" />
              <g transform={`translate(${px} 165)`}>
                <path d="M-60,0 L50,-4 L64,0 L50,4 Z M-6,-2 L-20,-34 L-10,-34 L12,-2 Z M-6,2 L-20,34 L-10,34 L12,2 Z M-56,-1 L-66,-14 L-60,-14 L-48,-1 Z" fill="#c9d2da" stroke="#000" strokeWidth={2} />
              </g>
              {/* 위성 빔 */}
              <g transform="translate(860 120)">
                <rect x={-14} y={-10} width={28} height={20} fill="#c9d2da" stroke="#000" strokeWidth={2} />
                <rect x={-58} y={-6} width={40} height={12} fill="#2a5a8a" stroke="#000" strokeWidth={2} />
                <rect x={18} y={-6} width={40} height={12} fill="#2a5a8a" stroke="#000" strokeWidth={2} />
              </g>
              <polygon points={`860,130 760,${SURF} 960,${SURF}`} fill={RED} opacity={0.1} />
              <path d={`M860,130 L760,${SURF} M860,130 L960,${SURF}`} stroke={RED} strokeWidth={3} strokeDasharray="10 10" />
              {fail && <Chip x={px} y={SUB_Y - 160} text="탐지 실패" color={RED} size={32} o={ramp(t, p.stealth + 1.2, p.stealth + 1.5)} />}
              {fail && <Chip x={860} y={SURF + 40} text="탐지 실패" color={RED} size={28} o={ramp(t, p.stealth + 1.6, p.stealth + 1.9)} />}
            </g>
          );
        })()}
        {/* 사출 기포 + 미사일 (수중 구간) */}
        {mOn && t < p.breach + 1.5 &&
          Array.from({length: 40}, (_, i) => {
            const k = r01(i + 300);
            const y = lerp(mStart, Math.max(mY, SURF), k);
            const age = clamp01((t - p.eject) * 1.2 - k);
            return <circle key={i} cx={tubeX + (r01(i + 400) - 0.5) * 40 * (1 + k)} cy={y + 30} r={2 + r01(i + 500) * 7} fill="none" stroke="#cfeeff" strokeWidth={2} opacity={0.7 * age * (1 - ramp(t, p.breach + 0.6, p.breach + 1.5))} />;
          })}
        {/* 잠수함 */}
        <g transform={`translate(${subX} ${vlsY})`}>
          <Submarine hatch={hatch} vlsHi={vlsHi} xray={xray} />
        </g>
        {/* 수면 */}
        <rect x={-600} y={SURF - 3} width={W + 1200} height={6} fill="#7fc8ff" opacity={0.45} />
        <path d={`M-600,${SURF} ${Array.from({length: 60}, (_, i) => `Q${-600 + i * 40 + 20},${SURF - 7 - Math.sin(t * 3 + i) * 3} ${-600 + (i + 1) * 40},${SURF}`).join(' ')}`} fill="none" stroke="#cfeaff" strokeWidth={2.5} opacity={0.5} />
        {/* 점화 섬광 · 물보라 */}
        {splash > 0 && (
          <g opacity={splash}>
            <path d={`M${tubeX - 150},${SURF} C${tubeX - 90},${SURF - 140 * splash} ${tubeX - 40},${SURF - 190 * splash} ${tubeX},${SURF - 200 * splash} C${tubeX + 40},${SURF - 190 * splash} ${tubeX + 90},${SURF - 140 * splash} ${tubeX + 150},${SURF} Z`} fill="#e8f6ff" opacity={0.6} />
            {Array.from({length: 30}, (_, i) => {
              const a = -Math.PI / 2 + (r01(i + 600) - 0.5) * 2.2;
              const dd = (40 + r01(i + 700) * 200) * (1.2 - splash);
              return <circle key={i} cx={tubeX + Math.cos(a) * dd * 1.3} cy={SURF + Math.sin(a) * dd} r={3 + r01(i + 800) * 7} fill="#f2fbff" opacity={0.8} />;
            })}
          </g>
        )}
        {flash > 0 && <ellipse cx={tubeX} cy={SURF - 80} rx={420 * (0.6 + flash * 0.4)} ry={320 * (0.6 + flash * 0.4)} fill="url(#e12flash)" opacity={flash} />}
        {mOn && (
          <g>
            {/* 연기 기둥 */}
            {ignited && <path d={`M${tubeX - 10},${SURF} L${tubeX - 4},${mY + 40} L${tubeX + 4},${mY + 40} L${tubeX + 10},${SURF} Z`} fill="#dfe7ee" opacity={0.55} />}
            {ignited && <path d={`M${tubeX - 26},${SURF} L${tubeX - 6},${mY + 40} L${tubeX + 6},${mY + 40} L${tubeX + 26},${SURF} Z`} fill="#dfe7ee" opacity={0.18} />}
            {/* 로켓 화염 */}
            {ignited && (
              <g transform={`translate(${tubeX} ${mY + 34})`}>
                <path d={`M-16,0 L0,${110 + Math.sin(t * 40) * 14} L16,0 Z`} fill="#FF8A1F" opacity={0.85} />
                <path d={`M-9,0 L0,${70 + Math.sin(t * 50) * 8} L9,0 Z`} fill="#FFF2A8" />
                <circle cx={0} cy={6} r={26} fill="#FFB020" opacity={0.35} />
              </g>
            )}
            <g transform={`translate(${tubeX} ${mY})`}>
              <path d="M-12,34 L-12,-60 C-12,-80 -5,-94 0,-100 C5,-94 12,-80 12,-60 L12,34 Z" fill="#e9eef3" stroke="#000" strokeWidth={3} />
              <rect x={-12} y={-44} width={24} height={9} fill="#1a1a1a" />
              <rect x={-12} y={0} width={24} height={6} fill={RED} />
              <path d="M-12,26 L-24,38 L-12,38 Z M12,26 L24,38 L12,38 Z" fill="#9aa4ad" stroke="#000" strokeWidth={2} />
            </g>
          </g>
        )}
      </g>
      {/* 고정 HUD (줌 영향 없음) */}
      {/* 수심 게이지 */}
      <g opacity={1 - ramp(t, p.breach, p.breach + 0.6)}>
        <rect x={24} y={SURF + 10} width={10} height={STAGE_H - SURF - 40} rx={5} fill="rgba(255,255,255,0.12)" />
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <rect x={20} y={SURF + 10 + k * 150} width={18} height={4} fill="#9fc7ee" />
            <text x={46} y={SURF + 22 + k * 150} fontSize={22} fontWeight={900} fill="#9fc7ee" style={{fontFamily: 'Pretendard'}}>{`${k * 50}m`}</text>
          </g>
        ))}
      </g>
      {t > 1.2 && t < p.vls && <Chip x={subX + 260} y={SUB_Y + 100} text={d.subLabel} color={CYAN} size={30} o={ramp(t, 1.2, 1.6) * (1 - ramp(t, p.vls - 0.4, p.vls))} />}
      {/* AIP 연료전지 패널 */}
      {t >= p.aip && t < p.stealth + 0.2 && (() => {
        const o = ramp(t, p.aip, p.aip + 0.3) * (1 - ramp(t, p.stealth - 0.1, p.stealth + 0.2));
        const fill = ramp(t, p.aip + 1.2, p.stealth - 0.3);
        const blink = Math.sin(t * 8) > 0 ? 1 : 0.4;
        return (
          <g opacity={o} transform="translate(70 290)">
            <rect x={5} y={5} width={520} height={190} rx={16} fill="#000" />
            <rect x={0} y={0} width={520} height={190} rx={16} fill="rgba(4,14,24,0.92)" stroke="#2BFF88" strokeWidth={4} />
            <circle cx={36} cy={40} r={12} fill="#2BFF88" opacity={blink} />
            <text x={60} y={52} fontSize={34} fontWeight={900} fill="#fff" style={{fontFamily: 'Pretendard'}}>{d.aipLabel}</text>
            <text x={24} y={104} fontSize={28} fontWeight={900} fill="#9fc7ee" style={{fontFamily: 'Pretendard'}}>공기 흡입</text>
            <text x={496} y={104} textAnchor="end" fontSize={30} fontWeight={900} fill={YEL} style={{fontFamily: 'Pretendard'}}>불필요</text>
            <text x={24} y={150} fontSize={28} fontWeight={900} fill="#9fc7ee" style={{fontFamily: 'Pretendard'}}>수중 잠항</text>
            <rect x={160} y={128} width={250} height={28} rx={8} fill="rgba(255,255,255,0.12)" />
            <rect x={160} y={128} width={250 * fill} height={28} rx={8} fill="#2BFF88" />
            <text x={496} y={152} textAnchor="end" fontSize={30} fontWeight={900} fill={YEL} style={{fontFamily: 'Pretendard'}}>수 주</text>
          </g>
        );
      })()}
      {/* VLS·미사일 라벨 */}
      {t >= p.vls + 0.6 && t < p.launch + 0.6 && (
        <g opacity={ramp(t, p.vls + 0.6, p.vls + 1.0) * (1 - ramp(t, p.launch, p.launch + 0.6))}>
          <Chip x={470} y={200} text={d.vlsLabel} color={YEL} size={40} />
          <Chip x={470} y={800} text={d.missileLabel} color={CYAN} size={38} o={ramp(t, p.vls + 1.6, p.vls + 2.0)} />
        </g>
      )}
      {/* 발사 명령 · 콜드런치 */}
      {t >= p.launch && t < p.breach + 0.3 && (
        <g opacity={1 - ramp(t, p.breach, p.breach + 0.3)}>
          <rect x={0} y={0} width={W} height={STAGE_H} fill="none" stroke={RED} strokeWidth={14} opacity={0.35 + 0.35 * Math.sin(t * 9)} />
          <Chip x={470} y={SURF + 70} text={t < p.eject ? '발사 명령' : d.coldLabel} color={RED} size={36} />
        </g>
      )}
      {t >= p.ignite && t < p.track && <Chip x={470} y={SURF + 90} text={d.igniteLabel} color="#FF9A1F" size={36} o={ramp(t, p.ignite, p.ignite + 0.25)} />}
    </g>
  );

  // ── 전술 지도: 포물선 궤적 ──
  const L = proj(d.launch);
  const Tg = proj(d.target);
  const C: [number, number] = [(L[0] + Tg[0]) / 2 + 40, Math.min(L[1], Tg[1]) - 300];
  const fly = easeInOut(ramp(t, p.track + 0.35, p.impact));
  const bez = (k: number) => [
    (1 - k) * (1 - k) * L[0] + 2 * (1 - k) * k * C[0] + k * k * Tg[0],
    (1 - k) * (1 - k) * L[1] + 2 * (1 - k) * k * C[1] + k * k * Tg[1],
  ];
  const arcPts = Array.from({length: 61}, (_, i) => bez((i / 60) * fly));
  const head = bez(fly);
  const hit = t >= p.impact;
  const hitK = hit ? t - p.impact : 0;
  const stampS = t >= p.stamp ? spring({frame: frame - p.stamp * 30, fps: 30, config: {damping: 9, stiffness: 160, mass: 0.7}}) : 0;
  const map = mapK > 0 && (
    <g opacity={mapK} transform={`translate(${shake} 0)`}>
      <rect x={0} y={0} width={W} height={STAGE_H} fill="#030b16" />
      {/* 격자 */}
      {Array.from({length: 12}, (_, i) => (
        <path key={i} d={`M0,${i * 80} L${W},${i * 80} M${i * 100},0 L${i * 100},${STAGE_H}`} stroke="#1c3a5a" strokeWidth={1} opacity={0.5} />
      ))}
      <path d={paths.PRK} fill="rgba(255,59,48,0.28)" stroke={RED} strokeWidth={3} />
      <path d={paths.KOR} fill="rgba(0,102,255,0.28)" stroke="#4da3ff" strokeWidth={3} />
      <text x={proj([126.2, 40.4])[0]} y={proj([126.2, 40.4])[1]} fontSize={34} fontWeight={900} fill="#ff8a80" style={{fontFamily: 'Pretendard'}}>북한</text>
      <text x={proj([127.3, 36.3])[0]} y={proj([127.3, 36.3])[1]} fontSize={34} fontWeight={900} fill="#8cc4ff" style={{fontFamily: 'Pretendard'}}>한국</text>
      <text x={proj([130.2, 39.6])[0]} y={proj([130.2, 39.6])[1]} fontSize={28} fontWeight={900} fill="#7fc8ff" opacity={0.7} style={{fontFamily: 'Pretendard'}}>동해</text>
      {/* 잠항 구역 */}
      <ellipse cx={L[0]} cy={L[1]} rx={70} ry={46} fill="rgba(56,225,255,0.12)" stroke={CYAN} strokeWidth={3} strokeDasharray="10 8" />
      <circle cx={L[0]} cy={L[1]} r={9} fill={CYAN} />
      {/* 궤적: 굵은 반투명 3단 + 실선 */}
      {fly > 0 && (
        <g>
          {[22, 12].map((w, i) => (
            <polyline key={w} points={arcPts.map((q) => q.join(',')).join(' ')} fill="none" stroke="#FF9A1F" strokeWidth={w} strokeLinecap="round" opacity={0.12 + i * 0.12} />
          ))}
          <polyline points={arcPts.map((q) => q.join(',')).join(' ')} fill="none" stroke="#FFE58A" strokeWidth={5} strokeLinecap="round" />
          {/* 지상 투영선 */}
          <path d={`M${L[0]},${L[1]} L${lerp(L[0], Tg[0], fly)},${lerp(L[1], Tg[1], fly)}`} stroke="#fff" strokeWidth={2} strokeDasharray="8 8" opacity={0.4} />
          {!hit && (
            <g transform={`translate(${head[0]} ${head[1]})`}>
              <circle r={22} fill="#FF9A1F" opacity={0.3} />
              <circle r={10} fill="#fff" />
            </g>
          )}
        </g>
      )}
      {/* 표적 */}
      <g transform={`translate(${Tg[0]} ${Tg[1]})`}>
        {[0, 1, 2].map((k) => {
          const ph = ((t * 0.9 + k / 3) % 1);
          return <circle key={k} r={20 + ph * 60} fill="none" stroke={RED} strokeWidth={3} opacity={(1 - ph) * (hit ? 0.3 : 0.8)} />;
        })}
        <path d="M-34,0 L-14,0 M14,0 L34,0 M0,-34 L0,-14 M0,14 L0,34" stroke={RED} strokeWidth={5} />
        <circle r={8} fill={RED} />
        {hit && (
          <g>
            <circle r={40 + Math.min(hitK, 1) * 160} fill="none" stroke="#FFE58A" strokeWidth={8 * Math.max(0, 1 - hitK)} />
            <circle r={90 * Math.max(0, 1 - hitK * 0.7)} fill="#FFB020" opacity={Math.max(0, 0.75 - hitK * 0.5)} />
            <circle r={45 * Math.max(0, 1 - hitK * 0.6)} fill="#fff" opacity={Math.max(0, 1 - hitK)} />
          </g>
        )}
      </g>
      <Chip x={Tg[0] - 20} y={Tg[1] - 92} text={d.targetLabel} color={RED} size={32} />
      <Chip x={L[0] + 10} y={L[1] + 88} text={hit ? d.originLabel : d.launchLabel} color={hit ? YEL : CYAN} size={30} />
      {t >= p.track + 0.6 && !hit && <Chip x={C[0] - 40} y={C[1] + 40} text="고각 탄도 · 수백 km" color="#FF9A1F" size={30} o={ramp(t, p.track + 0.6, p.track + 1.0)} />}
      {/* 결론 직인 */}
      {stampS > 0 && (
        <g transform={`translate(470 470) rotate(-7) scale(${2 - stampS})`} opacity={Math.min(1, stampS * 1.5)}>
          <rect x={-330} y={-115} width={660} height={230} rx={14} fill="rgba(0,0,0,0.72)" stroke={RED} strokeWidth={10} />
          <rect x={-312} y={-97} width={624} height={194} rx={8} fill="none" stroke={RED} strokeWidth={3} />
          <text x={0} y={-12} textAnchor="middle" fontSize={84} fontWeight={900} fill={YEL} stroke="#000" strokeWidth={8} paintOrder="stroke" style={{fontFamily: 'Pretendard'}}>{d.stamp[0]}</text>
          <text x={0} y={76} textAnchor="middle" fontSize={64} fontWeight={900} fill="#fff" stroke="#000" strokeWidth={7} paintOrder="stroke" style={{fontFamily: 'Pretendard'}}>{d.stamp[1]}</text>
        </g>
      )}
    </g>
  );

  return (
    <div style={{position: 'absolute', left: 0, top: STAGE_TOP, width: W, height: STAGE_H, overflow: 'hidden'}}>
      <svg width={W} height={STAGE_H} viewBox={`0 0 ${W} ${STAGE_H}`}>
        {mapK < 1 && sea}
        {map}
        {/* 장면 끝 4초는 CTA를 위해 살짝 어둡게 */}
        <rect x={0} y={0} width={W} height={STAGE_H} fill="#000" opacity={interpolate(t, [p.T - 4, p.T - 3.6], [0, 0.35], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
      </svg>
    </div>
  );
};
