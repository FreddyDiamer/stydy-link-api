# Study Link — Design System

A complete, build-ready design spec for the **Study Link** tutor marketplace. This is a
**Telegram Mini App** (mobile-first, single column, opens inside Telegram). The goal of this
document is a **minimalist, calm, comfortable interface** that maps 1:1 onto the existing API.

> Use this file as the source of truth when generating the UI. Every screen, input, validation
> rule, and status color below comes directly from the backend. Don't invent fields the API
> doesn't have; don't drop fields it does.

---

## 1. Product in one paragraph

Students post **requests** ("I need help with subject X, teacher Y, budget Z"). Tutors post
**services** ("I tutor subject X, teacher Y, price Z"). The other side **responds** with a
message, a proposed price, and a proposed deadline. The owner **accepts** a response, which
creates a **deal**. The deal moves through a status lifecycle to *completed*, after which either
party leaves a **review** (1–5 stars + comment). A reference layer of **subjects / teachers /
groups** (parsed from the university, KAI) powers all the selectors.

Two roles, one account: **the same user is a tutor in some flows and a student in others.** The UI
must make "what am I doing right now" obvious without forcing a hard role switch.

---

## 2. Design principles

1. **Minimal surface, maximal clarity.** One primary action per screen. Everything else is
   secondary or tertiary. No decorative chrome.
2. **Native to Telegram.** Respect the Telegram theme (light/dark), use the Telegram `MainButton`
   for the primary action on form screens, and the back button for navigation. Feel like part of
   Telegram, not a website embedded in it.
3. **Comfortable by default.** Generous tap targets (min 44×44pt), generous line-height, hairline
   dividers instead of heavy boxes, soft motion. Nothing cramped.
4. **Money and time are first-class.** Prices and deadlines appear on every card — formatted for
   humans (₽, not kopecks; "in 3 days", not an ISO string).
5. **Status is always visible.** Every deal/response/service shows its state as a colored badge,
   using the single status palette in §5.
6. **Progressive disclosure.** Cards show the essentials; tap to expand into the full detail
   screen. Don't dump every field into a list row.

---

## 3. Color system

Minimalist neutral base + a single blue accent + a small semantic set. These map directly to
**Telegram theme variables** (`themeParams`) so the app recolors itself in dark mode automatically.
The hexes below are the *fallback* values for when no Telegram theme is present.

### Light (default)

| Token | Hex | Telegram var | Use |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `bg_color` | App background |
| `--bg-secondary` | `#F2F3F5` | `secondary_bg_color` | Grouped section background, page behind cards |
| `--surface` | `#FFFFFF` | `section_bg_color` | Cards, sheets, input fields |
| `--text` | `#0F0F0F` | `text_color` | Primary text |
| `--text-secondary` | `#707579` | `subtitle_text_color` / `hint_color` | Labels, meta, captions |
| `--text-hint` | `#A8A8A8` | `hint_color` | Placeholders, disabled |
| `--separator` | `#E7E9EB` | `section_separator_color` | Hairline dividers, card borders |
| `--accent` | `#3390EC` | `button_color` / `link_color` | Primary buttons, links, active states |
| `--accent-text` | `#FFFFFF` | `button_text_color` | Text on accent |
| `--destructive` | `#E53935` | `destructive_text_color` | Delete, cancel, errors |

### Dark

| Token | Hex |
|---|---|
| `--bg` | `#17212B` |
| `--bg-secondary` | `#0E1621` |
| `--surface` | `#232E3C` |
| `--text` | `#FFFFFF` |
| `--text-secondary` | `#AAB4BE` |
| `--text-hint` | `#6D7883` |
| `--separator` | `#101921` |
| `--accent` | `#5EA8F0` |
| `--accent-text` | `#FFFFFF` |
| `--destructive` | `#FF595A` |

### Accent usage rules
- Exactly **one** accent. Don't introduce a second brand color.
- Accent = the thing you tap to move forward. Never use accent for static decoration.
- Backgrounds stay neutral; color comes only from accent + status badges.

---

## 4. Typography

System font stack (matches Telegram): `-apple-system, "SF Pro", Roboto, "Segoe UI", sans-serif`.

