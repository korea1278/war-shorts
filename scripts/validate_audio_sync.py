"""오디오 공백·영상 길이·자막 싱크 자동 검증 (렌더 전/후).

python scripts/validate_audio_sync.py ep01-artillery                     # 렌더 전 검사
python scripts/validate_audio_sync.py ep01-artillery --require-whisper   # Whisper 대조 필수 (Actions)
python scripts/validate_audio_sync.py ep01-artillery --video out/ep01-artillery.mp4   # 렌더 후 길이 검사

오픈소스 도구
  - ffmpeg silencedetect : 무음 구간 (앞·중간·끝 공백)
  - faster-whisper tiny  : 실제 음성의 단어 타임스탬프 → 자막 JSON과 대조
하나라도 실패하면 exit 1 (워크플로가 렌더 전에 멈춤). 결과는 out/validate_<ep>.md + Actions 요약
"""
import argparse
import difflib
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30

# 기준값
MAX_TRAIL_SILENCE = 2.0   # 오디오 끝 무음 허용(초) — 이상이면 실패
MAX_LEAD_SILENCE = 1.0    # 0초부터 바로 나레이션
MAX_GAP_SILENCE = 2.0     # 문장 사이 무음 공백
MAX_LEN_DIFF = 2.0        # 영상 길이 - 오디오 길이
MAX_END_DIFF = 1.0        # 마지막 자막 끝 vs 실제 음성 끝
MAX_WHISPER_END_DIFF = 1.2
MAX_SENT_OFFSET = 0.8     # 문장 시작 vs Whisper 단어 시작 (중앙값)
STD_TOL = 0.5   # docs/SHORTS_STANDARD.md 2항: 자막 start/end 오차 ±0.5초
MIN_COVERAGE = 0.9        # 음성 단어 중 자막이 떠 있는 비율


def ffprobe_dur(p, stream=None):
    args = ["ffprobe", "-v", "error"]
    if stream:
        args += ["-select_streams", stream, "-show_entries", "stream=duration"]
    else:
        args += ["-show_entries", "format=duration"]
    out = subprocess.run(args + ["-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout.strip().splitlines()
    v = out[0].strip(",") if out else ""
    return float(v) if v not in ("", "N/A") else None


def silences(p, noise="-40dB", d=0.25):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(p), "-af", f"silencedetect=noise={noise}:d={d}",
                        "-f", "null", "-"], capture_output=True, text=True)
    out, cur = [], None
    for line in r.stderr.splitlines():
        m = re.search(r"silence_start: ([\d.]+)", line)
        if m:
            cur = float(m.group(1))
        m = re.search(r"silence_end: ([\d.]+)", line)
        if m and cur is not None:
            out.append([cur, float(m.group(1))])
            cur = None
    if cur is not None:
        out.append([cur, None])  # 파일 끝까지 무음
    return out


def norm_ko(s):
    return re.sub(r"[^가-힣a-zA-Z0-9]", "", s)


class Report:
    def __init__(self):
        self.rows, self.failed = [], False

    def check(self, name, ok, detail, warn_only=False):
        mark = "✅" if ok else ("⚠️" if warn_only else "❌")
        if not ok and not warn_only:
            self.failed = True
        self.rows.append(f"| {mark} | {name} | {detail} |")
        print(f"{mark} {name}: {detail}")

    def info(self, name, detail):
        self.rows.append(f"| ℹ️ | {name} | {detail} |")
        print(f"ℹ️ {name}: {detail}")


