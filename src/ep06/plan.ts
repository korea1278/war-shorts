// 문장(scene)·자막 큐 → 장면 시각표(초). TTS 길이가 달라도 연출이 나레이션을 따라감
import {Timeline} from '../lib/types';
import {cueAt, videoSec} from '../ep05/layout';
import {DefenseEpisode, DefenseScene} from './types';

const within = (v: number, a: number, b: number) => Math.max(a, Math.min(Math.max(a, b), v));

export const sceneStart = (ep: DefenseEpisode, tl: Timeline, key: DefenseScene, fb: number) => {
  const i = ep.script.findIndex((l) => l.scene === key);
  return i >= 0 && tl.sentences[i] ? tl.sentences[i].start : fb;
};

export const plan = (ep: DefenseEpisode, tl: Timeline) => {
  const T = videoSec(tl);
  const launch = sceneStart(ep, tl, 'launch', 4);
  const lsam = sceneStart(ep, tl, 'lsam', 8);
  const pullup = sceneStart(ep, tl, 'pullup', 13);
  const mid = sceneStart(ep, tl, 'mid', 16.5);
  const lamd = sceneStart(ep, tl, 'lamd', 21.5);
  const outro = sceneStart(ep, tl, 'outro', 26);
  const cta = sceneStart(ep, tl, 'cta', T - 3.5);
  const cards = ep.threat.cards.map((c, i) => cueAt(tl, c.cue, launch + 0.3 + i * 0.8) + (i ? 0.45 * i : 0));
  const lsamHit = within(cueAt(tl, ep.lsam.hitCue, lsam + 2.4) + 0.3, lsam + 1.7, pullup - 0.3);
  const pullupAt = within(cueAt(tl, ep.pullup.cue, pullup + 1.0) + 0.2, pullup + 0.5, mid - 1.3);
  const midFire = within(cueAt(tl, ep.mid.fireCue, mid + 1.0), mid + 0.3, lamd - 2);
  const midHit = within(cueAt(tl, ep.mid.hitCue, mid + 2.6), midFire + 1.3, lamd - 0.3);
  const lamdOn = within(cueAt(tl, ep.lamd.cue, lamd + 1.6), lamd + 0.3, outro - 2);
  const lamdHit = within(cueAt(tl, ep.lamd.hitCue, lamd + 3.0), lamdOn + 0.8, outro - 0.5);
  const core = within(cueAt(tl, ep.outro.coreCue, outro + 2.0), outro + 0.8, T - 0.5);
  return {T, launch, lsam, pullup, mid, lamd, outro, cta, cards, lsamHit, pullupAt, midFire, midHit, lamdOn, lamdHit, core};
};
export type Plan = ReturnType<typeof plan>;

/** 지금 장면 */
export const sceneOf = (p: Plan, sec: number): DefenseScene =>
  sec >= p.cta ? 'cta' : sec >= p.outro ? 'outro' : sec >= p.lamd ? 'lamd' : sec >= p.mid ? 'mid'
    : sec >= p.pullup ? 'pullup' : sec >= p.lsam ? 'lsam' : sec >= p.launch ? 'launch' : 'intro';
