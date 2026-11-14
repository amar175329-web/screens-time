/* Unit tests for the data engine. Run: node --test tests/   (Node 18+) */
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../www/js/engine.js'), S = require('../www/js/sample.js');

const D = new Date(2026, 10, 9);                       // a fixed day (local time)
const at = (h, m = 0, s = 0, dayOff = 0) => new Date(D.getFullYear(), D.getMonth(), D.getDate() + dayOff, h, m, s).getTime();
const A = { id: 'a.app', name: 'Alpha', category: 'Social' }, B = { id: 'b.app', name: 'Beta', category: 'Video' };
const app = (m, id) => m.APPS.find(a => a.id === id);

test('foreground / background pairs become minutes, opens and an unlock', () => {
  const m = E.build({ now: at(12), apps: [A, B], events: [
    { t: at(9, 0, 0), k: 'screenOn' }, { t: at(9, 0, 1), k: 'unlock' },
    { t: at(9, 0, 2), k: 'fg', app: 'a.app' }, { t: at(9, 10, 2), k: 'bg', app: 'a.app' },
    { t: at(9, 10, 10), k: 'fg', app: 'b.app' }, { t: at(9, 15, 10), k: 'bg', app: 'b.app' }, { t: at(9, 15, 20), k: 'screenOff' }] });
  assert.equal(app(m, 'a.app').t, 10); assert.equal(app(m, 'b.app').t, 5);
  assert.equal(m.TODAY, 15); assert.equal(m.UNL, 1); assert.equal(app(m, 'a.app').m, 1); assert.equal(m.SESS.length, 2);
});

test('opening another app ends the previous one; screen off ends the last', () => {
  const m = E.build({ now: at(12), apps: [A, B], events: [{ t: at(10), k: 'fg', app: 'a.app' }, { t: at(10, 5), k: 'fg', app: 'b.app' }, { t: at(10, 8), k: 'screenOff' }] });
  assert.equal(app(m, 'a.app').t, 5); assert.equal(app(m, 'b.app').t, 3);
});

test('an app with no closing event is capped at 4 hours', () => {
  const m = E.build({ now: at(14), apps: [A], events: [{ t: at(8), k: 'fg', app: 'a.app' }] });
  assert.equal(app(m, 'a.app').t, 240);
});

test('a visit that started before midnight only counts from midnight', () => {
  const ev = [{ t: at(23, 50, 0, -1), k: 'fg', app: 'a.app' }, { t: at(0, 10), k: 'bg', app: 'a.app' }];
  const today = E.build({ now: at(1), apps: [A], events: ev });
  assert.equal(app(today, 'a.app').t, 10);
  const yest = E.rollupDay({ apps: [A], events: ev }, at(12, 0, 0, -1));
  assert.equal(yest.apps['a.app'], 10); assert.equal(yest.total, 10);
});

test('rounded app minutes add up to the day total and to the hour totals', () => {
  const ev = []; let t = at(10);
  ['a.app', 'b.app', 'c.app'].forEach(id => { ev.push({ t, k: 'fg', app: id }, { t: t + 100000, k: 'bg', app: id }); t += 200000; });
  const m = E.build({ now: at(12), apps: [A, B, { id: 'c.app', name: 'Gamma' }], events: ev });
  assert.equal(m.APPS.reduce((s, a) => s + a.t, 0), 5); assert.equal(m.TODAY, 5);
  assert.equal(m.HM.reduce((a, b) => a + b, 0), m.TODAY);
});

test('an unknown app (launcher) ends the previous visit but is not counted', () => {
  const m = E.build({ now: at(12), apps: [A], events: [{ t: at(10), k: 'fg', app: 'a.app' }, { t: at(10, 5), k: 'fg', app: 'launcher' }, { t: at(10, 10), k: 'fg', app: 'a.app' }, { t: at(10, 12), k: 'bg', app: 'a.app' }] });
  assert.equal(app(m, 'a.app').t, 7); assert.equal(app(m, 'a.app').m, 2);
});

test('page titles split a visit into pieces', () => {
  const m = E.build({ now: at(12), apps: [A], events: [{ t: at(10), k: 'fg', app: 'a.app' }, { t: at(10, 6), k: 'bg', app: 'a.app' }],
    pages: [{ t: at(10), app: 'a.app', title: 'Feed' }, { t: at(10, 3), app: 'a.app', title: 'Messages' }] });
  const a = app(m, 'a.app'); assert.deepEqual(a.pg, ['Feed', 'Messages']);
  assert.equal(m.SESS.length, 2); assert.equal(m.SESS[0].d + m.SESS[1].d, 6); assert.equal(a.m, 1);
});

test('quick flickers under 2 seconds are ignored; pause + resume inside 3 seconds is one visit', () => {
  const m = E.build({ now: at(12), apps: [A], events: [
    { t: at(10), k: 'fg', app: 'a.app' }, { t: at(10, 0, 1), k: 'bg', app: 'a.app' },
    { t: at(11), k: 'fg', app: 'a.app' }, { t: at(11, 0, 2), k: 'bg', app: 'a.app' }, { t: at(11, 0, 3), k: 'fg', app: 'a.app' }, { t: at(11, 0, 5), k: 'bg', app: 'a.app' }] });
  assert.equal(app(m, 'a.app').m, 1);
});

