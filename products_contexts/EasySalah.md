# EasySalah

EasySalah is a clean, privacy-first Expo (React Native) Islamic companion app. All logic runs **on-device** — no backend, no accounts, no analytics, no ads. Current app version: **2.3.1**.

This file is intended as a concise, up-to-date context document for building on and optimizing the app.

## What the app does (features)

- **Prayer Times** — location-based daily times via `adhan`, with calculation method + madhab options, merged display of fard + voluntary (nafl) prayers, zawal handling, and a live next-prayer countdown.
- **Qibla** — compass bearing using location + magnetometer with magnetic declination correction; immersive full-screen mode.
- **Zakat** — three tabs plus a Wealth Tracker:
  - **Calculate Now** — defaults to a **Simple guided calculator** (plain-language questions, gold/silver entry by value *or* weight in grams, an itemized result breakdown, and an above/below-nisab status indicator) with a one-tap switch to a **Detailed** calculator (profiles, per-asset eligibility, liabilities, gold/silver nisab).
  - **Check Nisab** — auto eligibility readout that pulls the Calculate Now amounts live (total assets − debts vs. the selected gold/silver nisab), with a silver-basis nudge when below the gold threshold.
  - **Zakat Motivation** — Qur'an, hadith, and reports from the salaf.
  - **Wealth Tracker** — track individual assets over time; each entry gets a per-asset **hawl countdown** (one lunar year from acquisition, Hijri + Gregorian), a summary vs. nisab, and optional **"7 days before"** reminders. Entries can be edited (tap a row) or removed (with a confirm dialog), and a note flags mixed-currency totals. **Soft Pro gate**: free users get a teaser of **1 tracked asset** (with its live countdown); tracking unlimited assets and hawl reminders are Pro (inline paywall CTAs). Reached from links on both calculator modes and the Check Nisab tab. Entries persist on-device (`useZakatTrackerStore`).
- **Islamic Calendar** — full Hijri month grid (Gregorian shown alongside), curated agreed-upon important dates (the two Eids, Ashura, Arafah, Laylat al-Qadr, first ten of Dhul-Hijjah, White Days, etc.), per-event detail, optional "day-before" reminders, and an upcoming-date banner on Home.
- **Tasbih** — counter with progress ring, dhikr presets, rounds/total, daily history, keep-awake.
- **Azkar** — adhkār catalog.
- **Masjid Finder** (Pro) — nearby/saved masjids with custom prayer offsets.
- **Ramadan** (Pro), **EasyTones**, **Quiet/Silent hours**, **Appearance** (themes).
- **Prohibited prayer times** — gentle full-screen tint + banner at sunrise, zawal, and sunset.
- **Hijri date display** with a user offset (±2 days) for local moon-sighting alignment.
- **Home & Lock Screen widgets** (iOS WidgetKit + Android) that mirror the app theme.
- **7 languages**: English, Arabic, Urdu, Bengali, Hindi, Russian, Simplified Chinese (RTL-aware).

## Tech & architecture

- Expo managed workflow + **expo-router** (file-based routing under `app/`).
- Functional components + hooks; **Zustand** stores with `AsyncStorage` persistence.
- `Intl` (ICU) for Gregorian + Hijri (`islamic` calendar) formatting.
- `expo-notifications` (DATE-triggered) for prayer + event reminders.

### Key directories

```text
app/                       # expo-router routes (thin; re-export screens)
  _layout.tsx              # providers, Stack, app-wide effects (incl. event-reminder sync)
  (tabs)/                  # home, prayers, qibla, zakat, settings
src/
  screens/                 # screen components
    zakat/                 # ZakatCalculateTab (Simple/Detailed switch),
                           #   ZakatSimpleCalculator, ZakatAdvancedCalculator,
                           #   ZakatNisaabCheckTab, ZakatMotivationTab,
                           #   WealthTrackerScreen, zakatScreenStyles
  components/              # shared UI + calendar/ (grid, events list, detail sheet, banner)
                           #   + zakat/ (HawlCountdownCard, WealthEntryRow, AddWealthEntryModal)
  store/                   # prayerStore (large), PrayerTimesContext, tasbihStore,
                           #   masjidStore, islamicCalendarStore, zakatTrackerStore
  hooks/                   # useT, useCompassHeading, useProhibitedPrayerWindow, useReduceMotion
  utils/                   # prayer, mergedPrayerDisplayRows, hijri, date, format, qibla,
                           #   zakat, zakatHawl
  constants/               # theme, islamicEvents, dhikrPresets, zakatAssetTypes, features
  notifications/           # prayerReminders, islamicEventReminders, zakatHawlReminders, channels/sounds
  widgetData/ + widgets/   # widget payload export + native/preview widgets
  i18n/locales/            # en, ar, ur, bn, hi, ru, zh-CN
  theme/                   # themes (incl. Pro themes) + theme context
```