def whisper_words(audio):
    from faster_whisper import WhisperModel
    model = WhisperModel("tiny", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(str(audio), language="ko", word_timestamps=True, beam_size=1, vad_filter=False,
                                condition_on_previous_text=False)  # tiny 모델 반복·건너뛰기 방지 (EP08)
    words, text = [], []
    for s in segs:
        text.append(s.text)
        for w in s.words or []:
            if w.word.strip():
                words.append((w.start, w.end, w.word.strip()))
    return words, "".join(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ep")
    ap.add_argument("--require-whisper", action="store_true")
    ap.add_argument("--video")
    a = ap.parse_args()

    d = ROOT / "public" / "ep" / a.ep
    tl = json.loads((d / "timeline.json").read_text(encoding="utf-8"))
    ep = json.loads((d / "episode.json").read_text(encoding="utf-8"))
    narr = d / "narration.mp3"
    R = Report()
    # docs/SHORTS_STANDARD.md: 단일 파일 모드면 자막 싱크 허용 오차 ±0.5초
    std = tl.get("mode") == "single"
    end_tol = STD_TOL if std else MAX_END_DIFF
    wend_tol = STD_TOL if std else MAX_WHISPER_END_DIFF
    sent_tol = STD_TOL if std else MAX_SENT_OFFSET
    if std:
        R.info("표준 규격", f"단일 TTS 파일 · 정렬 {tl.get('alignment')} · 싱크 허용 ±{STD_TOL}초")

    audio = ffprobe_dur(narr)
    frames = tl.get("durationInFrames")
    video_sec = frames / FPS if frames else 60.0
    chunks = tl["chunks"]
    last_end = chunks[-1].get("endFrame", round(chunks[-1]["end"] * FPS)) / FPS
    first_start = chunks[0]["start"]
    R.info("TTS 엔진", f"{tl.get('engine')} · 목소리 {tl.get('voice') or '-'} · 속도 보정 x{tl.get('tempo')}")
    R.info("길이", f"오디오 {audio:.2f}초 · 영상 {frames}프레임({video_sec:.2f}초) · 자막 {len(chunks)}개")

    # 자막 단일 활성화: 프레임 구간 [startFrame, endFrame) 이 서로 겹치지 않아야 함
    fr = [(c.get("startFrame", round(c["start"] * FPS)), c.get("endFrame", round(c["end"] * FPS))) for c in chunks]
    overlap = [i for i in range(len(fr) - 1) if fr[i][1] > fr[i + 1][0]]
    R.check("자막 중복 노출 없음", not overlap, f"겹침 {len(overlap)}곳" if overlap else f"{len(fr)}개 모두 단일 활성")
    exp = math.ceil(audio * FPS) + round(float(tl.get("tailSec", 1.5)) * FPS)
    R.check("영상 프레임 = ceil(오디오×30)+45", frames is None or abs(frames - exp) <= 1, f"{frames} / 기대 {exp}")

    if a.video:
        v = ffprobe_dur(a.video, "v:0") or ffprobe_dur(a.video)
        au = ffprobe_dur(a.video, "a:0") or v
        R.check("렌더 결과 영상 길이", abs(v - video_sec) <= 0.15, f"MP4 {v:.2f}초 / 예정 {video_sec:.2f}초")
        R.check("렌더 결과 오디오 트랙", abs(au - v) <= 0.3, f"오디오 트랙 {au:.2f}초 / 영상 {v:.2f}초")
        R.check("영상-나레이션 길이 차", 0 <= v - audio <= MAX_LEN_DIFF, f"{v - audio:+.2f}초 (기준 0~{MAX_LEN_DIFF}초)")
        finish(R, a.ep, "렌더 후")
        return

    # 1) 무음 검사 (ffmpeg silencedetect)
    sil = silences(narr)
    trail = 0.0
    if sil and (sil[-1][1] is None or sil[-1][1] >= audio - 0.05):
        trail = audio - sil[-1][0]
    lead = sil[0][1] if sil and sil[0][0] <= 0.02 and sil[0][1] else 0.0
    gaps = [(s, e) for s, e in sil if e is not None and s > 0.02 and e < audio - 0.05]
    max_gap = max([e - s for s, e in gaps], default=0.0)
    speech_end = audio - trail
    R.check("후반 공백 (오디오 끝 무음)", trail < MAX_TRAIL_SILENCE, f"{trail:.2f}초 (기준 {MAX_TRAIL_SILENCE}초 미만)")
    R.check("시작 공백", lead <= MAX_LEAD_SILENCE, f"{lead:.2f}초 (기준 {MAX_LEAD_SILENCE}초 이하)")
    R.check("문장 사이 최대 무음", max_gap < MAX_GAP_SILENCE, f"{max_gap:.2f}초 (기준 {MAX_GAP_SILENCE}초 미만)")

    # 2) 컴포지션 길이
    diff = video_sec - audio
    R.check("컴포지션 길이 vs 오디오", 0 <= diff <= MAX_LEN_DIFF, f"영상 {video_sec:.2f}초 - 오디오 {audio:.2f}초 = {diff:+.2f}초 (기준 0~{MAX_LEN_DIFF}초)")
    R.check("자막이 영상 안에서 끝남", last_end <= video_sec, f"마지막 자막 끝 {last_end:.2f}초 ≤ 영상 {video_sec:.2f}초")

    # 3) 자막 싱크: 마지막 자막 endFrame vs 실제 음성 끝
    R.check("마지막 자막 종료 vs 음성 종료", abs(last_end - speech_end) <= end_tol,
            f"자막 {last_end:.2f}초 / 음성 {speech_end:.2f}초 (차 {last_end - speech_end:+.2f}초, 기준 ±{end_tol}초)")
    if std:
        nar = (tl.get("audioSec") or audio)
        R.check("나레이션 길이 55~58초 (표준)", 55.0 - 0.05 <= nar <= 58.0 + 0.05, f"{nar:.2f}초",
                warn_only=tl.get("engine") != "elevenlabs")

    # 4) Whisper 단어 타임스탬프 대조
    words = None
    if tl.get("engine") == "mock":
        R.info("Whisper", "mock 음성(톤) — 건너뜀")
    else:
        try:
            words, text = whisper_words(narr)
        except Exception as e:
            R.check("Whisper 대조 실행", False, f"실패: {e}", warn_only=not a.require_whisper)
    if words:
        w_first, w_last = words[0][0], words[-1][1]
        R.check("첫 단어 vs 첫 자막", abs(w_first - first_start) <= end_tol,
                f"음성 {w_first:.2f}초 / 자막 {first_start:.2f}초")
        R.check("마지막 단어 vs 마지막 자막", abs(last_end - w_last) <= wend_tol,
                f"음성 {w_last:.2f}초 / 자막 {last_end:.2f}초 (차 {last_end - w_last:+.2f}초, 기준 ±{wend_tol}초)")
        mids = [(s + e) / 2 for s, e, _ in words]
        cov = sum(any(c["start"] - 0.1 <= m <= c["end"] + 0.1 for c in chunks) for m in mids) / len(mids)
        R.check("자막 노출 커버리지", cov >= MIN_COVERAGE, f"음성 단어 {len(words)}개 중 {cov * 100:.0f}%에 자막 표시 (기준 {MIN_COVERAGE * 100:.0f}%)")
        starts = [w[0] for w in words]
        offs = sorted(min(abs(s["start"] - x) for x in starts) for s in tl["sentences"])
        med = offs[len(offs) // 2]
        R.check("문장 시작 싱크 (중앙값)", med <= sent_tol, f"{med:.2f}초 (최대 {offs[-1]:.2f}초, 기준 {sent_tol}초)")
        if std:
            co = sorted(min(abs(c["start"] - x) for x in starts) for c in chunks)
            cmed = co[len(co) // 2]
            R.check("자막 시작 싱크 (중앙값, 표준 ±0.5초)", cmed <= STD_TOL, f"{cmed:.2f}초 (최대 {co[-1]:.2f}초)")
        say = "".join(l.get("say") or l["t"] for l in ep["script"])
        sim = difflib.SequenceMatcher(None, norm_ko(say), norm_ko(text)).ratio()
        R.check("받아쓰기 유사도 (tiny 모델 참고값)", sim >= 0.5, f"{sim * 100:.0f}%", warn_only=True)
    finish(R, a.ep, "렌더 전")


def finish(R, ep, stage):
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    md = [f"### 🔎 오디오·자막 싱크 검증 ({stage}) — {'❌ 실패' if R.failed else '✅ 통과'}", "", "| | 항목 | 결과 |", "|---|---|---|", *R.rows, ""]
    (out / f"validate_{ep}{'_post' if stage == '렌더 후' else ''}.md").write_text("\n".join(md), encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write("\n".join(md) + "\n")
    if R.failed:
        print("❌ 검증 실패 — 렌더를 중단합니다")
        sys.exit(1)
    print("✅ 검증 통과")


if __name__ == "__main__":
    main()
