// 장비/누끼 에셋 스프링 바운스: 화면 밖에서 날아와 통통 튀며 멈춤
//  spring({damping: 12, mass: 0.8, stiffness: 120}) + 착지 스쿼시
import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

type Props = {
  startFrame: number;
  exitFrame?: number; // 이 프레임부터 아래로 빠지며 사라짐
  from: 'left' | 'right' | 'top' | 'bottom';
  x: number; // 최종 위치(왼쪽 위)
  y: number;
  width: number;
  height: number;
  distance?: number;
  tilt?: number; // 날아오는 동안 기울기(도)
  children: React.ReactNode;
};

export const BouncingAsset: React.FC<Props> = ({startFrame, exitFrame, from, x, y, width, height, distance = 900, tilt = 14, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < startFrame) return null;
  const progress = spring({frame: frame - startFrame, fps, config: {damping: 12, mass: 0.8, stiffness: 120}});
  const rest = 1 - progress; // 1 → 0 (오버슈트 시 음수 = 반대편으로 살짝 튐)
  const dx = from === 'left' ? -distance * rest : from === 'right' ? distance * rest : 0;
  const dy = from === 'top' ? -distance * rest : from === 'bottom' ? distance * rest : 0;
  // 통통: 감쇠하는 수직 홉 + 착지 스쿼시
  const t = (frame - startFrame) / fps;
  const hop = from === 'left' || from === 'right' ? -Math.abs(Math.sin(t * Math.PI * 3.2)) * 70 * Math.exp(-t * 3.4) : 0;
  const squash = 1 + 0.1 * Math.sin(t * Math.PI * 4) * Math.exp(-t * 4);
  const rot = (from === 'left' ? -tilt : from === 'right' ? tilt : 0) * rest;
  let exit = 0;
  let op = interpolate(frame - startFrame, [0, 4], [0, 1], {extrapolateRight: 'clamp'});
  if (exitFrame !== undefined && frame >= exitFrame) {
    exit = interpolate(frame, [exitFrame, exitFrame + 10], [0, 1], {extrapolateRight: 'clamp'});
    op *= 1 - exit;
  }
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width, height, opacity: op,
      transform: `translate(${dx}px, ${dy + hop + exit * 80}px) rotate(${rot}deg) scale(${1 / squash}, ${squash})`,
      transformOrigin: '50% 100%',
    }}>
      {children}
    </div>
  );
};
