// EP06 한국형 다층 방공망 시뮬레이션 (QHD 1440x2560 · 30fps · 순수 2D/SVG 벡터)
//  인트로·발사(한반도 지도 위 수십 줄기 붉은 궤적) → 고도 레이어 측면 시뮬레이션
//  L-SAM 상층 직격 → KN-23 풀업 → 천궁-II·PAC-3 2중 그물 → LAMD 요격 돔 → 1발 관통 → 3축 결론
import React, {useMemo} from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';
import {Subtitles} from '../components/Subtitles';
import {CtaOverlay} from '../components/CtaOverlay';
import {SoundTrack} from '../components/SoundTrack';
import {BouncingAsset} from '../components/infographic/BouncingAsset';
import {CountUpText, HARD_TEXT} from '../components/infographic/CountUpText';
import {TerritoryHighlight} from '../components/infographic/TerritoryHighlight';
import {AltitudeLayerGrid} from '../components/infographic/AltitudeLayerGrid';
import {MissileTrajectory} from '../components/infographic/MissileTrajectory';
import {CheongungLauncher, GreenPineRadar, LamdLauncher, LsamLauncher, PatriotLauncher, Skyline} from '../components/infographic/defenseAssets';
import {fontCss, usePretendard} from '../lib/font';
import {Episode, LngLat} from '../lib/types';
import {BADGE_Y, clamp01, easeInOut, FPS, makeProj, MAP, mosaicRect, PANEL, Proj, QH, QW, TITLE_Y, UP} from '../ep05/layout';
import {plan, Plan, sceneOf} from './plan';
import {BAT, buildSim, KPX, Sim, SV, yAlt} from './sim';
import {DefenseEpisode, DefenseProps} from './types';

const YELLOW = '#FFD000';
const RED = '#FF2828';
const CYAN = '#00E5FF';
const GREEN = '#00FF66';

// ───────────────────────── 상단: 뱃지 + 타이틀 ─────────────────────────
const Header: React.FC<{ep: DefenseEpisode; p: Plan; sec: number}> = ({ep, p, sec}) => {
  const m = clamp01((sec - (p.launch - 0.3)) / 0.55);
  const k = m * m * (3 - 2 * m);
  const introIn = interpolate(sec, [0, 0.35], [0, 1], {extrapolateRight: 'clamp'});
  const maxLen = Math.max(...ep.title.map((l) => l.length));
  const fit = (base: number) => Math.min(base, Math.floor((QW - 110) / (maxLen * 0.93)));
  const size = fit(128) + (fit(82) - fit(128)) * k;
  const top = MAP.top + 280 + (TITLE_Y - MAP.top - 280) * k;
  return (
    <>
      <div style={{position: 'absolute', top: BADGE_Y, left: 0, width: QW, display: 'flex', justifyContent: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '8px 30px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.78)',
          border: '4px solid #FF3B30', color: '#fff', fontSize: 34, fontWeight: 900, letterSpacing: 1}}>
          <span>[</span>
          <span style={{width: 24, height: 24, borderRadius: 12, background: '#FF3B30', display: 'inline-block'}} />
          <span>가상 군사 시뮬레이션 IF ]</span>
        </div>
      </div>
      <div style={{position: 'absolute', top, left: 40, width: QW - 80, textAlign: 'center', transform: `scale(${0.8 + 0.2 * introIn})`, opacity: introIn}}>
        {ep.title.map((line, i) => (
          <div key={i} style={{...HARD_TEXT, fontSize: size, lineHeight: 1.12, color: i === 1 ? YELLOW : '#fff', whiteSpace: 'nowrap',
            WebkitTextStroke: `${Math.round(5 + 5 * (1 - k))}px #000`, textShadow: `${Math.round(5 + 3 * (1 - k))}px ${Math.round(6 + 3 * (1 - k))}px 0 #000`}}>{line}</div>
        ))}
      </div>
    </>
  );
};

