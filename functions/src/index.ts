/**
 * Cloud Functions removed in favor of a fully-offline quote pool.
 *
 * 2026-05-21 — Lumina Daily switched from on-demand AI generation to a
 * bundled local quote database. The client picks from `src/data/quotes.json`
 * and schedules local notifications via Capacitor LocalNotifications.
 *
 * Previously deployed functions to remove from Firebase:
 *   firebase functions:delete generateQuote --region asia-northeast3
 *   firebase functions:delete sendDailyNotifications --region us-central1
 *
 * History of the old implementation is in git (commit before this one).
 */
export {};
