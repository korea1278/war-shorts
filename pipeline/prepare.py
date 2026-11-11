"""나레이션(TTS) + 자막 타임라인 생성.

python pipeline/prepare.py ep01-artillery [--mock]

TTS 엔진 우선순위
  1) ELEVENLABS_API_KEY 가 있으면 일레븐랩스 (목소리: episode.json voice → ELEVENLABS_VOICE_ID)
  2) 없으면 edge-tts 무료 한국어 남성 목소리 (ko-KR-InJoonNeural)
  3) --mock : 무음 (로컬 점검용)

표준(docs/SHORTS_STANDARD.md): 전체 대본을 TTS 1회 호출로 단일 파일 생성, 글자 타임스탬프로 자막 동기화.
쉼은 대본의 마침표로만 조절 (쉼표 금지·문장 사이 무음 삽입 없음).

결과 → public/ep/<ep>/
  narration.mp3, timeline.json, episode.json(사본), <ep>.srt
"""
import asyncio
import base64
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHUNK_MAX = 15       # 자막 한 화면 최대 글자 수(공백 제외 기준 근사)


def sh(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def duration(p):
    return float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)).strip())


VOICE_SETTINGS = {
    "stability": 0.38,          # 긴장감·전달력
    "similarity_boost": 0.82,   # 빠른 딕션에서도 명확하게
    "style": 0.12,
    "use_speaker_boost": True,
    "speed": 1.15,              # 1.15배 템포
}


def tts_elevenlabs(text, out_mp3, voice):
    """전체 대본을 한 번의 호출로 받는다 (/with-timestamps → 글자별 시작·끝 시각).
    반환: (chars, starts, ends) — 입력 text 글자와 1:1"""
    import requests
    key = os.environ["ELEVENLABS_API_KEY"]
    model = os.environ.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
    body = {"text": text, "model_id": model, "voice_settings": VOICE_SETTINGS}
    for attempt in range(4):
        r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps",
                          params={"output_format": "mp3_44100_128"},
                          headers={"xi-api-key": key, "Content-Type": "application/json"},
                          json=body, timeout=300)
        if r.status_code < 400:
            j = r.json()
            out_mp3.write_bytes(base64.b64decode(j["audio_base64"]))
            a = j.get("alignment") or j["normalized_alignment"]
            return a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]
        print(f"  일레븐랩스 오류 {r.status_code}: {r.text[:200]}")
        if r.status_code in (401, 402, 403):
            raise RuntimeError(f"일레븐랩스 인증/크레딧 오류 {r.status_code}")
    raise RuntimeError("일레븐랩스 실패")


def synth_alignment(text, total):
    """엔진이 글자 시각을 안 주는 경우(edge·mock): 글자 수 비례 + 마침표 뒤 쉼으로 근사"""
    w = [0.0 if c == " " else (3.0 if c in ".?!" else 1.0) for c in text]
    k = total / max(1e-6, sum(w))
    st, en, t = [], [], 0.0
    for x in w:
        st.append(t)
        t += x * k
        en.append(t)
    return list(text), st, en


def tts_edge(text, out_mp3):
    import edge_tts
    voice = os.environ.get("EDGE_VOICE") or "ko-KR-InJoonNeural"

    async def run():
        await edge_tts.Communicate(text, voice, rate="+8%").save(str(out_mp3))
    asyncio.run(run())


def tts_mock(text, out_mp3):
    sec = max(1.0, len(text.replace(" ", "")) / float(os.environ.get("MOCK_CPS") or 6.6))
    sh("ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"sine=frequency=220:sample_rate=44100:duration={sec:.2f}",
       "-af", "volume=0.3", "-b:a", "96k", str(out_mp3))


