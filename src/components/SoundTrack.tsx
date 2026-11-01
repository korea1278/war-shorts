import React from 'react';
import {Audio, interpolate, Sequence, staticFile} from 'remotion';
import {buildSfx, FPS, TOTAL_SEC} from '../lib/schedule';
import {Episode, Timeline} from '../lib/types';

export const SoundTrack: React.FC<{ep: string; episode: Episode; timeline: Timeline}> = ({ep, episode, timeline}) => {
  const cues = buildSfx(episode, timeline);
  const total = TOTAL_SEC * FPS;
  return (
    <>
      <Audio src={staticFile(`ep/${ep}/narration.mp3`)} volume={1} />
      <Audio src={staticFile('bgm/tension.mp3')} loop
        volume={(f) => interpolate(f, [0, 20, total - 45, total], [0, 0.13, 0.13, 0], {extrapolateRight: 'clamp'})} />
      {cues.map((c, i) => {
        const from = Math.round(c.at * FPS);
        const dur = c.dur ? Math.round(c.dur * FPS) : undefined;
        return (
          <Sequence key={i} from={from} durationInFrames={dur ?? total - from} layout="none">
            <Audio src={staticFile(`sfx/${c.file}`)}
              volume={(f) => (dur ? c.volume * interpolate(f, [0, 4, dur - 10, dur], [0, 1, 1, 0], {extrapolateRight: 'clamp'}) : c.volume)} />
          </Sequence>
        );
      })}
    </>
  );
};
