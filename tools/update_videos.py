#!/usr/bin/env python3
"""채널 영상 목록을 새로 받아 data/videos.json을 다시 만든다 (yt-dlp 필요).
쓰기: python3 tools/update_videos.py   → 편수 변화를 출력한다. 그 뒤 커밋·push하면 사이트에 반영된다."""
import datetime, json, pathlib, subprocess, sys

CH = "https://www.youtube.com/channel/UC0Wy2BjhsQP3gk2iuksCudw"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "videos.json"
ORDER = ["리스닝", "스피킹", "문장감각", "소리감각", "1분", "여행", "Frozen", "소설", "100%", "노하우", "수업소개"]
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


def main():
    videos = [item(e) for e in reversed(fetch(CH + "/videos"))]
    if len(videos) < 100:
        sys.exit("영상 목록을 받지 못했습니다(%d편) — 기존 파일을 그대로 둡니다." % len(videos))
    shorts = [item(e, False) for e in reversed(fetch(CH + "/shorts"))]
    streams = [item(e) for e in reversed(fetch(CH + "/streams"))]
    known = {x["id"] for x in videos + shorts + streams}
    playlists = []
    for p in fetch(CH + "/playlists"):
        ids = [e["id"] for e in fetch("https://www.youtube.com/playlist?list=" + p["id"])
               if e["id"] in known and e.get("title") not in HIDDEN]
        playlists.append({"id": p["id"], "t": p["title"], "v": ids})
    playlists.sort(key=lambda p: next((i for i, k in enumerate(ORDER) if k in p["t"]), 99))
    old = json.loads(OUT.read_text()) if OUT.exists() else {"videos": [], "shorts": []}
    new = {"channel": "에스텔잉글리쉬", "fetched": datetime.date.today().isoformat(), "videos": videos,
           "shorts": shorts, "streams": streams, "playlists": playlists}
    OUT.write_text(json.dumps(new, ensure_ascii=False, separators=(",", ":")))
    print("영상 %d→%d · 쇼츠 %d→%d · 재생목록 %d개" % (len(old["videos"]), len(videos),
                                                 len(old["shorts"]), len(shorts), len(playlists)))


if __name__ == "__main__":
    main()
