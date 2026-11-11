import React, {useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender} from 'remotion';
import {fontCss, usePretendard} from '../lib/font';

/**
 * 쇼츠 전용 초고대비 썸네일 (9:16 · 1080x1920) — EP12부터
 *
 * 세이프존
 *  - 상단 15~35% (Y 288~672): 라벨 + 2줄 초대형 헤드카피
 *  - 중앙 35~75% (Y 672~1440): 심해 잠수함 + 콜드런치 수면 돌파 화염 + 훅 문구
 *  - 하단 0~25% (Y 1440~1920) · 우측 15%(162px): 쇼츠 제목·버튼 가림 방지 → 텍스트 없음
 *
 * 글자 4중 레이어: 채움색 + 8px 검정 외곽선 + 20px 하드 섀도우(블러 없음) + 반투명 다크 틴트 박스
 * 렌더 서버 규칙상 CSS filter·blur 금지 → 발광은 반투명 도형 겹치기, 그림자는 블러 0 계단식
 *
 * 쓰는 곳
 *  - Still `shorts-thumbnail` → public/thumbnails/shorts_ep12.png
 *  - 영상 Frame 0에 <ShortsThumbnail /> 를 1프레임 깔아도 됨 (props만 넘기면 동일)
 */

export type ThumbCopy = {
  label: string; // 상단 라벨 (레드)
  line1: string; // 메인 1줄 (화이트)
  line2: string; // 메인 2줄 (옐로)
  hook: string; // 중앙 하단 훅
};

export const EP12_THUMB: ThumbCopy = {
  label: '[ 극비 보복 병기 ]',
  line1: '바닷속 3,000톤',
  line2: '평양이 가장 떠는 괴물',
  hook: '세계 8번째 수중 발사의 진실',
};

const W = 1080;
const H = 1920;
const SAFE_L = 48; // 좌측 여백
const SAFE_R = Math.round(W * 0.15); // 우측 15% = 162px
const SAFE_W = W - SAFE_L - SAFE_R; // 870px

const RED = '#FF3B30';
const YELLOW = '#FFE500';

// 20px 하드 섀도우 (블러 0, 2px 계단 → 입체 압출 느낌)
const hardShadow = (depth: number) =>
  Array.from({length: depth / 2}, (_, i) => `${(i + 1) * 2}px ${(i + 1) * 2}px 0 #000`).join(',');

