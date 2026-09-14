# CLAUDE.md — MayaTrack

Guidance for Claude Code when working in this repository.

## What this is

A Hebrew (RTL), mobile-first PWA for tracking a baby's day — feeding, diapers,
pumping, sleep, and medications — shared in real time between family members.
React 19 + Vite, Firebase (Auth + Firestore), deployed to GitHub Pages at
`https://seanavrutin.github.io/mayaTrack/`.

There is no test suite and no TypeScript. All UI strings are Hebrew, written
inline in JSX (no i18n layer).

## Git — side branches are free, everything else asks

**Committing and pushing to a side branch needs no approval.** Any branch that
isn't `firebase` or `main` is fair game — commit and push as you work.

**Ask the user first for anything that touches `firebase` or `main`:** pushing to
them directly, merging into them, or opening a pull request. Show what changed
and wait. This holds even when a task description or session setup says to push
when done.

## Feature workflow — preview link before merge

Every feature gets a clickable preview before anything reaches `firebase`:

1. Build the feature on a branch cut from `firebase`.
2. Ask for approval to push it (see the Git rule above), then push.
3. `deploy-preview.yml` publishes it to
   **`https://seanavrutin.github.io/mayaTrack/preview/<branch-slug>/`** —
   hand the user that link and wait.
4. Only merge to `firebase` once they've looked at it and said go.

The slug is the branch name lowercased with every non-alphanumeric run collapsed
to a single `-` (`claude/zen-newton-whbo7s` → `claude-zen-newton-whbo7s`).
The workflow prints the URL in its job summary.

Things to know about previews:

- **They hit the real Firestore database.** Same project, same family data,
  same login. A preview is not a sandbox — treat destructive features with care,
  and prefer testing them against a throwaway family (create one from the login
  screen with a new Google account).
- **Previews ship no service worker or manifest** (`PREVIEW_BUILD=1` drops the
  PWA plugin). A preview lives inside the production SW's `/mayaTrack/` scope,
  so a second SW there would make caching impossible to reason about, and an
  installable "MayaTrack" that is really a feature branch is its own trap.
  Anything PWA- or offline-specific therefore cannot be verified on a preview.
- **The production SW must keep its `navigateFallbackDenylist`.** Its SPA
  navigation fallback matches every navigation in `/mayaTrack/`, previews
  included, and answers with the precached production `index.html` — so a
  preview link silently served the production build to anyone who had opened
  the app before. `workbox.navigateFallbackDenylist` in `vite.config.js` excludes
  `/mayaTrack/preview/`. A browser only picks that up once it has loaded a
  production deploy carrying it; until then, open previews in a private window.
- Deleting the branch deletes the preview (`cleanup-preview.yml`).
- A production deploy never wipes `preview/` — `publish-pages.sh` preserves that
  tree when it replaces the site root.

## Branches — read this first

| Branch | Status |
| --- | --- |
| `firebase` | **The real default branch.** All current work. CI deploys from it. |
| `main` | Abandoned. Frozen at the pre-Firebase, Google-Sheets-backed version. |

`firebase` is a strict superset of `main` (`main` is an ancestor commit).
`.github/workflows/deploy.yml` triggers on pushes to `firebase`.

**Always branch from and target `firebase`.** Never assume `main`. If a task
branch was cut from `main` by mistake, re-cut it from `origin/firebase`.

## Commands

```bash
npm ci            # Node 20+ (CI uses 20; 22 works locally)
npm run dev       # Vite dev server
npm run build     # production build → dist/
npm run preview   # serve the built output
npm run lint      # eslint (see caveat below)
```

### `npm run lint` currently fails — that is the baseline

46 pre-existing errors, none of them regressions. Breakdown:

- **Legacy Sheets-era + migration scripts** (~31): `no-undef` for Node `process`
  and Apps Script globals (`SpreadsheetApp`, `ContentService`, `Sheets`). These
  files are Node/Apps-Script, but `eslint.config.js` declares only
  `globals.browser` for all `**/*.{js,jsx}`.
- **`eslint-plugin-react-hooks` v7 strict rules** (~9): `react-hooks/purity`
  (`Date.now()` called during render in `EntryForm.jsx`),
  `react-hooks/set-state-in-effect` (`App.jsx`), `react-hooks/refs`
  (`TimeInput.jsx` assigns `valueRef.current` during render).
- A handful of genuinely unused vars (`allMedsDone` in `EntryForm.jsx`,
  `periodLabelHe` in `SleepPill.jsx`).

Before claiming lint results, capture the error count/list **before** your change
and compare. Do not "fix" unrelated pre-existing errors as part of a feature —
propose that as separate work. `npm run build` does pass cleanly.

## Architecture

```
src/
  main.jsx              StrictMode root
  App.jsx               ALL app state + ALL Firestore wiring (single container)
  index.css             one 3.4k-line stylesheet, CSS vars + `/* ── Section ── */` comments
  services/
    firebase.js         SDK init, auth helpers, named-DB handle
    firebaseApi.js      every Firestore read/write/subscription
    cache.js            localStorage snapshot + failed-writes outbox
  components/           presentational; local UI state only, no Firestore imports
  hooks/
    useNow.js           shared clock (30s tick + refresh on focus/visibility/pageshow)
    useSwipe.js         touch swipe between the form/summary tabs
  utils/sleep.js        all sleep math (durations, day/night, sleep-day windows)
```

