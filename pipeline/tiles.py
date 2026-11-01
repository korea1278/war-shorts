"""위성 영상(Esri World Imagery) 타일을 받아 '모자이크 이미지 2장'으로 미리 합친다.

렌더 중에는 WebGL·인터넷 타일을 전혀 쓰지 않고, 이 두 장을 Canvas 2D로 원근 변환해서 그린다.
  public/tiles/mosaic_back.jpg   : z8 넓은 배경 (먼 지평선용, 저해상도)
  public/tiles/mosaic_detail.jpg : z11 수도권~휴전선 상세
  public/tiles/mosaic.json       : 각 이미지의 줌·원점(월드 픽셀)
색 보정(채도↓·대비↑·밝기↓)도 여기서 한 번만 적용 → 렌더 중 필터 비용 0

python pipeline/tiles.py            (이미 받은 타일은 건너뜀)
python pipeline/tiles.py --fake     (로컬 점검용 가짜 타일)
"""
import json
import math
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "tiles"

# 이름: (줌, bbox[서,남,동,북])
MOSAICS = {
    "back": (8, (123.5, 35.0, 131.0, 41.8)),
    "detail": (11, (125.9, 37.0, 128.2, 39.05)),
}
# 에피소드 전용 상세 모자이크: episode.json의 map.mosaicDefs {"이름": [줌, [서,남,동,북]]}
for _ep in sorted((ROOT / "episodes").glob("*/episode.json")):
    for _name, (_z, _bbox) in json.loads(_ep.read_text(encoding="utf-8")).get("map", {}).get("mosaicDefs", {}).items():
        MOSAICS[_name] = (_z, tuple(_bbox))

SAT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"


def tx(lon, z):
    return int((lon + 180) / 360 * 2 ** z)


def ty(lat, z):
    r = math.radians(lat)
    return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z)


def tile_ranges(z, bbox):
    w, s, e, n = bbox
    return range(tx(w, z), tx(e, z) + 1), range(ty(n, z), ty(s, z) + 1)


def tile_path(z, x, y):
    return OUT / "sat" / str(z) / str(x) / f"{y}.jpg"


def download(fake):
    import requests
    s = requests.Session()
    s.headers["User-Agent"] = "war-shorts-renderer/1.0 (+https://github.com/korea1278/war-shorts)"
    todo = []
    for z, bbox in MOSAICS.values():
        xs, ys = tile_ranges(z, bbox)
        todo += [(z, x, y) for x in xs for y in ys if not tile_path(z, x, y).exists()]
    print(f"받을 타일 {len(todo)}개")
    fails = [0]

    def get(j):
        z, x, y = j
        p = tile_path(z, x, y)
        p.parent.mkdir(parents=True, exist_ok=True)
        if fake:
            return fake_tile(z, x, y, p)
        for _ in range(3):
            try:
                r = s.get(SAT_URL.format(z=z, x=x, y=y), timeout=30)
                if r.status_code == 200 and len(r.content) > 100:
                    p.write_bytes(r.content)
                    return
            except Exception:
                pass
        fails[0] += 1

    with ThreadPoolExecutor(8) as ex:
        list(ex.map(get, todo))
    print(f"다운로드 완료 (실패 {fails[0]}개)")


def build():
    from PIL import Image, ImageEnhance
    meta = {}
    for name, (z, bbox) in MOSAICS.items():
        xs, ys = tile_ranges(z, bbox)
        img = Image.new("RGB", (len(xs) * 256, len(ys) * 256), (11, 16, 22))
        for i, x in enumerate(xs):
            for j, y in enumerate(ys):
                p = tile_path(z, x, y)
                if p.exists():
                    try:
                        img.paste(Image.open(p).convert("RGB").resize((256, 256)), (i * 256, j * 256))
                    except Exception:
                        pass
        img = ImageEnhance.Color(img).enhance(0.62)
        img = ImageEnhance.Contrast(img).enhance(1.18)
        img = ImageEnhance.Brightness(img).enhance(0.78)
        f = f"mosaic_{name}.jpg"
        img.save(OUT / f, quality=86, optimize=True)
        meta[name] = {"file": f"tiles/{f}", "z": z, "x0": xs.start * 256, "y0": ys.start * 256, "w": img.width, "h": img.height}
        print(f"{f}: {img.width}x{img.height}")
    (OUT / "mosaic.json").write_text(json.dumps(meta, indent=1))


def fake_tile(z, x, y, p):
    from PIL import Image, ImageDraw
    import random
    random.seed(z * 100000 + x * 1000 + y)
    img = Image.new("RGB", (256, 256), (50 + random.randint(0, 40), 70 + random.randint(0, 40), 45))
    d = ImageDraw.Draw(img)
    for _ in range(12):
        x0, y0 = random.randint(0, 255), random.randint(0, 255)
        d.ellipse((x0, y0, x0 + 30, y0 + 20), fill=(90, 100, 70))
    img.save(p, quality=70)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    download(fake="--fake" in sys.argv)
    build()
