/* 에스텔 영어 공부 — 화면·재생·동기화 */
(function () {
  'use strict';
  const { emptyState, merge, fmtTime, firstUnseen, newKey } = window.Core;

  // 공개용(게시 가능) 키. 진도 표는 직접 읽을 수 없고 열쇠를 아는 기기만 자기 줄을 읽고 쓴다.
  const SB_URL = 'https://zvrrhhgxcbbqiphgxnap.supabase.co/rest/v1/rpc/';
  const SB_KEY = 'sb_publishable_vj0AsOwhiug15t-puHDWTA_X_d17jJ0';
  const LS_STATE = 'es.state', LS_KEY = 'es.key', LS_PREF = 'es.pref';

  const $ = (id) => document.getElementById(id);
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 공간 없음: 화면은 계속 동작 */ } },
  };

  let data = null;              // videos.json
  const byId = new Map();       // id -> {id,t,d}
  const lists = new Map();      // key -> {key, name, ids, short}
  let state = merge(emptyState(), ls.get(LS_STATE, null));
  let pref = Object.assign({ speed: 1, auto: true, newestFirst: false }, ls.get(LS_PREF, {}));
  let syncKey = ls.get(LS_KEY, null);
  let listKey = 'estell/all', curId = null;   // 목록 열쇠 = 채널/목록
  const shortIds = new Set();
  const chOf = (key) => key.split('/')[0];
  // 채널이 하나뿐이던 때 저장된 열쇠('all'·'pl:…')는 첫 채널 것으로 읽는다
  const normKey = (key) => (key && key.includes('/') ? key : 'estell/' + key);
  let player = null, playerReady = false, pendingLoad = null;
  let ab = { a: null, b: null };
  const rowEls = new Map();

  /* ---------- 진도 기록 ---------- */
  const rec = (id) => state.v[id] || [0, 0, 0, 0];
  function setRec(id, patch) {
    const r = rec(id).slice();
    if ('done' in patch) r[1] = patch.done ? 1 : 0;
    if ('pos' in patch) r[2] = Math.floor(patch.pos);
    if ('star' in patch) r[3] = patch.star ? 1 : 0;
    r[0] = Date.now();
    state.v[id] = r;
    persist();
  }
  function persist(urgent) {
    ls.set(LS_STATE, state);
    schedulePush(urgent ? 1500 : 15000);
  }

  /* ---------- 동기화 ---------- */
  let pushTimer = null, dirty = false;
  function setSync(text, cls) { const el = $('syncState'); el.textContent = text; el.className = 'sync-state ' + (cls || ''); }
  async function rpc(fn, body, keepalive) {
    const res = await fetch(SB_URL + fn, {
      method: 'POST', keepalive: !!keepalive,
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(fn + ' ' + res.status);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }
  async function pull() {
    try {
      const remote = await rpc('get_progress', { p_key: syncKey });
      if (remote) { merge(state, remote); ls.set(LS_STATE, state); }
      setSync('진도 맞춤', 'ok');
      return true;
    } catch (e) { setSync('오프라인 — 이 기기에만 저장', 'warn'); return false; }
  }
  async function push(keepalive) {
    clearTimeout(pushTimer); pushTimer = null;
    if (!dirty) return;
    dirty = false;
    try {
      if (!keepalive) { const remote = await rpc('get_progress', { p_key: syncKey }); if (remote) merge(state, remote); }
      await rpc('save_progress', { p_key: syncKey, p_data: state }, keepalive);
      setSync('진도 맞춤', 'ok');
    } catch (e) { dirty = true; setSync('오프라인 — 이 기기에만 저장', 'warn'); }
  }
  function schedulePush(ms) {
    dirty = true;
    if (pushTimer && ms >= 15000) return;   // 이미 예약돼 있으면 급한 것만 앞당긴다
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(false), ms);
  }

  /* ---------- 목록 ---------- */
  function buildLists() {
    for (const c of data.channels) {
      for (const k of ['videos', 'shorts', 'streams']) for (const v of c[k]) byId.set(v.id, v);
      for (const v of c.shorts) shortIds.add(v.id);
      const own = new Set([...c.videos, ...c.shorts, ...c.streams].map((v) => v.id));
      const add = (key, name, ids) => lists.set(c.key + '/' + key, { key: c.key + '/' + key, ch: c.key, name, ids, own });
      add('all', '전체 영상', c.videos.map((v) => v.id));
      add('star', '다시 볼 것', []);
      for (const p of c.playlists) add('pl:' + p.id, p.t, p.v.filter((id) => byId.has(id)));
      if (c.shorts.length) add('shorts', '쇼츠', c.shorts.map((v) => v.id));
      if (c.streams.length) add('streams', '라이브 방송', c.streams.map((v) => v.id));
    }
  }
  function idsOf(key) {
    const l = lists.get(key);
    if (key.endsWith('/star')) return [...l.own].filter((id) => rec(id)[3]);
    if (key.endsWith('/all') && pref.newestFirst) return l.ids.slice().reverse();
    return l.ids;
  }
  function renderChannels() {
    const nav = $('channels'); nav.textContent = '';
    for (const c of data.channels) {
      const b = document.createElement('button');
      const on = c.key === chOf(listKey);
      b.type = 'button'; b.className = on ? 'on' : '';
      b.setAttribute('aria-pressed', on);
      const done = c.videos.filter((v) => rec(v.id)[1]).length;
      const name = document.createElement('span'); name.textContent = c.name;
      const cnt = document.createElement('small'); cnt.textContent = done + ' / ' + c.videos.length + '편';
      b.append(name, cnt);
      b.onclick = () => {
        if (on) return;
        // 그 채널에서 마지막에 보던 목록으로 돌아간다
        listKey = (pref.lastList && lists.has(pref.lastList[c.key]) && pref.lastList[c.key]) || c.key + '/all';
        $('q').value = ''; renderChips(); renderList(); showNow(); scrollToCurrent();
      };
      nav.appendChild(b);
    }
  }
  function renderChips() {
    renderChannels();
    const nav = $('chips'); nav.textContent = '';
    for (const l of lists.values()) {
      if (l.ch !== chOf(listKey)) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (l.key === listKey ? ' on' : '');
      const n = idsOf(l.key).length;
      b.textContent = l.name + ' ' + n;
      b.setAttribute('aria-pressed', l.key === listKey);
      b.onclick = () => { listKey = l.key; pref.lastList = Object.assign({}, pref.lastList, { [l.ch]: l.key }); ls.set(LS_PREF, pref); $('q').value = ''; renderChips(); renderList(); showNow(); scrollToCurrent(); };
      nav.appendChild(b);
    }
  }
  function renderList() {
    const ol = $('list'); ol.textContent = ''; rowEls.clear();
    const ids = idsOf(listKey);
    const q = $('q').value.trim().toLowerCase(), unseen = $('chkUnseen').checked;
    const frag = document.createDocumentFragment();
    let shown = 0;
    ids.forEach((id, i) => {
      const v = byId.get(id), r = rec(id);
      if (q && !v.t.toLowerCase().includes(q)) return;
      if (unseen && r[1]) return;
      shown++;
      const li = document.createElement('li');
      li.className = 'item'; li.dataset.id = id;
      const btn = document.createElement('button'); btn.type = 'button';
      const num = document.createElement('span'); num.className = 'num'; num.textContent = i + 1;
      const img = document.createElement('img');
      img.loading = 'lazy'; img.alt = ''; img.width = 120; img.height = 68;
      img.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
      const txt = document.createElement('span'); txt.className = 'txt';
      const t = document.createElement('span'); t.className = 't'; t.textContent = v.t;
      const m = document.createElement('span'); m.className = 'm';
      txt.append(t, m);
      btn.append(num, img, txt);
      btn.onclick = () => play(id, true);
      li.appendChild(btn);
      rowEls.set(id, { li, m });
      paintRow(id);
      frag.appendChild(li);
    });
    ol.appendChild(frag);
    $('empty').hidden = shown > 0;
    $('btnOrder').hidden = !listKey.endsWith('/all');
    $('btnOrder').textContent = pref.newestFirst ? '최신순 · 바꾸기' : '오래된 순 · 바꾸기';
    renderProgress();
  }
  function paintRow(id) {
    const row = rowEls.get(id); if (!row) return;
    const v = byId.get(id), r = rec(id);
    row.li.classList.toggle('done', !!r[1]);
    row.li.classList.toggle('cur', id === curId);
    const parts = [];
    if (v.d) parts.push(fmtTime(v.d));
    if (r[1]) parts.push('다 봄'); else if (r[2] > 5) parts.push(fmtTime(r[2]) + '까지 봄');
    if (r[3]) parts.push('★ 다시 볼 것');
    row.m.textContent = parts.join(' · ');
  }
  function renderProgress() {
    const ids = idsOf(listKey), done = ids.filter((id) => rec(id)[1]).length;
    $('progText').textContent = lists.get(listKey).name + ' ' + done + ' / ' + ids.length + '편 완료';
    $('progBar').style.width = (ids.length ? (done / ids.length) * 100 : 0) + '%';
    $('btnResume').hidden = !firstUnseen(ids, state.v);
    const c = data.channels.find((x) => x.key === chOf(listKey));
    $('fetched').textContent = '목록 기준일 ' + data.fetched + ' · ' + c.name + ' 영상 ' + c.videos.length + '편';
  }
  // 넓은 화면은 목록만 따로 구르므로 항상 맞춰 주고, 폰은 사용자가 요청했을 때만 페이지를 옮긴다
  const wide = window.matchMedia('(min-width: 960px)');
  function scrollToCurrent(force, block) {
    const row = rowEls.get(curId);
    if (row && (wide.matches || force)) row.li.scrollIntoView({ block: block || 'center' });
  }

  /* ---------- 재생 ---------- */
  function showNow() {
    const v = byId.get(curId); if (!v) return;
    const ids = idsOf(listKey), i = ids.indexOf(curId);
    $('nowNum').textContent = i >= 0 ? lists.get(listKey).name + ' ' + (i + 1) + ' / ' + ids.length : '다른 목록의 영상';
    $('nowTitle').textContent = v.t;
    const r = rec(curId);
    $('chkDone').checked = !!r[1]; $('chkStar').checked = !!r[3];
    $('btnPrev').disabled = i <= 0; $('btnNext').disabled = i >= ids.length - 1 || !ids.length;
    document.title = v.t + ' — 영어 공부';
  }
  function play(id, autoplay) {
    if (!byId.has(id)) return;
    const prev = curId;
    savePos();
    curId = id;
    state.cur = { t: Date.now(), l: listKey, id };
    persist(true);
    resetAB();
    $('embedError').hidden = true;
    $('playerBox').classList.toggle('short', shortIds.has(id));
    paintRow(prev); paintRow(id); showNow();
    const r = rec(id), v = byId.get(id);
    // 다 본 영상이나 거의 끝난 위치는 처음부터
    const start = r[1] || (v.d && r[2] > v.d - 15) ? 0 : r[2];
    const arg = { videoId: id, startSeconds: start };
    if (!playerReady) { pendingLoad = { arg, autoplay }; return; }
    if (autoplay) player.loadVideoById(arg); else player.cueVideoById(arg);
  }
  function step(d) {
    const ids = idsOf(listKey), i = ids.indexOf(curId);
    const next = i >= 0 ? ids[i + d] : (d > 0 ? firstUnseen(ids, state.v) || ids[0] : null);
    if (next) { play(next, true); scrollToCurrent(false, 'nearest'); }
  }
  function savePos() {
    if (!playerReady || !curId || !player.getCurrentTime) return;
    const t = player.getCurrentTime();
    if (t > 1 && !rec(curId)[1]) setRec(curId, { pos: t });
  }
  function seek(d) {
    if (!playerReady) return;
    player.seekTo(Math.max(0, player.getCurrentTime() + d), true);
  }
  function resetAB() { ab = { a: null, b: null }; paintAB(); }
  function paintAB() {
    const b = $('btnAB');
    b.classList.toggle('on', ab.a !== null);
    if (ab.a === null) b.textContent = '구간 반복';
    else if (ab.b === null) b.textContent = fmtTime(ab.a) + '부터 — 끝 지점에서 누르기';
    else b.textContent = fmtTime(ab.a) + '~' + fmtTime(ab.b) + ' 반복 중 · 끄기';
  }
  function tick() {
    if (!playerReady || !player.getPlayerState) return;
    if (player.getPlayerState() !== 1) return;
    const t = player.getCurrentTime();
    if (ab.a !== null && ab.b !== null && (t >= ab.b || t < ab.a - 1)) player.seekTo(ab.a, true);
  }
  function onState(e) {
    if (e.data === 1) player.setPlaybackRate(pref.speed);
    if (e.data === 2) { savePos(); paintRow(curId); }
    if (e.data === 0) {
      setRec(curId, { done: true, pos: 0 });
      paintRow(curId); showNow(); renderProgress(); renderChannels();
      persist(true);
      if (pref.auto) step(1);
    }
  }
  function onError(e) {
    // 101·150: 퍼가기 금지, 100: 삭제·비공개
    $('embedLink').href = 'https://www.youtube.com/watch?v=' + curId;
    $('embedError').hidden = false;
  }
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady() {
          playerReady = true;
          if (pendingLoad) {
            const p = pendingLoad; pendingLoad = null;
            if (p.autoplay) player.loadVideoById(p.arg); else player.cueVideoById(p.arg);
          }
        },
        onStateChange: onState, onError,
      },
    });
  };

  /* ---------- 기기 연결 ---------- */
  function deviceLink() { return location.origin + location.pathname + '#k=' + syncKey; }
  function openDevices() {
    const url = deviceLink();
    $('linkText').value = url;
    const box = $('qr'); box.textContent = '';
    if (window.qrcode) {
      const q = window.qrcode(0, 'M'); q.addData(url); q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    }
    $('dlg').showModal();
  }
  function adoptKeyFromHash() {
    const m = /[#&]k=([0-9a-f]{20,64})\b/.exec(location.hash);
    if (m) {
      if (m[1] !== syncKey) { syncKey = m[1]; ls.set(LS_KEY, syncKey); dirty = true; }
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (!syncKey) { syncKey = newKey(); ls.set(LS_KEY, syncKey); }
  }

  /* ---------- 이벤트 ---------- */
  function wire() {
    $('btnPrev').onclick = () => step(-1);
    $('btnNext').onclick = () => step(1);
    $('btnBack').onclick = () => seek(-5);
    $('btnFwd').onclick = () => seek(5);
    $('btnAB').onclick = () => {
      if (!playerReady) return;
      const t = player.getCurrentTime();
      if (ab.a === null) ab.a = t;
      else if (ab.b === null) { if (t > ab.a + 0.5) { ab.b = t; player.seekTo(ab.a, true); } else ab.a = t; }
      else ab = { a: null, b: null };
      paintAB();
    };
    $('speeds').onclick = (e) => {
      const s = parseFloat(e.target.dataset.s); if (!s) return;
      pref.speed = s; ls.set(LS_PREF, pref); paintPrefs();
      if (playerReady) player.setPlaybackRate(s);
    };
    $('chkDone').onchange = (e) => { setRec(curId, { done: e.target.checked, pos: 0 }); persist(true); paintRow(curId); renderProgress(); renderChannels(); };
    $('chkStar').onchange = (e) => { setRec(curId, { star: e.target.checked }); persist(true); paintRow(curId); renderChips(); if (listKey.endsWith('/star')) renderList(); };
    $('chkAuto').onchange = (e) => { pref.auto = e.target.checked; ls.set(LS_PREF, pref); };
    $('chkUnseen').onchange = renderList;
    $('q').oninput = renderList;
    $('btnOrder').onclick = () => { pref.newestFirst = !pref.newestFirst; ls.set(LS_PREF, pref); renderList(); showNow(); scrollToCurrent(); };
    $('btnResume').onclick = () => {
      const id = firstUnseen(idsOf(listKey), state.v); if (!id) return;
      if (!rowEls.has(id)) { $('q').value = ''; renderList(); }
      play(id, true); scrollToCurrent(true);
    };
    $('btnDevices').onclick = openDevices;
    $('btnClose').onclick = () => $('dlg').close();
    $('btnCopy').onclick = async () => {
      try { await navigator.clipboard.writeText($('linkText').value); $('btnCopy').textContent = '복사했습니다'; }
      catch (e) { $('linkText').select(); }
    };
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea') || e.metaKey || e.ctrlKey || e.altKey || $('dlg').open) return;
      if (e.key === 'ArrowLeft') { seek(-5); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { seek(5); e.preventDefault(); }
      else if (e.key === ' ' && playerReady) { player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo(); e.preventDefault(); }
    });
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) { savePos(); ls.set(LS_STATE, state); push(true); return; }
      const before = state.cur && state.cur.t;
      if (await pull()) {
        renderChips(); renderList();
        // 다른 기기에서 더 나중에 본 영상이 있고 지금 재생 중이 아니면 그쪽으로 옮긴다
        const playing = playerReady && player.getPlayerState && player.getPlayerState() === 1;
        if (state.cur && state.cur.t !== before && state.cur.id !== curId && !playing) restoreCurrent();
        else showNow();
      }
    });
    window.addEventListener('pagehide', () => { savePos(); ls.set(LS_STATE, state); push(true); });
    setInterval(tick, 200);
    setInterval(() => { if (playerReady && player.getPlayerState && player.getPlayerState() === 1) { savePos(); paintRow(curId); } }, 5000);
  }
  function paintPrefs() {
    for (const b of $('speeds').children) b.classList.toggle('on', parseFloat(b.dataset.s) === pref.speed);
    $('chkAuto').checked = pref.auto;
  }
  function restoreCurrent() {
    const c = state.cur;
    if (c && byId.has(c.id) && lists.has(normKey(c.l))) { listKey = normKey(c.l); }
    const ids = idsOf(listKey);
    const id = c && byId.has(c.id) ? c.id : firstUnseen(ids, state.v) || ids[0];
    renderChips(); renderList();
    const keep = state.cur;
    play(id, false);
    if (keep) state.cur = keep;   // 화면 복원만으로 「마지막에 본 시각」을 새로 쓰지 않는다
    scrollToCurrent();
  }

  /* ---------- 시작 ---------- */
  async function init() {
    adoptKeyFromHash();
    wire(); paintPrefs();
    const [d] = await Promise.all([
      fetch('data/videos.json').then((r) => r.json()),
      Promise.race([pull(), new Promise((r) => setTimeout(r, 4000))]),
    ]);
    data = d;
    buildLists();
    restoreCurrent();
    if (dirty) schedulePush(1500);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }
  init().catch((e) => { $('nowTitle').textContent = '목록을 불러오지 못했습니다. 새로고침해 주세요.'; console.error(e); });
})();
