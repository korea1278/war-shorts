// EP10 대한민국 국방비 vs 북한 1년 국민총소득 (1080x1920 · 30fps · 2D/SVG)
//  상단 25% 비교 카드 · 중앙 50% 한반도와 그래픽 · 하단 25% 의미 단위 자막. 장면은 실제 발음 시각에 맞춰 자동 배치
import React, {useMemo} from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';
import {CtaOverlay} from '../components/CtaOverlay';
import {SoundTrack} from '../components/SoundTrack';
import {Subtitles} from '../components/Subtitles';
import {CountUpText} from '../components/infographic/CountUpText';
import {NK_RED, ROK_BLUE, TerritoryHighlight} from '../components/infographic/TerritoryHighlight';
import {Jet, NukeIcon, Warship} from '../components/infographic/assets';
import {Cam, camAt, clamp01, FPS, makeProj, mosaicRect, Proj, QW} from '../ep05/layout';
import {InfographicProps} from '../ep05/types';
import {fontCss, usePretendard} from '../lib/font';
import {Episode, LngLat} from '../lib/types';
import {MoneyPlan, moneyPlan} from './plan';

const YELLOW = '#FFE500';
const RED = '#FF3B30';
const MAP_TOP = 480;
const MAP_H = 960;
const Q = 0.75; // QHD 좌표 → 1080 화면
const BASE_Y = 1400; // 동전 탑 바닥
const PX = 6.6; // 1조 원당 높이 (0부터 같은 축)
const STROKE = (w: number): React.CSSProperties => ({WebkitTextStroke: `${w}px #000`, paintOrder: 'stroke fill', fontWeight: 900});
const fade = (s: number, a: number, b: number, c: number, d: number) =>
  interpolate(s, [a, b, c, d], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

type MoneyEp = Episode & {
  stats: {rok: {value: number; note: string}; nk: {value: number; note: string}; procure: {value: number; total: number}};
  map: {fit: [number, number, number, number]; day: string; mdl: LngLat[]; north: LngLat; south: LngLat};
  title: string[];
};

// ── 상단: 뱃지 + 제목 + 비교 카드 ──
const Header: React.FC<{ep: MoneyEp; p: MoneyPlan; sec: number; frame: number}> = ({ep, p, sec, frame}) => {
  const card = (side: 'nk' | 'rok') => {
    const at = side === 'nk' ? p.nkV : p.rokV;
    const color = side === 'nk' ? NK_RED : ROK_BLUE;
    const st = ep.stats[side];
    const f = frame - Math.round((at - 0.15) * FPS);
    const sp = spring({frame: f, fps: FPS, config: {damping: 13, stiffness: 180, mass: 0.7}});
    return (
      <div style={{position: 'absolute', top: 318, left: side === 'nk' ? 28 : 552, width: 500, height: 154, boxSizing: 'border-box', opacity: f < 0 ? 0 : 1,
        transform: `scale(${0.85 + 0.15 * sp})`, background: 'rgba(8,10,16,0.94)', border: `5px solid ${color}`, borderRadius: 20, boxShadow: '0 7px 0 #000'}}>
        <div style={{position: 'absolute', top: 8, left: 0, width: '100%', textAlign: 'center', fontSize: 26, fontWeight: 900, color: '#fff'}}>{side === 'nk' ? '북한' : '대한민국'}</div>
        <div style={{position: 'absolute', top: 36, left: 0, width: '100%'}}>
          <CountUpText value={st.value} startFrame={Math.round(at * FPS)} prefix="약 " suffix="조 원" size={66} suffixScale={0.62} color={side === 'nk' ? '#fff' : YELLOW} />
        </div>
        <div style={{position: 'absolute', bottom: 8, left: 0, width: '100%', textAlign: 'center', fontSize: 23, fontWeight: 900, color: 'rgba(255,255,255,0.82)'}}>{st.note}</div>
      </div>
    );
  };
  const hook = fade(sec, 0.1, 0.4, p.rokV - 0.4, p.rokV - 0.15);
  return (
    <>
      <div style={{position: 'absolute', top: 130, left: 0, width: 1080, display: 'flex', justifyContent: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 900, color: '#FF3B30', ...STROKE(4)}}>
          <span>[</span><span style={{width: 18, height: 18, borderRadius: 9, background: '#FF3B30'}} /><span>가상 군사 시뮬레이션 IF ]</span>
        </div>
      </div>
      <div style={{position: 'absolute', top: 172, left: 30, width: 1020, textAlign: 'center'}}>
        {ep.title.map((l, i) => (
          <div key={i} style={{fontSize: i ? 62 : 60, lineHeight: 1.14, color: i ? YELLOW : '#fff', whiteSpace: 'nowrap', ...STROKE(6), textShadow: '4px 5px 0 #000'}}>{l}</div>
        ))}
      </div>
      <div style={{position: 'absolute', top: 340, left: 0, width: 1080, textAlign: 'center', opacity: hook, fontSize: 74, color: '#fff', ...STROKE(8), textShadow: '5px 6px 0 #000'}}>
        전쟁은 결국 <span style={{color: YELLOW}}>돈의 대결</span>
      </div>
      {card('nk')}
      {card('rok')}
    </>
  );
};

// ── 지도 ──
const MapStage: React.FC<{ep: MoneyEp; props: InfographicProps; p: MoneyPlan; pr: Proj; sec: number}> = ({ep, props, p, pr, sec}) => {
  const day = props.mosaics?.[ep.map.day];
  const rect = day ? {...mosaicRect(day, pr, ep.map.fit), file: day.file} : undefined;
  const C = {fx: QW / 2, fy: 610, sx: QW / 2, sy: 640};
  const [nx, ny] = pr.p(ep.map.north);
  const [sx, sy] = pr.p(ep.map.south);
  const N = {s: 1.5, fx: nx, fy: ny, sx: QW / 2, sy: 640};
  const S = {s: 1.5, fx: sx, fy: sy, sx: QW / 2, sy: 760};
  const keys: Cam[] = [
    {t: 0, s: 1.08, ...C}, {t: p.turn, s: 1.0, ...C}, {t: p.south - 0.2, s: 1.0, ...C}, {t: p.south + 0.8, ...S}, {t: p.north - 0.2, ...S},
    {t: p.north + 0.8, ...N}, {t: p.chase - 0.2, ...N}, {t: p.chase + 0.6, s: 1.0, ...C}, {t: p.nuke - 0.2, s: 1.0, ...C}, {t: p.nuke + 0.8, ...N}, {t: p.T, ...N, s: 1.58},
  ];
  const cam = camAt(keys, sec);
  const reveal = interpolate(sec, [0.15, 0.9], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const line = interpolate(sec, [0.5, 1.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const turnGlow = sec >= p.turn && sec < p.south ? 0.5 + 0.5 * Math.sin(sec * 7) : 0;
  const dim = Math.max(
    0.46 * fade(sec, p.rok - 0.2, p.rok + 0.3, p.turn - 0.3, p.turn),
    0.46 * fade(sec, p.chase - 0.2, p.chase + 0.3, p.nuke - 0.3, p.nuke),
    0.28 * fade(sec, p.north - 0.2, p.north + 0.4, p.chase - 0.3, p.chase),
    0.28 * fade(sec, p.weapons - 0.2, p.weapons + 0.3, p.north - 0.3, p.north),
  );
  return (
    <div style={{position: 'absolute', top: MAP_TOP, left: 0, width: 1080, height: MAP_H, overflow: 'hidden', background: '#0b1018'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: QW, height: 1280, transform: `scale(${Q})`, transformOrigin: '0 0'}}>
        <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${cam.sx - cam.s * cam.fx}px, ${cam.sy - cam.s * cam.fy}px) scale(${cam.s})`}}>
          {rect && <Img src={staticFile(rect.file)} style={{position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height}} />}
          <div style={{position: 'absolute', left: -600, top: -600, width: QW + 1200, height: 2480, background: 'rgba(3,6,12,0.32)'}} />
          {props.geo && <TerritoryHighlight geo={props.geo} pr={pr} mdl={ep.map.mdl} reveal={reveal} line={line} fillOpacity={0.5 + 0.12 * turnGlow} flagOpacity={0.24} pulseNk={sec >= p.nuke ? 0.5 + 0.5 * Math.sin(sec * 6) : 0} />}
        </div>
      </div>
      <div style={{position: 'absolute', inset: 0, background: `rgba(0,0,0,${dim})`}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 50, background: 'linear-gradient(#05070a, rgba(5,7,10,0))'}} />
      <div style={{position: 'absolute', left: 0, bottom: 0, width: 1080, height: 90, background: 'linear-gradient(rgba(5,7,10,0), #05070a)'}} />
    </div>
  );
};

// ── 입체 동전 탑 (0부터 같은 축: 66조와 48조 높이가 숫자 비례) ──
const CoinTower: React.FC<{x: number; value: number; grow: number; gold: boolean; label: string}> = ({x, value, grow, gold, label}) => {
  const W = 250, COIN = 21;
  const h = value * PX * grow;
  const n = Math.max(0, Math.floor(h / COIN));
  const [side, top, edge] = gold ? ['#c8920f', '#ffd34d', '#7a5606'] : ['#8f8f8f', '#c9c9c9', '#505050'];
  return (
    <div style={{position: 'absolute', left: x - W / 2, top: BASE_Y - h - 90, width: W, height: h + 90}}>
      <svg width={W} height={h + 90} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {Array.from({length: n}).map((_, i) => {
          const y = h + 60 - (i + 1) * COIN;
          const jig = Math.sin(i * 7.3) * 5;
          return (
            <g key={i} transform={`translate(${jig},0)`}>
              <path d={`M8 ${y + 24} L8 ${y + 44} A117 24 0 0 0 242 ${y + 44} L242 ${y + 24} Z`} fill={side} stroke={edge} strokeWidth={3} />
              <ellipse cx={125} cy={y + 24} rx={117} ry={24} fill={top} stroke={edge} strokeWidth={3} />
            </g>
          );
        })}
      </svg>
      <div style={{position: 'absolute', top: -34, left: -60, width: W + 120, textAlign: 'center', fontSize: 58, color: gold ? YELLOW : '#fff', opacity: grow > 0.1 ? 1 : 0, ...STROKE(7), textShadow: '4px 5px 0 #000'}}>{label}</div>
    </div>
  );
};

const Towers: React.FC<{ep: MoneyEp; p: MoneyPlan; sec: number; frame: number}> = ({ep, p, sec, frame}) => {
  const first = fade(sec, p.rok - 0.1, p.rok + 0.2, p.turn - 0.25, p.turn);
  const again = fade(sec, p.chase - 0.1, p.chase + 0.2, p.nuke - 0.25, p.nuke);
  const op = Math.max(first, again);
  if (op <= 0) return null;
  const isChase = again > 0;
  const rokG = isChase ? 1 : easeOut((sec - p.rokV) / 0.9);
  const nkG = isChase ? easeOut((sec - p.chase) / 1.6) : easeOut((sec - p.nkV) / 0.9);
  const rokY = BASE_Y - ep.stats.rok.value * PX - 30;
  const stF = frame - Math.round(p.ratio * FPS);
  const slam = spring({frame: stF, fps: FPS, config: {damping: 10, stiffness: 260, mass: 0.9}});
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <CoinTower x={290} value={ep.stats.nk.value} grow={nkG} gold={false} label="48조" />
      <CoinTower x={790} value={ep.stats.rok.value} grow={rokG} gold label="66조" />
      {isChase && (
        <svg style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920}}>
          <line x1={110} x2={960} y1={rokY + 30} y2={rokY + 30} stroke={YELLOW} strokeWidth={6} strokeDasharray="22 14" />
        </svg>
      )}
      {isChase && (
        <div style={{position: 'absolute', left: 80, top: rokY - 58, width: 430, textAlign: 'center', fontSize: 40, color: RED, opacity: clamp01((sec - p.chase - 1.6) / 0.3), ...STROKE(6)}}>1년 치 전부 넣어도</div>
      )}
      {!isChase && stF >= 0 && (
        <div style={{position: 'absolute', left: 0, top: 590, width: 1080, display: 'flex', justifyContent: 'center'}}>
          <div style={{transform: `rotate(-7deg) scale(${2.1 - 1.1 * slam})`, background: '#D32F2F', border: '7px solid #fff', outline: '6px solid #000', borderRadius: 16, padding: '4px 40px 12px', fontSize: 104, color: YELLOW, ...STROKE(7)}}>1.3배</div>
        </div>
      )}
    </div>
  );
};

// ── 남측 전력 양산 라인 ──
const ProductionLine: React.FC<{p: MoneyPlan; sec: number; frame: number}> = ({p, sec, frame}) => {
  const op = fade(sec, p.south - 0.1, p.south + 0.4, p.north - 0.3, p.north);
  if (op <= 0) return null;
  const wrap = (i: number, gap: number, v: number) => (((frame * v + i * gap) % (gap * 4)) + gap * 4) % (gap * 4) - 300;
  const lane = (top: number, label: string, children: (i: number) => React.ReactNode, gap: number, v: number) => (
    <div style={{position: 'absolute', left: 0, top, width: 1080, height: 180, background: 'rgba(0,18,48,0.72)', borderTop: `4px solid ${ROK_BLUE}`, borderBottom: `4px solid ${ROK_BLUE}`, overflow: 'hidden'}}>
      <svg width={1080} height={180} style={{position: 'absolute'}}>
        {Array.from({length: 28}).map((_, i) => <line key={i} x1={((i * 40 + frame * v) % 1120) - 40} x2={((i * 40 + frame * v) % 1120) - 60} y1={170} y2={150} stroke="rgba(160,205,255,0.5)" strokeWidth={5} />)}
      </svg>
      {[0, 1, 2, 3].map((i) => <div key={i} style={{position: 'absolute', left: wrap(i, 400, v), top: 10}}>{children(i)}</div>)}
      <div style={{position: 'absolute', left: 22, top: 8, fontSize: 40, color: YELLOW, ...STROKE(6)}}>{label}</div>
    </div>
  );
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      {lane(1010, 'F-35A 스텔스기', () => <Jet size={150} color="#5aa0ff" heading={90} />, 400, 5)}
      {lane(1210, '이지스함', () => <div style={{marginTop: 42}}><Warship width={280} color="#3d7fe0" /></div>, 400, 3)}
    </div>
  );
};

// ── 무기 구입·개발비 막대 ──
const ProcureBar: React.FC<{ep: MoneyEp; p: MoneyPlan; sec: number}> = ({ep, p, sec}) => {
  const op = fade(sec, p.weapons - 0.1, p.weapons + 0.3, p.north - 0.3, p.north);
  if (op <= 0) return null;
  const W = 960;
  const {value, total} = ep.stats.procure;
  const fill = (value / total) * W * easeOut((sec - p.procure) / 0.8);
  const show = sec >= p.pct - 0.05;
  return (
    <div style={{position: 'absolute', left: 60, top: 590, width: W, opacity: op}}>
      <div style={{fontSize: 44, color: '#fff', textAlign: 'center', ...STROKE(6), marginBottom: 16}}>북한 1년 국민총소득 48조 원 중</div>
      <div style={{position: 'relative', width: W, height: 118, background: 'rgba(120,20,20,0.88)', border: '6px solid #000', borderRadius: 16, boxSizing: 'border-box', overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, top: 0, height: '100%', width: fill, background: '#e7b416'}} />
      </div>
      <div style={{position: 'absolute', top: 76, left: 24, fontSize: 62, color: '#fff', ...STROKE(7), opacity: sec >= p.procure ? 1 : 0}}>약 20조 원</div>
      <div style={{textAlign: 'right', fontSize: 66, color: YELLOW, ...STROKE(7), textShadow: '4px 5px 0 #000', opacity: show ? 1 : 0, marginTop: 8}}>40% 넘음</div>
      <div style={{position: 'absolute', top: 212, left: 0, fontSize: 30, color: 'rgba(255,255,255,0.85)', ...STROKE(4)}}>한국 방위력개선비(무기 구입·개발)</div>
    </div>
  );
};

// ── 북측 구형 미그기 (옆모습) + 빈 연료계 ──
const OldMig: React.FC<{rust: number}> = ({rust}) => {
  const spots = [[150, 92, 44], [250, 80, 56], [340, 100, 38], [430, 86, 52], [520, 98, 40], [205, 118, 30], [395, 122, 34], [300, 60, 26], [470, 58, 30]];
  return (
    <svg width={760} height={285} viewBox="0 0 640 240" style={{overflow: 'visible'}}>
      <defs><clipPath id="migBody"><path d="M18 104 L120 70 L300 58 L470 62 L600 44 L626 50 L610 108 L560 136 L300 142 L120 134 Z" /></clipPath></defs>
      <path d="M470 62 L560 2 L602 2 L590 62 Z" fill="#6f7478" stroke="#000" strokeWidth={5} strokeLinejoin="round" />
      <path d="M18 104 L120 70 L300 58 L470 62 L600 44 L626 50 L610 108 L560 136 L300 142 L120 134 Z" fill="#878c90" stroke="#000" strokeWidth={5} strokeLinejoin="round" />
      <path d="M140 68 Q190 26 250 60 Z" fill="#3b4a55" stroke="#000" strokeWidth={5} />
      <path d="M260 118 L440 118 L350 196 L276 196 Z" fill="#6f7478" stroke="#000" strokeWidth={5} strokeLinejoin="round" />
      <ellipse cx={30} cy={104} rx={14} ry={24} fill="#16181a" stroke="#000" strokeWidth={4} />
      <g clipPath="url(#migBody)" opacity={rust}>
        {spots.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.62} fill={i % 2 ? '#7a3a14' : '#a24f1a'} />)}
        <path d="M120 96 L190 104 L250 94 M360 76 L420 110 L500 96" fill="none" stroke="#231106" strokeWidth={4} />
      </g>
      <path d="M170 138 L170 196 M430 136 L430 196" stroke="#000" strokeWidth={8} />
      <circle cx={170} cy={210} r={22} fill="#16181a" /><circle cx={430} cy={210} r={22} fill="#16181a" />
      <line x1={-20} x2={670} y1={234} y2={234} stroke="rgba(255,255,255,0.65)" strokeWidth={6} strokeDasharray="44 26" />
    </svg>
  );
};

const FuelGauge: React.FC<{v: number}> = ({v}) => {
  const a = -120 + 120 * (0.95 - 0.92 * v);
  return (
    <svg width={190} height={130} viewBox="0 0 190 130">
      <path d="M20 118 A75 75 0 0 1 170 118" fill="rgba(0,0,0,0.82)" stroke="#fff" strokeWidth={8} />
      <text x={22} y={108} fill={RED} fontSize={30} fontWeight={900}>E</text>
      <text x={150} y={108} fill="#fff" fontSize={30} fontWeight={900}>F</text>
      <g transform={`rotate(${a + 30} 95 118)`}><line x1={95} y1={118} x2={95} y2={52} stroke={RED} strokeWidth={9} strokeLinecap="round" /></g>
      <circle cx={95} cy={118} r={11} fill="#fff" />
    </svg>
  );
};

const NorthMig: React.FC<{p: MoneyPlan; sec: number}> = ({p, sec}) => {
  const op = fade(sec, p.north - 0.1, p.north + 0.4, p.chase - 0.3, p.chase);
  if (op <= 0) return null;
  const v = clamp01((sec - p.north - 0.3) / 2.2);
  const rust = interpolate(sec, [p.north + 0.5, p.rust + 1.8], [0.12, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <div style={{position: 'absolute', left: 150, top: 800}}><OldMig rust={rust} /></div>
      <div style={{position: 'absolute', left: 0, top: 1115, width: 1080, textAlign: 'center', fontSize: 58, color: '#fff', ...STROKE(7)}}>구형 미그기</div>
      <div style={{position: 'absolute', left: 840, top: 610}}>
        <FuelGauge v={v} />
        <div style={{textAlign: 'center', fontSize: 36, color: RED, ...STROKE(6), marginTop: 2}}>연료 부족</div>
      </div>
    </div>
  );
};

// ── 핵 ──
const Nuke: React.FC<{p: MoneyPlan; sec: number; frame: number}> = ({p, sec, frame}) => {
  if (sec < p.nuke) return null;
  const f = frame - Math.round(p.nuke * FPS);
  const pop = spring({frame: f - 6, fps: FPS, config: {damping: 8, stiffness: 160, mass: 0.8}});
  const X = 540, Y = 860;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <svg style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920}}>
        {[0, 1, 2].map((i) => {
          const ph = ((f / FPS) * 1.1 + i / 3) % 1;
          return <circle key={i} cx={X} cy={Y} r={110 + 280 * ph} fill="none" stroke={RED} strokeWidth={7} opacity={(1 - ph) * clamp01(f / 8)} />;
        })}
      </svg>
      <div style={{position: 'absolute', left: X - 130, top: Y - 130, width: 260, height: 260, transform: `scale(${Math.max(0, pop)})`}}><NukeIcon size={260} /></div>
    </div>
  );
};

export const MoneyWar: React.FC<InfographicProps> = (props) => {
  usePretendard();
  const frame = useCurrentFrame();
  const ep = props.episode as unknown as MoneyEp | undefined;
  const tl = props.timeline;
  const pr = useMemo(() => (ep ? makeProj(ep.map.fit) : null), [ep]);
  const p = useMemo(() => (ep && tl ? moneyPlan(ep, tl) : null), [ep, tl]);
  if (!ep || !tl || !pr || !p) return null;
  const sec = frame / FPS;
  return (
    <AbsoluteFill style={{background: '#05070a', fontFamily: 'Pretendard, sans-serif'}}>
      <style>{fontCss()}</style>
      <MapStage ep={ep} props={props} p={p} pr={pr} sec={sec} />
      <Towers ep={ep} p={p} sec={sec} frame={frame} />
      <ProductionLine p={p} sec={sec} frame={frame} />
      <ProcureBar ep={ep} p={p} sec={sec} />
      <NorthMig p={p} sec={sec} />
      <Nuke p={p} sec={sec} frame={frame} />
      <Header ep={ep} p={p} sec={sec} frame={frame} />
      <Subtitles timeline={tl} episode={ep} />
      <CtaOverlay episode={ep} timeline={tl} />
      <SoundTrack ep={props.ep} episode={ep} timeline={tl} />
    </AbsoluteFill>
  );
};
