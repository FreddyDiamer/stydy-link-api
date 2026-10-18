# Notifications

The Telegram bot: notifications on marketplace events, a reply to `/start`, and the webhook that receives updates.

## Key files

| File                                                       | Purpose                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/modules/notifications/notification.service.ts`        | One `notifyX(payload)` method per event; builds Russian message text + deep link                      |
| `src/modules/notifications/notification.types.ts`          | Typed payload per event (`recipientUserId`, `actorName`, entity ids, …)                               |
| `src/modules/notifications/telegram-bot.service.ts`        | Telegraf wrapper: `sendMessage`, `/start` and fallback replies, webhook registration and secret check |
| `src/modules/notifications/telegram-webhook.controller.ts` | `POST /telegram/webhook` — public, secret-checked receiver of Telegram updates                        |
| `src/common/constants/frontend-paths.ts`                   | `FRONTEND_PATHS` templates + `buildFrontendUrl()` for Mini App deep links                             |

## Events

`NotificationService` covers: response created / accepted / rejected (both `ServiceResponse` and `RequestResponse` variants), deal created / accepted / rejected-or-cancelled / completed (including auto-confirm, sent to both sides), review created, review reply. Deep-link buttons use `FRONTEND_PATHS` (`src/common/constants/frontend-paths.ts`), which must match the mini-app's real routes (`/market`, `/deals`, `/profile`, `/market/services/:id`).

## How a notification goes out

1. A marketplace service calls `void this.notificationService.notifyX(payload)` — **fire-and-forget**, never awaited in the request path; a Telegram failure must not fail the API call.
2. The service loads the recipient, checks `User.telegramNotificationsEnabled` (per-event `notificationPreferences Json?` is reserved for the future), formats a Russian message, and builds a deep link into the Mini App with `buildFrontendUrl(FRONTEND_BASE_URL, FRONTEND_PATHS.X, { id })`.
3. `TelegramBotService.sendMessage` delivers via the bot (`TELEGRAM_BOT_TOKEN`). Without a token (local dev) sends are skipped/logged, not thrown.

Buttons are sent as `web_app` buttons: the Mini App opens **inside Telegram**, already authenticated through `initData`, on the linked screen. A plain `url` button would open an external browser, where there is no Telegram login and the production build only says «Откройте приложение в Telegram». Telegram accepts `web_app` only over HTTPS, so `FRONTEND_BASE_URL` must be `https://` — otherwise Telegram rejects the whole message.

## Receiving updates

The bot answers `/start` with a greeting and an «Открыть Study Link» button, and any other message with a short hint and the same button. Updates arrive by webhook:

1. On boot, `TelegramBotService.onApplicationBootstrap` calls `setWebhook(FRONTEND_BASE_URL + '/api/telegram/webhook', { secret_token: TELEGRAM_WEBHOOK_SECRET })` when the secret is set. The address relies on the frontend and the API sharing one domain (Caddy routes `/api/*` to the app); if they ever split, the webhook needs its own URL variable.
2. Telegram posts each update to `POST /api/telegram/webhook` with the `X-Telegram-Bot-Api-Secret-Token` header. The route is `@Public()` (no JWT) and `@SkipThrottle()` (all updates come from a few Telegram IPs); a missing or wrong secret is a 401.
3. Handler errors are logged by `bot.catch` and never turned into a non-200 answer, so Telegram does not retry a failing update forever.

## Adding a new notification

1. Add a payload interface in `notification.types.ts`
2. Add `notifyX()` in `notification.service.ts` (Russian text; reuse an existing method as the template)
3. If it links into the Mini App, add the path to `FRONTEND_PATHS` — templates must match the frontend router (`study-link/src/router/paths.ts`)
4. Call it with `void` from the service that owns the state change

## Common mistakes

- `await`-ing a notify call in a request handler — blocks and can fail the user's request on Telegram errors
- Hardcoding a frontend URL instead of `FRONTEND_PATHS` + `buildFrontendUrl` — deep links silently break when the router changes
- Writing notification text in English — user-facing text is Russian
- Starting a local server with the production bot token and `TELEGRAM_WEBHOOK_SECRET` set — it re-registers the webhook to its own `FRONTEND_BASE_URL` and production stops receiving `/start`
