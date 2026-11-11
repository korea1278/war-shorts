// EP12 SLBM 수중 발사: 문장 scene 키 + 자막 큐 → 연출 시각(초)
import {cueTime, videoSec} from '../lib/schedule';
import {Episode, LngLat, Timeline} from '../lib/types';

export type SlbmScene = 'intro' | 'aip' | 'stealth' | 'vls' | 'launch' | 'breach' | 'track' | 'impact' | 'outro' | 'cta';

export type SlbmData = {
  launch: LngLat; launchLabel: string; target: LngLat; targetLabel: string;
  subLabel: string; aipLabel: string; vlsLabel: string; missileLabel: string;
  coldLabel: string; igniteLabel: string; originLabel: string; stamp: [string, string];
  launchCue: string; breachCue: string; igniteCue: string; impactCue: string; stampCue: string;
};

export type SlbmEpisode = Omit<Episode, 'script'> & {
  composition: string;
  slbm: SlbmData;
  script: {t: string; say?: string; phase2?: boolean; subs?: string[]; scene: SlbmScene}[];
};

export type SlbmPlan = {
  T: number;
  aip: number; stealth: number; vls: number; launch: number; eject: number;
  breach: number; ignite: number; track: number; impact: number; outro: number; stamp: number;
};

export const slbmPlan = (ep: SlbmEpisode, tl: Timeline): SlbmPlan => {
  const T = videoSec(tl);
  const at = (scene: SlbmScene, fb: number) => {
    const i = ep.script.findIndex((s) => s.scene === scene);
    return i >= 0 && tl.sentences[i] ? tl.sentences[i].start : fb;
  };
  const d = ep.slbm;
  const launch = at('launch', T * 0.45);
  const breach = at('breach', launch + 4);
  const track = at('track', breach + 3.5);
  const impact = at('impact', track + 3.5);
  return {
    T,
    aip: at('aip', T * 0.15),
    stealth: at('stealth', T * 0.25),
    vls: at('vls', T * 0.35),
    launch,
    eject: cueTime(tl, d.launchCue, launch + 1.2),
    breach,
    ignite: cueTime(tl, d.igniteCue, breach + 1),
    track,
    impact: Math.max(cueTime(tl, d.impactCue, impact), track + 2),
    outro: at('outro', impact + 3.5),
    stamp: cueTime(tl, d.stampCue, at('outro', impact + 3.5)),
  };
};
