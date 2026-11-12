const test = require('node:test');
const assert = require('node:assert');
const { emptyState, merge, fmtTime, firstUnseen, newKey } = require('../core.js');

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
