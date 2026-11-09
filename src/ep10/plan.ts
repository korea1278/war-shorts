// EP10 장면 시각표(문장 scene 키 + 자막 큐)와 효과음
import {Sfx, videoSec} from '../lib/schedule';
import {Episode, Timeline} from '../lib/types';

type ScriptScene = {scene?: string};
const start = (ep: Episode, tl: Timeline, key: string, fb: number) => {
  const i = (ep.script as ScriptScene[]).findIndex((l) => l.scene === key);
  return i >= 0 && tl.sentences[i] ? tl.sentences[i].start : fb;
};
const cue = (tl: Timeline, word: string, fb: number) => tl.chunks.find((c) => c.text.includes(word))?.start ?? fb;

export const moneyPlan = (ep: Episode, tl: Timeline) => {
  const T = videoSec(tl);
  const rok = start(ep, tl, 'rok', 8);
  const nk = start(ep, tl, 'nk', 11);
  const compare = start(ep, tl, 'compare', 14);
  const turn = start(ep, tl, 'turn', 21);
  const south = start(ep, tl, 'south', 24);
  const weapons = start(ep, tl, 'weapons', 29);
  const north = start(ep, tl, 'north', 35);
  const rust = start(ep, tl, 'rust', 41);
  const chase = start(ep, tl, 'chase', 44);
  const nuke = start(ep, tl, 'nuke', 49);
  const cta = start(ep, tl, 'cta', T - 4);
  return {
    T, rok, nk, compare, turn, south, weapons, north, rust, chase, nuke, cta,
    rokV: cue(tl, '66조', rok + 1), nkV: cue(tl, '48조', nk + 1), ratio: cue(tl, '1.3배', compare + 3),
    procure: cue(tl, '20조', weapons + 1), pct: cue(tl, '40%', weapons + 3),
  };
};
export type MoneyPlan = ReturnType<typeof moneyPlan>;

const GAIN = 0.3;
export const buildMoneySfx = (ep: Episode, tl: Timeline): Sfx[] => {
  const p = moneyPlan(ep, tl);
  const out: Sfx[] = [];
  const add = (file: string, at: number, volume: number, dur?: number) => {
    if (at < 0 || at >= p.T - 0.3) return;
    out.push({file, at, volume: volume * GAIN, dur: dur ? Math.min(dur, p.T - at) : undefined});
  };
  add('heartbeat.mp3', 0, 0.5, p.rok);
  add('drum.mp3', 0.1, 0.7);
  [p.rok, p.nk, p.compare, p.turn, p.south, p.weapons, p.north, p.chase, p.nuke].forEach((t) => add('whoosh.mp3', t - 0.2, 0.45));
  [p.rokV, p.nkV].forEach((t) => {
    add('pop.mp3', t, 0.7);
    add('typewriter.mp3', t + 0.03, 0.4, 0.85);
  });
  add('hit.mp3', p.ratio, 0.9);
  add('thud.mp3', p.ratio + 0.02, 0.8);
  add('jet.mp3', p.south + 0.1, 0.5, 2.4);
  add('water.mp3', p.south + 2.2, 0.4, 1.6);
  add('pop.mp3', p.procure, 0.7);
  add('hit.mp3', p.pct, 0.6);
  add('wind.mp3', p.north, 0.4, p.chase - p.north);
  add('thud.mp3', p.chase + 1.2, 0.6);
  add('deepboom.mp3', p.nuke + 0.1, 0.9);
  add('heartbeat.mp3', p.nuke + 0.6, 0.45, Math.max(0.5, p.cta - p.nuke - 0.6));
  return out;
};
