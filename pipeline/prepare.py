"""나레이션(TTS) + 자막 타임라인 생성.

python pipeline/prepare.py ep01-artillery [--mock]

TTS 엔진 우선순위
  1) ELEVENLABS_API_KEY 가 있으면 일레븐랩스 (목소리: episode.json voice → ELEVENLABS_VOICE_ID)
  2) 없으면 edge-tts 무료 한국어 남성 목소리 (ko-KR-InJoonNeural)
  3) --mock : 무음 (로컬 점검용)

결과 → public/ep/<ep>/
  narration.mp3, timeline.json, episode.json(사본), <ep>.srt
"""
import asyncio
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEAD = 0.15          # 0초부터 바로 나레이션 (첫 소리 0.15초)
GAP = 0.22           # 문장 사이 쉼
GAP_Q = 0.38         # 물음표 뒤 쉼
CHUNK_MAX = 15       # 자막 한 화면 최대 글자 수(공백 제외 기준 근사)


def sh(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def duration(p):
    return float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)).strip())


def tts_elevenlabs(text, out_mp3, voice, prev_t, next_t):
    import requests
    key = os.environ["ELEVENLABS_API_KEY"]
    model = os.environ.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
    body = {
        "text": text, "model_id": model,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.2,
                           "use_speaker_boost": True, "speed": float(os.environ.get("TTS_SPEED") or 1.05)},
    }
    if prev_t:
        body["previous_text"] = prev_t
    if next_t:
        body["next_text"] = next_t
    for attempt in range(4):
        r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
                          params={"output_format": "mp3_44100_128"},
                          headers={"xi-api-key": key, "Content-Type": "application/json"},
                          json=body, timeout=180)
        if r.status_code < 400:
            out_mp3.write_bytes(r.content)
            return
        print(f"  일레븐랩스 오류 {r.status_code}: {r.text[:200]}")
        if r.status_code in (401, 402, 403):
            raise RuntimeError("일레븐랩스 인증/크레딧 오류")
    raise RuntimeError("일레븐랩스 실패")


def tts_edge(text, out_mp3):
    import edge_tts
    voice = os.environ.get("EDGE_VOICE") or "ko-KR-InJoonNeural"

    async def run():
        await edge_tts.Communicate(text, voice, rate="+8%").save(str(out_mp3))
    asyncio.run(run())


def tts_mock(text, out_mp3):
    sec = max(1.0, len(text.replace(" ", "")) / 4.3)
    sh("ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono:d={sec:.2f}",
       "-b:a", "96k", str(out_mp3))


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


def main(ep, mock=False):
    src = ROOT / "episodes" / ep / "episode.json"
    data = json.loads(src.read_text(encoding="utf-8"))
    out = ROOT / "public" / "ep" / ep
    tdir = out / "tts"
    tdir.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, out / "episode.json")

    has_el = bool(os.environ.get("ELEVENLABS_API_KEY")) and not mock
    voice = data.get("voice") or os.environ.get("ELEVENLABS_VOICE_ID") or "ZJCNdZEjYwkOElxugmW2"
    engine = "mock" if mock else ("elevenlabs" if has_el else "edge")
    print(f"TTS 엔진: {engine}")

    lines = data["script"]
    says = [l.get("say") or l["t"] for l in lines]
    parts = []
    for i, line in enumerate(lines):
        say = says[i]
        sig = hashlib.sha1(json.dumps([engine, voice, say], ensure_ascii=False).encode()).hexdigest()[:10]
        mp3 = tdir / f"s{i:02d}_{sig}.mp3"
        if not mp3.exists():
            print(f"  [{i}] {say}")
            if engine == "elevenlabs":
                try:
                    tts_elevenlabs(say, mp3, voice, says[i - 1] if i else None, says[i + 1] if i + 1 < len(says) else None)
                except Exception as e:  # 크레딧·키 문제면 무료 목소리로 계속
                    print(f"  ⚠ {e} → edge-tts로 대체")
                    engine = "edge"
                    tts_edge(say, mp3)
            elif engine == "edge":
                tts_edge(say, mp3)
            else:
                tts_mock(say, mp3)
        parts.append(mp3)

    # 문장별 길이 + 쉼 → 전체 이어 붙이기
    durs = [duration(p) for p in parts]
    gaps = [GAP_Q if l["t"].rstrip().endswith("?") else GAP for l in lines]
    total = LEAD + sum(durs) + sum(gaps[:-1])
    tempo = 1.0
    limit = float(data.get("maxNarrationSec", 57.5))
    if total > limit:
        tempo = min(1.25, total / limit)
        print(f"  길이 {total:.1f}초 > {limit}초 → 속도 x{tempo:.3f}")

    wavs = []
    sil = tdir / "_gap.wav"
    for i, p in enumerate(parts):
        w = tdir / f"_{i:02d}.wav"
        sh("ffmpeg", "-v", "error", "-y", "-i", str(p), "-ar", "44100", "-ac", "1", str(w))
        wavs.append(w)
    lst = tdir / "_list.txt"
    with lst.open("w") as f:
        lead = tdir / "_lead.wav"
        sh("ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono:d={LEAD}", str(lead))
        f.write(f"file '{lead.name}'\n")
        for i, w in enumerate(wavs):
            f.write(f"file '{w.name}'\n")
            if i < len(wavs) - 1:
                g = tdir / f"_g{i:02d}.wav"
                sh("ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono:d={gaps[i]}", str(g))
                f.write(f"file '{g.name}'\n")
    af = f"atempo={tempo:.4f}" if tempo != 1.0 else "anull"
    sh("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-af", af,
       "-ar", "44100", "-b:a", "192k", str(out / "narration.mp3"))

    # 타임라인
    t = LEAD
    sentences, chunks = [], []
    phase2 = None
    for i, line in enumerate(lines):
        d = durs[i] / tempo
        st, en = t, t + d
        if line.get("phase2") and phase2 is None:
            phase2 = st
        sentences.append({"i": i, "start": round(st, 3), "end": round(en, 3), "text": line["t"]})
        cs = split_chunks(line["t"])
        ws = [weight(c) for c in cs]
        acc = st
        for c, wv in zip(cs, ws):
            cd = d * wv / sum(ws)
            chunks.append({"start": round(acc, 3), "end": round(acc + cd, 3), "text": c, "sentence": i})
            acc += cd
        t = en + (gaps[i] / tempo if i < len(lines) - 1 else 0)
    # 문장 사이 쉼에도 직전 자막을 유지
    for a, b in zip(chunks, chunks[1:]):
        a["end"] = b["start"]
    chunks[-1]["end"] = round(chunks[-1]["end"] + 0.8, 3)

    tl = {"engine": engine, "tempo": round(tempo, 4), "duration": round(t, 3),
          "phase2At": round(phase2 if phase2 is not None else 26.0, 3),
          "sentences": sentences, "chunks": chunks}
    (out / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")

    def ts(x):
        h, m, s = int(x // 3600), int(x % 3600 // 60), x % 60
        return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")
    srt = "\n".join(f"{n}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n" for n, c in enumerate(chunks, 1))
    (out / f"{ep}.srt").write_text(srt, encoding="utf-8")

    for f in tdir.glob("_*"):
        f.unlink()
    print(f"완료: 나레이션 {t:.1f}초 · 전환 {tl['phase2At']}초 · 자막 {len(chunks)}개 · 엔진 {engine}")


if __name__ == "__main__":
    main(sys.argv[1], mock="--mock" in sys.argv)