| Style | Size / line-height | Weight | Use |
|---|---|---|---|
| Title L | 22 / 28 | 700 | Screen titles, profile name |
| Title M | 17 / 22 | 600 | Card titles, section headers, prices |
| Body | 16 / 22 | 400 | Default text, descriptions |
| Subhead | 15 / 20 | 400 | Secondary lines on cards |
| Caption | 13 / 16 | 400 | Meta (dates, counts), badge text |
| Caption strong | 13 / 16 | 600 | Badge labels, overline labels (uppercase) |

Rules: max one Title per card. Numbers (prices, ratings) use **tabular figures**. Truncate
descriptions to 2 lines on cards with `…`.

---

## 5. Status & badge system

A **badge** is a pill: `Caption strong`, 12px horizontal padding, 4px vertical, full radius,
tinted background (10–15% of the color) + solid color text. One badge palette for the whole app.

### Deal status — `DealStatus`
| Value | Label (RU) | Color | Meaning |
|---|---|---|---|
| `PENDING` | Ожидает | Amber `#F5A623` | Created, not yet confirmed |
| `ACCEPTED` | Принята | Accent blue | Both sides agreed |
| `IN_PROGRESS` | В работе | Indigo `#5B5BD6` | Active |
| `COMPLETED` | Завершена | Green `#34C759` | Done, review enabled |
| `CANCELLED` | Отменена | Gray `#707579` | Dead |

### Response status — `ResponseStatus` (service & request responses)
| Value | Label | Color |
|---|---|---|
| `PENDING` | Ожидает | Amber `#F5A623` |
| `ACCEPTED` | Принят | Green `#34C759` |
| `REJECTED` | Отклонён | Destructive red |
| `EXPIRED` | Истёк | Gray `#707579` |

### Service status — `ServiceStatus`
| Value | Label | Color |
|---|---|---|
| `ACTIVE` | Активна | Green `#34C759` |
| `INACTIVE` | Скрыта | Gray `#707579` |
| `SUSPENDED` | Заблокирована | Destructive red |

### Urgency (reserved; `Urgency` enum exists in schema)
`LOW` gray · `MEDIUM` amber · `HIGH` red. Use only if/when urgency is wired into requests.

### Other small indicators
- **Verified user** (`isVerified: true`): small accent check ✓ next to name. Never a full badge.
- **Inactive account** (`isActive: false`): name dimmed to `--text-secondary`, "неактивен" caption.

---

## 6. Spacing, radius, elevation, motion

- **Spacing scale** (px): `4 · 8 · 12 · 16 · 20 · 24 · 32`. Default gutter = 16. Card inner
  padding = 16. Gap between cards = 8 (grouped) or 12 (standalone).
- **Radius:** inputs & buttons 12, cards 16, sheets 20 (top corners), badges/avatars full.
- **Elevation:** avoid shadows. Separate with `--bg-secondary` behind `--surface` cards + 1px
  `--separator` border. At most one soft shadow on floating elements (bottom sheet, FAB):
  `0 2px 12px rgba(0,0,0,0.08)`.
- **Motion:** 150–200ms ease-out for taps/sheets. Sheets slide up. No bounce, no parallax.
- **Touch targets:** min 44×44pt. List rows min height 56.

---

## 7. Core components

### Buttons
- **Primary** — accent fill, `--accent-text`, full-width on forms, radius 12, height 50. On form
  screens prefer Telegram's native `MainButton` instead of an in-page button.
- **Secondary** — `--bg-secondary` fill, `--text`, same metrics. For "Отклониться"/secondary path.
- **Tertiary / text** — accent text only, no fill. Inline actions ("Изменить", "Все отклики").
- **Destructive** — destructive-red text (text button) or red fill only on confirm dialogs.
- States: pressed = 92% opacity; disabled = 40% opacity + no shadow; loading = spinner replaces label.

### Input field
Label (`Caption strong`, `--text-secondary`, above) → field (`--surface`, 1px `--separator`,
radius 12, height 48, 16px padding, `Body`) → helper/error line below (`Caption`). Focused border =
accent. Error border = destructive + destructive helper text. Optional fields carry a muted
"необязательно" hint in the label row.

### Money input
A specialized text input: shows `₽`, accepts rubles, **stores kopecks** (×100). Min 1 ₽
(100 kopecks), max 100 000 ₽ (10 000 000 kopecks). Right-aligned tabular figures. On blur, format
with thousands separators ("1 500 ₽").