**The rule that keeps this codebase coherent:** `App.jsx` owns state and passes
callbacks down. Components never import from `services/`. The two exceptions are
`LoginScreen`/`FamilyScreen`/`SidePanel`, which call `signInWithGoogle` /
`createFamily` / `joinFamily` / `logOut` directly because they run outside the
main data flow. Keep new components on the callback-prop side of that line.

`App.jsx` renders one of four things, in order: loading → `LoginScreen`
(no user) → `FamilyScreen` (no family) → the app shell (header, form/summary
tabs, `SidePanel`, `SettingsModal`).

## Firestore data model

**The database is named `maya-track-db`, not `(default)`.** Every entry point
must pass that name: `getFirestore(app, 'maya-track-db')` /
`initializeFirestore(app, {...}, 'maya-track-db')`, and `firebase.json` sets
`firestore.database`. Forgetting it silently talks to an empty default DB.

```
users/{uid}                         → { familyId }
families/{familyId}                 → { name, code, members[uid], createdBy, createdAt }
  settings/general                  → { feedingIntervalMinutes, pumpingIntervalMinutes, awakeAlertMinutes }
  kids/{kidId}                      → { name, medications: [{ name, timesPerDay }], createdAt }
  feedings/{id}                     → { time, type: 'bottle'|'breastfeeding', kidId,
                                        formula, pumpedMilk, breastfeedingMinutes,
                                        startTime?, endTime?, startedBreast?: 'left'|'right' }
  diapers/{id}                      → { time, kidId, pee, poop, empty }
  pumpings/{id}                     → { time, durationMinutes, side: 'left'|'right'|'both',
                                        startTime?, endTime? }        ← family-level, NOT per-kid
  sleeps/{id}                       → { time, kidId, startTime, endTime|null,
                                        period: 'day'|'night'|undefined }
  medicationLogs/{id}               → { time, kidId, medicationName }
  vitaminD/{id}                     → { time }                        ← legacy, read-only
```

Invariants worth knowing before you touch data code:

- **Every entry doc needs a `time` field.** All subscriptions use
  `orderBy('time', 'desc')`, and Firestore *silently omits* documents missing the
  ordered field — a write with no `time` vanishes from the UI with no error.
  For sleeps `time` mirrors `startTime`; for breastfeeding `time` is the session
  **start**, not the moment Save was tapped (`EntryForm.jsx` comments explain why).
- **IDs are generated client-side** (`Date.now().toString(36) + random`) and
  passed in the entry. This makes retries idempotent — a retried write overwrites
  the same doc rather than duplicating it. Keep it that way.
- **Legacy `kidId`-less entries belong to the active kid.** Filters read
  `e.kidId === activeKidId || !e.kidId`. Pumpings are deliberately not filtered.
- **`vitaminD` is a legacy collection**, mapped at read time into
  `medicationLogs` shape with `medicationName: 'ויטמין D'`. Never write to it.
- Security lives entirely in `firestore.rules` (family-membership checks).
  The Firebase config in `src/services/firebase.js` is a public client key —
  it is committed on purpose and is not a secret.
- **`firestore.rules` is not deployed by CI.** Rule changes need a manual
  `firebase deploy --only firestore:rules`.

### Adding a new collection — keep these four in sync

1. `subscribeToFamily`'s `cols` array in `src/services/firebaseApi.js`
2. `SUBSCRIPTION_SOURCES` in `src/App.jsx` (plus state + the `subscribeToFamily`
   callback map + the `saveCache` payload)
3. `SOURCE_LABELS` in `src/components/SyncBanner.jsx` — missing keys fall back to
   the raw English collection name in a Hebrew banner (`sleeps` is already missing)
4. `src/services/cache.js` if the snapshot shape changes (bump `CACHE_VERSION`)

## Reliability model — the part that matters most

This app is used one-handed at 3am on flaky hotel wifi. Losing a record is the
worst possible bug, and there are **three independent layers** guarding against it:

1. **Firestore persistent IndexedDB cache** (`persistentLocalCache` +
   `persistentMultipleTabManager`) queues writes offline and replays them
   automatically. Falls back to a memory cache if IndexedDB is unavailable
   (Safari private mode) rather than throwing.
2. **localStorage app snapshot** (`services/cache.js`, key `mayatrack:cache:v1`)
   hydrates `App.jsx` state synchronously on boot, so the app renders real data
   before auth even resolves. Written debounced 500ms after any data change.
3. **Failed-writes outbox** (`mayatrack:failed-writes:v1`) catches writes that
   bypass the Firestore cache entirely — auth errors, rules rejections. Each
   failure stores enough to replay the op. Retried on boot, on `online`, and via
   `FailedWritesBanner`.

