// EP05 남북 군사·경제 격차 인포그래픽 (QHD 1440x2560 · 30fps · 순수 2D/SVG 벡터)
//  장면은 나레이션 문장(scene 키)과 자막 큐에 맞춰 자동 배치 → TTS 길이가 달라져도 싱크 유지
import React, {useMemo} from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';
import {Subtitles} from '../components/Subtitles';
import {CtaOverlay} from '../components/CtaOverlay';
import {SoundTrack} from '../components/SoundTrack';
import {BouncingAsset} from '../components/infographic/BouncingAsset';
import {CountUpText, HARD_TEXT} from '../components/infographic/CountUpText';
import {NightMapOverlay} from '../components/infographic/NightMapOverlay';
import {NK_RED, ROK_BLUE, TerritoryHighlight} from '../components/infographic/TerritoryHighlight';
import {TargetPulseRing} from '../components/infographic/TargetPulseRing';
import {Jet, MoneyStack, NukeIcon, Warship} from '../components/infographic/assets';
import {fontCss, usePretendard} from '../lib/font';
import {Episode} from '../lib/types';
import {
  BADGE_Y, Cam, camApply, camAt, clamp01, FPS, makeProj, MAP, mosaicRect, PANEL, Proj, QH, QW, TITLE_Y, UP,
} from './layout';
import {InfographicEpisode, InfographicProps, VsStat} from './types';
import {plan, Plan} from './plan';

const YELLOW = '#FFD000';
const STAMP_RED = '#D32F2F';
const dec = (v: number) => (Number.isInteger(v) ? 0 : 1);



// ───────────────────────── 상단: 뱃지 + 타이틀 ─────────────────────────
const Header: React.FC<{ep: InfographicEpisode; p: Plan; sec: number}> = ({ep, p, sec}) => {
  // 인트로: 지도 위 초대형 질문 → 육군 장면부터 상단 타이틀로 이동
  const m = clamp01((sec - (p.army - 0.3)) / 0.55);
  const k = m * m * (3 - 2 * m);
  const introIn = interpolate(sec, [0, 0.35], [0, 1], {extrapolateRight: 'clamp'});
  const size = 128 + (82 - 128) * k;
  const top = MAP.top + 300 + (TITLE_Y - MAP.top - 300) * k;
  const pop = 0.8 + 0.2 * introIn;
  return (
    <>
      <div style={{position: 'absolute', top: BADGE_Y, left: 0, width: QW, display: 'flex', justifyContent: 'center'}}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '8px 30px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.78)',
          border: '4px solid #FF3B30', color: '#fff', fontSize: 34, fontWeight: 900, letterSpacing: 1,
        }}>
          <span>[</span>
          <span style={{width: 24, height: 24, borderRadius: 12, background: '#FF3B30', display: 'inline-block'}} />
          <span>가상 군사 시뮬레이션 IF ]</span>
        </div>
      </div>
      <div style={{position: 'absolute', top, left: 40, width: QW - 80, textAlign: 'center', transform: `scale(${pop})`, opacity: introIn}}>
        {ep.title.map((line, i) => (
          <div key={i} style={{
            ...HARD_TEXT, fontSize: size, lineHeight: 1.12, color: i === 1 ? YELLOW : '#fff', whiteSpace: 'nowrap',
            WebkitTextStroke: `${Math.round(5 + 5 * (1 - k))}px #000`, textShadow: `${Math.round(5 + 3 * (1 - k))}px ${Math.round(6 + 3 * (1 - k))}px 0 #000`,
          }}>{line}</div>
        ))}
      </div>
    </>
  );
};

// ───────────────────────── 패널: VS 카드 · 바 비교 · 결론 ─────────────────────────
const Chip: React.FC<{text: string; color: string; size?: number}> = ({text, color, size = 44}) => (
  <div style={{display: 'inline-block', background: color, color: '#fff', fontSize: size, fontWeight: 900, padding: '4px 22px 8px', borderRadius: 14,
    border: '4px solid #000', WebkitTextStroke: '2px #000', paintOrder: 'stroke fill', lineHeight: 1.1}}>{text}</div>
);

