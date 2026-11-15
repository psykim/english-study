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

  // 기기 연결 링크(#k=열쇠)를 어떻게 다룰지 정한다. 열쇠만 알면 진도를 읽고 쓸 수 있으므로,
  // 남이 만든 링크를 여는 것만으로 열쇠가 바뀌면 안 된다(2026-11-15 보안 점검) — 바꾸기 전에 묻는다.
  function linkKeyAction(hash, currentKey) {
    const m = /[#&]k=([0-9a-f]{20,64})\b/.exec(hash || '');
    if (!m) return { action: 'none', key: null };
    if (m[1] === currentKey) return { action: 'same', key: m[1] };
    return { action: currentKey ? 'ask-replace' : 'ask-first', key: m[1] };
  }

  // 말하기 연습(2026-11-13, 계획 docs/plans/2026-11-13-speaking-practice.html) —
  // 앱은 AI를 부르지 않는다(공개 저장소라 키 없음). 이 글을 복사해 대표가 Claude·ChatGPT에 붙여 넣는다.
  const SIM_TEMPLATE = [
    '영어 말하기 연습을 도와줘. 나는 한국인 성인 학습자야.',
    '오늘 본 강의: 「{title}」',
    '연습 상황: {situation}',
    '',
    '1. 너는 이 상황의 상대역이야. 영어로 먼저 짧게 말을 걸어 줘.',
    '2. 내가 영어로 답하면(틀려도, 단어만 말해도 돼) 대화를 잇기 전에 한국어로 짧게 알려 줘:',
    '   - 내가 하려던 말을 네가 이해한 뜻',
    '   - 이 상황에서 원어민이 실제로 할 자연스러운 말 2가지(조금 격식 있게 / 편하게)',
    '   - 내 문장에서 고칠 것 딱 한 가지',
    '3. 그다음 상대역으로 돌아가 영어로 대화를 이어 가.',
    '4. 6번 주고받으면 끝내고, 오늘 쓴 표현 3개를 정리해 줘.',
    '나는 목소리로 답할 수도 있어.',
  ].join('\n');
  const KO_TEMPLATE = [
    '영어 표현을 도와줘. 나는 한국인 성인이고, 생각은 한국어로 먼저 정리했어.',
    '- 내 역할: {role}',
    '- 상대: {partner}',
    '- 하고 싶은 말(한국어): {memo}',
    '',
    '1. 직역하지 말고, 이 장면에서 실제로 쓸 자연스러운 영어로 바꿔 줘(정중한 판 / 편한 판).',
    '2. 한국어와 영어가 다르게 표현하는 핵심 단어 2~3개를 비교해 줘.',
    '3. 내가 소리 내어 따라 말할 한 문장을 골라 줘.',
    '4. 내가 그 문장을 다시 말해 보내면 고칠 점을 알려 줘.',
  ].join('\n');

  function buildPrompt(mode, f) {
    f = f || {};
    const fill = (s) => String(s == null ? '' : s).trim() || '(비워 둠)';
    const vals = mode === 'ko'
      ? { role: fill(f.role), partner: fill(f.partner), memo: fill(f.memo) }
      : { title: fill(f.title), situation: fill(String(f.situation || '').trim() || f.title) };
    // 함수로 바꿔 넣는다 — 입력의 $&·$1 이 치환 패턴으로 읽히지 않게
    return (mode === 'ko' ? KO_TEMPLATE : SIM_TEMPLATE).replace(/\{(\w+)\}/g, (_, k) => vals[k]);
  }

  const api = { emptyState, merge, fmtTime, firstUnseen, newKey, buildPrompt, linkKeyAction };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
