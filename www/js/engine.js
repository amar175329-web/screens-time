/* Screens Time - data engine.
   Pure functions, no DOM. Works in the browser (window.Engine) and in Node (module.exports) so it can be unit tested.

   INPUT  (raw): what the phone (or the sample generator) hands over. See docs/DATA_CONTRACT.md.
   OUTPUT (model): everything the screens need: per app totals, per minute strip, per hour totals,
                   sessions, unlocks, week / month / year series, deleted apps.
   Every number the UI shows is computed here, from events, in one place.                         */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MIN = 60000, DAY_MIN = 1440;
  const MAX_SESSION = 4 * 3600000;      // an app can't be "in front" for more than 4 h without a new event
  const MERGE_GAP = 3000;               // activity switch inside one app: pause + resume within 3 s is one visit
  const MIN_SESSION = 2000;             // ignore flickers shorter than 2 s
  const CLUSTER_GAP_MS = 0;             // unlocks are real events, no guessing

  const pad = n => String(n).padStart(2, '0');
  const dayStart = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const ymd = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const addDays = (t, n) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12).getTime(); };
  const ORDER = { shutdown: 0, screenOff: 1, bg: 2, unlock: 3, screenOn: 4, fg: 5 };

  /* round a list of floats to integers so that the integers add up to round(sum)  (largest remainder) */
  function roundSum(vals) {
    const total = Math.round(vals.reduce((a, b) => a + b, 0));
    const fl = vals.map(Math.floor);
    let rest = total - fl.reduce((a, b) => a + b, 0);
    const order = vals.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
    for (let k = 0; k < order.length && rest > 0; k++, rest--) fl[order[k].i]++;
    return fl;
  }

  /* events -> [{app,s,e}] in epoch ms.  fg opens a visit; bg of the same app, fg of another app, screenOff or shutdown closes it. */
  function intervals(events, now) {
    const ev = events.filter(e => e && typeof e.t === 'number').sort((a, b) => a.t - b.t || (ORDER[a.k] ?? 9) - (ORDER[b.k] ?? 9));
    const out = []; let cur = null;
    const close = t => { if (cur) { const e = Math.min(t, cur.s + MAX_SESSION); if (e > cur.s) out.push({ app: cur.app, s: cur.s, e }); cur = null; } };
    for (const e of ev) {
      if (e.k === 'fg') { if (cur && cur.app === e.app) continue; close(e.t); cur = { app: e.app, s: e.t }; }
      else if (e.k === 'bg') { if (cur && cur.app === e.app) close(e.t); }
      else if (e.k === 'screenOff' || e.k === 'shutdown') close(e.t);
    }
    if (cur) close(now);
    /* merge quick activity switches inside the same app */
    const merged = [];
    for (const it of out) {
      const l = merged[merged.length - 1];
      if (l && l.app === it.app && it.s - l.e <= MERGE_GAP) l.e = Math.max(l.e, it.e); else merged.push({ ...it });
    }
    return merged.filter(i => i.e - i.s >= MIN_SESSION);
  }

  function emptyModel(now, mode) {
    const n = now == null ? Date.now() : now;
    return build({ now: n, mode: mode || 'native', apps: [], events: [] });
  }

  function build(raw) {
    const now = raw.now == null ? Date.now() : raw.now;
    const start = dayStart(now);
    const NOW = clampMin(Math.floor((now - start) / MIN));
    const ids = new Map();      // package -> index in APPS
    const APPS = [];
    const addApp = (a) => {
      if (!a || !a.id || ids.has(a.id)) return;
      ids.set(a.id, APPS.length);
      APPS.push({ id: a.id, n: a.name || a.n || tail(a.id), cat: a.category || a.cat || 'Other', icon: a.icon || null, sys: !!a.system,
        t: 0, m: 0, nf: 0, pg: [], g: initials(a.name || a.n || tail(a.id)) });
    };
    (raw.apps || []).forEach(addApp);

    /* ---- visits today (events may start a few hours before midnight so an app already open at 00:00 is caught) ---- */
    const dayEnd = Math.min(now, start + DAY_MIN * MIN);
    const evs = (raw.events || []).filter(e => e && typeof e.t === 'number' && e.t <= now);
    /* an unknown app (launcher, system UI) still ends the previous visit; it just is not counted */
    const iv = intervals(evs, now).filter(i => ids.has(i.app))
      .map(i => ({ ...i, s: Math.max(i.s, start), e: Math.min(i.e, dayEnd) })).filter(i => i.e > i.s);

    /* page titles -> sessions split where the title changes */
    const pagesBy = new Map();
    (raw.pages || []).forEach(p => { if (!p || !ids.has(p.app)) return; if (!pagesBy.has(p.app)) pagesBy.set(p.app, []); pagesBy.get(p.app).push(p); });
    pagesBy.forEach(l => l.sort((a, b) => a.t - b.t));
    const pageAt = (app, t) => { const l = pagesBy.get(app); if (!l) return null; let r = null; for (const p of l) { if (p.t <= t) r = p; else break; } return r && t - r.t < 3600000 ? r.title : null; };
    const pageIdx = (a, title) => { if (!title) return -1; let k = a.pg.indexOf(title); if (k < 0) { a.pg.push(title); k = a.pg.length - 1; } return k; };

    const SESS = [], secMin = new Map();           // minute -> Map(appIdx -> ms)
    const perHour = new Array(24).fill(0), perAppHour = APPS.map(() => new Array(24).fill(0));
    const appMs = APPS.map(() => 0), opens = APPS.map(() => 0);
    iv.forEach(it => {
      const ai = ids.get(it.app); opens[ai]++;
      /* split at page changes */
      const cuts = [it.s];
      (pagesBy.get(it.app) || []).forEach(p => { if (p.t > it.s && p.t < it.e) cuts.push(p.t); });
      cuts.push(it.e);
      for (let c = 0; c < cuts.length - 1; c++) {
        const s = cuts[c], e = cuts[c + 1];
        if (e - s < MIN_SESSION && cuts.length > 2) continue;
        const sm = Math.floor((s - start) / MIN), em = Math.max(sm + 1, Math.ceil((e - start) / MIN));
        SESS.push({ a: ai, p: pageIdx(APPS[ai], pageAt(it.app, s)), s: sm, e: em, d: Math.max(1, Math.round((e - s) / MIN)), ms: s, unl: false });
      }
      /* minute accounting */
      appMs[ai] += it.e - it.s;
      for (let m = Math.floor((it.s - start) / MIN); m <= Math.floor((it.e - 1 - start) / MIN); m++) {
        if (m < 0 || m >= DAY_MIN) continue;
        const a = Math.max(it.s, start + m * MIN), b = Math.min(it.e, start + (m + 1) * MIN), ms = b - a;
        if (ms <= 0) continue;
        let mp = secMin.get(m); if (!mp) { mp = new Map(); secMin.set(m, mp); }
        mp.set(ai, (mp.get(ai) || 0) + ms);
        const h = Math.floor(m / 60);
        perHour[h] += ms; perAppHour[ai][h] += ms;
      }
    });
    SESS.sort((a, b) => a.ms - b.ms);

    const MM = new Int16Array(DAY_MIN).fill(-1), PG = new Int16Array(DAY_MIN).fill(-1), BG = new Uint8Array(DAY_MIN);
    secMin.forEach((mp, m) => { let best = -1, bm = 0; mp.forEach((ms, ai) => { if (ms > bm) { bm = ms; best = ai; } }); if (bm >= 5000) MM[m] = best; });
    SESS.forEach(x => { for (let m = x.s; m < x.e && m < DAY_MIN; m++) if (MM[m] === x.a) PG[m] = x.p; });

    /* totals: exact seconds first, then integers that add up */
    const tApp = roundSum(appMs.map(v => v / MIN));
    const HM = roundSum(perHour.map(v => v / MIN));
    const AH = perAppHour.map(r => r.map(v => Math.round(v / MIN)));
    APPS.forEach((a, i) => { a.t = tApp[i]; a.m = opens[i]; });
    const TODAY = tApp.reduce((a, b) => a + b, 0);

    /* background play (music, calls, navigation) */
    const BGL = [];
    (raw.background || []).forEach(b => {
      if (!b || !ids.has(b.app)) return;
      const s = Math.max(b.s, start), e = Math.min(b.e, dayEnd); if (e - s < MIN) return;
      BGL.push({ a: ids.get(b.app), s: Math.floor((s - start) / MIN), e: Math.ceil((e - start) / MIN), d: Math.max(1, Math.round((e - s) / MIN)) });
      for (let m = Math.floor((s - start) / MIN); m < Math.ceil((e - start) / MIN) && m < DAY_MIN; m++) BG[m] = 1;
    });
    BGL.sort((a, b) => a.s - b.s);

    /* unlocks: each unlock lasts until the next screen-off */
    const sc = evs.filter(e => ['unlock', 'screenOn', 'screenOff', 'shutdown'].includes(e.k)).sort((a, b) => a.t - b.t || (ORDER[a.k] ?? 9) - (ORDER[b.k] ?? 9));
    const hasUnlock = sc.some(e => e.k === 'unlock');
    const openKind = hasUnlock ? 'unlock' : 'screenOn';
    const CL = []; let open = null;
    sc.forEach(e => {
      if (e.k === openKind) { if (!open) { open = { st: e.t }; } }
      else if (e.k === 'screenOff' || e.k === 'shutdown') { if (open) { CL.push({ st: open.st, en: e.t }); open = null; } }
    });
    if (open) CL.push({ st: open.st, en: now });
    const clMin = CL.filter(c => c.en > start).map(c => ({ s: Math.max(0, Math.floor((Math.max(c.st, start) - start) / MIN)), e: Math.max(1, Math.ceil((Math.min(c.en, dayEnd) - start) / MIN)), st: c.st }))
      .filter(c => c.s < DAY_MIN && c.st >= start);
    const UH = new Array(24).fill(0); clMin.forEach(c => UH[Math.floor(c.s / 60)]++);
    clMin.forEach(c => { const f = SESS.find(x => x.ms >= c.st - 2000 && x.ms <= c.st + (c.e - c.s) * MIN); if (f) f.unl = true; });
    const UNL = clMin.length;
    const NOTIF_BY = APPS.map(() => 0);
    (raw.notifications || []).forEach(n => { if (n && n.t >= start && n.t <= now && ids.has(n.app)) NOTIF_BY[ids.get(n.app)]++; });
    APPS.forEach((a, i) => { a.nf = NOTIF_BY[i]; });
    const NOTIF = NOTIF_BY.reduce((a, b) => a + b, 0);
    const LONGEST = Math.max(0, ...clMin.map(c => c.e - c.s));
    const FIRST = clMin.length ? clMin[0].s : 0, LASTUSE = clMin.length ? clMin[clMin.length - 1].e : 0;
    const gaps = clMin.slice(1).map((c, i) => c.s - clMin[i].e);
    const DETOX = Math.max(0, NOW - LASTUSE, ...gaps);
    const CHECK = UNL ? Math.round((NOW - FIRST) / UNL) : 0;

    /* ---- history: week / month / year ---- */
    const hist = (raw.history || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const byDate = new Map(hist.map(h => [h.date, h]));
    const todayKey = ymd(now);
    const todayApps = {}; APPS.forEach(a => { if (a.t > 0) todayApps[a.id] = a.t; });
    byDate.set(todayKey, { date: todayKey, total: TODAY, unlocks: UNL, apps: todayApps });
    const dayRec = off => byDate.get(ymd(addDays(now, off))) || null;      // off <= 0
    const series = (n, f) => Array.from({ length: n }, (_, i) => { const r = dayRec(i - (n - 1)); return r ? Math.round(f(r)) : 0; });
    const WEEK = series(7, r => r.total), MONTH = series(30, r => r.total);
    const WU = series(7, r => r.unlocks || 0), MU = series(30, r => r.unlocks || 0);
    const PREV = Array.from({ length: 7 }, (_, i) => dayRec(-13 + i)).reduce((s, r) => s + (r ? r.total : 0), 0);
    const havePrev = Array.from({ length: 7 }, (_, i) => dayRec(-13 + i)).some(Boolean);
    const YEAR = [], YU = [], YMON = [];
    const cur = new Date(now);
    for (let k = 11; k >= 0; k--) {
      const y = new Date(cur.getFullYear(), cur.getMonth() - k, 1), key = y.getFullYear() + '-' + pad(y.getMonth() + 1);
      let tot = 0, un = 0, n = 0;
      byDate.forEach((r, d) => { if (d.startsWith(key)) { tot += r.total; un += r.unlocks || 0; n++; } });
      YEAR.push(n ? Math.round(tot / n) : 0); YU.push(n ? Math.round(un / n) : 0); YMON.push(key);
    }
    /* per-app totals for week / month  (used by Week and Month screens) */
    const sumApps = n => { const o = {}; for (let i = 0; i < n; i++) { const r = dayRec(-i); if (r && r.apps) for (const k in r.apps) o[k] = (o[k] || 0) + r.apps[k]; } return o; };
    const RANGE = { day: todayApps, week: sumApps(7), month: sumApps(30) };
    const appKnown = new Set(APPS.map(a => a.id));
    /* an app that has history but is not installed any more is a deleted app. Its numbers come from the history, never from a guess. */
    const meta = new Map();
    (raw.deleted || []).forEach(d => { if (d && d.id && !appKnown.has(d.id)) meta.set(d.id, d); });
    (raw.known || []).forEach(k => { if (k && k.id && !appKnown.has(k.id) && !meta.has(k.id)) meta.set(k.id, k); });
    byDate.forEach(r => Object.keys(r.apps || {}).forEach(id => { if (!appKnown.has(id) && !meta.has(id)) meta.set(id, { id }); }));
    const delStats = id => {
      let life = 0, from = null, last = null, pk = { min: 0, date: null }, wk = 0, mo = 0;
      byDate.forEach((r, d) => { const v = (r.apps && r.apps[id]) || 0; if (!v) return; life += v; if (!from || d < from) from = d; if (!last || d > last) last = d; if (v > pk.min) pk = { min: v, date: d }; });
      for (let i = 0; i < 30; i++) { const r = dayRec(-i), v = (r && r.apps && r.apps[id]) || 0; if (i < 7) wk += v; mo += v; }
      let h = null;
      if (from && last && from < last) {      // 20 equal slices between install and removal
        const t0 = new Date(from + 'T12:00:00').getTime(), t1 = new Date(last + 'T12:00:00').getTime(), n = 20; h = new Array(n).fill(0);
        byDate.forEach((r, d) => { const v = (r.apps && r.apps[id]) || 0; if (!v) return; const k = Math.min(n - 1, Math.floor((new Date(d + 'T12:00:00').getTime() - t0) / (t1 - t0 + 1) * n)); h[k] += v; });
      }
      return { life, from, last, pk, wk, mo, h };
    };
    const DELETED = [...meta.values()].map(d => {
      const st = delStats(d.id), nm = d.name || d.n || tail(d.id);
      return { id: d.id, n: nm, cat: d.category || d.cat || 'Other', g: initials(nm), icon: null, c: 'var(--so)',
        from: niceDate(st.from || d.from), last: niceDate(st.last || d.last),
        life: Math.round(st.life || d.lifeMin || d.life || 0), wk: Math.round(st.wk), mo: Math.round(st.mo),
        peak: st.pk.min ? fmMin(st.pk.min) + ' on ' + niceDate(st.pk.date) : (typeof d.peak === 'string' ? d.peak : ''),
        notes: d.notes || 'Uninstalled', hist: st.h };
    }).filter(d => d.life > 0).sort((a, b) => b.life - a.life);

    return {
      NOW, APPS, DELETED, MM, PG, BG, BGL, SESS, HM, AH, UH, CL: clMin.map(c => ({ s: c.s, e: c.e })), UNL, TODAY, NOTIF, LONGEST, FIRST, LASTUSE, DETOX, CHECK,
      WEEK, PREV, HAVE_PREV: havePrev, MONTH, YEAR, YMON, WU, MU, YU, RANGE, HIST_DAYS: byDate.size, start, now, mode: raw.mode || 'sample',
      SITE: raw.siteMinutes || {}, PAUSE: { tries: (raw.pause && raw.pause.tries) || 0, saved: (raw.pause && raw.pause.savedMin) || 0 }
    };
  }

  /* one finished day -> the small record that is kept for ever: { date, total, unlocks, apps:{id:minutes} } */
  function rollupDay(raw, dayTs) {
    const start = dayStart(dayTs), now = start + DAY_MIN * MIN - 1;
    const apps = [...(raw.apps || []), ...(raw.known || [])];
    const m = build({ now, apps, events: (raw.events || []).filter(e => e.t <= now), notifications: raw.notifications || [], history: [] });
    const out = {}; m.APPS.forEach(a => { if (a.t > 0) out[a.id] = a.t; });
    return { date: ymd(start), total: m.TODAY, unlocks: m.UNL, apps: out };
  }

  function clampMin(m) { return Math.max(0, Math.min(DAY_MIN - 1, m)); }
  function tail(id) { const p = String(id).split('.'); return p[p.length - 1] || String(id); }
  function initials(n) { const w = String(n).trim().split(/\s+/).filter(Boolean); if (!w.length) return '?'; return (w.length > 1 ? w[0][0] + w[1][0] : String(n).slice(0, 2)).replace(/^./, c => c.toUpperCase()); }
  function fmMin(m) { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? h + 'h ' + pad(r) + 'm' : r + 'm'; }
  function niceDate(s) { if (!s) return ''; if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const [y, m, d] = s.split('-').map(Number); return d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]; }

  return { build, emptyModel, rollupDay, intervals, roundSum, dayStart, ymd, addDays, fmMin, MIN };
});
