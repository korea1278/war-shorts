// QHD(1440x2560) 인포그래픽 템플릿 타입 (EP05~)
import {LngLat, Timeline} from '../lib/types';

export type SceneKey = 'intro' | 'army' | 'air' | 'gdp' | 'night' | 'nuke' | 'cta';

export type VsStat = {
  label: string; // 카드 위 분류 (예: "상비 병력")
  nk: number;
  rok: number;
  unit: string; // 숫자 뒤 단위 (예: "만 명")
  decimals?: number;
  prefix?: string; // 숫자 앞 (예: "약")
  nkCue?: string; // 이 글자가 자막에 나오면 북한 숫자 카운트업
  rokCue?: string;
  sub?: {label: string; nk: string; rok: string}; // 아래 작은 비교 줄 (예: 예비 전력)
  source?: string; // 출처 표기
};

export type InfographicEpisode = {
  id: string;
  composition: string;
  scenario: 'infographic';
  layout: 'safe';
  title: [string, string];
  disclaimer?: string;
  cta?: boolean;
  highlight?: string[];
  script: {t: string; say?: string; scene: SceneKey}[];
  stats: {army: VsStat; air: VsStat; gdp: VsStat};
  gdpStamp: {text: string; cue: string};
  ulsan: {pos: LngLat; badge: string; cue: string; value: number; nkValue: number; valueLabel: string; nkLabel: string; source?: string};
  nuke: {pos: LngLat; line1: string; line2: string};
  map: {
    fit: [number, number, number, number]; // 지도 프레임에 맞출 [서,남,동,북]
    mosaicDefs: Record<string, [number, [number, number, number, number]]>;
    nightDefs: Record<string, [number, [number, number, number, number]]>;
    day: string; // 주간 위성 모자이크 이름
    night: string; // 야간 불빛 모자이크 이름
    mdl: LngLat[]; // 군사분계선 근사 좌표
    labels: {nk: LngLat; rok: LngLat};
  };
};

export type Mosaic = {file: string; z: number; x0: number; y0: number; w: number; h: number; night?: boolean};

export type GeoFeature = {properties: {iso: 'KOR' | 'PRK'}; geometry: {type: 'MultiPolygon'; coordinates: number[][][][]}};

export type InfographicProps = {
  ep: string;
  episode?: InfographicEpisode;
  timeline?: Timeline;
  geo?: {features: GeoFeature[]};
  mosaics?: Record<string, Mosaic>;
};