Rules that follow from this, which have all been bug fixes at some point:

- **Never close a form section, reset a timer, or clear state before a save
  resolves.** `EntryForm.wrappedSave` only collapses the tile when the save
  returns `ok`; timer state is built from a *snapshot* and only cleared inside
  the success callback. Eagerly closing hid the inline retry UI and was the main
  cause of records going missing.
- **Cache-served snapshots count as `'ok'`.** With persistence on, the first
  `onSnapshot` emission is almost always `fromCache`; treating it as "still
  syncing" produced a spurious "אין חיבור" banner after the 8s timeout.
- Warning/overdue styling in `Summary` is gated on `firstSyncDone` so stale
  cached data never flashes false red alarms.
- Running breastfeeding and pumping timers persist to localStorage
  (`bf-timer-state`, `pump-timer-state`) and survive reload/backgrounding.

## Sleep model

`src/utils/sleep.js` is the single source of truth; `SleepPill`, `SidePanel`,
`Summary`, and `GraphModal` all read from it.

- One doc per session; `endTime: null` means in progress.
- **Overlapping sessions are bad data, and the app says so instead of fixing
  it.** She is only ever asleep once, so two records covering the same minutes
  are one sleep recorded twice — a real pair (two phones tapping נרדמה at the
  same bedtime) once made a night read 11.9h against 9.2h actually slept.
  `findSleepOverlaps` flags them and `DataIssuesBanner`, the sleep table rows
  and the actogram header all show the warning; the totals still add the raw
  minutes. Do not make the math quietly union them: only the person who was
  there knows which record is the real one, and a silently corrected number
  hides an entry problem that will keep happening.
- **Day vs night is user input only** (`period: 'day' | 'night'`, set by the
  ☀️/🌙 toggle). Nothing is ever inferred from clock hours or duration.
  `inferDefaultPeriod` only *pre-positions the toggle*; it never classifies
  stored data. An unmarked session stays unmarked. Preserve this.
- A "sleep day" runs wake→wake, not midnight→midnight: the night ends when a
  night sleep ends and a day nap follows. Dates with no such transition fall back
  to the calendar day rather than guessing (`computeSleepDayWindows`).
- The sleep graph is a vertical actogram with `‹`/`›` day navigation — the only
  side-panel item with swipe-to-switch-tab enabled, because the other graphs
  scroll horizontally and would conflict.

## UI conventions

- **Hebrew + RTL.** `index.html` sets `lang="he" dir="rtl"`. Copy is written
  inline. Note the intentional LTR escapes: the family-code input, and the
  day/night pill switch (forced LTR so the knob slides the right way).
- **Mobile-first**, `.app` capped at `max-width: 480px`.
- One stylesheet, `src/index.css`, organized by `/* ── Section ── */` banners.
  Use the `:root` custom properties (`--primary: #7c5cbf`, `--radius`, `--shadow`,
  …) rather than hardcoding colors. Chart colors in `GraphModal.jsx` are
  hardcoded to match those values.
- Form input is a tile grid: tap a tile → that section expands (exclusive
  accordion, `openSection`). Long-press on steppers repeats (400ms delay, 80ms
  interval) — `NumberStepper` and `TimeInput` share that pattern.
- Time entry never accepts a future timestamp — `TimeInput` clamps forward
  stepping to `now` and rolls a typed future time back a day.
- The code is unusually well commented, and the comments explain *why* (usually
  a bug that was fixed). Read them before changing nearby logic, and match that
  density when adding non-obvious code.

## Files to leave alone

Dead weight from the Google Sheets era, kept for reference only. Don't modify,
don't "fix" their lint errors, don't wire them into anything:

- `google-apps-script.js`, `import-data-to-sheets.js`, `generate-import.cjs`
- `migration/` — one-off Firestore import scripts plus the exported CSVs.
  Run manually with `node migration/<script>.js [familyName]`; `add-kids.js`
  supports `--dry-run`.
- `README.md` is still the stock Vite template and describes nothing real.

## Deployment

GitHub Pages serves the **`gh-pages` branch** (Settings → Pages → "Deploy from a
branch" → `gh-pages` / `(root)`). Nothing is committed there by hand — three
workflows own it, all sharing the `gh-pages` concurrency group so they can never
push over each other:

| Workflow | Trigger | Writes |
| --- | --- | --- |
| `deploy.yml` | push to `firebase` | site root (preserves `preview/`) |
| `deploy-preview.yml` | push to any other branch | `preview/<slug>/` |
| `cleanup-preview.yml` | branch deleted | removes `preview/<slug>/` |

All three go through `.github/scripts/publish-pages.sh`, which clones
`gh-pages`, swaps in `dist/`, and pushes. It creates the branch on first run.

`vite.config.js` sets `base: '/mayaTrack/'`; preview builds override it with
`--base=/mayaTrack/preview/<slug>/`. Any hardcoded absolute asset path in
`index.html` will **not** be rebased — the `apple-touch-icon` link is the one
existing case, and it harmlessly resolves to the production copy.

`firestore.rules` is not deployed by any of this — see the Firestore section.