/** 글자가 SAFE_W를 넘으면 가로 압축(최대 0.8배) → 그래도 넘으면 글자 크기 축소 */
const FitLine: React.FC<{
  text: string;
  size: number;
  color: string;
  maxW?: number;
  stroke?: number;
  shadow?: number;
  tracking?: number;
}> = ({text, size, color, maxW = SAFE_W - 40, stroke = 8, shadow = 20, tracking = -0.03}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({sx: 1, fs: size});
  const [h] = useState(() => delayRender(`썸네일 글자 맞춤: ${text}`));
  useLayoutEffect(() => {
    let done = false;
    document.fonts.ready.then(() => {
      if (done || !ref.current) return;
      const w = ref.current.scrollWidth;
      if (w > maxW) {
        const r = maxW / w;
        if (r >= 0.8) setFit({sx: r, fs: size});
        else setFit({sx: 0.8, fs: Math.floor((size * r) / 0.8)});
      }
      continueRender(h);
    });
    return () => {
      done = true;
    };
  }, [h, maxW, size, text]);
  return (
    <div style={{display: 'flex', justifyContent: 'center', width: SAFE_W}}>
      <span
        ref={ref}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          fontSize: fit.fs,
          lineHeight: 1.08,
          fontWeight: 900,
          letterSpacing: `${tracking}em`,
          color,
          WebkitTextStroke: `${stroke * 2}px #000`, // 절반은 채움 뒤로 → 바깥 8px
          paintOrder: 'stroke fill',
          textShadow: hardShadow(shadow),
          transform: `scaleX(${fit.sx})`,
          transformOrigin: 'center',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// 결정적 의사난수 (렌더마다 같은 파티클)
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const SURFACE_Y = 960; // 수면
const LAUNCH_X = 600; // 미사일 수면 돌파 지점

/** 배경 + 잠수함 + 미사일 + 조준선 (전부 SVG 벡터, 필터 없음) */
const Scene: React.FC = () => {
  // 화염·물보라 파티클
  const sparks = Array.from({length: 70}, (_, i) => {
    const a = -Math.PI / 2 + (rand(i) - 0.5) * 2.4;
    const d = 40 + rand(i + 99) * 260;
    return {
      x: LAUNCH_X + Math.cos(a) * d,
      y: SURFACE_Y - 40 + Math.sin(a) * d * 0.6,
      r: 2 + rand(i + 7) * 7,
      c: rand(i + 3) > 0.45 ? '#FFB020' : '#FFF2A8',
      o: 0.35 + rand(i + 5) * 0.6,
    };
  });
  const spray = Array.from({length: 36}, (_, i) => {
    const a = -Math.PI / 2 + (rand(i + 300) - 0.5) * 2.0;
    const d = 30 + rand(i + 400) * 170;
    return {x: LAUNCH_X + Math.cos(a) * d * 1.3, y: SURFACE_Y + Math.sin(a) * d * 0.6, r: 3 + rand(i + 500) * 8};
  });
  const bubbles = Array.from({length: 44}, (_, i) => {
    const t = rand(i + 700);
    return {
      x: 690 - t * 90 + (rand(i + 800) - 0.5) * 60 * (1 + t),
      y: 1135 - t * 170,
      r: 2 + rand(i + 900) * 7,
    };
  });
  const snow = Array.from({length: 90}, (_, i) => ({
    x: rand(i + 1000) * W,
    y: SURFACE_Y + 20 + rand(i + 1100) * (H - SURFACE_Y),
    r: 0.8 + rand(i + 1200) * 2.2,
  }));

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#01030a" />
          <stop offset="0.75" stopColor="#071a33" />
          <stop offset="1" stopColor="#0c2a4a" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a2f55" />
          <stop offset="0.35" stopColor="#041a35" />
          <stop offset="0.7" stopColor="#020b1a" />
          <stop offset="1" stopColor="#000207" />
        </linearGradient>
        <radialGradient id="flash" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="0.18" stopColor="#FFF2A8" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#FF9A1F" stopOpacity="0.55" />
          <stop offset="0.75" stopColor="#FF3B30" stopOpacity="0.18" />
          <stop offset="1" stopColor="#FF3B30" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="underGlow" cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#FF9A1F" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#FF5A1F" stopOpacity="0.12" />
          <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="plume" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.25" stopColor="#FFE58A" />
          <stop offset="0.6" stopColor="#FF8A1F" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FF3B30" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3a4c" />
          <stop offset="0.45" stopColor="#111a24" />
          <stop offset="1" stopColor="#03060a" />
        </linearGradient>
        <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd4ff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#9fd4ff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 하늘 / 심해 */}
      <rect x="0" y="0" width={W} height={SURFACE_Y} fill="url(#sky)" />
      <rect x="0" y={SURFACE_Y} width={W} height={H - SURFACE_Y} fill="url(#sea)" />

      {/* 수중 빛줄기 */}
      {[120, 330, 760, 930].map((x, i) => (
        <polygon
          key={i}
          points={`${x - 30},${SURFACE_Y} ${x + 40},${SURFACE_Y} ${x + 140 + i * 20},${SURFACE_Y + 700} ${x - 10 + i * 20},${SURFACE_Y + 700}`}
          fill="url(#ray)"
        />
      ))}
      {/* 수면 아래 화염 반사광 */}
      <ellipse cx={LAUNCH_X} cy={SURFACE_Y} rx={520} ry={420} fill="url(#underGlow)" />

      {/* 심해 부유물 */}
      {snow.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#9fc7ee" opacity={0.18} />
      ))}

      {/* 레이더 링 (잠수함 중심, 은밀 기동) */}
      {[150, 260, 370, 480].map((r, i) => (
        <ellipse
          key={r}
          cx={500}
          cy={1215}
          rx={r * 1.35}
          ry={r * 0.42}
          fill="none"
          stroke="#38E1FF"
          strokeWidth={i === 0 ? 4 : 2.5}
          strokeDasharray={i % 2 ? '14 12' : undefined}
          opacity={0.42 - i * 0.07}
        />
      ))}
      {/* 레이더 스윕 부채꼴 */}
      <path d="M500,1215 L1060,1120 A660,200 0 0 1 1010,1330 Z" fill="#38E1FF" opacity={0.08} />

      {/* 잠수함 (도산안창호급 실루엣: 긴 선체 + 함교탑 + 함교타 + X형 꼬리) */}
      <g transform="translate(70,1140)">
        {/* 굵은 반투명 테두리로 윤곽 발광 (블러 대신) */}
        <path
          d="M30,75 C30,30 90,8 190,6 L780,6 C850,8 880,40 900,62 L940,70 L940,84 L900,90 C870,118 840,140 780,144 L190,144 C90,142 30,120 30,75 Z"
          fill="none"
          stroke="#38E1FF"
          strokeWidth={14}
          opacity={0.12}
        />
        <path
          d="M30,75 C30,30 90,8 190,6 L780,6 C850,8 880,40 900,62 L940,70 L940,84 L900,90 C870,118 840,140 780,144 L190,144 C90,142 30,120 30,75 Z"
          fill="url(#hull)"
          stroke="#5f86a8"
          strokeWidth={2.5}
        />
        {/* 함교탑 */}
        <path d="M372,8 C376,-40 384,-72 404,-80 L522,-80 C534,-78 540,-66 546,-40 L566,8 Z" fill="url(#hull)" stroke="#5f86a8" strokeWidth={2.5} />
        <rect x="420" y="-118" width="8" height="40" fill="#1b2633" />
        <rect x="444" y="-104" width="6" height="26" fill="#1b2633" />
        {/* 함교타 */}
        <path d="M392,-36 L338,-30 L338,-24 L392,-26 Z" fill="#0b121a" stroke="#5f86a8" strokeWidth={1.5} />
        {/* X형 꼬리날개 */}
        <path d="M900,62 L960,10 L978,14 L930,74 Z" fill="#0b121a" stroke="#5f86a8" strokeWidth={1.5} />
        <path d="M900,92 L960,146 L978,142 L930,82 Z" fill="#0b121a" stroke="#5f86a8" strokeWidth={1.5} />
        {/* VLS 6문 해치 (함교 뒤) — 첫 문 열림 */}
        {Array.from({length: 6}, (_, i) => (
          <rect
            key={i}
            x={600 + (i % 3) * 34}
            y={i < 3 ? 4 : -4}
            width={26}
            height={8}
            rx={2}
            fill={i === 0 ? '#FF9A1F' : '#2c3e52'}
          />
        ))}
        {/* 선체 하이라이트 */}
        <path d="M120,22 L800,22" stroke="#7fb2dc" strokeWidth={3} opacity={0.35} />
      </g>

      {/* 콜드런치 사출 기포 기둥 */}
      {bubbles.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="none" stroke="#bfe6ff" strokeWidth={1.8} opacity={0.6} />
      ))}

      {/* 수면 */}
      <rect x="0" y={SURFACE_Y - 3} width={W} height={6} fill="#7fc8ff" opacity={0.45} />
      <path
        d={`M0,${SURFACE_Y} ${Array.from({length: 28}, (_, i) => `Q${i * 40 + 20},${SURFACE_Y - 8 - (i % 3) * 3} ${(i + 1) * 40},${SURFACE_Y}`).join(' ')}`}
        fill="none"
        stroke="#cfeaff"
        strokeWidth={2.5}
        opacity={0.55}
      />

      {/* 수면 돌파 섬광 */}
      <ellipse cx={LAUNCH_X} cy={SURFACE_Y - 40} rx={430} ry={330} fill="url(#flash)" />

      {/* 물보라 기둥 */}
      <path
        d={`M${LAUNCH_X - 150},${SURFACE_Y} C${LAUNCH_X - 90},${SURFACE_Y - 120} ${LAUNCH_X - 50},${SURFACE_Y - 170} ${LAUNCH_X},${SURFACE_Y - 175} C${LAUNCH_X + 50},${SURFACE_Y - 170} ${LAUNCH_X + 90},${SURFACE_Y - 120} ${LAUNCH_X + 150},${SURFACE_Y} Z`}
        fill="#e8f6ff"
        opacity={0.55}
      />
      {spray.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#f2fbff" opacity={0.7} />
      ))}

      {/* 로켓 화염 기둥 (수면 → 위) */}
      <path
        d={`M${LAUNCH_X - 90},${SURFACE_Y} L${LAUNCH_X - 18},${SURFACE_Y - 70} L${LAUNCH_X + 18},${SURFACE_Y - 70} L${LAUNCH_X + 90},${SURFACE_Y} Z`}
        fill="#FFE58A"
        opacity={0.95}
      />
      {/* 미사일 본체 (수면 위로 솟구침, 노즈는 헤드카피 아래까지) */}
      <g transform={`translate(${LAUNCH_X},${SURFACE_Y - 70}) scale(0.95)`}>
        <path d="M-20,0 L-20,-150 C-20,-190 -8,-215 0,-228 C8,-215 20,-190 20,-150 L20,0 Z" fill="#e9eef3" stroke="#000" strokeWidth={3} />
        <rect x="-20" y="-120" width="40" height="14" fill="#1a1a1a" />
        <rect x="-20" y="-60" width="40" height="8" fill={RED} />
        <path d="M-20,-4 L-38,10 L-20,10 Z M20,-4 L38,10 L20,10 Z" fill="#9aa4ad" stroke="#000" strokeWidth={2} />
      </g>

      {/* 화염 파티클 */}
      {sparks.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} opacity={s.o} />
      ))}

      {/* 적색 타깃 조준선 (발사 지점 고정) */}
      <g transform={`translate(${LAUNCH_X},${SURFACE_Y - 160})`} stroke={RED} fill="none" strokeWidth={5}>
        <circle r={125} opacity={0.9} strokeDasharray="40 18" />
        <circle r={80} opacity={0.6} strokeWidth={3} />
        <path d="M-175,0 L-135,0 M135,0 L175,0 M0,135 L0,175" strokeWidth={6} />
        {/* 모서리 록온 브래킷 */}
        <path d="M-150,-110 L-150,-150 L-110,-150 M110,-150 L150,-150 L150,-110 M150,110 L150,150 L110,150 M-110,150 L-150,150 L-150,110" strokeWidth={7} />
      </g>

      {/* 하단 비네팅 (쇼츠 UI 아래 어둡게) */}
      <rect x="0" y={H - 520} width={W} height={520} fill="#000" opacity={0.35} />
    </svg>
  );
};

