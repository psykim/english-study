const test = require('node:test');
const assert = require('node:assert');
const { emptyState, merge, fmtTime, firstUnseen, newKey, buildPrompt } = require('../core.js');

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
