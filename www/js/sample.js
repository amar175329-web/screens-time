/* Screens Time - sample data.
   Used when the app runs in a browser (no phone). It does NOT build screens by itself: it only invents RAW events
   (app opened, app closed, screen off, unlock, page title, notification) and hands them to Engine.build(),
   exactly like the phone does. So the demo exercises the same maths as real data.
   Modes: 'sample' (a normal day), 'stress' (70 apps, long names, hundreds of sessions), 'empty' (nothing used yet). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.Sample = factory(root.Engine);
})(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hashStr = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  /* original stand-in icons (drawn here, no brand artwork). On a phone the real icon of each app is used instead. */
  const ICONSPEC = {
    'com.server.auditor.ssh.client': ['#3f52d4', '#2c3cae', '<path d="M30 34l18 14-18 14"/><path d="M54 64h16"/>'],
    'com.anthropic.claude': ['#e0693f', '#c9532c', '<path d="M48 22c2 15 9 22 24 26-15 4-22 11-24 26-2-15-9-22-24-26 15-4 22-11 24-26z" fill="#fff" stroke="none"/>'],
    'com.instagram.android': ['#e0357d', '#c42266', '<path d="M48 70C27 56 25 44 31 37c5-6 14-4 17 3 3-7 12-9 17-3 6 7 4 19-17 33z" fill="#fff" stroke="none"/>'],
    'com.android.chrome': ['#f5a300', '#dd8a00', '<circle cx="48" cy="48" r="22"/><path d="M26 48h44M48 26c-11 13-11 31 0 44M48 26c11 13 11 31 0 44"/>'],
    'com.whatsapp': ['#27ad62', '#1b8f4e', '<path d="M28 32h40a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H46l-12 10V62h-6a6 6 0 0 1-6-6V38a6 6 0 0 1 6-6z"/>'],
    'com.google.android.youtube': ['#e5322d', '#c41f1a', '<path d="M38 28l32 20-32 20z" fill="#fff" stroke="none"/>'],
    'com.google.android.dialer': ['#2f8fe6', '#1f6fc2', '<path d="M30 28l11 3-3 12-7 3c4 9 10 15 19 19l3-7 12-3 3 11c-2 8-10 12-22 8-16-6-26-20-22-35 1-4 3-8 6-11z" fill="#fff" stroke="none"/>'],
    'com.example.notes': ['#86b81e', '#6c9a12', '<path d="M30 34h36M30 48h36M30 62h22"/>'],
    'com.google.android.gm': ['#d9382d', '#b92a20', '<rect x="26" y="32" width="44" height="32" rx="5"/><path d="M28 36l20 16 20-16"/>'],
    'com.google.android.apps.photos': ['#8f5cd8', '#7342bd', '<circle cx="37" cy="37" r="5" fill="#fff" stroke="none"/><path d="M24 70l17-21 10 12 8-9 13 18z" fill="#fff" stroke="none"/>'],
    'com.android.settings': ['#6d7f8c', '#566772', '<circle cx="48" cy="48" r="10"/><path d="M48 24v8M48 64v8M24 48h8M64 48h8M31 31l6 6M59 59l6 6M31 65l6-6M59 37l6-6"/>'],
    'com.android.vending': ['#14a9bb', '#0d8898', '<path d="M28 38h40l-3 30H31z"/><path d="M38 38c0-15 20-15 20 0"/>'],
    'com.android.camera': ['#3b4d56', '#27363d', '<rect x="24" y="34" width="48" height="32" rx="7"/><circle cx="48" cy="50" r="8"/>'],
    'com.google.android.deskclock': ['#8d6e63', '#6f5249', '<circle cx="48" cy="48" r="22"/><path d="M48 34v15l10 6"/>'],
    'com.spotify.music': ['#1fae5a', '#14803f', '<path d="M26 40c14-4 30-3 44 4M29 52c11-3 23-2 34 3M32 63c8-2 16-1 24 2"/>']
  };
  const iconURI = ([a, b, g]) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="96" height="96" rx="24" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`);

  /* t = minutes today (target), m = typical visit length, nf = notifications */
  const BASE = [
    { id: 'com.server.auditor.ssh.client', name: 'Termius', category: 'Productivity', t: 74, m: 12, nf: 4, pg: ['ssh prod-api-01', 'ssh build-box', 'SFTP /var/log', 'ssh staging-db'] },
    { id: 'com.anthropic.claude', name: 'Claude', category: 'Productivity', t: 58, m: 9, nf: 3, pg: ['Chat: Screens Time app', 'Artifact preview', 'New chat', 'Chat: debug SSH'] },
    { id: 'com.instagram.android', name: 'Instagram', category: 'Social', t: 52, m: 5, nf: 33, pg: ['Reels', 'Home feed', 'Direct messages', 'Explore', 'Profile'] },
    { id: 'com.android.chrome', name: 'Chrome', category: 'Browser', t: 33, m: 5, nf: 5, pg: ['github.com/pulls', 'news.ycombinator.com', 'docs.python.org', 'stackoverflow.com'] },
    { id: 'com.whatsapp', name: 'WhatsApp', category: 'Social', t: 31, m: 3, nf: 48, pg: ['Chat: Rahul', 'Group: Office', 'Status', 'Calls'] },
    { id: 'com.google.android.youtube', name: 'YouTube', category: 'Video', t: 27, m: 7, nf: 12, pg: ['Watch: lo-fi coding mix', 'Shorts', 'Search', 'Subscriptions'] },
    { id: 'com.google.android.dialer', name: 'Phone', category: 'System', system: true, t: 22, m: 4, nf: 6, pg: ['Call: Rahul', 'Dialer', 'Call: Mom'] },
    { id: 'com.example.notes', name: 'My Note', category: 'Productivity', t: 17, m: 4, nf: 2, pg: ['Note: kal ka plan', 'Checklist', 'Reminders'] },
    { id: 'com.google.android.gm', name: 'Gmail', category: 'Productivity', t: 14, m: 3, nf: 22, pg: ['Inbox', 'Compose', 'Thread: invoice'] },
    { id: 'com.google.android.apps.photos', name: 'Photos', category: 'System', system: true, t: 13, m: 4, nf: 3, pg: ['Library', 'Screenshots', 'Albums'] },
    { id: 'com.android.settings', name: 'Settings', category: 'System', system: true, t: 11, m: 3, nf: 4, pg: ['Digital Wellbeing', 'Wi-Fi', 'Battery'] },
    { id: 'com.android.vending', name: 'Play Store', category: 'System', system: true, t: 9, m: 3, nf: 6, pg: ['Search: screen time', 'Updates'] },
    { id: 'com.spotify.music', name: 'Spotify', category: 'Music', t: 5, m: 3, nf: 1, pg: ['Now playing', 'Library'] },
    { id: 'com.android.camera', name: 'Camera', category: 'System', system: true, t: 7, m: 2, nf: 0, pg: ['Photo', 'Video'] },
    { id: 'com.google.android.deskclock', name: 'Clock', category: 'System', system: true, t: 6, m: 2, nf: 2, pg: ['Alarm', 'Timer'] }
  ];
  const DELETED_META = [
    { id: 'com.skydash.game', name: 'Sky Dash', category: 'Games', notes: 'Game, uninstalled', fromOff: -240, lastOff: -11, daily: 34 },
    { id: 'com.cricketlive.app', name: 'Cricket Live', category: 'Video', notes: 'Sports, uninstalled', fromOff: -200, lastOff: -50, daily: 14 },
    { id: 'com.reeleditor.app', name: 'Reel Editor', category: 'Productivity', notes: 'Video editor, uninstalled', fromOff: -80, lastOff: -66, daily: 12 }
  ];
  const WORDS = ['Atlas', 'Bolt', 'Cedar', 'Drift', 'Echo', 'Fable', 'Grove', 'Halo', 'Iris', 'Jade', 'Kite', 'Lumen', 'Mango', 'Nova', 'Orbit', 'Pixel', 'Quill', 'Ripple', 'Sage', 'Tide'];
  const CATS = ['Social', 'Video', 'Productivity', 'Browser', 'Games', 'Music', 'News', 'Shopping', 'Maps', 'Finance', 'Health', 'Education'];

  function stressApps() {
    const r = rng(77), out = BASE.map(a => ({ ...a }));
    const long = ['A Very Long Application Name That Should Be Cut Neatly Without Breaking The Row', 'Раскладка клавиатуры', '日本語のアプリ', 'App with <b>tags</b> & "quotes"', 'ऐप का नाम बहुत लंबा है'];
    for (let i = 0; i < 55; i++) {
      const nm = i < long.length ? long[i] : WORDS[i % WORDS.length] + ' ' + WORDS[(i * 7 + 3) % WORDS.length];
      out.push({ id: 'com.stress.app' + i, name: nm, category: CATS[i % CATS.length], t: 1 + Math.floor(r() * 22), m: 1 + Math.floor(r() * 6), nf: Math.floor(r() * 18), pg: ['Home', 'Page two with a long title that goes on and on for a while', 'Settings', 'Search results for "' + nm.slice(0, 6) + '"'] });
    }
    return out;
  }

  /* the sample day: one slot per minute, filled deterministically, then turned into events */
  function plan(apps, nowMin, seed, hw) {
    const r = rng(seed), MM = new Int16Array(1440).fill(-1), PG = new Int16Array(1440);
    const hs = hw.reduce((a, b) => a + b, 0);
    const pick = () => { let x = r() * hs; for (let h = 0; h < 24; h++) { x -= hw[h]; if (x <= 0) return h; } return 21; };
    apps.map((a, i) => i).sort((a, b) => apps[b].t - apps[a].t).forEach(i => {
      const a = apps[i]; let rem = a.t, guard = 0;
      while (rem > 0 && guard++ < 600) {
        let d = Math.min(rem, 1 + Math.floor(r() * a.m * 2));
        const s = pick() * 60 + Math.floor(r() * 60);
        if (s + d > nowMin) continue;
        let k = 0; while (k < d && MM[s + k] < 0) k++;
        if (!k) continue;
        d = Math.min(d, k); const p = Math.floor(r() * a.pg.length);
        for (let j = 0; j < d; j++) { MM[s + j] = i; PG[s + j] = p; }
        rem -= d;
      }
      for (let s = 7 * 60; rem > 0 && s < nowMin; s++) if (MM[s] < 0) { MM[s] = i; PG[s] = 0; rem--; }
    });
    return { MM, PG, r };
  }

  function raw(opts) {
    opts = opts || {};
    const mode = opts.mode || 'sample';
    const today = Engine.dayStart(opts.now != null ? opts.now : Date.now());
    const NOWM = 21 * 60 + 23, now = opts.now != null ? opts.now : today + NOWM * 60000 + 20000;
    const nowMin = Math.floor((now - today) / 60000);
    const apps = mode === 'stress' ? stressApps() : BASE.map(a => ({ ...a }));
    const out = {
      now, mode: 'sample', events: [], pages: [], background: [], notifications: [], history: [], deleted: [],
      apps: apps.map(a => ({ id: a.id, name: a.name, category: a.category, system: !!a.system, icon: ICONSPEC[a.id] ? iconURI(ICONSPEC[a.id]) : null })),
      siteMinutes: { 'youtube.com': 8.5 }, pause: { tries: 6, savedMin: 14 }
    };
    if (mode === 'empty') {
      out.apps = out.apps.slice(0, 6); out.events.push({ t: today + 6 * 3600000, k: 'screenOff' });
      return out;
    }
    const hw = [0, 0, 0, 0, 0, 0, 0, .4, 1.5, 1.6, 1.1, .8, 1, 1.3, .9, .8, .9, 1.1, 1.3, 1.4, 1.6, 1.9, 0, 0];
    if (mode === 'stress') for (let h = 0; h < 24; h++) hw[h] = hw[h] || .3;
    const { MM, PG, r } = plan(apps, nowMin, mode === 'stress' ? 23 : 11, hw);

    /* runs of the same app (any page) -> one visit */
    const visits = [];
    for (let s = 0; s <= nowMin;) {
      if (MM[s] < 0) { s++; continue; }
      let e = s; while (e + 1 <= nowMin && MM[e + 1] === MM[s]) e++;
      visits.push({ a: MM[s], s, e: e + 1 }); s = e + 1;
    }
    /* unlocks: visits with 3 or fewer idle minutes between them belong to one unlock */
    const clusters = []; let cur = null;
    visits.forEach(v => { if (cur && v.s - cur.e <= 4) { cur.v.push(v); cur.e = v.e; } else { cur = { s: v.s, e: v.e, v: [v] }; clusters.push(cur); } });
    const T = m => today + m * 60000;
    clusters.forEach(c => {
      out.events.push({ t: T(c.s) - 4000 - Math.floor(r() * 3000), k: 'screenOn' }, { t: T(c.s) - 2000, k: 'unlock' });
      c.v.forEach((v, i) => {
        const id = apps[v.a].id, st = T(v.s) + Math.floor(r() * 9000), en = Math.min(now - 1000, T(v.e) - Math.floor(r() * 9000) - 1);
        out.events.push({ t: st, k: 'fg', app: id }, { t: Math.max(st + 3000, en), k: 'bg', app: id });
        let last = null;
        for (let m = v.s; m < v.e; m++) if (PG[m] !== last) { last = PG[m]; out.pages.push({ t: m === v.s ? st : T(m) + 1000, app: id, title: apps[v.a].pg[PG[m]] }); }
      });
      out.events.push({ t: Math.min(now - 500, T(c.e) + 12000 + Math.floor(r() * 8000)), k: 'screenOff' });
    });
    /* notifications */
    apps.forEach(a => { for (let i = 0; i < a.nf; i++) out.notifications.push({ t: T(420 + Math.floor(r() * Math.max(1, nowMin - 420))), app: a.id }); });
    /* music keeps playing with the screen off */
    if (mode !== 'stress') [[485, 18], [790, 9], [1110, 14]].forEach(([s, d]) => out.background.push({ app: 'com.spotify.music', s: T(s), e: T(s + d) }));

    /* history: one record per past day, apps add up to the total */
    const days = mode === 'stress' ? 400 : 365, rd = rng(5);
    const W6 = [312, 401, 289, 455, 348, 428], P7 = [380, 402, 371, 395, 360, 412, 420], U6 = [58, 64, 49, 71, 60, 66];
    const wts = apps.map(a => a.t), wsum = wts.reduce((a, b) => a + b, 0);
    for (let off = -days; off <= -1; off++) {
      const d = new Date(today + 12 * 3600000); d.setDate(d.getDate() + off);
      const date = Engine.ymd(d.getTime());
      let total = off >= -6 ? W6[off + 6] : off >= -13 ? P7[off + 13] : Math.round(300 + rd() * 170);
      const unlocks = off >= -6 ? U6[off + 6] : Math.round(38 + rd() * 46);
      const wv = apps.map((a, i) => wts[i] * (.7 + (hashStr(date + a.id) % 600) / 1000));
      DELETED_META.forEach(x => { if (off >= x.fromOff && off <= x.lastOff) wv.push(x.daily * (.5 + (hashStr(date + x.id) % 1000) / 1000)); else wv.push(0); });
      const vals = Engine.roundSum(wv.map(v => v / wv.reduce((a, b) => a + b, 0) * total));
      const am = {};[...apps, ...DELETED_META].forEach((a, i) => { if (vals[i] > 0) am[a.id] = vals[i]; });
      out.history.push({ date, total, unlocks, apps: am });
    }
    out.deleted = DELETED_META.map(x => ({ id: x.id, name: x.name, category: x.category, notes: x.notes }));
    return out;
  }

  /* settings a first-time demo user would already have */
  function config() {
    return {
      limits: [
        { id: 'l1', kind: 'app', app: 'com.instagram.android', min: 45, on: true, remind: 10 },
        { id: 'l2', kind: 'app', app: 'com.google.android.youtube', min: 30, on: true, remind: 5 },
        { id: 'l3', kind: 'site', site: 'youtube.com', min: 7, on: true, remind: 5 }
      ],
      sched: [
        { id: 'sc1', name: 'Work hours', days: [0, 1, 1, 1, 1, 1, 0], all: false, start: '09:00', end: '18:00', apps: ['com.instagram.android', 'com.google.android.youtube', 'com.whatsapp'], on: true },
        { id: 'sc2', name: 'Wind-down', days: [1, 1, 1, 1, 1, 1, 1], all: false, start: '22:30', end: '07:00', apps: ['com.instagram.android', 'com.google.android.youtube', 'com.android.chrome'], on: false }
      ],
      flags: { shorts: true, igreels: true },
      keywords: ['betting', 'crypto pump', 'ipl spoilers'], sites: ['youtube.com', 'reddit.com'],
      acts: [{ n: 'Working', m: 215 }, { n: 'Reading', m: 62 }, { n: 'Studying', m: 38 }, { n: 'Writing', m: 45 }]
    };
  }

  return { raw, config, ICONSPEC, iconURI };
});
