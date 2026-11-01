// 끝 4초 결과 카드 공통 (EP04~): 총 프레임 - 120프레임부터
import {FPS, videoSec} from './schedule';
import {Episode, Timeline} from './types';

export const RESULT_SEC = 4;
export const resultOn = (ep: Episode) => !!ep.result;
/** 결과 카드 진입 프레임 = 총 프레임 - 120 */
export const resultStartFrame = (tl: Timeline) => Math.round(videoSec(tl) * FPS) - RESULT_SEC * FPS;
