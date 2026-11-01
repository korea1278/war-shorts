"""위성 영상(Esri World Imagery) 타일을 미리 받아 public/tiles 에 저장.

렌더 중에는 인터넷 타일을 쓰지 않고 이 로컬 타일만 쓴다 → 프레임마다 결과가 같고, 타일 서버 지연으로 멈추지 않음.
python pipeline/tiles.py            (이미 받은 타일은 건너뜀)
python pipeline/tiles.py --fake     (로컬 점검용 가짜 타일)
"""
import math
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "tiles"

# (zoom 범위, bbox[서,남,동,북])
SAT_PLAN = [((5, 9), (123.5, 35.0, 131.0, 41.5)),
            ((10, 11), (124.8, 36.2, 129.2, 40.6)),
            ((12, 12), (126.2, 37.25, 127.75, 38.6))]
DEM_PLAN = [((5, 8), (123.5, 35.0, 131.0, 41.5)),
            ((9, 10), (124.8, 36.2, 129.2, 40.6))]

SAT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
DEM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"


def tile_range(z, bbox):
    w, s, e, n = bbox
    def tx(lon):
        return int((lon + 180) / 360 * 2 ** z)
    def ty(lat):
        r = math.radians(lat)
        return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z)
    for x in range(tx(w), tx(e) + 1):
        for y in range(ty(n), ty(s) + 1):
            yield x, y


def jobs(plan, kind, ext):
    for (z0, z1), bbox in plan:
        for z in range(z0, z1 + 1):
            for x, y in tile_range(z, bbox):
                yield kind, z, x, y, OUT / kind / str(z) / str(x) / f"{y}.{ext}"


def main(fake=False):
    import requests
    s = requests.Session()
    s.headers["User-Agent"] = "war-shorts-renderer/1.0 (+https://github.com/korea1278/war-shorts)"
    todo = [j for j in list(jobs(SAT_PLAN, "sat", "jpg")) if not j[4].exists()]
    print(f"받을 타일 {len(todo)}개")
    fails = [0]

    def get(j):
        kind, z, x, y, p = j
        p.parent.mkdir(parents=True, exist_ok=True)
        if fake:
            return fake_tile(kind, z, x, y, p)
        url = (SAT_URL if kind == "sat" else DEM_URL).format(z=z, x=x, y=y)
        for _ in range(3):
            try:
                r = s.get(url, timeout=30)
                if r.status_code == 200 and len(r.content) > 100:
                    p.write_bytes(r.content)
                    return
            except Exception:
                pass
        fails[0] += 1

    with ThreadPoolExecutor(8) as ex:
        list(ex.map(get, todo))
    print(f"완료 (실패 {fails[0]}개)")


def fake_tile(kind, z, x, y, p):
    from PIL import Image
    import random
    random.seed(z * 100000 + x * 1000 + y)
    if kind == "sat":
        img = Image.new("RGB", (256, 256), (40 + random.randint(0, 30), 60 + random.randint(0, 30), 40))
        img.save(p, quality=70)
    else:
        img = Image.new("RGB", (256, 256), (128, random.randint(0, 40), 0))
        img.save(p)


if __name__ == "__main__":
    main(fake="--fake" in sys.argv)
