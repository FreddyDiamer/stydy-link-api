# Notifications

Telegram notifications sent to users when marketplace events happen. Service-only module — it has no controller.

## Key files

| File                                                | Purpose                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/modules/notifications/notification.service.ts` | One `notifyX(payload)` method per event; builds Russian message text + deep link |
| `src/modules/notifications/notification.types.ts`   | Typed payload per event (`recipientUserId`, `actorName`, entity ids, …)          |
| `src/modules/notifications/telegram-bot.service.ts` | Thin Telegraf wrapper: `sendMessage(telegramId, text, …)`                        |
| `src/common/constants/frontend-paths.ts`            | `FRONTEND_PATHS` templates + `buildFrontendUrl()` for Mini App deep links        |

## Events

`NotificationService` covers: response created / accepted / rejected (both `ServiceResponse` and `RequestResponse` variants), deal created / accepted / rejected-or-cancelled / completed, review created, review reply.

## How a notification goes out

1. A marketplace service calls `void this.notificationService.notifyX(payload)` — **fire-and-forget**, never awaited in the request path; a Telegram failure must not fail the API call.
2. The service loads the recipient, checks `User.telegramNotificationsEnabled` (per-event `notificationPreferences Json?` is reserved for the future), formats a Russian message, and builds a deep link into the Mini App with `buildFrontendUrl(FRONTEND_BASE_URL, FRONTEND_PATHS.X, { id })`.
3. `TelegramBotService.sendMessage` delivers via the bot (`TELEGRAM_BOT_TOKEN`). Without a token (local dev) sends are skipped/logged, not thrown.

## Adding a new notification

1. Add a payload interface in `notification.types.ts`
2. Add `notifyX()` in `notification.service.ts` (Russian text; reuse an existing method as the template)
3. If it links into the Mini App, add the path to `FRONTEND_PATHS` — templates must match the frontend router (`study-link/src/router/paths.ts`)
4. Call it with `void` from the service that owns the state change

## Common mistakes

- `await`-ing a notify call in a request handler — blocks and can fail the user's request on Telegram errors
- Hardcoding a frontend URL instead of `FRONTEND_PATHS` + `buildFrontendUrl` — deep links silently break when the router changes
- Writing notification text in English — user-facing text is Russian