export const ShortsThumbnail: React.FC<{copy?: ThumbCopy}> = ({copy = EP12_THUMB}) => {
  usePretendard();
  return (
    <AbsoluteFill style={{background: '#01030a', fontFamily: 'Pretendard, sans-serif', overflow: 'hidden'}}>
      <style>{fontCss()}</style>
      <Scene />

      {/* ── 상단 헤드카피 (Y 288~672) ── */}
      <div style={{position: 'absolute', left: SAFE_L, top: 270, width: SAFE_W}}>
        {/* 반투명 다크 틴트 박스 */}
        <div
          style={{
            position: 'absolute',
            left: -22,
            right: -22,
            top: 70,
            height: 330,
            background: 'rgba(0,0,0,0.58)',
            borderRadius: 18,
            border: '3px solid rgba(255,255,255,0.08)',
          }}
        />
        {/* 라벨 */}
        <div style={{position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 20}}>
          <span
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: '#fff',
              background: RED,
              padding: '6px 26px 8px',
              borderRadius: 8,
              border: '4px solid #000',
              boxShadow: '6px 6px 0 #000',
              letterSpacing: '-0.01em',
            }}
          >
            {copy.label}
          </span>
        </div>
        <div style={{position: 'relative'}}>
          <FitLine text={copy.line1} size={115} color="#FFFFFF" />
          <div style={{height: 8}} />
          <FitLine text={copy.line2} size={125} color={YELLOW} />
        </div>
      </div>

      {/* ── 중앙 하단 훅 (Y ~1330, 중앙 구역 안) ── */}
      <div style={{position: 'absolute', left: SAFE_L, top: 1318, width: SAFE_W}}>
        <div
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            top: -6,
            height: 98,
            background: 'rgba(0,0,0,0.62)',
            borderRadius: 14,
            borderLeft: `10px solid ${RED}`,
          }}
        />
        <div style={{position: 'relative'}}>
          <FitLine text={copy.hook} size={65} color="#EEEEEE" stroke={6} shadow={10} maxW={SAFE_W - 80} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
