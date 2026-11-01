# war-shorts — 9:16 밀리터리 맵 쇼츠 자동 제작 규칙

사용자는 PC방에서 작업한다. 로컬 설치를 요구하지 말고 렌더링은 모두 GitHub Actions(`쇼츠 만들기`)에서 한다.
답변은 한국어로 한다.

## 규격
- 1080x1920 · 30fps · 60초(1800프레임) · 한국어 단일 버전
- 나레이션 300자 안팎 = 약 50~55초. 57.5초를 넘으면 `prepare.py`가 자동으로 살짝 빠르게 맞춤
- 화면 3단: 상단 인포그래픽(Y 0~480, `src/components/TopStats.tsx`) / 중앙 지도(Y 384~1440, `MapCanvas.tsx` + `MapOverlay.tsx`) / 하단 자막(Y 1440~1920, `Subtitles.tsx`)
- 색: 북한 `#ff2828`, 한국 `#0066ff`, 강조 노랑 `#FFD000`, 폰트 Pretendard Black

## 새 에피소드 만드는 법
1. `episodes/<epNN-이름>/episode.json` 작성 (형식은 `episodes/ep01-artillery/episode.json`)
   - `script`: 문장 단위. 숫자는 `say`로 읽는 발음 지정 (1,000문 → "천 문", K9 → "케이나인")
   - `phase2: true` 문장에서 2단계(반격)로 전환 — 지도·통계 카드가 이 문장 시작 시각에 바뀜
   - `stats.phase1/phase2`: 카드 2장씩. `cue`는 그 글자가 자막에 나올 때 카드 등장
   - `map`: 발사 원점·목표·아군 진지·라벨 좌표 [경도, 위도], `camera` 키프레임(t<0은 구간 끝 기준)
2. 커밋·푸시 후 Actions `쇼츠 만들기` 실행 (episode 입력)
3. 결과 MP4·SRT·확인용 컷은 Artifacts(3일 보관)

## 파이프라인
- `pipeline/tiles.py`: Esri 위성 타일을 미리 받아 `public/tiles`(캐시) — 렌더 중 인터넷 타일 안 씀
- `pipeline/prepare.py`: TTS(일레븐랩스 `ELEVENLABS_API_KEY` 있으면 목소리 ZJCNdZEjYwkOElxugmW2, 없거나 실패하면 edge-tts ko-KR-InJoonNeural) + 자막 타임라인 + SRT
- 효과음: `public/sfx` 17종(war-docu와 같은 음원) + 합성 레이더 비프 `radar.mp3`, 큐는 `src/lib/schedule.ts`의 `buildSfx`
- BGM: `public/bgm/tension.mp3` 고정 재사용 (음악 API 호출 금지)
- 렌더: `--gl=swangle`(GPU 없는 러너에서 WebGL), 지도 캔버스만 pixelRatio 0.75(속도), SVG 블러 필터 금지(프레임당 1초 이상 느려짐)

## 로컬 점검 (세션 안에서)
```
python3 pipeline/tiles.py --fake && python3 pipeline/prepare.py ep01-artillery --mock
npx remotion still src/index.ts Short out/x.png --frame=300 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
```