const VsCards: React.FC<{st: VsStat; nkAt: number; rokAt: number}> = ({st, nkAt, rokAt}) => {
  const card = (side: 'nk' | 'rok') => {
    const color = side === 'nk' ? NK_RED : ROK_BLUE;
    const v = side === 'nk' ? st.nk : st.rok;
    return (
      <div style={{
        position: 'absolute', top: 82, left: side === 'nk' ? 34 : 750, width: 656, height: 214, boxSizing: 'border-box',
        background: 'rgba(8,10,16,0.92)', border: `6px solid ${color}`, borderRadius: 28, boxShadow: '0 10px 0 #000', padding: '14px 22px',
      }}>
        <Chip text={side === 'nk' ? '북한' : '대한민국'} color={color} size={40} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 70}}>
          <CountUpText value={v} decimals={dec(v)} prefix={st.prefix} suffix={st.unit} size={112}
            startFrame={Math.round((side === 'nk' ? nkAt : rokAt) * FPS)} color={side === 'nk' ? '#fff' : YELLOW} />
        </div>
        {st.sub && (
          <div style={{position: 'absolute', right: 22, top: 22, fontSize: 32, fontWeight: 900, color: 'rgba(255,255,255,0.86)'}}>
            {st.sub.label} <span style={{color: side === 'nk' ? '#ff9b94' : '#9cc4ff'}}>{side === 'nk' ? st.sub.nk : st.sub.rok}</span>
          </div>
        )}
      </div>
    );
  };
  return (
    <>
      <div style={{position: 'absolute', top: 0, left: 0, width: QW, display: 'flex', justifyContent: 'center'}}>
        <div style={{...HARD_TEXT, fontSize: 58, color: YELLOW, WebkitTextStroke: '6px #000', textShadow: '4px 5px 0 #000'}}>{st.label}</div>
      </div>
      {card('nk')}
      {card('rok')}
      <div style={{position: 'absolute', top: 146, left: QW / 2 - 52, width: 104, height: 104, borderRadius: 52, background: '#000',
        border: `5px solid ${YELLOW}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, fontWeight: 900, color: YELLOW}}>VS</div>
      {st.source && <div style={{position: 'absolute', top: 302, right: 40, fontSize: 24, fontWeight: 900, color: 'rgba(255,255,255,0.55)'}}>{st.source}</div>}
    </>
  );
};

const BarCompare: React.FC<{ep: InfographicEpisode; at: number; sec: number}> = ({ep, at, sec}) => {
  const u = ep.ulsan;
  const max = Math.max(u.value, u.nkValue);
  const grow = (d: number) => clamp01((sec - at - d) / 0.7);
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  const row = (i: number, label: string, valLabel: string, v: number, color: string) => {
    const g = ease(grow(i * 0.5));
    const W = 760;
    return (
      <div key={i} style={{position: 'absolute', left: 40, top: 82 + i * 110, width: QW - 80, height: 96, display: 'flex', alignItems: 'center', gap: 20}}>
        <div style={{width: 300, textAlign: 'right', fontSize: 50, fontWeight: 900, color: '#fff', WebkitTextStroke: '5px #000', paintOrder: 'stroke fill'}}>{label}</div>
        <div style={{width: W * (v / max) * g, height: 74, background: color, border: '5px solid #000', borderRadius: 14, boxShadow: '0 7px 0 #000'}} />
        <div style={{...HARD_TEXT, fontSize: 60, color: i === 0 ? YELLOW : '#fff', WebkitTextStroke: '6px #000', opacity: g > 0.6 ? 1 : 0, whiteSpace: 'nowrap'}}>{valLabel}</div>
      </div>
    );
  };
  return (
    <>
      <div style={{position: 'absolute', top: 0, left: 0, width: QW, display: 'flex', justifyContent: 'center'}}>
        <div style={{...HARD_TEXT, fontSize: 58, color: YELLOW, WebkitTextStroke: '6px #000', textShadow: '4px 5px 0 #000'}}>도시 하나 vs 나라 전체</div>
      </div>
      {row(0, '울산 1개 도시', u.valueLabel, u.value, ROK_BLUE)}
      {row(1, '북한 전체', u.nkLabel, u.nkValue, NK_RED)}
      {u.source && <div style={{position: 'absolute', top: 302, right: 40, fontSize: 24, fontWeight: 900, color: 'rgba(255,255,255,0.55)'}}>{u.source}</div>}
    </>
  );
};

const Conclusion: React.FC<{ep: InfographicEpisode}> = ({ep}) => (
  <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30}}>
    <NukeIcon size={190} />
    <div>
      <div style={{...HARD_TEXT, fontSize: 70, color: '#fff', whiteSpace: 'nowrap', lineHeight: 1.18}}>{ep.nuke.line1}</div>
      <div style={{...HARD_TEXT, fontSize: 84, color: YELLOW, whiteSpace: 'nowrap', lineHeight: 1.18}}>{ep.nuke.line2}</div>
    </div>
  </div>
);

const Panel: React.FC<{ep: InfographicEpisode; p: Plan; sec: number; frame: number}> = ({ep, p, sec, frame}) => {
  if (sec < p.army - 0.05) return null;
  const which = sec < p.air ? 'army' : sec < p.gdp ? 'air' : sec < p.night ? 'gdp' : sec < p.nuke ? 'night' : 'nuke';
  const startSec = {army: p.army, air: p.air, gdp: p.gdp, night: p.night, nuke: p.nuke}[which];
  const f = frame - Math.round(startSec * FPS);
  const sp = spring({frame: f, fps: FPS, config: {damping: 13, stiffness: 170, mass: 0.7}});
  const op = interpolate(f, [0, 5], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', top: PANEL.top, left: 0, width: QW, height: PANEL.h, opacity: op, transform: `scale(${0.88 + 0.12 * sp})`, transformOrigin: '50% 30%'}}>
      {which === 'army' && <VsCards st={ep.stats.army} nkAt={p.armyNk} rokAt={p.armyRok} />}
      {which === 'air' && <VsCards st={ep.stats.air} nkAt={p.airNk} rokAt={p.airRok} />}
      {which === 'gdp' && <VsCards st={ep.stats.gdp} nkAt={p.gdpNk} rokAt={p.gdpRok} />}
      {which === 'night' && <BarCompare ep={ep} at={Math.max(p.night + 0.6, p.ulsanValue - 0.6)} sec={sec} />}
      {which === 'nuke' && <Conclusion ep={ep} />}
    </div>
  );
};

// ───────────────────────── 지도 무대 ─────────────────────────
const MapLabel: React.FC<{x: number; y: number; text: string; color: string; size?: number; op: number}> = ({x, y, text, color, size = 60, op}) => (
  <div style={{position: 'absolute', left: x - 300, top: y - size * 0.7, width: 600, textAlign: 'center', opacity: op}}>
    <span style={{display: 'inline-block', background: 'rgba(0,0,0,0.8)', border: `5px solid ${color}`, borderRadius: 16, padding: '2px 22px 8px',
      fontSize: size, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap'}}>{text}</span>
  </div>
);

const MapStage: React.FC<{ep: InfographicEpisode; props: InfographicProps; p: Plan; pr: Proj; sec: number; frame: number}> = ({ep, props, p, pr, sec, frame}) => {
  const fit = ep.map.fit;
  const day = props.mosaics?.[ep.map.day];
  const night = props.mosaics?.[ep.map.night];
  const dayRect = day ? {...mosaicRect(day, pr, fit), file: day.file} : undefined;
  const nightRect = night ? {...mosaicRect(night, pr, fit), file: night.file} : undefined;
  const ul = pr.p(ep.ulsan.pos);
  const nk = pr.p(ep.nuke.pos);
  const C = {fx: QW / 2, fy: MAP.h / 2 - 20, sx: QW / 2, sy: MAP.h / 2 - 20};
  const keys: Cam[] = [
    {t: 0, s: 1.06, ...C},
    {t: p.army, s: 1.0, ...C},
    {t: p.night, s: 1.0, ...C},
    {t: p.ulsan - 0.2, s: 1.0, ...C},
    {t: p.ulsan + 0.9, s: 1.38, fx: ul[0], fy: ul[1], sx: 850, sy: 760},
    {t: p.nuke - 0.15, s: 1.38, fx: ul[0], fy: ul[1], sx: 850, sy: 760},
    {t: p.nuke + 0.8, s: 1.12, fx: nk[0], fy: nk[1], sx: QW / 2, sy: 470},
    {t: p.T, s: 1.16, fx: nk[0], fy: nk[1], sx: QW / 2, sy: 470},
  ];
  const cam = camAt(keys, sec);
  const nightOp = interpolate(sec, [p.night - 0.1, p.night + 1.1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const reveal = interpolate(sec, [0.25, 1.1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const line = interpolate(sec, [0.7, 1.7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // 밤에는 영토색을 거의 빼서 불빛이 보이게, 핵 장면은 북한만 붉게
  const fillOp = 0.6 * (1 - 0.82 * nightOp) + (sec > p.nuke ? 0.35 * clamp01((sec - p.nuke) / 0.6) : 0);
  const flagOp = 0.34 * (1 - nightOp);
  const pulseNk = sec > p.nuke ? 0.5 + 0.5 * Math.sin(sec * 6) : 0;
  const dim = sec > p.nuke ? 0.35 * clamp01((sec - p.nuke) / 0.6) : 0;
  const labelP = (ll: [number, number]) => camApply(cam, pr.p(ll));
  const [nkLx, nkLy] = labelP(ep.map.labels.nk);
  const [rkLx, rkLy] = labelP(ep.map.labels.rok);
  const isNight = sec >= p.night && sec < p.nuke;
  const labelOp = interpolate(sec, [0.9, 1.3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    * (sec > p.ulsan + 0.2 && sec < p.nuke ? 0 : 1);
  const [ux, uy] = camApply(cam, ul);
  const [nx, ny] = camApply(cam, nk);
  const nukeF = frame - Math.round(p.nuke * FPS);
  const nukePop = spring({frame: nukeF - 6, fps: FPS, config: {damping: 8, stiffness: 160, mass: 0.8}});
  return (
    <div style={{position: 'absolute', top: MAP.top, left: 0, width: QW, height: MAP.h, overflow: 'hidden', background: '#0b1018'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: QW, height: MAP.h, transformOrigin: '0 0',
        transform: `translate(${cam.sx - cam.s * cam.fx}px, ${cam.sy - cam.s * cam.fy}px) scale(${cam.s})`}}>
        {dayRect ? (
          <Img src={staticFile(dayRect.file)} style={{position: 'absolute', left: dayRect.left, top: dayRect.top, width: dayRect.width, height: dayRect.height}} />
        ) : (
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(#0d1b2a, #0a1520)'}} />
        )}
        <div style={{position: 'absolute', left: -400, top: -400, width: QW + 800, height: MAP.h + 800, background: 'rgba(3,6,12,0.3)'}} />
        <NightMapOverlay opacity={nightOp} nightRect={nightRect} pr={pr} />
        {props.geo && (
          <TerritoryHighlight geo={props.geo} pr={pr} mdl={ep.map.mdl} reveal={reveal} line={line}
            fillOpacity={fillOp} flagOpacity={flagOp} pulseNk={pulseNk} />
        )}
      </div>
      <div style={{position: 'absolute', inset: 0, background: `rgba(0,0,0,${dim})`}} />
      <MapLabel x={nkLx} y={nkLy} text={isNight ? '칠흑의 북한' : '북한'} color={NK_RED} op={labelOp * (1 - clamp01((sec - p.nuke) / 0.3))} />
      <MapLabel x={rkLx} y={rkLy} text={isNight ? '불야성 대한민국' : '대한민국'} color={ROK_BLUE} op={labelOp} />
      {sec >= p.ulsan && sec < p.nuke && (
        <TargetPulseRing x={ux} y={uy} startFrame={Math.round(p.ulsan * FPS)} badge={ep.ulsan.badge} badgeSide="left" />
      )}
      {sec >= p.nuke && (
        <>
          <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
            {[0, 1, 2].map((i) => {
              const ph = (((nukeF / FPS) * 1.1 + i / 3) % 1 + 1) % 1;
              return <circle key={i} cx={nx} cy={ny} r={90 + 260 * ph} fill="none" stroke={NK_RED} strokeWidth={8} opacity={(1 - ph) * clamp01(nukeF / 8)} />;
            })}
          </svg>
          <div style={{position: 'absolute', left: nx - 130, top: ny - 130, width: 260, height: 260,
            transform: `scale(${Math.max(0, nukePop)}) rotate(${(1 - Math.min(1, nukePop)) * -90 + Math.sin(nukeF / 9) * 4}deg)`}}>
            <NukeIcon size={260} />
          </div>
        </>
      )}
      {/* 위·아래 페이드 (패널·자막과 자연스럽게) */}
      <div style={{position: 'absolute', left: 0, top: 0, width: QW, height: 70, background: 'linear-gradient(#05070a, rgba(5,7,10,0))'}} />
      <div style={{position: 'absolute', left: 0, bottom: 0, width: QW, height: 170, background: 'linear-gradient(rgba(5,7,10,0), #05070a)'}} />
    </div>
  );
};

// ───────────────────────── 에셋 레이어 (화면 좌표) ─────────────────────────
const Assets: React.FC<{p: Plan}> = ({p}) => {
  const fr = (s: number) => Math.round(s * FPS);
  const airIn = fr(p.air + 0.1);
  const airOut = fr(p.gdp - 0.2);
  const gdpOut = fr(p.night - 0.2);
  const Y = MAP.top;
  return (
    <>
      {/* 해군·공군: 북한(왼쪽 서해 쪽) 숫자 많게, 한국(오른쪽 동해 쪽) */}
      {[0, 1, 2, 3].map((i) => (
        <BouncingAsset key={`nj${i}`} from="left" startFrame={airIn + i * 4} exitFrame={airOut} x={40 + (i % 2) * 150} y={Y + 60 + i * 115} width={150} height={150}>
          <Jet size={150} color="#ff6b62" heading={160} />
        </BouncingAsset>
      ))}
      <BouncingAsset from="left" startFrame={airIn + 14} exitFrame={airOut} x={30} y={Y + 560} width={340} height={143}>
        <Warship width={340} color="#c94a43" />
      </BouncingAsset>
      {[0, 1].map((i) => (
        <BouncingAsset key={`rj${i}`} from="right" startFrame={fr(p.airRok - 0.1) + i * 5} exitFrame={airOut} x={1110 + i * 120} y={Y + 560 + i * 140} width={170} height={170}>
          <Jet size={170} color="#5aa0ff" heading={-20} />
        </BouncingAsset>
      ))}
      <BouncingAsset from="right" startFrame={fr(p.airRok - 0.1) + 12} exitFrame={airOut} x={1080} y={Y + 900} width={340} height={143}>
        <Warship width={340} color="#3d7fe0" flip />
      </BouncingAsset>
      {/* 경제력: 북한 지폐 한 묶음 vs 한국 돈다발 산 */}
      <BouncingAsset from="left" startFrame={fr(p.gdpNk - 0.1)} exitFrame={gdpOut} x={70} y={Y + 300} width={230} height={70}>
        <MoneyStack width={230} bundles={1} />
      </BouncingAsset>
      {[0, 1, 2].map((i) => (
        <BouncingAsset key={`m${i}`} from="top" distance={1400} startFrame={fr(p.gdpRok - 0.1) + i * 4} exitFrame={gdpOut}
          x={1050 + (i % 2) * 60 - (i === 2 ? 40 : 0)} y={Y + 520 + i * -160} width={300} height={300}>
          <MoneyStack width={300} bundles={7} />
        </BouncingAsset>
      ))}
    </>
  );
};

/** 대형 볼드 스탬프: "경제력 차이 / 무려 56배" */
const Stamp: React.FC<{ep: InfographicEpisode; p: Plan; frame: number}> = ({ep, p, frame}) => {
  const st = Math.round(p.stamp * FPS);
  const end = Math.round((p.night - 0.15) * FPS);
  if (frame < st || frame > end + 8) return null;
  const f = frame - st;
  const slam = spring({frame: f, fps: FPS, config: {damping: 10, stiffness: 260, mass: 0.9}});
  const scale = 2.3 - 1.3 * slam;
  const op = interpolate(frame, [st, st + 3, end, end + 8], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const shake = f < 8 ? Math.sin(f * 2.4) * (8 - f) * 1.6 : 0;
  const [l1, l2] = ep.gdpStamp.text.split('/').map((s) => s.trim());
  return (
    <div style={{position: 'absolute', left: 0, top: MAP.top + 330, width: QW, display: 'flex', justifyContent: 'center', opacity: op,
      transform: `translate(${shake}px, ${shake * 0.6}px)`}}>
      <div style={{transform: `rotate(-7deg) scale(${scale})`, background: STAMP_RED, border: '10px solid #fff', outline: '8px solid #000',
        borderRadius: 22, padding: '18px 56px 26px', textAlign: 'center', boxShadow: '0 16px 0 rgba(0,0,0,0.85)'}}>
        <div style={{...HARD_TEXT, fontSize: 84, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap'}}>{l1}</div>
        <div style={{...HARD_TEXT, fontSize: 168, color: YELLOW, lineHeight: 1.05, whiteSpace: 'nowrap', WebkitTextStroke: '10px #000', textShadow: '8px 9px 0 #000'}}>{l2}</div>
      </div>
    </div>
  );
};

// ───────────────────────── 컴포지션 ─────────────────────────
export const MilitaryGap: React.FC<InfographicProps> = (props) => {
  usePretendard();
  const frame = useCurrentFrame();
  const {episode: ep, timeline: tl} = props;
  const pr = useMemo(() => (ep ? makeProj(ep.map.fit) : null), [ep]);
  const p = useMemo(() => (ep && tl ? plan(ep, tl) : null), [ep, tl]);
  if (!ep || !tl || !pr || !p) return null;
  const sec = frame / FPS;
  const legacy = ep as unknown as Episode; // 자막·CTA·사운드 공용 컴포넌트 재사용 (layout 'safe')
  return (
    <AbsoluteFill style={{background: '#05070a', fontFamily: 'Pretendard, sans-serif', width: QW, height: QH}}>
      <style>{fontCss()}</style>
      <MapStage ep={ep} props={props} p={p} pr={pr} sec={sec} frame={frame} />
      <Assets p={p} />
      <Stamp ep={ep} p={p} frame={frame} />
      <Panel ep={ep} p={p} sec={sec} frame={frame} />
      <Header ep={ep} p={p} sec={sec} />
      {/* 1080 Safe Area 규격 자막·CTA를 ×4/3로 (DOM 벡터 → QHD에서도 선명) */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${UP})`, transformOrigin: '0 0'}}>
        <Subtitles timeline={tl} episode={legacy} />
        <CtaOverlay episode={legacy} timeline={tl} />
      </div>
      <SoundTrack ep={props.ep} episode={legacy} timeline={tl} />
    </AbsoluteFill>
  );
};