def split_chunks(text):
    """자막을 단어 단위로 자른다: 쉼표에서 먼저 끊고, 각 구절을 15자 안팎으로 고르게 나눔."""
    n_chars = lambda ws: len("".join(ws))
    clauses, cur = [], []
    for w in text.split(" "):
        cur.append(w)
        if w.endswith(",") and n_chars(cur) >= 6:
            clauses.append(cur)
            cur = []
    if cur:
        clauses.append(cur)
    chunks = []
    for ws in clauses:
        total = n_chars(ws)
        n = max(1, -(-total // CHUNK_MAX))
        target = total / n
        part, acc = [], 0
        for i, w in enumerate(ws):
            part.append(w)
            acc += len(w)
            left = len(ws) - i - 1
            if acc >= target - 2 and left and n > 1:
                chunks.append(" ".join(part))
                part, acc = [], 0
                n -= 1
                total_left = n_chars(ws[i + 1:])
                target = total_left / max(1, n)
        if part:
            chunks.append(" ".join(part))
    return chunks


def weight(chunk):
    # 읽는 시간 근사: 숫자는 자리수만큼 더 길게 읽힘
    s = chunk.replace(" ", "")
    digits = len(re.findall(r"\d", s))
    return len(s) - digits + digits * 1.3 + 0.6


def check_script(lines, says):
    """표준 1: 낭독(say)은 쉼표 없이 100% 한글 + 마침표/물음표/느낌표만, 표시(t)도 숫자 자릿점 외 쉼표 금지"""
    bad = []
    for i, (l, sy) in enumerate(zip(lines, says), 1):
        if "," in sy:
            bad.append(f"{i}번 say에 쉼표")
        odd = re.sub(r"[가-힣\s.?!]", "", sy)
        if odd:
            bad.append(f"{i}번 say에 한글 아닌 글자 {sorted(set(odd))}")
        if re.search(r"(?<!\d),|,(?!\d)", l["t"]):
            bad.append(f"{i}번 t에 쉼표(숫자 자릿점 제외)")
    if bad:
        sys.exit("❌ 대본 표준 위반 (docs/SHORTS_STANDARD.md 1항):\n  " + "\n  ".join(bad))


def main(ep, mock=False):
    src = ROOT / "episodes" / ep / "episode.json"
    data = json.loads(src.read_text(encoding="utf-8"))
    out = ROOT / "public" / "ep" / ep
    tdir = out / "tts"
    tdir.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, out / "episode.json")

    has_el = bool(os.environ.get("ELEVENLABS_API_KEY")) and not mock
    voice = data.get("voice") or os.environ.get("ELEVENLABS_VOICE_ID") or "U1cJYS4EdbaHmfR7YzHd"
    engine = "mock" if mock else ("elevenlabs" if has_el else "edge")
    # TTS_STRICT=1 이면 일레븐랩스가 아니면 중단 (다른 목소리로 몰래 바뀌는 것 방지)
    strict = os.environ.get("TTS_STRICT") == "1" and not mock
    if strict and engine != "elevenlabs":
        sys.exit("❌ ELEVENLABS_API_KEY가 없습니다 — 저장소 Settings > Secrets > Actions에 등록하세요 (TTS_STRICT)")
    print(f"TTS 엔진: {engine} · 목소리 {voice} · {VOICE_SETTINGS}")

    lines = data["script"]
    says = [(l.get("say") or l["t"]).strip() for l in lines]
    check_script(lines, says)

    # ── 표준 1: 오디오 단일 생성 — 전체 대본을 한 번의 호출로 한 파일 (문장별 생성·이어 붙이기 금지) ──
    full = " ".join(says)
    offs, pos = [], 0
    for sy in says:
        offs.append((pos, pos + len(sy)))
        pos += len(sy) + 1
    sig = hashlib.sha1(json.dumps([engine, voice, full, VOICE_SETTINGS], ensure_ascii=False).encode()).hexdigest()[:10]
    raw = tdir / f"full_{sig}.mp3"
    alj = tdir / f"full_{sig}.json"
    calls = 0
    if not (raw.exists() and alj.exists()):
        print(f"  단일 호출 TTS ({len(full)}자): {full}")
        if engine == "elevenlabs":
            try:
                al = tts_elevenlabs(full, raw, voice)
                calls = 1
            except Exception as e:  # 크레딧·키 문제
                if strict:
                    sys.exit(f"❌ 일레븐랩스 실패: {e}")
                print(f"  ⚠ {e} → edge-tts로 대체")
                engine = "edge"
        if engine == "edge":
            tts_edge(full, raw)
        elif engine == "mock":
            tts_mock(full, raw)
        if engine != "elevenlabs":
            al = synth_alignment(full, duration(raw))
        alj.write_text(json.dumps({"chars": al[0], "start": al[1], "end": al[2]}, ensure_ascii=False), encoding="utf-8")
    else:
        print(f"  캐시된 단일 나레이션 사용: {raw.name}")
    A = json.loads(alj.read_text(encoding="utf-8"))
    chars, cst, cen = A["chars"], A["start"], A["end"]
    if "".join(chars) != full:
        # 일레븐랩스가 글자를 바꿔 돌려준 경우 → 길이 비례로 원문 위치에 다시 대응
        print("  ⚠ 정렬 글자가 원문과 달라 비례 대응으로 보정")
        n = len(chars)
        idx = [min(n - 1, round(i * (n - 1) / max(1, len(full) - 1))) for i in range(len(full))]
        cst, cen = [cst[i] for i in idx], [cen[i] for i in idx]

    raw_sec = duration(raw)
    # ── 길이 맞춤 (55~58초): 단일 파일 전체에 atempo만 적용 ──
    lo = float(data.get("minNarrationSec", 55.0))
    limit = float(data.get("maxNarrationSec", 57.5))
    tempo = 1.0
    if raw_sec > limit:
        tempo = min(1.12, raw_sec / limit)
    elif raw_sec < lo:
        tempo = max(0.94, raw_sec / lo)
    if tempo != 1.0:
        print(f"  길이 {raw_sec:.2f}초 → 목표 {lo}~{limit}초, 속도 x{tempo:.3f}")
    af = f"atempo={tempo:.4f}" if tempo != 1.0 else "anull"
    sh("ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", af, "-ar", "44100", "-b:a", "192k", str(out / "narration.mp3"))

    def at(i, end=False):
        return (cen[i] if end else cst[i]) / tempo

    def first_char(a, b):  # 공백 아닌 첫/마지막 글자 위치
        i = a
        while i < b - 1 and full[i] == " ":
            i += 1
        return i

    # ── 타임라인: 글자 타임스탬프 → 문장·자막 시작/끝 (오디오 파형 기준 동기화) ──
    sentences, chunks = [], []
    phase2 = None
    squash = lambda x: re.sub(r"\s", "", x)
    for i, line in enumerate(lines):
        a, b = offs[i]
        st, en = at(first_char(a, b)), at(b - 1, True)
        if line.get("phase2") and phase2 is None:
            phase2 = st
        sentences.append({"i": i, "start": round(st, 3), "end": round(en, 3), "text": line["t"]})
        cs = line.get("subs") or split_chunks(line["t"])
        if line.get("subs") and squash("".join(cs)) != squash(line["t"]):
            sys.exit(f"[오류] {i + 1}번 문장 subs를 이어 붙인 글자가 t와 다릅니다: {cs}")
        tw, sw = line["t"].split(), says[i].split()
        # say 단어 위치 (전체 문자열 기준)
        wpos, p0 = [], a
        for w in sw:
            k = full.index(w, p0)
            wpos.append((k, k + len(w)))
            p0 = k + len(w)
        if len(tw) == len(sw):
            # 표시 단어 = 낭독 단어 1:1 → 자막 경계를 실제 단어 발화 시각에 정확히 맞춤
            wi = 0
            for c in cs:
                n = len(c.split())
                ks, ke = wpos[wi][0], wpos[wi + n - 1][1] - 1
                chunks.append({"start": round(at(ks), 3), "end": round(at(ke, True), 3), "text": c, "sentence": i})
                wi += n
        else:
            print(f"  ⚠ {i + 1}번 문장: 표시 단어 {len(tw)}개 ≠ 낭독 단어 {len(sw)}개 → 문장 안에서 비례 배분")
            ws = [weight(c) for c in cs]
            acc = st
            for c, wv in zip(cs, ws):
                cd = (en - st) * wv / sum(ws)
                chunks.append({"start": round(acc, 3), "end": round(acc + cd, 3), "text": c, "sentence": i})
                acc += cd
    # 다음 자막이 시작할 때까지 직전 자막 유지 (쉼에서 빈 화면 없음)
    for x, y in zip(chunks, chunks[1:]):
        x["end"] = y["start"]
    chunks[-1]["end"] = round(chunks[-1]["end"] + 0.25, 3)
    for c in chunks:
        c["startFrame"] = round(c["start"] * 30)
        c["endFrame"] = round(c["end"] * 30)
    t = sentences[-1]["end"]

    audio_sec = duration(out / "narration.mp3")
    tail = float(data.get("tailSec", 1.5))
    frames = math.ceil(audio_sec * 30) + round(tail * 30)   # Math.ceil(audioDuration*30) + 45 (여운 1.5초 뒤 칼종료)
    tl = {"engine": engine, "voice": voice if engine == "elevenlabs" else None, "tempo": round(tempo, 4),
          "mode": "single", "ttsCalls": calls, "alignment": "elevenlabs-timestamps" if engine == "elevenlabs" else "estimated",
          "duration": round(t, 3), "audioSec": round(audio_sec, 3), "tailSec": tail,
          "durationInFrames": frames, "videoSec": round(frames / 30, 3),
          "phase2At": round(phase2 if phase2 is not None else 26.0, 3),
          "sentences": sentences, "chunks": chunks}
    (out / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")

    def ts(x):
        h, m, s = int(x // 3600), int(x % 3600 // 60), x % 60
        return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")
    srt = "\n".join(f"{n}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n" for n, c in enumerate(chunks, 1))
    (out / f"{ep}.srt").write_text(srt, encoding="utf-8")

    print(f"영상 길이: {frames}프레임 = {frames / 30:.2f}초 (오디오 {audio_sec:.2f}초 + 여운 {tail}초)")
    print(f"완료: 나레이션 {t:.1f}초 · 전환 {tl['phase2At']}초 · 자막 {len(chunks)}개 · 엔진 {engine}")


if __name__ == "__main__":
    main(sys.argv[1], mock="--mock" in sys.argv)