// ───────────────────────── 패널 ─────────────────────────
const Chip: React.FC<{text: string; color: string; size?: number; fg?: string}> = ({text, color, size = 40, fg = '#000'}) => (
  <div style={{display: 'inline-block', background: color, color: fg, fontSize: size, fontWeight: 900, padding: '4px 22px 8px', borderRadius: 14,
    border: '4px solid #000', lineHeight: 1.1, whiteSpace: 'nowrap'}}>{text}</div>
);
const BIG = (size: number, color = '#fff'): React.CSSProperties => ({...HARD_TEXT, fontSize: size, color, whiteSpace: 'nowrap', lineHeight: 1.1});
const box = (color: string): React.CSSProperties => ({
  position: 'absolute', boxSizing: 'border-box', background: 'rgba(8,10,16,0.92)', border: `6px solid ${color}`, borderRadius: 28, boxShadow: '0 10px 0 #000',
});
const Center: React.FC<{top: number; children: React.ReactNode}> = ({top, children}) => (
  <div style={{position: 'absolute', top, left: 0, width: QW, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24}}>{children}</div>
);

const Warn: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M50 6 L96 90 L4 90 Z" fill={YELLOW} stroke="#000" strokeWidth={7} strokeLinejoin="round" />
    <rect x={44} y={34} width={12} height={32} rx={4} fill="#000" />
    <circle cx={50} cy={77} r={7} fill="#000" />
  </svg>
);

const ThreatCards: React.FC<{ep: DefenseEpisode; p: Plan; sec: number}> = ({ep, p, sec}) => (
  <>
    {ep.threat.cards.map((c, i) => (
      <div key={i} style={{...box(i === 0 ? YELLOW : RED), top: 14, left: 30 + i * 466, width: 448, height: 236, padding: '14px 10px',
        opacity: clamp01((sec - p.cards[i] + 0.15) / 0.2), transform: `scale(${0.85 + 0.15 * clamp01((sec - p.cards[i] + 0.15) / 0.25)})`}}>
        <div style={{textAlign: 'center'}}><Chip text={c.label} color={i === 0 ? YELLOW : RED} size={34} fg={i === 0 ? '#000' : '#fff'} /></div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 96}}>
          <CountUpText value={c.value} decimals={c.decimals ?? 0} prefix={c.prefix} suffix={c.unit} size={104} suffixScale={0.46}
            startFrame={Math.round(p.cards[i] * FPS)} color={i === 0 ? YELLOW : '#fff'} />
        </div>
      </div>
    ))}
    {ep.threat.source && <div style={{position: 'absolute', top: 262, right: 36, fontSize: 24, fontWeight: 900, color: 'rgba(255,255,255,0.6)'}}>{ep.threat.source}</div>}
  </>
);

