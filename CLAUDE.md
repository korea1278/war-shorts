# war-shorts — 9:16 밀리터리 맵 쇼츠 자동 제작 규칙

사용자는 PC방에서 작업한다. 로컬 설치를 요구하지 말고 렌더링은 모두 GitHub Actions(`쇼츠 만들기`)에서 한다.
답변은 한국어로 한다.

## 규격
- 1080x1920 · 30fps · 한국어 단일 버전
- **영상 길이 = 나레이션 실제 길이 + 여운 1.5초** (2026-11-01, 고정 1800프레임 폐지). `prepare.py`가 `timeline.json`의 `durationInFrames`를 계산, `Root.tsx` calculateMetadata가 사용. 카메라 키프레임은 60초 기준으로 쓰고 실제 길이에 비율로 자동 맞춤
- 나레이션이 57.5초를 넘으면 `prepare.py`가 자동으로 살짝 빠르게 맞춤
- 화면 3단: 상단 인포그래픽(Y 0~480, `src/components/TopStats.tsx`) / 중앙 지도(Y 384~1440, `MapCanvas.tsx` + `MapOverlay.tsx`, Canvas 2D) / 하단 자막(Y 1440~1920, `Subtitles.tsx`)
- 색: 북한 `#ff2828`, 한국 `#0066ff`, 강조 노랑 `#FFD000`, 폰트 Pretendard Black
- **상단 표준 (EP02~, 모든 에피소드)**: 0초부터 뱃지 `[ ● 가상 군사 시뮬레이션 IF ]`(빨간 원은 CSS로 그림 — 서버에 이모지 글꼴 없음), 타이틀 2줄 64px(길면 자동 축소)·3px 검정 외곽선·블러 없는 진한 그림자. 카드 전에는 타이틀을 아래로 내려 빈 공간 없앰 → 첫 카드 등장 때 위로. `stats.vs: true`면 카드 사이 VS
- 시나리오: `scenario`가 `"armor"`면 기갑전(`src/lib/armor.ts` + `ArmorOverlay.tsx`: 축선 화살표·전차 무리 → K2 2.5km 링·레이저 조준·120mm 사격·야간 화면·교환비 문구), 없으면 포격전(EP01). 지명 라벨 `phase` 0=항상, 1=1단계만, 2=2단계만
- 상세 위성: `map.mosaicDefs {"이름": [줌, [서,남,동,북]]}` + `map.mosaics: ["이름"]` → 근접 장면용 고해상도 모자이크(EP02 문산 z14)

## 새 에피소드 만드는 법
1. `episodes/<epNN-이름>/episode.json` 작성 (형식은 `episodes/ep01-artillery/episode.json`)
   - `script`: 문장 단위. 숫자는 `say`로 읽는 발음 지정 (1,000문 → "천 문", K9 → "케이나인")
   - `phase2: true` 문장에서 2단계(반격)로 전환 — 지도·통계 카드가 이 문장 시작 시각에 바뀜
   - `stats.phase1/phase2`: 카드 2장씩. `cue`는 그 글자가 자막에 나올 때 카드 등장
   - `map`: 발사 원점·목표·아군 진지·라벨 좌표 [경도, 위도], `camera` 키프레임(t<0은 구간 끝 기준)
2. 커밋·푸시 후 Actions `쇼츠 만들기` 실행 (episode 입력)
3. 결과 MP4·SRT·확인용 컷은 Artifacts(3일 보관)

## 파이프라인
- `pipeline/tiles.py`: Esri 위성 타일을 받아 모자이크 2장(z8 배경·z11 상세, 색 보정 포함)으로 합침 → `public/tiles/mosaic_*.jpg` + `mosaic.json` (캐시)
- `pipeline/prepare.py`: TTS + 자막 타임라인 + SRT. **일레븐랩스 Minho `U1cJYS4EdbaHmfR7YzHd`**, eleven_multilingual_v2, stability 0.38 · similarity 0.82 · style 0.12 · speed 1.15 · speaker boost. Actions는 `TTS_STRICT=1` → 키가 없거나 실패하면 다른 목소리로 바꾸지 않고 중단. 문장별 앞뒤 무음은 잘라내고 쉼은 0.22초(물음표 뒤 0.38초)
- `scripts/validate_audio_sync.py`: 렌더 직전 검증(ffmpeg silencedetect + faster-whisper tiny) — 끝 무음 2초 이상, 영상-오디오 길이 차 0~2초 밖, 마지막 자막 끝 vs 음성 끝 ±1초, Whisper 단어 대조(마지막 단어 ±1.2초, 커버리지 90%, 문장 시작 중앙값 0.8초) 실패 시 렌더 중단. 렌더 후 `--video`로 MP4 길이 재확인
- 믹싱: 나레이션 1.0, 효과음 전부 기존의 30%, BGM 0.11, 말하는 동안 효과음·BGM 50%로 덕킹 (`SoundTrack.tsx`)
- 효과음: `public/sfx` 17종(war-docu와 같은 음원) + 합성 레이더 비프 `radar.mp3`, 큐는 `src/lib/schedule.ts`의 `buildSfx`
- BGM: `public/bgm/tension.mp3` 고정 재사용 (음악 API 호출 금지)
- **렌더 속도 원칙 (2026-11-01)**: MapLibre(WebGL)는 GPU 없는 러너에서 소프트웨어로 돌아 프레임당 1초 이상 → 제거.
  지도는 `src/lib/camera.ts`의 경량 카메라(메르카토르+원근 틸트+회전, MapLibre와 같은 zoom/pitch/bearing)로
  모자이크를 가로 띠마다 아핀 변환해 Canvas 2D `drawImage` (1080x1056, 배율 1). 국경·탄도·폭발도 같은 캔버스에 그림
- 금지: CSS `filter`/`drop-shadow`/`blur`, SVG filter, 블러 있는 `box-shadow`·`text-shadow` (발광은 굵은 반투명 선 3단 겹치기)
- 렌더 옵션: `--gl=swiftshader --concurrency=2` (`--disable-dev-shm-usage`는 Remotion 기본값). 로컬 2코어 실측 120프레임 19초(시작 포함)

## 로컬 점검 (세션 안에서)
```
python3 pipeline/tiles.py --fake && python3 pipeline/prepare.py ep01-artillery --mock
npx remotion still src/index.ts Short out/x.png --frame=300 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
```
