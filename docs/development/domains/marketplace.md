# Marketplace

The core loop: tutors post services, students post requests, the other side responds, an accepted response becomes a deal, a completed deal gets a review.

## Key files

| File                                         | Purpose                                                  |
| -------------------------------------------- | -------------------------------------------------------- |
| `src/modules/marketplace/services/`          | Tutor offers (`Service`)                                 |
| `src/modules/marketplace/requests/`          | Student asks (`Request`)                                 |
| `src/modules/marketplace/service-responses/` | Student → service responses; `accept()` creates the deal |
| `src/modules/marketplace/request-responses/` | Tutor → request responses; accept/reject/cancel          |
| `src/modules/marketplace/deals/`             | Deal lifecycle: accept, reject, complete, cancel         |
| `src/modules/reviews/`                       | Reviews on completed deals, tutor replies                |

## The flow

```
Tutor posts Service ──► Student sends ServiceResponse ─► Tutor accepts ──► Deal ─► Review
Student posts Request ─► Tutor sends RequestResponse ──► Student accepts ► Deal ─► Review
```

1. A tutor publishes a `Service` (subject + teacher + price, plus `lessonsCount` and `lessonDurationMinutes`). A student publishes a `Request` (subject + teacher, optional `budget` and `deadline`).
2. The counterparty responds with an optional `message`, proposed `price`, and `proposedDeadline`. `ServiceResponse` additionally carries `proposedDeadlineType` (today/week/month/custom) and `budgetType` (service-price/flexible/lower/higher) — UI hints, not business logic.
3. The owner **accepts** the response → the response becomes `ACCEPTED` and a `Deal` is created with the agreed price/deadline. The deal links back one-to-one via `serviceResponseId` XOR `requestResponseId`.
4. The deal moves `PENDING → ACCEPTED → IN_PROGRESS → COMPLETED` (or `CANCELLED`) via `PATCH /marketplace/deals/:id/accept|reject|complete|cancel`; every transition checks the caller is a deal participant (`ensureDealParticipant`).
5. A deal completes by **two-sided confirmation**: each side calls `complete`; the deal closes when both confirmed (or via 3-day auto-confirm when one side stays silent — `applyAutoConfirmations`). Cancellation records who/when/why (`cancelledById`, `cancelReason`).
6. On a completed deal, **each participant** may leave one `Review` (rating 1–5, comment); the author is the current user, the target and `targetRole` are derived from the deal. The reviewed party can answer via `PATCH /reviews/:id/reply`.

## Invariants

- A deal originates **only** from an accepted response — `POST /marketplace/deals` exists but the normal path is response acceptance
- One response per `(studentId, serviceId)` and per `(tutorId, requestId)` — enforced by `@@unique`
- One review per deal **per author** (`@@unique([dealId, authorId])`) — both sides can review each other
- Response statuses: `PENDING / ACCEPTED / REJECTED / EXPIRED`; a response with a deal cannot be deleted
- Only the resource owner mutates it: service/request owners edit their listings, the listing owner accepts/rejects responses, the response author edits/deletes their response

## Side effects

Every accept/reject/create/complete transition fires a fire-and-forget Telegram notification (`void this.notificationService.notify...`) — see [notifications.md](notifications.md). When adding a new transition, add the matching notification call.

## Common mistakes

- Creating a deal directly instead of accepting a response — bypasses the response status update and the one-response-per-pair invariant
- Forgetting the ownership check on a new mutating endpoint — copy the pattern from `ServiceResponsesService.accept()`
- Treating `budgetType` / `proposedDeadlineType` as authoritative — the real values are `price` and `proposedDeadline`