const Panel: React.FC<{ep: DefenseEpisode; p: Plan; sec: number; frame: number}> = ({ep, p, sec, frame}) => {
  const sc = sceneOf(p, sec);
  if (sc === 'intro') return null;
  const which = sc === 'cta' ? 'outro' : sc;
  const startSec = {launch: p.launch, lsam: p.lsam, pullup: p.pullup, mid: p.mid, lamd: p.lamd, outro: p.outro}[which];
  const f = frame - Math.round(startSec * FPS);
  const sp = spring({frame: f, fps: FPS, config: {damping: 13, stiffness: 170, mass: 0.7}});
  const op = interpolate(f, [0, 5], [0, 1], {extrapolateRight: 'clamp'});
  const coreOn = sec >= p.core;
  const cf = frame - Math.round(p.core * FPS);
  return (
    <div style={{position: 'absolute', top: PANEL.top, left: 0, width: QW, height: PANEL.h, opacity: op, transform: `scale(${0.88 + 0.12 * sp})`, transformOrigin: '50% 30%'}}>
      {which === 'launch' && <ThreatCards ep={ep} p={p} sec={sec} />}
      {which === 'lsam' && (
        <>
          <Center top={0}><Chip text="1차 · 상층 요격" color={CYAN} size={38} /><div style={BIG(64, CYAN)}>L-SAM</div></Center>
          <div style={{position: 'absolute', top: 82, left: 0, width: QW}}>
            <CountUpText value={ep.lsam.alt} prefix="상공" suffix="km" size={124} suffixScale={0.5} startFrame={Math.round((p.lsam + 0.35) * FPS)} color={YELLOW} />
          </div>
          <Center top={222}><div style={BIG(50)}>{ep.lsam.caption.split(',').slice(1).join(',').trim() || ep.lsam.caption}</div>
            {ep.lsam.note && <Chip text={ep.lsam.note} color="#fff" size={34} />}</Center>
        </>
      )}
      {which === 'pullup' && (
        <>
          <Center top={30}><Warn size={150} /><div style={BIG(108, RED)}>{ep.pullup.caption}</div></Center>
          {ep.pullup.sub && <Center top={205}><div style={BIG(50)}>{ep.pullup.sub}</div></Center>}
        </>
      )}
      {which === 'mid' && (
        <>
          <Center top={0}><Chip text="2차 · 중·하층 요격" color={GREEN} size={38} /><div style={BIG(62, YELLOW)}>{ep.mid.caption}</div></Center>
          {ep.mid.cards.map((c, i) => {
            const k = spring({frame: frame - Math.round((p.midFire + i * 0.2) * FPS), fps: FPS, config: {damping: 11, stiffness: 180, mass: 0.7}});
            return (
              <div key={i} style={{...box(c.color), top: 92, left: 34 + i * 702, width: 670, height: 190, padding: '18px 24px', textAlign: 'center',
                transform: `scale(${0.6 + 0.4 * k})`, opacity: k > 0.02 ? 1 : 0}}>
                <div style={BIG(c.name.length > 8 ? 62 : 76, c.color)}>{c.name}</div>
                <div style={{...BIG(52), marginTop: 12}}>고도 {c.range}</div>
              </div>
            );
          })}
          <div style={{position: 'absolute', top: 160, left: QW / 2 - 46, width: 92, height: 92, borderRadius: 46, background: '#000', border: `5px solid ${YELLOW}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, fontWeight: 900, color: YELLOW}}>+</div>
        </>
      )}
      {which === 'lamd' && (
        <>
          <Center top={0}><Chip text="3차 · 최후의 보루" color={YELLOW} size={38} /><div style={BIG(56)}>{ep.lamd.caption}</div></Center>
          <Center top={84}><div style={BIG(96, YELLOW)}>한국형 아이언돔 LAMD</div></Center>
          <Center top={212}><Chip text={ep.lamd.range} color={YELLOW} size={38} /><Chip text={ep.lamd.status} color="#fff" size={38} /></Center>
        </>
      )}
      {which === 'outro' && !coreOn && (
        <Center top={70}><div style={BIG(Math.min(110, Math.floor((QW - 100) / (ep.outro.line1.length * 0.93))))}>
          <span style={{color: RED}}>{ep.outro.line1.split(' ')[0]}</span> {ep.outro.line1.split(' ').slice(1).join(' ')}
        </div></Center>
      )}
      {which === 'outro' && coreOn && (
        <>
          <Center top={0}><div style={BIG(56, YELLOW)}>3축 체계의 진짜 핵심</div></Center>
          {ep.outro.pillars.map((pl, i) => {
            const k = spring({frame: cf - i * 4, fps: FPS, config: {damping: 10, stiffness: 190, mass: 0.7}});
            const c = pl.on ? YELLOW : '#8a8f99';
            return (
              <div key={i} style={{...box(c), top: 84, left: 30 + i * 466, width: 448, height: 196, padding: '20px 10px', textAlign: 'center',
                opacity: (pl.on ? 1 : 0.5) * clamp01(k * 3), transform: `scale(${0.5 + 0.5 * k})`}}>
                <div style={BIG(78, pl.on ? YELLOW : '#c9ccd2')}>{pl.name}</div>
                <div style={{...BIG(40), marginTop: 14, color: pl.on ? '#fff' : '#c9ccd2'}}>{pl.desc}</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

// ───────────────────────── 인트로: 한반도 지도 + 수십 줄기 궤적 ─────────────────────────
const bez = (a: [number, number], c: [number, number], b: [number, number], t: number): [number, number] => [
  (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];

const MapIntro: React.FC<{ep: DefenseEpisode; props: DefenseProps; p: Plan; pr: Proj; sec: number; op: number}> = ({ep, props, p, pr, sec, op}) => {
  if (op <= 0) return null;
  const day = props.mosaics?.[ep.map.day];
  const dayRect = day ? {...mosaicRect(day, pr, ep.map.fit), file: day.file} : undefined;
  const py = pr.p(ep.map.pyongyang);
  const se = pr.p(ep.map.seoul);
  const z = easeInOut(clamp01((sec - p.launch) / 1.3));
  const s = 1 + 0.5 * z;
  const cx = QW / 2, cy = MAP.h / 2;
  const fx = cx + ((py[0] + se[0]) / 2 - cx) * z;
  const fy = cy + ((py[1] + se[1]) / 2 + 40 - cy) * z;
  const arcs = Array.from({length: 26}).map((_, i) => {
    const a = pr.p(ep.map.launchSites[i % ep.map.launchSites.length] as LngLat);
    const b = pr.p(ep.map.targets[(i * 3 + Math.floor(i / 10)) % ep.map.targets.length] as LngLat);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    const sign = i % 2 ? 1 : -1;
    const c: [number, number] = [(a[0] + b[0]) / 2 + nx * len * 0.2 * sign, (a[1] + b[1]) / 2 + ny * len * 0.2 * sign];
    const t0 = i < 16 ? 0.2 + i * 0.1 : p.launch - 0.4 + (i - 16) * 0.12;
    return {a, b, c, t0, i};
  });
  const distOn = clamp01((sec - p.cards[0] + 0.1) / 0.5);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: QW, height: MAP.h, transformOrigin: '0 0', transform: `translate(${cx - s * fx}px, ${cy - s * fy}px) scale(${s})`}}>
        {dayRect ? <Img src={staticFile(dayRect.file)} style={{position: 'absolute', left: dayRect.left, top: dayRect.top, width: dayRect.width, height: dayRect.height}} />
          : <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(#0d1b2a, #0a1520)'}} />}
        <div style={{position: 'absolute', left: -400, top: -400, width: QW + 800, height: MAP.h + 800, background: 'rgba(3,6,12,0.45)'}} />
        {props.geo && <TerritoryHighlight geo={props.geo} pr={pr} mdl={ep.map.mdl} reveal={clamp01(sec / 0.6)} line={clamp01((sec - 0.3) / 0.8)}
          fillOpacity={0.42} flagOpacity={0.22} pulseNk={0.5 + 0.5 * Math.sin(sec * 5)} />}
        <svg width={QW} height={MAP.h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          {arcs.map(({a, b, c, t0, i}) => {
            const k = clamp01((sec - t0) / 1.5);
            if (k <= 0) return null;
            const e = 1 - Math.pow(1 - k, 2);
            const d = `M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`;
            const hd = bez(a, c, b, e);
            const fl = sec - t0;
            return (
              <g key={i}>
                {fl < 0.5 && <circle cx={a[0]} cy={a[1]} r={14 + 50 * fl} fill="#FFB347" fillOpacity={0.9 * (1 - fl / 0.5)} />}
                <path d={d} pathLength={1} fill="none" stroke={RED} strokeOpacity={0.25} strokeWidth={16} strokeDasharray="1 1" strokeDashoffset={1 - e} strokeLinecap="round" />
                <path d={d} pathLength={1} fill="none" stroke={RED} strokeWidth={6} strokeDasharray="1 1" strokeDashoffset={1 - e} strokeLinecap="round" />
                {k < 1 ? <circle cx={hd[0]} cy={hd[1]} r={10} fill="#fff" stroke={RED} strokeWidth={5} />
                  : <circle cx={b[0]} cy={b[1]} r={12 + 6 * Math.sin(sec * 8 + i)} fill="none" stroke={RED} strokeWidth={5} />}
              </g>
            );
          })}
          {distOn > 0 && (
            <g opacity={distOn}>
              <line x1={py[0]} y1={py[1]} x2={se[0]} y2={se[1]} stroke="#000" strokeWidth={14 / s} strokeDasharray={`${22 / s} ${12 / s}`} />
              <line x1={py[0]} y1={py[1]} x2={se[0]} y2={se[1]} stroke={YELLOW} strokeWidth={8 / s} strokeDasharray={`${22 / s} ${12 / s}`} />
              <circle cx={py[0]} cy={py[1]} r={12 / s} fill={RED} stroke="#000" strokeWidth={4 / s} />
            </g>
          )}
        </svg>
        {distOn > 0 && (
          <>
            <div style={{position: 'absolute', left: (py[0] + se[0]) / 2 + 30 / s, top: (py[1] + se[1]) / 2 - 40 / s, opacity: distOn, transform: `scale(${1 / s})`, transformOrigin: '0 0'}}>
              <Chip text="약 200km" color={YELLOW} size={46} />
            </div>
            <div style={{position: 'absolute', left: py[0] - 14 / s, top: py[1] - 80 / s, opacity: distOn, transform: `scale(${1 / s})`, transformOrigin: '0 0'}}>
              <Chip text="평양" color={RED} size={40} fg="#fff" />
            </div>
          </>
        )}
        {sec >= p.launch && (
          <>
            <svg width={QW} height={MAP.h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
              {[0, 1, 2].map((i) => {
                const ph = ((sec - p.launch) * 1.0 + i / 3) % 1;
                return <circle key={i} cx={se[0]} cy={se[1]} r={(10 + 90 * ph) / s} fill="none" stroke={YELLOW} strokeWidth={6 / s} opacity={1 - ph} />;
              })}
              <circle cx={se[0]} cy={se[1]} r={11 / s} fill={YELLOW} stroke="#000" strokeWidth={4 / s} />
            </svg>
            <div style={{position: 'absolute', left: se[0] - 150 / s, top: se[1] + 22 / s, transform: `scale(${1 / s})`, transformOrigin: '0 0'}}>
              <Chip text="서울" color={YELLOW} size={44} />
            </div>
          </>
        )}
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: QW, height: 70, background: 'linear-gradient(#05070a, rgba(5,7,10,0))'}} />
      <div style={{position: 'absolute', left: 0, bottom: 0, width: QW, height: 170, background: 'linear-gradient(rgba(5,7,10,0), #05070a)'}} />
    </div>
  );
};

// ───────────────────────── 측면 고도 시뮬레이션 무대 ─────────────────────────
const Dome: React.FC<{g: number; sec: number}> = ({g, sec}) => {
  if (g <= 0) return null;
  const cx = BAT.dome, cy = SV.groundY, rx = 300, ry = 15 * KPX;
  const half = (sx: number, sy: number) => `M${cx - rx * sx} ${cy} A${rx * sx} ${ry * sy} 0 0 1 ${cx + rx * sx} ${cy}`;
  const shimmer = 0.75 + 0.25 * Math.sin(sec * 7);
  return (
    <svg width={QW} height={MAP.h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs><clipPath id="dome-clip"><rect x={0} y={0} width={SV.plotR} height={SV.groundY} /></clipPath></defs>
      <g clipPath="url(#dome-clip)" transform={`translate(${cx} ${cy}) scale(${g}) translate(${-cx} ${-cy})`}>
        <path d={half(1, 1) + 'Z'} fill={YELLOW} fillOpacity={0.12 * shimmer} />
        {[0.25, 0.5, 0.75].map((h) => {
          const w = rx * Math.sqrt(1 - h * h);
          return <line key={h} x1={cx - w} x2={cx + w} y1={cy - ry * h} y2={cy - ry * h} stroke={YELLOW} strokeOpacity={0.45} strokeWidth={3} />;
        })}
        {[0.33, 0.66].map((m) => <path key={m} d={half(m, 1)} fill="none" stroke={YELLOW} strokeOpacity={0.45} strokeWidth={3} />)}
        <path d={half(1, 1)} fill="none" stroke={YELLOW} strokeOpacity={0.25} strokeWidth={22} />
        <path d={half(1, 1)} fill="none" stroke={YELLOW} strokeWidth={6} opacity={shimmer} />
      </g>
    </svg>
  );
};

const AssetLabel: React.FC<{x: number; text: string; color: string; op: number}> = ({x, text, color, op}) => (
  <div style={{position: 'absolute', left: x - 150, top: SV.groundY + 16, width: 300, textAlign: 'center', opacity: op}}>
    <span style={{display: 'inline-block', background: 'rgba(0,0,0,0.85)', border: `4px solid ${color}`, borderRadius: 12, padding: '0 14px 4px',
      fontSize: 30, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap'}}>{text}</span>
  </div>
);

const SideStage: React.FC<{ep: DefenseEpisode; p: Plan; sim: Sim; sec: number; op: number}> = ({ep, p, sim, sec, op}) => {
  if (op <= 0) return null;
  const sc = sceneOf(p, sec);
  const active = sc === 'lsam' ? 'high' : sc === 'pullup' || sc === 'mid' ? 'mid' : sc === 'lamd' ? 'low' : undefined;
  const reveal = clamp01((sec - p.lsam + 0.15) / 0.9);
  const fr = (s: number) => Math.round(s * FPS);
  const AW = 190, AH = AW * 0.62;
  const assetY = SV.groundY - AH + 14;
  const tIn = {radar: p.lsam + 0.15, lsam: p.lsam + 0.3, cg: Math.min(p.mid, p.midHit - 1.7), pac: Math.min(p.mid + 0.15, p.midHit - 1.6), lamd: p.lamd + 0.05};
  const lab = (t: number) => clamp01((sec - t - 0.3) / 0.3);
  const kills = sim.kills.filter((t) => t <= sec).length;
  const lastKill = sim.kills.filter((t) => t <= sec).pop() ?? -9;
  const punch = 1 + 0.25 * Math.max(0, 1 - (sec - lastKill) / 0.25);
  const leakT = sim.warheads[sim.warheads.length - 1].end;
  const shake = sec > leakT && sec < leakT + 0.5 ? Math.sin((sec - leakT) * 70) * 14 * (1 - (sec - leakT) / 0.5) : 0;
  const dim = sec > p.core ? 0.5 * clamp01((sec - p.core) / 0.5) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, transform: `translate(${shake}px, ${shake * 0.6}px) translateY(${(1 - op) * 80}px)`}}>
      {/* 하늘 (위로 갈수록 성층권 남색) */}
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(#030512 0%, #07142b 45%, #0d2340 85%, #12304f 100%)'}} />
      <AltitudeLayerGrid layers={ep.layers} width={QW} height={MAP.h} yAlt={yAlt} topAlt={SV.topAlt} rulerX={SV.plotR} active={active} reveal={reveal} />
      {/* 지면 */}
      <div style={{position: 'absolute', left: 0, top: SV.groundY, width: QW, height: MAP.h - SV.groundY, background: '#0b1119', borderTop: '5px solid #44566b'}} />
      <div style={{position: 'absolute', left: BAT.seoul - 135, top: SV.groundY - 178, width: 270}}><Skyline w={270} /></div>
      <AssetLabel x={BAT.seoul} text="서울 · 수도권" color={YELLOW} op={reveal} />
      <Dome g={easeInOut(clamp01((sec - p.lamdOn + 0.2) / 0.7))} sec={sec} />
      <BouncingAsset from="left" startFrame={fr(tIn.radar)} x={BAT.radar - AW / 2} y={assetY} width={AW} height={AH}><GreenPineRadar w={AW} /></BouncingAsset>
      <BouncingAsset from="bottom" distance={500} startFrame={fr(tIn.lsam)} x={BAT.lsam - AW / 2} y={assetY} width={AW} height={AH}><LsamLauncher w={AW} /></BouncingAsset>
      <BouncingAsset from="bottom" distance={500} startFrame={fr(tIn.cg)} x={BAT.cg - AW / 2} y={assetY} width={AW} height={AH}><CheongungLauncher w={AW} /></BouncingAsset>
      <BouncingAsset from="bottom" distance={500} startFrame={fr(tIn.pac)} x={BAT.pac - AW / 2} y={assetY} width={AW} height={AH}><PatriotLauncher w={AW} /></BouncingAsset>
      <BouncingAsset from="right" startFrame={fr(tIn.lamd)} x={BAT.lamd - AW / 2} y={assetY} width={AW} height={AH}><LamdLauncher w={AW} /></BouncingAsset>
      <AssetLabel x={BAT.radar + 30} text="그린파인 레이더" color="#9fd18a" op={lab(tIn.radar)} />
      <AssetLabel x={BAT.lsam} text="L-SAM" color={CYAN} op={lab(tIn.lsam)} />
      <AssetLabel x={BAT.cg} text="천궁-II" color={GREEN} op={lab(tIn.cg)} />
      <AssetLabel x={BAT.pac} text="PAC-3" color="#fff" op={lab(tIn.pac)} />
      <AssetLabel x={BAT.lamd - 10} text="LAMD" color={YELLOW} op={lab(tIn.lamd)} />
      {/* 그린파인 레이더 탐지파 */}
      {sec > tIn.radar + 0.4 && sec < p.outro && (
        <svg width={QW} height={MAP.h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          {[0, 1, 2].map((i) => {
            const ph = ((sec * 0.8 + i / 3) % 1);
            return <path key={i} d={`M${BAT.radar + 20} ${SV.groundY - 90} m${-260 * ph} ${-260 * ph * 0.3} a${300 * ph} ${300 * ph} 0 0 1 ${520 * ph} ${-30 * ph}`}
              fill="none" stroke="#9fd18a" strokeWidth={5} strokeOpacity={0.6 * (1 - ph)} />;
          })}
        </svg>
      )}
      <MissileTrajectory sim={sim} sec={sec} showPredicted={sec >= p.pullup - 0.2 && sec < p.midHit + 0.3} trackFrom={p.pullup} pullupLabelAt={p.pullupAt} />
      <div style={{position: 'absolute', inset: 0, background: `rgba(0,0,0,${dim})`}} />
      {/* HUD: 북한 방향 + 요격 카운터 */}
      <div style={{position: 'absolute', left: 420, top: 26, display: 'flex', gap: 16, alignItems: 'center', opacity: reveal}}>
        <Chip text="북한 방향" color={RED} size={34} fg="#fff" />
        <div style={{background: 'rgba(0,0,0,0.85)', border: `4px solid ${CYAN}`, borderRadius: 14, padding: '2px 20px 6px', fontSize: 38, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap'}}>
          요격 성공 <span style={{display: 'inline-block', color: YELLOW, transform: `scale(${punch})`, minWidth: 52, textAlign: 'center'}}>{kills}</span>발
        </div>
      </div>
    </div>
  );
};

// ───────────────────────── 컴포지션 ─────────────────────────
export const MissileDefense: React.FC<DefenseProps> = (props) => {
  usePretendard();
  const frame = useCurrentFrame();
  const {episode: ep, timeline: tl} = props;
  const pr = useMemo(() => (ep ? makeProj(ep.map.fit) : null), [ep]);
  const p = useMemo(() => (ep && tl ? plan(ep, tl) : null), [ep, tl]);
  const sim = useMemo(() => (p ? buildSim(p) : null), [p]);
  if (!ep || !tl || !pr || !p || !sim) return null;
  const sec = frame / FPS;
  const sideOp = clamp01((sec - (p.lsam - 0.35)) / 0.5);
  const legacy = ep as unknown as Episode;
  return (
    <AbsoluteFill style={{background: '#05070a', fontFamily: 'Pretendard, sans-serif', width: QW, height: QH}}>
      <style>{fontCss()}</style>
      <div style={{position: 'absolute', top: MAP.top, left: 0, width: QW, height: MAP.h, overflow: 'hidden', background: '#0b1018'}}>
        <MapIntro ep={ep} props={props} p={p} pr={pr} sec={sec} op={1 - sideOp} />
        <SideStage ep={ep} p={p} sim={sim} sec={sec} op={sideOp} />
        <div style={{position: 'absolute', left: 0, top: 0, width: QW, height: 40, background: 'linear-gradient(#05070a, rgba(5,7,10,0))'}} />
      </div>
      <Panel ep={ep} p={p} sec={sec} frame={frame} />
      <Header ep={ep} p={p} sec={sec} />
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${UP})`, transformOrigin: '0 0'}}>
        <Subtitles timeline={tl} episode={legacy} />
        <CtaOverlay episode={legacy} timeline={tl} />
      </div>
      <SoundTrack ep={props.ep} episode={legacy} timeline={tl} />
    </AbsoluteFill>
  );
};