### Selector row (subject / teacher / group)
Tappable row: leading label, trailing current value + chevron `›`. Opens a **search sheet**
(§ bottom sheet) with a search field and a scrollable list. Required selectors show a placeholder
("Выберите предмет") in `--text-hint` until chosen.

### Date / deadline picker
Selector row opening a native-style date/time wheel. Stores ISO 8601. Displays relative
("через 3 дня") + absolute on the detail screen. Optional everywhere it appears.

### Card
`--surface`, radius 16, 1px `--separator`, 16px padding. Top row: title + status badge. Then meta
lines (`Subhead`, `--text-secondary`). Bottom row: price (Title M) on the left, a small meta
(date or response count) on the right. Whole card is tappable → detail. See §9 for per-entity
card content.

### Chip / filter pill
`--bg-secondary` pill, `Caption strong`. Selected = accent fill + accent-text. Used in filter bars
(status, price range presets) and for inline tags (subject name).

### Avatar
Circle. `avatarUrl` if present, else initials on a deterministic muted background. Sizes: 28
(inline), 40 (list row), 72 (profile).

### Rating display
Five stars + numeric (`4.8`) in `Caption`/`Body`. Empty state: "Нет отзывов". Input variant:
five large tappable stars (used in the review form, 1–5, required).

### Segmented control
For role/context switches and tab-like filters ("Услуги | Заявки", "Мои | Все"). `--bg-secondary`
track, accent-text on white thumb for the selected segment.

### Bottom sheet
Slides from bottom, radius 20 top, drag handle, `--bg` scrim at 40%. Used for: selectors (with
search), action menus (edit/delete/share), and short confirmations.

### List section
Grouped list: section header (`Caption strong`, uppercase, `--text-secondary`, 16px side padding)
over a `--surface` block whose rows are split by inset `--separator` hairlines.

### Empty / loading / error states
- **Loading:** skeleton cards (gray blocks pulsing), not spinners, for lists. Spinner only for
  button-level actions.
- **Empty:** centered, a simple line-icon, one `Title M` line + one `Subhead` line + (optional)
  primary action. E.g. "Пока нет откликов — поделитесь услугой".
- **Error:** same layout, destructive icon, "Что-то пошло не так" + "Повторить" button.
- **Toast:** transient confirmation at top, auto-dismiss 2s. Errors from the API envelope show here.

---

## 8. Navigation & information architecture

Bottom tab bar (4 tabs) — the spine of the app. Telegram back button handles drill-down.

| Tab | Icon | Contains |
|---|---|---|
| **Маркет** | grid | Browse services *and* requests (segmented control at top). Search + filters. |
| **Сделки** | handshake | All deals the user is in, filtered by status. The active-work hub. |
| **Отклики** | bell | Responses: incoming (to my services/requests) + outgoing (mine). |
| **Профиль** | person | My profile, my services, my requests, reviews about me, group, balance. |

**Primary create action:** a single accent **"+"** (FAB or header action) that opens a sheet —
"Создать услугу" (tutor) / "Создать заявку" (student). Context-aware to the current Маркет segment.

Detail screens push on top (full screen, Telegram back to dismiss). Forms open as full screens with
the Telegram `MainButton` as submit.

---

## 9. Entities → cards & detail screens

Every list uses **PaginationDto** (`page`, `limit` ≤ 100). Infinite scroll, 10 per page.

### 9.1 Service card (tutor's offer)
- **Title:** `subject.name` · `teacher.fullName`
- **Badge:** `ServiceStatus`
- **Body:** `description` (2 lines, optional)
- **Footer left:** `price` → "1 500 ₽"
- **Footer right:** `_count.responses` → "12 откликов"; `deadline` if set ("до 1 июня")
- **Owner avatar+name** (`tutor.name`, verified ✓) as a small header row on the browse list.

**Service detail:** tutor header (avatar, name, rating, verified), big price, subject+teacher,
description, deadline, response count. Owner sees: Изменить · Активировать/Скрыть · Удалить (sheet)
and a list of incoming responses with Accept/Reject. Non-owner (student) sees the **"Откликнуться"**
primary button → opens the *service-response* form.