test('notifications are counted per app, today only', () => {
  const m = E.build({ now: at(12), apps: [A], events: [], notifications: [{ t: at(8), app: 'a.app' }, { t: at(9), app: 'a.app' }, { t: at(9, 0, 0, -1), app: 'a.app' }, { t: at(9), app: 'zzz' }] });
  assert.equal(m.NOTIF, 2); assert.equal(app(m, 'a.app').nf, 2);
});

test('week, month, year and range totals come from the history', () => {
  const hist = [];
  for (let o = -400; o <= -1; o++) { const d = new Date(D.getFullYear(), D.getMonth(), D.getDate() + o, 12), key = E.ymd(d.getTime()); hist.push({ date: key, total: 100, unlocks: 10, apps: { 'a.app': 60, 'b.app': 40 } }); }
  const m = E.build({ now: at(12), apps: [A, B], history: hist, events: [{ t: at(10), k: 'fg', app: 'a.app' }, { t: at(10, 30), k: 'bg', app: 'a.app' }] });
  assert.equal(m.WEEK.length, 7); assert.equal(m.MONTH.length, 30); assert.equal(m.YEAR.length, 12);
  assert.equal(m.WEEK[6], 30); assert.equal(m.WEEK.slice(0, 6).every(v => v === 100), true);
  assert.equal(m.PREV, 700); assert.equal(m.HAVE_PREV, true);
  assert.equal(Object.values(m.RANGE.week).reduce((a, b) => a + b, 0), m.WEEK.reduce((a, b) => a + b, 0));
  assert.equal(Object.values(m.RANGE.month).reduce((a, b) => a + b, 0), m.MONTH.reduce((a, b) => a + b, 0));
});

test('an uninstalled app is rebuilt from its history, with real dates and totals', () => {
  const hist = [];
  for (let o = -30; o <= -1; o++) { const key = E.ymd(new Date(D.getFullYear(), D.getMonth(), D.getDate() + o, 12).getTime()); hist.push({ date: key, total: 100, unlocks: 5, apps: o <= -10 ? { 'a.app': 60, 'old.app': 40 } : { 'a.app': 100 } }); }
  const m = E.build({ now: at(12), apps: [A], history: hist, events: [], known: [{ id: 'old.app', name: 'Old Game', category: 'Games' }] });
  assert.equal(m.DELETED.length, 1);
  const d = m.DELETED[0]; assert.equal(d.n, 'Old Game'); assert.equal(d.life, 21 * 40); assert.equal(d.wk, 0); assert.equal(d.mo, 20 * 40);   // the last 30 days hold 20 of those 21 days
  assert.equal(d.hist.reduce((a, b) => a + b, 0), 21 * 40);
});

test('rollupDay equals what the day looked like at its end', () => {
  const ev = [{ t: at(9, 0, 0, -1), k: 'unlock' }, { t: at(9, 0, 1, -1), k: 'fg', app: 'a.app' }, { t: at(9, 20, 1, -1), k: 'bg', app: 'a.app' }, { t: at(9, 21, 0, -1), k: 'screenOff' }];
  const r = E.rollupDay({ apps: [A], events: ev }, at(12, 0, 0, -1));
  assert.equal(r.date, E.ymd(at(12, 0, 0, -1))); assert.equal(r.total, 20); assert.equal(r.unlocks, 1); assert.deepEqual(r.apps, { 'a.app': 20 });
});

test('empty input never throws and shows zeros', () => {
  const m = E.emptyModel(at(12)); assert.equal(m.TODAY, 0); assert.equal(m.APPS.length, 0); assert.equal(m.WEEK.length, 7); assert.equal(m.HAVE_PREV, false);
  assert.doesNotThrow(() => E.build({ now: at(0, 0, 1), apps: [A], events: [{ t: at(0, 0, 0), k: 'bg', app: 'a.app' }, { t: 'x', k: 'fg' }, null] }));
});

test('sample data goes through the same engine and adds up everywhere', () => {
  for (const mode of ['sample', 'stress', 'empty']) {
    const m = E.build(S.raw({ mode }));
    assert.equal(m.APPS.reduce((s, a) => s + a.t, 0), m.TODAY, mode + ' apps vs total');
    assert.equal(m.HM.reduce((a, b) => a + b, 0), m.TODAY, mode + ' hours vs total');
    assert.equal(m.WEEK[6], m.TODAY); assert.equal(m.MONTH[29], m.TODAY);
    assert.equal(Object.values(m.RANGE.week).reduce((a, b) => a + b, 0), m.WEEK.reduce((a, b) => a + b, 0), mode + ' week range');
    assert.equal(Object.values(m.RANGE.month).reduce((a, b) => a + b, 0), m.MONTH.reduce((a, b) => a + b, 0), mode + ' month range');
    m.SESS.forEach(s => { assert.ok(s.s >= 0 && s.e <= 1440 && s.e > s.s); });
  }
});
