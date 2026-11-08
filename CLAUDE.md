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
- 시나리오 `"missile"`(EP03~): `src/lib/missile.ts` + `MissileOverlay.tsx` — 발사대 점화·연기 → 고각 탄도(지상궤적+고도, 고도는 tanh 압축) → 대기권 경계 100km 점선·고도/마하 계기 → 2단계 재진입·화면 위에서 수직 낙하 → 충돌 섬광·지면 파동 링·화면 진동(캔버스 transform) → 관통 깊이 게이지 → 심도 폭발·벙커 매몰. `map.missile`의 `impactCue`(충돌)·`buryCue`(매몰) 자막 기준. 카메라 bearing을 탄도 방향+90°로 두면 궤적이 옆에서 본 포물선으로 보임
- 효과음 추가(EP03, ffmpeg 합성): `rocket.mp3` 로켓 점화·발사, `reentry.mp3` 초음속 재진입 굉음(끝 소닉붐), `thud.mp3` 지하 관통 강타음, `deepboom.mp3` 심도 폭발음
- **구독·좋아요 CTA (EP03~, 모든 에피소드 기본)**: `CtaOverlay.tsx` — 끝 4초, 자막 위(Y 1236~) 네온 레드 뱃지 `🔔 다음 시뮬레이션이 궁금하다면? [구독] [좋아요]`(종·엄지는 SVG), 스케일 0.9→1.0 스프링 바운스 + 블러 없는 펄스 링, 1.6초에 구독 버튼 눌림→'구독중', 2.3초 좋아요 강조. 대본 마지막 문장에 구독·좋아요 멘트. 끄려면 `"cta": false`
- 시나리오 `"air"`(EP04~): `src/lib/air.ts` + `AirOverlay.tsx` — 1단계 북한 편대(경로 `map.air.routes`) 남하 궤적·화살표 → 2단계 KF-21 편대 AESA 부채꼴 빔(`radarKm`·`radarBearing`·`radarSpread`) → 록온 박스 → 미티어 푸른 궤적·연속 공중 폭발. 큐 `radarCue`·`lockCue`·`fireCue`·`killCue`. 효과음 `jet.mp3`(ffmpeg 합성 제트 굉음) 추가
- **Safe Area 레이아웃 `"layout": "safe"` (EP04~)**: 뱃지 Y130·24px·`#FF3B30`, 타이틀 Y180·60px 고정, 카드 Y352~, 지도 384~1440, 자막 Y1550~1720·우측 150px 마진(2줄 자동), CTA 바닥 Y1535
- **결과 카드 `"result"` (EP04~)**: 총 프레임-120(끝 4초)부터 `ResultCard.tsx` Y480~1250 단독 + 스탯 박스 opacity 0 페이드 + 지도 80% 딤 + Metal Hit(hit+thud)
- 자막 단일 활성화: `Subtitles.tsx`가 정수 프레임 `[startFrame, endFrame)`로 판정, 간격 5프레임 미만은 다음 자막까지 늘려 Cut. 검증 스크립트가 겹침·`ceil(오디오×30)+45` 프레임 확인
- 자막에서 끊기면 안 되는 단어(예 "마하 4")는 `t`에 줄바꿈 없는 공백(U+00A0)
- 카드 옵션: `valueText`(숫자 대신 글자, 예 "20~30"), `side: "gray"`(비교 기준값 회색), `numPrefix`(숫자 앞 단위, 예 "마하"), `stats.vsPhase2`
- 상세 위성: `map.mosaicDefs {"이름": [줌, [서,남,동,북]]}` + `map.mosaics: ["이름"]` → 근접 장면용 고해상도 모자이크(EP02 문산 z14)