### 9.2 Request card (student's ask)
- **Title:** `subject.name` · `teacher.fullName`
- **Body:** `description` (2 lines, optional)
- **Footer left:** `budget` → "до 2 000 ₽" (or "Бюджет не указан")
- **Footer right:** `_count.responses`; `deadline` if set
- **Owner avatar+name** (`student.name`).

**Request detail:** student header, budget, subject+teacher, description, deadline. Owner sees
Изменить · Удалить + incoming responses with Accept. Non-owner (tutor) sees **"Откликнуться"** →
*request-response* form.

### 9.3 Response card (service-response / request-response)
- **Title:** counterparty name (`student.name` / `tutor.name`)
- **Badge:** `ResponseStatus`
- **Body:** `message` (optional, 2 lines)
- **Meta:** `price` ("Предлагает 1 400 ₽"), `proposedDeadline` ("к 1 июня")
- **Actions (owner of the service/request):** Принять (primary) · Отклонить (secondary).
  Accepting creates a **deal** and flips status to ACCEPTED. Once a deal exists, show "Сделка
  создana →" linking to it; hide accept/reject.

### 9.4 Deal card
- **Title:** `subject.name` · `teacher.fullName`
- **Badge:** `DealStatus`
- **Subhead:** the counterparty ("с Иван Иванов")
- **Footer left:** `price`
- **Footer right:** `deadline`

**Deal detail:** both participants (student + tutor headers), price, subject+teacher, deadline,
status. **Status stepper** visualizing PENDING → ACCEPTED → IN_PROGRESS → COMPLETED (CANCELLED =
red terminal). Owner-permitted status transitions are buttons. On COMPLETED → **"Оставить отзыв"**
primary (if no review yet) → review form. If a review exists, show it inline.

### 9.5 Review card
- **Header:** author avatar + name, `rating` stars, date
- **Body:** `comment` (optional)
- **Footnote:** the deal's subject ("Математика · Иванов И.И.")

**Profile rating block:** average stars + count, then a list of Review cards (about-me).

### 9.6 User / profile
- **Header:** avatar (72), `name` + verified ✓, `telegramUsername` (@handle), `group.number`,
  rating stars + count.
- **Description** (`description`, bio) if present.
- **Balance** row (`balance` → ₽) — own profile only.
- Segmented sub-lists: **Услуги · Заявки · Отзывы**.
- Own profile: edit profile, change group, settings.

---

## 10. Forms — every input, with validation

All money inputs use the **Money input** (rubles in, kopecks out, 1 ₽–100 000 ₽). All selectors
open search sheets fed by the active reference lists. `*` = required.

### 10.1 Create / edit **Service** (tutor) — `POST/PATCH /marketplace/services`
| Field | Control | Rules |
|---|---|---|
| Subject * | Selector → `GET /education/subjects/active` | UUID, required |
| Teacher * | Selector → `GET /education/teachers/by-subject/:subjectId` (filtered by chosen subject) | UUID, required |
| Price * | Money | 1 ₽ – 100 000 ₽ |
| Description | Multiline text | optional |
| Deadline | Date picker | optional, ISO |
| Status | Segmented (Активна/Скрыта) | optional, default ACTIVE; edit only |

Submit → MainButton "Опубликовать услугу". Owner auto-set to current user.

### 10.2 Create / edit **Request** (student) — `POST/PATCH /marketplace/requests`
| Field | Control | Rules |
|---|---|---|
| Subject * | Selector (active subjects) | UUID, required |
| Teacher * | Selector (teachers by subject) | UUID, required |
| Budget | Money | optional, 1 ₽ – 100 000 ₽ |
| Description | Multiline text | optional |
| Deadline | Date picker | optional |

Submit → "Опубликовать заявку". `studentId` = self (enforced server-side).

### 10.3 **Respond to a service** (student) — `POST /marketplace/service-responses`
| Field | Control | Rules |
|---|---|---|
| Message | Multiline text | optional |
| Proposed price | Money | optional, 1 ₽ – 100 000 ₽ |
| Proposed deadline | Date picker | optional |

Context shows the service summary on top (read-only). One response per (student, service) —
if already responded, show the existing response instead of the form.

### 10.4 **Respond to a request** (tutor) — `POST /marketplace/request-responses`
Same three optional fields (message / price / proposed deadline). One response per (tutor, request).

