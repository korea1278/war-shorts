// EP06 방공망 효과음 큐 (믹싱 규칙 동일: 효과음 30%, 말하는 동안 50% 덕킹은 SoundTrack에서)
import {Sfx} from '../lib/schedule';
import {Timeline} from '../lib/types';
import {plan} from './plan';
import {buildSim} from './sim';
import {DefenseEpisode} from './types';

const GAIN = 0.3;

export const buildDefenseSfx = (ep: DefenseEpisode, tl: Timeline): Sfx[] => {
  const p = plan(ep, tl);
  const sim = buildSim(p);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    out.push({file, at, volume: volume * GAIN, dur: dur ? Math.min(dur, p.T - at) : undefined});
  };
  // 인트로: 심장박동 + 연속 발사음
  add('heartbeat.mp3', 0, 0.5, p.lsam);
  add('wind.mp3', 0, 0.25, p.lsam);
  [0.2, 0.6, 1.1, 1.6].forEach((t, i) => add('rocket.mp3', t, 0.55 - i * 0.08, 1.6));
  add('rocket.mp3', p.launch - 0.4, 0.4, 1.6);
  // 발사 장면: 탐지 레이더 비프 + 카운트업
  for (let i = 0; i < 4; i++) add('radar.mp3', p.launch + 0.2 + i * 0.9, 0.45);
  p.cards.forEach((t) => {
    add('pop.mp3', t, 0.7);
    add('typewriter.mp3', t + 0.03, 0.4, 0.8);
  });
  // 장면 전환
  [p.launch, p.lsam, p.pullup, p.mid, p.lamd, p.outro].forEach((t) => {
    add('whoosh.mp3', t - 0.2, 0.55);
    add('drum.mp3', t, 0.45);
  });
  // 요격탄 발사(로켓) · 요격 성공(폭발)
  const seen = new Set<number>();
  sim.interceptors.forEach((ic) => {
    const k = Math.round(ic.t0 * 5); // 0.2초 안에 몰린 발사음은 하나로
    if (!seen.has(k)) {
      seen.add(k);
      add('rocket.mp3', ic.t0, ic.kind === 'lamd' ? 0.3 : 0.5, 1.2);
    }
  });
  const seenB = new Set<number>();
  sim.blasts.forEach((b) => {
    const k = Math.round(b.t * 6);
    if (seenB.has(k)) return;
    seenB.add(k);
    if (b.ground) {
      add('deepboom.mp3', b.t, 1.0);
      add('boom.mp3', b.t + 0.02, 0.8);
    } else add(b.color === '#FFD000' ? 'hit.mp3' : 'boom.mp3', b.t, b.color === '#FFD000' ? 0.5 : 0.75);
  });
  // 풀업 경고: 재진입 굉음 + 심장박동
  add('reentry.mp3', p.pullupAt - 0.6, 0.45, 2.0);
  // LAMD: 장사정포 발사음 + 돔 전개
  add('artillery_far.mp3', p.lamd + 0.1, 0.6, 2.5);
  add('whoosh.mp3', p.lamdOn - 0.1, 0.7);
  // 결론: 3축 카드 강타
  add('hit.mp3', p.core, 0.8);
  add('thud.mp3', p.core + 0.02, 0.7);
  add('heartbeat.mp3', p.core + 0.3, 0.4, Math.max(0.5, p.cta - p.core - 0.3));
  return out;
};
