import {Timeline} from '../lib/types';
import {cueAt, sceneAt, videoSec} from './layout';
import {InfographicEpisode} from './types';

/** 문장·자막 큐에서 뽑은 장면 시각표 (초) */
export const plan = (ep: InfographicEpisode, tl: Timeline) => {
  const T = videoSec(tl);
  const army = sceneAt(ep, tl, 'army', 2.5);
  const air = sceneAt(ep, tl, 'air', 7);
  const gdp = sceneAt(ep, tl, 'gdp', 13.5);
  const night = sceneAt(ep, tl, 'night', 21);
  const nuke = sceneAt(ep, tl, 'nuke', 28);
  const cta = sceneAt(ep, tl, 'cta', T - 4);
  const s = ep.stats;
  return {
    T, army, air, gdp, night, nuke, cta,
    armyNk: cueAt(tl, s.army.nkCue, army + 0.4), armyRok: cueAt(tl, s.army.rokCue, army + 1.2),
    airNk: cueAt(tl, s.air.nkCue, air + 0.6), airRok: cueAt(tl, s.air.rokCue, air + 1.6),
    gdpNk: cueAt(tl, s.gdp.nkCue, gdp + 1.0), gdpRok: cueAt(tl, s.gdp.rokCue, gdp + 2.0),
    stamp: cueAt(tl, ep.gdpStamp.cue, gdp + 3.5),
    ulsan: cueAt(tl, ep.ulsan.cue, night + 1.5),
    ulsanValue: cueAt(tl, ep.ulsan.valueLabel.replace(/[^0-9]/g, '') || '90', night + 2.5),
  };
};
export type Plan = ReturnType<typeof plan>;