### 10.5 **Review** — `POST /reviews`
| Field | Control | Rules |
|---|---|---|
| Rating * | 5 tappable stars | 1–5, required |
| Comment | Multiline text | optional |

Only on a **COMPLETED** deal, one review per deal. `dealId`, `authorId` (self), `targetId`,
`targetRole` are derived from the deal context, not typed by the user.

### 10.6 **Edit profile** — `PATCH /users/me`
| Field | Control | Rules |
|---|---|---|
| Name | Text | required, non-empty |
| Description (bio) | Multiline text | optional |
| Avatar | image (`avatarUrl`) | optional |

User **cannot** change verification/active flags (server-rejected — don't render those toggles).

### 10.7 **Change group** — `PATCH /users/group`
Single selector → `GET /education/groups`, stores `groupId`. Show group `number` (+ `data`
education form if present) in the sheet rows.

---

## 11. Filtering & search (browse screens)

The Маркет tab has a filter bar (chips + a filter sheet). Map directly to the query DTOs:

**Services** (`ServiceQueryDto`): `subjectId`, `teacherId`, `tutorId`, `status`, `minPrice`,
`maxPrice`, `search` (description), `deadlineBefore/After`, `page`, `limit`.

**Requests** (`RequestFilterDto`): `subjectId`, `teacherId`, `studentId`, `minBudget`,
`maxBudget`, `search`.

**Responses** (`ServiceResponseFilterDto` / `RequestResponseFilterDto`): `status`, `minPrice`,
`maxPrice`, `search`, plus the linking id.

**Deals** (`DealFilterDto`): `status`, `subjectId`, `teacherId`, `minPrice`, `maxPrice`.

**Reviews** (`ReviewFilterDto`): `targetRole`, `minRating`, `maxRating`, `search`.

UI pattern: a horizontal scroll of **status chips** (always visible) + a "Фильтры" button opening a
sheet with subject/teacher selectors and a price range. Search is a field pinned at the top.
Special lists worth a shortcut chip: **Популярные** (`/popular`), **Активные** (`/active`),
**Открытые заявки** (`/requests/open`).

---

## 12. Formatting rules

- **Money:** value is kopecks. Display = `value / 100` with a space thousands separator + ` ₽`.
  e.g. `150000` → "1 500 ₽". Never show kopecks decimals unless non-zero.
- **Dates:** relative within 7 days ("через 3 дня", "вчера"), absolute otherwise ("1 июня").
  Deadlines in the past on an open item → destructive "просрочено".
- **Ratings:** one decimal ("4.8"). Counts: "12 отзывов" with correct RU plural.
- **Names:** `name`; show `@telegramUsername` as a tappable handle (opens Telegram profile).
- **Empty optionals:** show a muted "—" or a sensible phrase ("Бюджет не указан"), never blank.

---

## 13. Auth & first run

- Login is silent via Telegram `initData` (`POST /auth/telegram`) — **no login screen**. On open,
  authenticate, then land on Маркет.
- First-run, if profile incomplete (no name/group), show a light onboarding sheet: confirm name →
  pick group (optional, skippable). Keep it to one or two steps.
- No passwords, no email anywhere in the UI.

---

## 14. Screen inventory (build checklist)

1. **Маркет** — segmented Услуги/Заявки, search, filter chips, infinite list of cards.
2. **Service detail** / **Request detail** — full info + responses + role-aware actions.
3. **Create/Edit Service** · **Create/Edit Request** — forms (§10.1–10.2).
4. **Respond** sheets/screens — service-response & request-response forms (§10.3–10.4).
5. **Отклики** — incoming (accept/reject) + outgoing, status-filtered.
6. **Сделки** — list + deal detail with status stepper & transitions.
7. **Review form** + reviews on profile.
8. **Профиль** (self & others) — header, services/requests/reviews sub-lists, balance, edit, group.
9. **Selector sheets** — subject / teacher / group search.
10. **Global states** — skeletons, empty, error, toasts.

---

## 15. Do / Don't

**Do:** one primary action per screen · status badge on every stateful item · format money & dates ·
reuse the card and selector components everywhere · lean on Telegram native back/MainButton.

**Don't:** show raw kopecks · expose UUIDs · render verify/active toggles in self-edit · use more
than one accent color · add shadows to cards · build a custom login screen · cram every field into a
list row.
