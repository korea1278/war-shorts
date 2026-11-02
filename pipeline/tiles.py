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
# 야간 불빛(NASA Black Marble) 모자이크: 이름 → (줌, bbox)  (EP05~)
NIGHTS = {}
# 에피소드 전용 상세 모자이크: episode.json의 map.mosaicDefs {"이름": [줌, [서,남,동,북]]}
#                     야간 모자이크: map.nightDefs  {"이름": [줌(최대 8), [서,남,동,북]]}
for _ep in sorted((ROOT / "episodes").glob("*/episode.json")):
    _m = json.loads(_ep.read_text(encoding="utf-8")).get("map", {})
    for _name, (_z, _bbox) in _m.get("mosaicDefs", {}).items():
        MOSAICS[_name] = (_z, tuple(_bbox))
    for _name, (_z, _bbox) in _m.get("nightDefs", {}).items():
        NIGHTS[_name] = (min(8, _z), tuple(_bbox))

SAT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
# NASA GIBS (무료·키 불필요) — 앞에서부터 시도, 실패하면 다음 레이어
NIGHT_URLS = [
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/2012-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
]


def tx(lon, z):
    return int((lon + 180) / 360 * 2 ** z)


def ty(lat, z):
    r = math.radians(lat)
    return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z)


def tile_ranges(z, bbox):
    w, s, e, n = bbox
    return range(tx(w, z), tx(e, z) + 1), range(ty(n, z), ty(s, z) + 1)


def tile_path(z, x, y, kind="sat"):
    return OUT / kind / str(z) / str(x) / f"{y}.{'png' if kind == 'night' else 'jpg'}"


def download(fake):
    import requests
    s = requests.Session()
    s.headers["User-Agent"] = "war-shorts-renderer/1.0 (+https://github.com/korea1278/war-shorts)"
    todo = []
    for kind, defs in (("sat", MOSAICS), ("night", NIGHTS)):
        for z, bbox in defs.values():
            xs, ys = tile_ranges(z, bbox)
            todo += [(z, x, y, kind) for x in xs for y in ys if not tile_path(z, x, y, kind).exists()]
    print(f"받을 타일 {len(todo)}개")
    fails = [0]

    def get(j):
        z, x, y, kind = j
        p = tile_path(z, x, y, kind)
        p.parent.mkdir(parents=True, exist_ok=True)
        if fake:
            return (fake_night if kind == "night" else fake_tile)(z, x, y, p)
        urls = NIGHT_URLS if kind == "night" else [SAT_URL]
        for url in urls:
            for _ in range(3):
                try:
                    r = s.get(url.format(z=z, x=x, y=y), timeout=30)
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
    # 야간 불빛: 색 보정 없이 원본 그대로 (칠흑의 북한 vs 불야성 남한), 빈 타일은 검정
    for name, (z, bbox) in NIGHTS.items():
        xs, ys = tile_ranges(z, bbox)
        img = Image.new("RGB", (len(xs) * 256, len(ys) * 256), (0, 0, 0))
        got = 0
        for i, x in enumerate(xs):
            for j, y in enumerate(ys):
                p = tile_path(z, x, y, "night")
                if p.exists():
                    try:
                        img.paste(Image.open(p).convert("RGB").resize((256, 256)), (i * 256, j * 256))
                        got += 1
                    except Exception:
                        pass
        if not got:
            print(f"⚠ 야간 타일 없음 → {name} 생략 (렌더는 벡터 불빛으로 대체)")
            continue
        img = ImageEnhance.Brightness(img).enhance(1.15)
        f = f"mosaic_{name}.jpg"
        img.save(OUT / f, quality=88, optimize=True)
        meta[name] = {"file": f"tiles/{f}", "z": z, "x0": xs.start * 256, "y0": ys.start * 256, "w": img.width, "h": img.height, "night": True}
        print(f"{f}: {img.width}x{img.height} (야간)")
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


def fake_night(z, x, y, p):
    """로컬 점검용 가짜 야간 타일: 남쪽(위도 38 이하)일수록 불빛이 많음"""
    from PIL import Image, ImageDraw
    import random
    random.seed(z * 7777 + x * 131 + y)
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 0.5) / 2 ** z))))
    img = Image.new("RGB", (256, 256), (2, 3, 8))
    d = ImageDraw.Draw(img)
    for _ in range(140 if lat < 38 else 4):
        x0, y0 = random.randint(0, 255), random.randint(0, 255)
        r = random.randint(1, 4)
        d.ellipse((x0, y0, x0 + r, y0 + r), fill=(255, 210, 120))
    img.save(p)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    download(fake="--fake" in sys.argv)
    build()
