#!/usr/bin/env python3
"""구독 채널들의 영상 목록을 새로 받아 data/videos.json을 다시 만든다 (yt-dlp 필요).
채널 추가는 CHANNELS에 한 줄. 쓰기: python3 tools/update_videos.py   → 편수 변화를 출력한다. 그 뒤 커밋·push하면 사이트에 반영된다.
「내가 모은 영상」 탭은 data/picks.json(묶음별 영상 열쇠)에서 만든다 — 영상 하나를 더하려면 거기에 열쇠 11자리만 넣고 다시 돌린다."""
import datetime, json, pathlib, re, subprocess, sys

CHANNELS = [
    {"key": "estell", "name": "에스텔잉글리쉬", "url": "https://www.youtube.com/channel/UC0Wy2BjhsQP3gk2iuksCudw",
     "order": ["리스닝", "스피킹", "문장감각", "소리감각", "1분", "여행", "Frozen", "소설", "100%", "노하우", "수업소개"]},
    {"key": "jenny", "name": "제니리 영어", "url": "https://www.youtube.com/channel/UCadhrKFHh_9K62ETq18EAAQ",
     "order": ["영어패턴", "구동사", "숙어", "영문법", "원어민", "공부법"]},
    {"key": "chips", "name": "칩스영어", "url": "https://www.youtube.com/channel/UCQSOd6CLxUvKnRoCwk3zkFA",
     "order": ["영화", "셀럽"],
     # 제목마다 붙는 「| 🎬 영화·미드 500장면 모음.zip」 꼬리와 재생목록 이름의 꾸밈을 뗀다
     "title_strip": r"\s*\|\s*🎬.*$", "list_strip": r"\.zip$|\s*\|.*$"},
]
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "videos.json"
PICKS = OUT.parent / "picks.json"
HIDDEN = ("[Private video]", "[Deleted video]")


def fetch(url):
    r = subprocess.run(["yt-dlp", "--flat-playlist", "-J", "--extractor-args", "youtube:lang=ko", url], capture_output=True, text=True,
                       stdin=subprocess.DEVNULL, timeout=600)
    if r.returncode != 0:
        return []
    return [e for e in json.loads(r.stdout).get("entries", []) if e]


def item(e, dur=True):
    d = {"id": e["id"], "t": e["title"]}
    if dur:
        d["d"] = int(e.get("duration") or 0)
    return d


def channel(c, old):
    ch = c["url"]
    videos = [item(e) for e in reversed(fetch(ch + "/videos"))]
    was = len(old.get("videos", []))
    if not videos or len(videos) < was * 0.8:
        sys.exit("%s: 영상 목록을 제대로 받지 못했습니다(%d편, 전에는 %d편) — 기존 파일을 그대로 둡니다."
                 % (c["name"], len(videos), was))
    shorts = [item(e, False) for e in reversed(fetch(ch + "/shorts"))]
    streams = [item(e) for e in reversed(fetch(ch + "/streams"))]
    known = {x["id"] for x in videos + shorts + streams}
    playlists = []
    for p in fetch(ch + "/playlists"):
        ids = [e["id"] for e in fetch("https://www.youtube.com/playlist?list=" + p["id"])
               if e["id"] in known and e.get("title") not in HIDDEN]
        if ids:
            playlists.append({"id": p["id"], "t": p["title"].lstrip("📂 "), "v": ids})
    playlists.sort(key=lambda p: next((i for i, k in enumerate(c["order"]) if k in p["t"]), 99))
    print("%s: 영상 %d→%d · 쇼츠 %d→%d · 재생목록 %d개" % (c["name"], was, len(videos),
                                                    len(old.get("shorts", [])), len(shorts), len(playlists)))
    if c.get("title_strip"):
        for v in videos + shorts + streams:
            v["t"] = re.sub(c["title_strip"], "", v["t"]).strip() or v["t"]
    for p in playlists:
        p["t"] = re.sub(c.get("list_strip", "$^"), "", p["t"]).lstrip("🎬📂 ").strip() or p["t"]
    return {"key": c["key"], "name": c["name"], "videos": videos, "shorts": shorts, "streams": streams,
            "playlists": playlists}


def one(vid):
    """영상 하나의 제목·길이·올린 날. 지워졌거나 비공개면 None."""
    r = subprocess.run(["yt-dlp", "-J", "--skip-download", "--no-warnings", "--extractor-args", "youtube:lang=ko",
                        "https://www.youtube.com/watch?v=" + vid], capture_output=True, text=True,
                       stdin=subprocess.DEVNULL, timeout=120)
    if r.returncode != 0:
        return None
    j = json.loads(r.stdout)
    return {"id": vid, "t": j["title"], "d": int(j.get("duration") or 0), "u": j.get("upload_date") or ""}


def picks(old):
    """data/picks.json → 채널 하나. 이미 받은 영상은 다시 묻지 않는다(전체 목록은 올린 날 순, 묶음은 적은 순)."""
    cfg = json.loads(PICKS.read_text())
    known = {v["id"]: v for v in old.get("videos", []) if v.get("u")}
    got, playlists = {}, []
    for g in cfg["groups"]:
        ids = []
        for vid in g["ids"]:
            if vid not in got:
                v = known.get(vid) or one(vid)
                if not v:
                    print("  %s: 영상을 못 받았습니다(지워졌거나 비공개) — 빼고 갑니다." % vid)
                    continue
                got[vid] = v
            ids.append(vid)
        if ids:
            playlists.append({"id": cfg["key"] + "-" + g["key"], "t": g["name"], "v": ids})
    videos = sorted(got.values(), key=lambda v: v["u"])
    print("%s: 영상 %d→%d · 묶음 %d개" % (cfg["name"], len(old.get("videos", [])), len(videos), len(playlists)))
    return {"key": cfg["key"], "name": cfg["name"], "videos": videos, "shorts": [], "streams": [],
            "playlists": playlists}


def main():
    old = json.loads(OUT.read_text()) if OUT.exists() else {}
    olds = {c["key"]: c for c in old.get("channels", [])}
    if "videos" in old:   # 채널이 하나뿐이던 옛 형식
        olds["estell"] = old
    new = {"fetched": datetime.date.today().isoformat(),
           "channels": [channel(c, olds.get(c["key"], {})) for c in CHANNELS]}
    if PICKS.exists():
        new["channels"].append(picks(olds.get("picks", {})))
    OUT.write_text(json.dumps(new, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
