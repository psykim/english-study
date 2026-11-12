#!/usr/bin/env python3
"""구독 채널들의 영상 목록을 새로 받아 data/videos.json을 다시 만든다 (yt-dlp 필요).
채널 추가는 CHANNELS에 한 줄. 쓰기: python3 tools/update_videos.py   → 편수 변화를 출력한다. 그 뒤 커밋·push하면 사이트에 반영된다."""
import datetime, json, pathlib, subprocess, sys

CHANNELS = [
    {"key": "estell", "name": "에스텔잉글리쉬", "url": "https://www.youtube.com/channel/UC0Wy2BjhsQP3gk2iuksCudw",
     "order": ["리스닝", "스피킹", "문장감각", "소리감각", "1분", "여행", "Frozen", "소설", "100%", "노하우", "수업소개"]},
    {"key": "jenny", "name": "제니리 영어", "url": "https://www.youtube.com/channel/UCadhrKFHh_9K62ETq18EAAQ",
     "order": ["영어패턴", "구동사", "숙어", "영문법", "원어민", "공부법"]},
]
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "videos.json"
HIDDEN = ("[Private video]", "[Deleted video]")


def fetch(url):
    r = subprocess.run(["yt-dlp", "--flat-playlist", "-J", url], capture_output=True, text=True,
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
    return {"key": c["key"], "name": c["name"], "videos": videos, "shorts": shorts, "streams": streams,
            "playlists": playlists}


def main():
    old = json.loads(OUT.read_text()) if OUT.exists() else {}
    olds = {c["key"]: c for c in old.get("channels", [])}
    if "videos" in old:   # 채널이 하나뿐이던 옛 형식
        olds["estell"] = old
    new = {"fetched": datetime.date.today().isoformat(),
           "channels": [channel(c, olds.get(c["key"], {})) for c in CHANNELS]}
    OUT.write_text(json.dumps(new, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
