import React from 'react';
import {Audio, interpolate, Sequence, staticFile} from 'remotion';
import {buildArmorSfx} from '../lib/armor';
import {buildMissileSfx} from '../lib/missile';
import {buildAirSfx} from '../lib/air';
import {buildNavalSfx} from '../lib/naval';
import {resultOn, RESULT_SEC} from '../lib/result';
import {buildSfx, FPS, Sfx, videoSec} from '../lib/schedule';
import {Episode, Timeline} from '../lib/types';
import {CTA_SEC, ctaOn} from './CtaOverlay';
import {buildInfographicSfx} from '../ep05/sfx';
import {InfographicEpisode} from '../ep05/types';
import {buildDefenseSfx} from '../ep06/sfx';
import {DefenseEpisode} from '../ep06/types';

// 끝 4초 구독·좋아요 뱃지 등장음 (효과음 30% 규칙 동일)
const ctaSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  if (!ctaOn(ep)) return [];
  const at = videoSec(tl) - CTA_SEC;
  return [
    {file: 'pop.mp3', at, volume: 0.8 * 0.3},
    {file: 'pop.mp3', at: at + 1.6, volume: 0.6 * 0.3},
  ];
};

// 결과 카드 진입: 묵직한 Metal Hit 타격음 (hit + thud 겹침, 30%)
const resultSfx = (ep: Episode, tl: Timeline): Sfx[] => {
  if (!resultOn(ep)) return [];
  const at = videoSec(tl) - RESULT_SEC;
  return [
    {file: 'hit.mp3', at, volume: 1.0 * 0.3},
    {file: 'thud.mp3', at: at + 0.02, volume: 0.9 * 0.3},
  ];
};

// 채널별 믹싱: 나레이션 1.0 고정, 말하는 동안 효과음·BGM을 자동으로 낮춤(덕킹)
const NARRATION_VOL = 1.0;
const BGM_VOL = 0.11;
const DUCK = 0.5; // 말하는 동안 효과음·BGM 배율

export const SoundTrack: React.FC<{ep: string; episode: Episode; timeline: Timeline}> = ({ep, episode, timeline}) => {
  const cues = [
    ...((episode.scenario as string) === 'defense' ? buildDefenseSfx(episode as unknown as DefenseEpisode, timeline)
      : (episode.scenario as string) === 'infographic' ? buildInfographicSfx(episode as unknown as InfographicEpisode, timeline)
      : episode.scenario === 'armor' ? buildArmorSfx(episode, timeline)
      : episode.scenario === 'missile' ? buildMissileSfx(episode, timeline)
      : episode.scenario === 'naval' ? buildNavalSfx(episode, timeline)
      : episode.scenario === 'air' ? buildAirSfx(episode, timeline) : buildSfx(episode, timeline)),
    ...ctaSfx(episode, timeline),
    ...resultSfx(episode, timeline),
  ];
  const total = Math.round(videoSec(timeline) * FPS);
  // 문장 구간(초) → 덕킹 곡선 (앞뒤 0.15초 완만하게)
  const speech = timeline.sentences.map((s) => [s.start, s.end] as const);
  const duck = (sec: number) => {
    let d = 1;
    for (const [a, b] of speech) {
      const inside = interpolate(sec, [a - 0.15, a, b, b + 0.15], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      d = Math.min(d, 1 - (1 - DUCK) * inside);
    }
    return d;
  };
  const outro = (frame: number) => interpolate(frame, [total - 40, total], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <>
      <Audio src={staticFile(`ep/${ep}/narration.mp3`)} volume={NARRATION_VOL} />
      <Audio src={staticFile('bgm/tension.mp3')} loop
        volume={(f) => BGM_VOL * duck(f / FPS) * interpolate(f, [0, 20], [0, 1], {extrapolateRight: 'clamp'}) * outro(f)} />
      {cues.map((c, i) => {
        const from = Math.round(c.at * FPS);
        const dur = Math.max(2, c.dur ? Math.round(c.dur * FPS) : total - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Audio src={staticFile(`sfx/${c.file}`)}
              volume={(f) => {
                const env = c.dur ? Math.max(0, Math.min(1, f / 4, (dur - f) / 10)) : 1;
                return c.volume * env * duck((from + f) / FPS) * outro(from + f);
              }} />
          </Sequence>
        );
      })}
    </>
  );
};
