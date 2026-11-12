// 화면과 무관한 순수 로직 — 브라우저와 node 테스트가 같이 쓴다.
// 진도 한 줄: v[영상ID] = [고친 시각(ms), 다 봤음 0/1, 이어 볼 위치(초), 다시 볼 것 0/1]
(function (root) {
  function emptyState() { return { v: {}, cur: null }; }

  // b를 a에 합친다. 영상마다 더 나중에 고친 쪽이 이긴다.
  function merge(a, b) {
    if (!b || typeof b !== 'object') return a;
    const bv = b.v || {};
    for (const id in bv) {
      const y = bv[id];
      if (!Array.isArray(y)) continue;
      const x = a.v[id];
      if (!x || y[0] > x[0]) a.v[id] = y;
    }
    if (b.cur && (!a.cur || b.cur.t > a.cur.t)) a.cur = b.cur;
    return a;
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
  }

  // 목록에서 아직 안 본 첫 영상의 ID (없으면 null)
  function firstUnseen(ids, v) {
    for (const id of ids) if (!(v[id] && v[id][1])) return id;
    return null;
  }

  function newKey() {
    const b = new Uint8Array(16);
    root.crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  const api = { emptyState, merge, fmtTime, firstUnseen, newKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
