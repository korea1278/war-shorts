// EP12 효과음 큐 (효과음 30% 규칙 · 덕킹은 SoundTrack)
import {Sfx} from '../lib/schedule';
import {cueTime} from '../lib/schedule';
import {Timeline} from '../lib/types';
import {slbmPlan, SlbmEpisode} from './plan';

const GAIN = 0.3;

export const buildSlbmSfx = (ep: SlbmEpisode, tl: Timeline): Sfx[] => {
  const p = slbmPlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    out.push({file, at, volume: volume * GAIN, dur: dur ? Math.min(dur, p.T - at) : undefined});
  };
  // 심해 긴장감: 심장박동 + 소나 핑
  add('heartbeat.mp3', 0, 0.5, p.aip);
  add('water.mp3', 0, 0.35, p.launch);
  for (let s = 0.4; s < p.launch; s += 2.2) add('radar.mp3', s, 0.4);
  // 상단 카드 등장
  [...ep.stats.phase1, ...ep.stats.phase2].forEach((st) => {
    const at = cueTime(tl, st.cue, -1);
    if (at >= 0) {
      add('pop.mp3', at, 0.7);
      add('typewriter.mp3', at + 0.03, 0.4, 0.8);
    }
  });
  // 장면 전환
  [p.aip, p.stealth, p.vls, p.track].forEach((t) => add('whoosh.mp3', t - 0.2, 0.55));
  add('drum.mp3', p.vls, 0.5);
  // 발사 명령 → 콜드런치 사출 → 수면 돌파 → 점화
  add('clock.mp3', p.launch, 0.45, Math.max(0.5, p.eject - p.launch));
  add('thud.mp3', p.eject, 0.9);
  add('water.mp3', p.eject, 0.8, 2.5);
  add('water.mp3', p.breach, 1.0, 1.8);
  add('rocket.mp3', p.ignite, 1.0, 3.0);
  add('jet.mp3', p.track + 0.3, 0.45, Math.max(1, p.impact - p.track));
  // 표적 타격
  add('reentry.mp3', p.impact - 1.2, 0.5, 1.3);
  add('boom.mp3', p.impact, 1.0);
  add('deepboom.mp3', p.impact + 0.05, 0.9);
  // 결론 직인
  add('hit.mp3', p.stamp, 0.8);
  add('thud.mp3', p.stamp + 0.02, 0.7);
  return out;
};
