# war-shorts 영구 제작 표준 규칙

> 2026-11-11 확정 · EP12 재제작부터 **앞으로 만드는 모든 쇼츠에 강제 적용**. 새 세션에서도 작업 전에 이 파일을 먼저 읽는다.
> 아래 1~4항은 사용자가 정한 원문, 각 항의 「구현」은 저장소에서 이 규칙을 강제하는 위치.

## 1. 오디오 단일 생성 원칙 (Strict Single File)
- 문장/어절 단위 분할 생성 및 단순 이어붙이기 절대 금지 (팝 노이즈 및 끊어읽기 원천 차단).
- 55~58초 전체 대본을 한 번의 ElevenLabs API 호출로 단일 파일(`shorts_epXX.mp3`)로 추출.
- 대본 내 불필요한 쉼표(,) 전면 금지 (마침표로만 호흡 제어). 100% 한글 발음 표기.

**구현**
- `pipeline/prepare.py`: 문장 낭독(`say`, 없으면 `t`)을 공백으로 이어 **`/v1/text-to-speech/{voice}/with-timestamps` 1회 호출** → `tts/full_<해시>.mp3` 한 파일 + 글자별 시각. 문장 사이 무음 삽입·문장별 무음 자르기·concat 없음. 쉼은 대본의 마침표/물음표로만 생김
- 길이 맞춤은 단일 파일 전체에 `atempo` 한 번만 (57.5초 초과 → 빠르게 최대 1.12배, 55초 미만 → 느리게 최소 0.94배). `minNarrationSec`·`maxNarrationSec`로 조정
- 대본 검사(`check_script`) — 하나라도 어기면 TTS 호출 전에 중단 (크레딧 낭비 없음)
  - `say`: 쉼표 금지, 한글·공백·`. ? !` 외 글자 금지 (숫자·영문·하이픈 → 한글로: 3,000 → 삼천, SLBM → 에스엘비엠, 현무-4-4 → 현무사다시사)
  - `t`(화면 자막): 숫자 자릿점(3,000) 외 쉼표 금지 — 자막 숫자는 숫자 그대로 표시
- Actions 결과물에 `shorts_epXX.mp3`(= 단일 나레이션) 첨부

## 2. 자막 배치 세이프존 (UI Safe Zone)
- 자막 수직 위치: `bottom: 23%` (약 Y: 1420px) 고정. 하단 0~20%는 유튜브 UI 마진으로 비움.
- 상단 인포그래픽 레이어와 자막 레이어 분리 (중복 텍스트 렌더링 방지).
- 오디오 파형 기준으로 자막 start/end 타임스탬프 동기화 (오차 ±0.5초 이내).

**구현**
- `episode.json`: `"layout": "safe"`, `"subtitleBottomY": 1478` (1920×0.77 = 자막 박스 바닥, 박스는 위로 자람 → 글자 중심 약 Y 1420). Y 1536~1920(하단 20%)엔 아무것도 그리지 않음. CTA는 `ctaBottomY`로 자막 위
- 자막은 `Subtitles.tsx` 한 레이어에서만. 중앙 무대 라벨·상단 카드가 같은 시점 자막과 같은 글자를 쓰지 않게 할 것 (EP12: 무대 라벨 `subLabel`·`vlsLabel` 비움 — 빈 라벨은 그리지 않음). `subtitleBottomY`를 쓰면 CTA 뱃지는 안내 문구 없이 [구독][좋아요] 버튼만 (`ctaHeadline`으로 강제 가능)
- 타이밍: 일레븐랩스 글자 타임스탬프로 문장·자막 시작/끝 계산 (`timeline.json` `"mode": "single"`, `"alignment": "elevenlabs-timestamps"`). 자막 `t`와 `say`의 **띄어쓰기 단어 수를 같게** 쓰면 자막 경계가 실제 발화 단어 시각에 정확히 맞음 (다르면 경고 후 문장 안 비례 배분) → 예: `3,000톤의` ↔ `삼천톤의`
- 검증 `scripts/validate_audio_sync.py`: 단일 모드면 마지막 자막 끝·첫/마지막 단어·문장 시작·**자막 시작 중앙값 모두 ±0.5초**, 나레이션 55~58초 확인. 실패 시 렌더 중단

## 3. 썸네일 컴포넌트 규격 (ShortsThumbnail.tsx)
- 상단 15~35% 구역: 110~125px 초극태 볼드 텍스트 (블랙 스트로크 + 드롭섀도우).
- Frame 0 또는 스냅샷 PNG 자동 추출 파이프라인 유지.

**구현**
- `src/components/ShortsThumbnail.tsx`: 헤드카피 1줄 115px·2줄 125px, 8px 검정 외곽선 + 20px 하드 섀도우(블러 없음). 길면 가로 압축하고 글자는 **110px 아래로 줄이지 않음**(`MIN_FS`)
- Still `shorts-thumbnail` → `public/thumbnails/shorts_epNN.png` + 영상 Frame 0에 1프레임 렌더. 에피소드마다 `ThumbCopy`(라벨·2줄 카피·훅)만 바꿈

## 4. 렌더링 엔진 원칙
- 시간 함수(Date.now) 배제, `frame / 30fps` 기반 결정론적 프레임 제어.

**구현**
- `src/`에서 `Date.now`·`new Date`·`performance.now`·`Math.random` 사용 금지. 애니메이션은 `useCurrentFrame()/fps`, 난수는 시드 고정 함수(`rand(i)`)만

## 새 쇼츠 체크리스트
1. 대본: 낭독 약 480자(공백 포함, Minho 1.15배 기준 55~58초), 쉼표 없음, `say`는 100% 한글, `t`/`say` 단어 수 일치
2. `episode.json`: `layout: safe`, `subtitleBottomY: 1478`, `ctaBottomY`, `minNarrationSec: 55`, `maxNarrationSec: 57.5`
3. 무대 라벨·상단 카드·자막 글자 중복 없는지 확인용 스틸로 점검
4. **업로드용 제목·설명·태그 `dist/epNN_metadata.txt` 필수 (렌더 전에 작성 — 워크플로가 Artifacts에 같이 첨부)**
   - 형식은 `dist/ep07_metadata.txt`: [제목] / [제목 후보] / [설명] / 📊 자료 출처 / ※ 가상 시뮬레이션 안내 / [태그]
   - 5060 시청자 기준으로 꼼꼼하게, 채널명·인사말 넣지 않기, 숫자는 숫자로
   - 영상 속 수치는 공식 발표와 대조하고, 출처마다 표현이 다르면 설명란에 함께 적기
5. Actions `쇼츠 만들기` 실행 → 검증(±0.5초) 통과해야 렌더