## F-35A 스텔스 공중전 (EP07~, `"scenario": "air"` 확장)
- `map.air.stealth`: `cue` 자막부터 북한 조기경보 레이더(`ewRadars` 붉은 반경·회전 스윕·"탐지 실패") + F-35A 침투 점선·반투명 유령 실루엣(`path`, 끝점=편대 선두). 2단계 진입 후 페이드아웃
- `bvrCue`: 아군 선두기↔가장 가까운 적기 노란 교전선 + 실제 거리 km 라벨. `radarLabel`(부채꼴 라벨)·`missileName`(격추 카운터 미사일명, 예 "암람")
- 자막: 문장별 `subs`로 의미 단위 직접 분할(이어 붙인 글자가 `t`와 다르면 prepare.py 중단), `highlightColor`(EP07 #FFE500), `warn` 단어는 경고 레드 #FF3B30

## 서해 항모전 (EP08~, `"scenario": "naval"`)
- `src/lib/naval.ts` + `NavalOverlay.tsx`: 1단계 항모 항적(`map.naval.carriers[].path`, 항모당 호위함 `escortsPerCarrier`)·서해 중간선 흰 점선·얕은 수심 음영(`sea` 다각형, `depthCue`)·함재기 초계(`jetCue`)·킬존 붉은 빗금 타원 + 잠수함 은신 불가(`killCue`·`killZone`·`subs`)·서해안 기지 타격권 원(`rangeCue`·`rangeKm`·`bases`)
- 2단계: 기지 초음속 미사일(`launchCue`, 시안) → 2함대 함대함(`fleetCue`, 파랑) → F-15K 슬램이알(`slamCue`, 노랑) 순으로 호위함 격침 → 항모 본함은 `graveCue` 직전 일제 타격 + 붉은 X·"항모의 무덤"
- 서해 위성 모자이크 `mosaicDefs.yellowsea` z9 (기본 back 모자이크는 동경 123.5도부터라 산둥반도가 빠짐)

## QHD 인포그래픽 템플릿 (EP05~, `"scenario": "infographic"`)
- 컴포지션 `ep05-military-gap` · **1440x2560(QHD)** · 30fps — 유튜브가 1440p 업로드에 VP09/AV01 고화질 코덱을 붙이게 함. 워크플로는 `episode.json`의 `"composition"`으로 렌더 대상을 자동 선택(없으면 `Short`)
- 길이 규칙은 동일(나레이션 + 1.5초). `maxNarrationSec: 32.5` → 34초 이내
- 순수 2D/SVG 벡터: `src/components/infographic/` — `CountUpText`(0→목표 카운트업, 8px 외곽선·하드 섀도우), `BouncingAsset`(spring damping 12·mass 0.8·stiffness 120 + 착지 스쿼시), `TerritoryHighlight`(북한 #FF3B30 0.6 + 인공기 clip-path / 남한 #0066FF 0.6 + 태극기 clip-path, 군사분계선 네온 화이트 3단), `NightMapOverlay`(NASA GIBS Black Marble 야간 모자이크 크로스페이드, 못 받으면 벡터 도시 불빛), `TargetPulseRing`(동심원 펄스 + 뱃지), `assets.tsx`(전투기·군함·돈다발·핵 마크·국기 SVG)
- 장면은 문장별 `scene` 키(`intro/army/air/gdp/night/nuke/cta`) 시작 시각과 자막 큐(`nkCue`·`rokCue`·`gdpStamp.cue`·`ulsan.cue`)로 자동 배치 (`src/ep05/plan.ts`) → 숫자는 `stats`·`ulsan`·`gdpStamp`만 바꾸면 됨
- 지도: `map.fit` 범위를 지도 프레임 높이에 맞춤, 주간 `mosaicDefs`·야간 `nightDefs`(줌 최대 8) 모두 `pipeline/tiles.py`가 받음. 카메라는 `src/ep05/layout.ts` `camAt`(울산 줌인 → 핵 장면 북쪽)
- 자막·CTA는 1080 Safe Area 컴포넌트를 ×4/3 스케일로 재사용(DOM 벡터라 선명). 자막 아래 안내 문구는 `"disclaimer"`로 교체 가능
- 효과음 `src/ep05/sfx.ts` (30% 규칙·덕킹 동일). 업로드용 메타데이터는 `dist/epNN_metadata.txt` → Artifacts에 같이 첨부
- 수치는 반드시 최신 공식 자료로 확인 후 넣고 출처를 패널·설명란에 표기 (EP05: 2022 국방백서, 한국은행 2025 북한 GNI)

## 다층 방공망 시뮬레이션 (EP06~, `"scenario": "defense"`)
- 컴포지션 `ep06-missile-defense` · 1440x2560 · 30fps · 목표 35초 (`maxNarrationSec: 33.5` + 여운 1.5초)
- 인트로·발사: 한반도 지도 위 북한 발사 지점(`map.launchSites`) → 남쪽 표적(`map.targets`) 붉은 궤적 26줄기, 평양–서울 거리선
- 이후 측면 고도 무대: `AltitudeLayerGrid`(레이어 `layers`: 상층 L-SAM 시안 / 15~40km 천궁-II·PAC-3 그린 / 15km 이하 LAMD 옐로 + 우측 0~60km 눈금자), `MissileTrajectory`(KN-23 붉은 궤적·풀업 기동·예상 궤도 점선·추적 박스, 요격탄 수직 상승→교차→섬광·충격파), `defenseAssets.tsx`(그린파인 레이더·L-SAM·천궁-II·패트리어트·LAMD 차량·스카이라인 SVG)
- 연출 시각은 `src/ep06/plan.ts`(scene 키 `intro/launch/lsam/pullup/mid/lamd/outro/cta` + 자막 큐 `lsam.hitCue`·`pullup.cue`·`mid.fireCue/hitCue`·`lamd.cue/hitCue`·`outro.coreCue`), 탄두·요격 계산은 `src/ep06/sim.ts`(시간의 순수 함수), 효과음 `src/ep06/sfx.ts`
- 수치 근거: PAC-3는 공개 자료상 15~40km(천궁-II와 같은 층)이라 하층(LAMD)과 분리. L-SAM·LAMD는 미배치 → "배치 예정" 표현

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

## 정찰 공백 (EP09~, `"scenario": "recon"`)
- `src/lib/recon.ts` + `ReconOverlay.tsx`: 1단계 감시망·전력 이탈 → 2단계 유투·위성 링크 단절 → 흑색 블라인드(`map.recon.blindZones`) → 사이오 위성 통과 때만 블라인드 해제. 큐는 `map.recon.*Cue`
- `"exports": {"audio", "subtitles"}`: 지정 경로로 나레이션·자막 JSON을 내보내고 Artifacts에 첨부