### Conventions
- Respond/code in English; keep files within ~500–800 lines (split when larger).
- Every user-facing string is localized across all 7 locales.
- Avoid narrating-the-obvious code comments.

## Recent changes (2.3.x)

- **Zakat redesign**: Simple calculator now shows an itemized result breakdown, an above/below-nisab status dot, and gold/silver entry by value or weight (grams converted via the per-gram rate). Check Nisab reads amounts live from Calculate Now and computes eligibility automatically. New **Wealth Tracker** (`/zakat-tracker`) tracks assets with per-asset hawl countdowns (`src/utils/zakatHawl.ts`, unit-tested), inline edit/remove (with confirm) and optional 7-day-before reminders (`zakatHawlReminders`, rescheduled on launch via a root effect). Uses a **soft Pro gate** — 1 free asset as a teaser, unlimited tracking + reminders behind Pro. Discoverable from both calculator modes and Check Nisab via a shared `ZakatTrackerLink`.
- **Zakat simplified**: Calculate Now opens a friendly **Simple** calculator by default (plain questions, currency-derived formatting); the full worksheet remains under **Detailed**. Check Nisab + Zakat Motivation tabs.
- **Islamic Calendar** added (grid + curated dates + reminders + Home banner). Hijri conversion is unit-tested (`src/utils/hijri.test.ts`).
- **More Pro themes** (Noor, Ihsan, Oasis, Nile, Olive, Copper, Marble) with localized names; widgets fill edge-to-edge with the selected theme.
- **Prohibited prayer-time** overlay + banner.
- **Tasbih** overhaul (progress ring, presets, history, keep-awake).
- **Widget fixes**: theme-accurate colors, larger Lock Screen fonts, multi-day timeline so lock-screen times stay fresh without daily app opens.
- **Event reminders** are now rescheduled on app launch and when the Hijri offset changes (root effect in `app/_layout.tsx`).
- Removed dead code (`SettingsScreen.tsx`, `NextPrayerCard.tsx`).

## Known areas for future improvement
- `src/store/prayerStore.ts` is very large (~2k lines) and mixes many concerns — a candidate for splitting.
- Several screens exceed the file-size rule (`PrayerTimesScreen`, `QiblaScreen`, `HomeScreen`, `NotificationsSettingsScreen`).
- Multiple countdown/prohibited-window timers run in parallel; could be consolidated to one source of truth.
- Widget payload is re-synced on each 60s countdown tick; could be throttled to prayer/location/theme changes.
- Accessibility labels are sparse on some Pressables (calendar chips, switches).
- Quiet Quran is behind `FEATURE_QUIET_QURAN_ENABLED` (currently off) but routes/code remain.

## Install / run

```bash
npm install
npx expo prebuild            # generate native projects (required for widgets)
npx expo run:ios             # or: npx expo run:android
npx expo start --dev-client  # JS iteration
```

> Native modules (widgets, `react-native-svg`, notifications sounds) require a dev/native build — they do not work in Expo Go.

## Release / submit (EAS)

```bash
eas build  -p ios     --profile production
eas build  -p android --profile production
eas submit -p ios     --profile production
eas submit -p android --profile production
```

## Testing

- Logic tests run with Vitest: `npm run test:logic` (prayer math, hijri conversion, zakat hawl, geo, reminder slots).
- Type check: `npx tsc --noEmit`.

## Privacy

No backend · no analytics · no ads · no login. All calculations and formatting happen locally on-device. Foreground location is used only for prayer times and qibla, with a graceful fallback if denied.
