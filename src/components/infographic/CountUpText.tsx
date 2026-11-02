// 고대비 숫자 롤링 카운트업 (0 → 목표값)
//  - Pretendard Black · 8px 검정 외곽선 · 블러 없는 하드 섀도우 (렌더 비용 0)
//  - 등장 순간 스프링 팝 + 도착 순간 펀치(살짝 커졌다 복귀)
import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

type Props = {
  value: number;
  startFrame: number;
  durationFrames?: number;
  from?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  size?: number; // 96~120 권장
  suffixScale?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

export const fmt = (v: number, decimals = 0) =>
  v.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});

export const HARD_TEXT: React.CSSProperties = {
  fontWeight: 900,
  WebkitTextStroke: '8px #000',
  paintOrder: 'stroke fill',
  textShadow: '6px 7px 0 #000',
};

export const CountUpText: React.FC<Props> = ({
  value, startFrame, durationFrames = 26, from = 0, decimals = 0, prefix, suffix,
  size = 112, suffixScale = 0.5, color = '#fff', align = 'center',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });
  const v = from + (value - from) * p;
  const pop = spring({frame: frame - startFrame, fps, config: {damping: 11, stiffness: 190, mass: 0.7}});
  const land = startFrame + durationFrames;
  const punch = interpolate(frame, [land - 1, land + 3, land + 9], [1, 1.12, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const visible = frame >= startFrame;
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end',
      whiteSpace: 'nowrap', opacity: visible ? 1 : 0, transform: `scale(${(0.55 + 0.45 * pop) * punch})`,
      transformOrigin: align === 'center' ? '50% 70%' : align === 'left' ? '0% 70%' : '100% 70%',
      fontVariantNumeric: 'tabular-nums', color, lineHeight: 1,
    }}>
      {prefix && <span style={{...HARD_TEXT, fontSize: size * suffixScale, WebkitTextStroke: '6px #000', marginRight: 10}}>{prefix}</span>}
      <span style={{...HARD_TEXT, fontSize: size}}>{fmt(v, decimals)}</span>
      {suffix && <span style={{...HARD_TEXT, fontSize: size * suffixScale, WebkitTextStroke: '6px #000', marginLeft: 6}}>{suffix}</span>}
    </div>
  );
};
