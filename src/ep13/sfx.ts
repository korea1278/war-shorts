// EP13 효과음 큐 (효과음 30% 규칙 · 덕킹은 SoundTrack)
import {cueTime, Sfx} from '../lib/schedule';
import {Timeline} from '../lib/types';
import {blackoutPlan, BlackoutEpisode} from './plan';

const GAIN = 0.3;

export const buildBlackoutSfx = (ep: BlackoutEpisode, tl: Timeline): Sfx[] => {
  const p = blackoutPlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    out.push({file, at, volume: volume * GAIN, dur: dur ? Math.min(dur, p.T - at) : undefined});
  };
  // 야간 긴장감
  add('heartbeat.mp3', 0, 0.45, p.korea);
  add('wind.mp3', 0, 0.3, p.release);
  // 상단 카드 등장
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((st) => {
    const at = cueTime(tl, st.cue, -1);
    if (at >= 0) {
      add('pop.mp3', at, 0.7);
      add('typewriter.mp3', at + 0.03, 0.4, 0.8);
    }
  });
  // 표적 획득 레이더
  for (let s = p.korea + 0.4; s < p.release; s += 1.6) add('radar.mp3', s, 0.4);
  // F-15K 진입 → 투하 → 공중 개방
  add('jet.mp3', p.jet0, 0.7, Math.max(2, p.release - p.jet0 + 3));
  add('whoosh.mp3', p.release - 0.1, 0.7);
  add('pop.mp3', p.burst, 0.9);
  add('boom.mp3', p.burst + 0.02, 0.55);
  add('wind.mp3', p.burst + 0.3, 0.45, Math.max(1.5, p.land - p.burst));
  // 합선 스파크 (짧은 타격음 연타) → 연쇄 섬광
  for (let s = p.land; s < p.wave; s += 0.75) add('hit.mp3', s, 0.35);
  add('mg.mp3', p.mass, 0.25, Math.max(1, Math.min(3, p.flash - p.mass)));
  for (let k = 0; k < 4; k++) add('thud.mp3', p.flash + k * 0.9, 0.55);
  // 정전 파동 → 암전 (낮은 굉음 뒤 정적)
  add('deepboom.mp3', p.wave, 0.9);
  add('whoosh.mp3', p.wave + 0.1, 0.6);
  add('thud.mp3', p.out, 0.7);
  add('clock.mp3', p.comms, 0.3, 2);
  return out;
};
