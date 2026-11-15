const test = require('node:test');
const assert = require('node:assert');
const { emptyState, merge, fmtTime, firstUnseen, newKey, buildPrompt, linkKeyAction } = require('../core.js');

test('말하기 연습: 상황 연습 글에 영상 제목과 상황이 들어간다', () => {
  const p = buildPrompt('sim', { title: '입국심사 영어질문', situation: '방문 목적을 묻는다' });
  assert.match(p, /오늘 본 강의: 「입국심사 영어질문」/);
  assert.match(p, /연습 상황: 방문 목적을 묻는다/);
  assert.match(p, /상대역/);
  assert.doesNotMatch(p, /\{/); // 빈칸 표시가 남지 않는다
});
test('말하기 연습: 상황이 비면 영상 제목을 상황으로 쓴다', () => {
  const p = buildPrompt('sim', { title: '바닐라 라떼 주문', situation: '   ' });
  assert.match(p, /연습 상황: 바닐라 라떼 주문/);
});
test('말하기 연습: 한국어로 먼저는 세 칸을 채우고, 빈 칸은 (비워 둠)', () => {
  const p = buildPrompt('ko', { role: '15년 차 팀장', partner: '', memo: '일정을 2주 미루자고 정중히' });
  assert.match(p, /내 역할: 15년 차 팀장/);
  assert.match(p, /상대: \(비워 둠\)/);
  assert.match(p, /하고 싶은 말\(한국어\): 일정을 2주 미루자고 정중히/);
  assert.doesNotMatch(p, /\{/);
});
test('말하기 연습: 두 방식은 서로 다른 글이고, 모르는 방식은 상황 연습', () => {
  const f = { title: 't', situation: 's', role: 'r', partner: 'p', memo: 'm' };
  assert.notEqual(buildPrompt('sim', f), buildPrompt('ko', f));
  assert.equal(buildPrompt('???', f), buildPrompt('sim', f));
});
test('말하기 연습: 입력 속 $ 기호가 그대로 들어간다(치환 패턴 아님)', () => {
  assert.match(buildPrompt('sim', { title: "$& price $1", situation: '' }), /「\$& price \$1」/);
});

test('합치기: 영상마다 나중에 고친 쪽이 이긴다', () => {
  const a = { v: { x: [10, 0, 30, 0], y: [50, 1, 0, 0] }, cur: { t: 5, l: 'all', id: 'x' } };
  const b = { v: { x: [20, 1, 0, 0], y: [40, 0, 9, 0], z: [1, 0, 3, 1] }, cur: { t: 9, l: 'shorts', id: 'z' } };
  merge(a, b);
  assert.deepEqual(a.v.x, [20, 1, 0, 0]);
  assert.deepEqual(a.v.y, [50, 1, 0, 0]);
  assert.deepEqual(a.v.z, [1, 0, 3, 1]);
  assert.equal(a.cur.id, 'z');
});
test('합치기: 빈 값·깨진 값은 무시한다', () => {
  const a = emptyState();
  merge(a, null); merge(a, { v: { bad: 'oops' } }); merge(a, {});
  assert.deepEqual(a, { v: {}, cur: null });
});
test('시간 표기', () => {
  assert.equal(fmtTime(65), '1:05');
  assert.equal(fmtTime(3725), '1:02:05');
  assert.equal(fmtTime(undefined), '0:00');
});
test('안 본 첫 영상', () => {
  assert.equal(firstUnseen(['a', 'b', 'c'], { a: [1, 1, 0, 0], b: [1, 0, 5, 0] }), 'b');
  assert.equal(firstUnseen(['a'], { a: [1, 1, 0, 0] }), null);
});
test('열쇠는 32자 16진수', () => { assert.match(newKey(), /^[0-9a-f]{32}$/); });

// 기기 연결 링크(2026-11-15 보안 점검): 남이 만든 링크를 열기만 해도 열쇠가 바뀌어 진도가 넘어가던 문제
const K1 = 'a'.repeat(32), K2 = 'b'.repeat(32);
test('기기 연결: 링크에 열쇠가 없으면 아무 일도 없다', () => {
  assert.deepStrictEqual(linkKeyAction('', K1), { action: 'none', key: null });
  assert.deepStrictEqual(linkKeyAction('#other=1', null), { action: 'none', key: null });
});
test('기기 연결: 링크 열쇠가 지금 열쇠와 같으면 묻지 않는다', () => {
  assert.deepStrictEqual(linkKeyAction('#k=' + K1, K1), { action: 'same', key: K1 });
});
test('기기 연결: 열쇠가 이미 있는데 다른 열쇠가 오면 먼저 묻는다', () => {
  assert.deepStrictEqual(linkKeyAction('#k=' + K2, K1), { action: 'ask-replace', key: K2 });
});
test('기기 연결: 처음 온 기기도 링크 열쇠는 묻고 받는다', () => {
  assert.deepStrictEqual(linkKeyAction('#x=1&k=' + K2, null), { action: 'ask-first', key: K2 });
});
test('기기 연결: 형식이 틀린 열쇠(짧음·대문자·16진수 아님)는 무시한다', () => {
  for (const h of ['#k=abc', '#k=' + 'A'.repeat(32), '#k=' + 'z'.repeat(32), '#k=' + 'a'.repeat(65)])
    assert.strictEqual(linkKeyAction(h, K1).action, 'none', h);
});
