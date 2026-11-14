# Data contract

The screens never read Android directly. They read a **model** made by `Engine.build(raw)`.
`raw` comes from `Data.load()`: the Android plugin on a phone, `Sample.raw()` in a browser.
If you give the engine real events in this shape, every screen fills in with real numbers.

## raw

```js
{
  now: 1731400000000,                     // epoch ms
  mode: 'native' | 'sample' | 'stress' | 'empty',
  apps:   [{ id:'com.instagram.android', name:'Instagram', category:'Social',
             icon:'data:image/png;base64,...',   // optional; the phone side sends it via getIcons()
             sys:false }],                       // sys = system app (hidden from pickers unless used)
  known:  ['com.instagram.android', ...],        // every package ever seen (to detect deleted apps)
  deleted:[{ id, name, category, notes }],       // optional extra info on removed apps
  events: [{ t:ms, k:'screenOn'|'unlock'|'fg'|'bg'|'screenOff'|'shutdown', app?:'pkg' }],
  background: [{ app, s:ms, e:ms }],             // music / calls that run while the screen is off or another app is in front
  pages:  [{ t:ms, app, title }],                // optional "what was open" lines (e.g. Reels, Home feed)
  notifications: [{ t:ms, app }],
  history: [{ date:'YYYY-MM-DD', total:min, unlocks:n, apps:{ pkg:min } }],   // finished days, kept for ever
  siteMinutes: { 'youtube.com': 8.5 },           // today
  pause: { tries:n, savedMin:n }                 // times the person closed an app during the countdown (last 24 h)
}
```

### Rules (engine.js)

| Rule | Value |
|---|---|
| `fg` opens a visit; `bg` of the same app, `fg` of another app, `screenOff`, `shutdown` closes it | |
| A visit is never longer than | 4 h without a new event |
| `fg` / `bg` flicker inside one app (merge) | under 3 s |
| Shortest visit counted | 2 s |
| Per-minute "main app" needs at least | 5 s inside that minute |
| Rounding | largest remainder, so apps add up to the day total and hours add up to the day total |
| Unlock | `unlock` event (or `screenOn` if the device sends no unlock) until the next `screenOff` |
| Unknown packages | close the previous visit but are not counted |
| Deleted app | an id in `history` or `known` that is no longer in `apps`: its history stays |

## Plugin (Capacitor, name `ScreensTime`)

| Method | In | Out |
|---|---|---|
| `status()` | | `{usage, notif, a11y, sdk}` booleans for the three permissions |
| `getData({since?})` | epoch ms (optional) | `raw` without `mode` |
| `saveRollups({days})` | `[{date,total,unlocks,apps}]` | stores finished days in SQLite (Android keeps events only 7-10 days) |
| `getIcons({ids})` | package ids | `{icons:{pkg:'data:image/png;base64,...'}}` 96 px, cached by the app |
| `getConfig()` / `setConfig({json})` | settings JSON | the same JSON the background services read |
| `openSettings({which})` | `usage` `notif` `a11y` `appinfo` `battery` | opens that Android settings screen |

## Settings JSON (`st_cfg_v2` in localStorage, mirrored to Android)

```js
{ goal:420, ugoal:60,                                   // daily goals in minutes / unlocks
  limits:[{ id, kind:'app'|'site', app?|site?, min, on, remind }],
  sched:[{ id, name, days:[0..6 as 0/1, Sunday first], all:bool, start:'HH:MM', end:'HH:MM', apps:[pkg], on }],
  flags:{ shorts, igreels, pause, pin ... },             // pause = countdown before apps that have a limit
  keywords:['word'], sites:['example.com'],
  bstyle:'minimal'|'gif'|'quote', pauseSec:3..30,
  muted:{ pkg:true },                                    // notifications to silence
  ch:{...} }                                             // detox challenge (apps locked until it ends)
```
