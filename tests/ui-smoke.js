/* Click-through smoke test. Needs Playwright (npm i -D playwright). Run: node tests/ui-smoke.js [outDir]
   Opens the app in three data modes, visits every screen, taps the main controls, and fails on any page error. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const url = m => 'file://' + path.resolve(__dirname, '../www/index.html') + (m ? '?data=' + m : '');
const out = process.argv[2] || path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const [w, h] of [[390, 844], [360, 740]]) for (const mode of ['sample', 'stress', 'empty']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push('pageerror ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errs.push('console ' + m.text()); });
    await p.goto(url(mode)); await p.waitForTimeout(2100);
    if (await p.$('#intro:not([hidden])')) { await p.click('[data-act=introdone]'); await p.waitForTimeout(900) }
    const shot = n => p.screenshot({ path: `${out}/${mode}_${w}_${n}.png` });
    const click = async s => { const e = await p.$(s); if (e) { await e.click(); await p.waitForTimeout(250); return true } return false };
    const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(200) };
    await shot('today');
    for (const r of ['week', 'month', 'day']) { await click(`[data-act=range][data-v=${r}]`); if (r !== 'day') await shot(r); }
    await click('[data-act=allapps]'); await shot('allapps'); await click('[data-act=pgclose]');
    await click('[data-act=app]'); await shot('app'); await esc();
    await click('[data-act=notif]'); await esc();
    await click('[data-act=goaledit]'); await click('[data-act=goalstep][data-d="15"]'); await esc();
    for (const k of [0, 1, 2]) { await click(`[data-act=tab][data-v=today]`); await click(`[data-act=part][data-v="${k}"]`); await shot('time' + k); await click('[data-act=hrtoggle]'); }
    for (let i = 0; i < 3; i++) { const hb = await p.$$('[data-act=hbar]'); if (hb[i]) { await hb[i].click(); await p.waitForTimeout(150) } }
    await click('[data-act=tab][data-v=limits]'); await shot('limits');
    await click('[data-act=limedit]'); await shot('limsheet'); await click('[data-act=limsave]');
    await click('[data-act=limadd]'); await click('[data-act=limsave]');
    for (const v of ['sched', 'feeds', 'words', 'look']) { await click(`[data-act=lpage][data-v=${v}]`); await shot('lp_' + v); await click('[data-act=pgclose]'); }
    await click('[data-act=tab][data-v=focus]'); await click('[data-act=fstart]'); await shot('focus'); await click('[data-act=freset]');
    await click('[data-act=chstart]'); await click('[data-act=chcancel]');
    await click('[data-act=tab][data-v=insights]'); await shot('insights');
    for (const r of ['month', 'year', 'week']) await click(`[data-act=irange][data-v=${r}]`);
    await click('[data-act=more]'); await shot('settings'); await click('[data-act=pgclose]');
    const bad2 = await p.evaluate(() => { const o = []; document.querySelectorAll('#view *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1) o.push(e.className + ':' + Math.round(r.right)) }); return o.slice(0, 5) });
    if (bad2.length) errs.push('overflow ' + bad2.join(' | '));
    console.log(mode, w, errs.length ? 'FAIL\n  ' + errs.join('\n  ') : 'ok'); bad += errs.length; await ctx.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
