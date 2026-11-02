// EP05 인포그래픽 효과음 큐 (믹싱 규칙 동일: 모든 효과음 30%, 나레이션 말하는 동안 50% 덕킹은 SoundTrack에서)
import {Sfx} from '../lib/schedule';
import {Timeline} from '../lib/types';
import {plan} from './plan';
import {InfographicEpisode} from './types';

const GAIN = 0.3;

export const buildInfographicSfx = (ep: InfographicEpisode, tl: Timeline): Sfx[] => {
  const p = plan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    out.push({file, at, volume: volume * GAIN, dur: dur ? Math.min(dur, p.T - at) : undefined});
  };
  // 인트로: 심장박동 + 바람 + 영토 하이라이트 휘익 + 군사분계선 드럼
  add('heartbeat.mp3', 0, 0.5, p.army);
  add('wind.mp3', 0, 0.25, p.air);
  add('whoosh.mp3', 0.25, 0.7);
  add('drum.mp3', 0.75, 0.7);
  // 장면 전환마다 드럼·휘익
  [p.army, p.air, p.gdp, p.night, p.nuke].forEach((t) => {
    add('whoosh.mp3', t - 0.2, 0.55);
    add('drum.mp3', t, 0.5);
  });
  // 카운트업: 팝 + 타자기 롤링
  [p.armyNk, p.armyRok, p.airNk, p.airRok, p.gdpNk, p.gdpRok].forEach((t) => {
    add('pop.mp3', t, 0.7);
    add('typewriter.mp3', t + 0.03, 0.45, 0.85);
  });
  // 해군·공군 바운스 진입
  add('jet.mp3', p.air + 0.1, 0.55, 2.4);
  add('water.mp3', p.air + 0.5, 0.4, 1.6);
  add('jet.mp3', p.airRok - 0.1, 0.5, 2.0);
  // 돈다발 착지 + 56배 스탬프 강타
  add('thud.mp3', p.gdpRok + 0.3, 0.6);
  add('hit.mp3', p.stamp, 1.0);
  add('thud.mp3', p.stamp + 0.02, 0.9);
  // 야간 전환: 낮은 굉음 → 울산 펄스 레이더 비프
  add('deepboom.mp3', p.night, 0.45);
  for (let i = 0; i < 5; i++) add('radar.mp3', p.ulsan + i * 1.0, 0.5);
  // 핵 마크
  add('deepboom.mp3', p.nuke + 0.15, 0.9);
  add('boom.mp3', p.nuke + 0.2, 0.55);
  add('heartbeat.mp3', p.nuke + 0.6, 0.45, Math.max(0.5, p.cta - p.nuke - 0.6));
  return out;
};
