import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

export const fontCss = () =>
  `@font-face{font-family:'Pretendard';src:url('${staticFile('fonts/Pretendard-Black.woff2')}') format('woff2');font-weight:100 900;font-display:block;}`;

/** Pretendard Black 로드가 끝날 때까지 렌더 대기 (글자 폭이 바뀌어 잘리는 것 방지) */
export const usePretendard = () => {
  const [h] = useState(() => delayRender('폰트 로드', {timeoutInMilliseconds: 60000}));
  useEffect(() => {
    const f = new FontFace('Pretendard', `url(${staticFile('fonts/Pretendard-Black.woff2')})`, {weight: '100 900'});
    f.load()
      .then((ff) => (document.fonts as unknown as {add: (x: FontFace) => void}).add(ff))
      .catch((e) => console.warn('font', e))
      .finally(() => continueRender(h));
  }, [h]);
};
