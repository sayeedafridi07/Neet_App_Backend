# NEET Backend — API & Schema Reference

Base URL: `http://<host>/api/v1`  ·  Health check: `GET /health`

---

## 1. Conventions

### Response envelope
Every endpoint returns the same envelope:
```json
{ "success": true, "message": "…", "data": { }, "error": null }
```

### Paginated lists
List endpoints accept `?page=1&limit=20&search=…` (`limit` max 100) and return:
```json
{ "<items>": [ ... ], "pagination": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
```

### Authentication
| Header | Required for | Notes |
|---|---|---|
| `Authorization: Bearer <accessToken>` | All protected routes | JWT. Only the **latest** token is valid (stored on the user/admin row), so logging in again invalidates older sessions. |
| `x-device-id: <device id>` | Students | Bound on first login/register. Requests from a different device get `401 Unauthorized device detected` until an admin calls *reset-device*. |

### Roles
| Role | Who | How they log in |
|---|---|---|
| `STUDENT` | App user (`User` table) | Phone + OTP |
| `ADMIN` | Panel user (`Admin` table) | Email + password |
| `SUPER_ADMIN` | Panel user; the only role allowed to **DELETE** | Email + password |

Common errors: `400` validation, `401` auth/session/device, `403` wrong role, `404` not found, `409` conflict, `413` file too large, `415` unsupported file type.

### File uploads
Upload endpoints use `multipart/form-data`. Files are stored in R2; responses return public URLs (e.g. `audioUrl`, `imageUrl`).

| Field | Accepted | Max |
|---|---|---|
| `audio` | mp3, m4a, aac, wav, webm, ogg | 100 MB |
| `image`, `explanationImage`, `optionImage0`…`optionImage5` | jpeg, png, webp, gif | 5 MB |
| `file` (question import) | .docx, .xlsx | 10 MB |

---

## 2. Data model

```
AcademicClass ─┐
               ├─< Chapter ─┬─< AudioLecture
Subject ───────┘            ├─< KeywordRevision
                            └─< Quiz (type CHAPTER) ─< Question ─< QuestionOption
                                Quiz (type TEST_SERIES, no chapter)

User ─┬─< QuizAttempt ─< QuizAttemptAnswer
      ├─< Subscription >── SubscriptionPlan
      │        └─< Payment
      └─< UserDailyActivity

Admin (standalone)
```

### Enums
| Enum | Values |
|---|---|
| `AdminRole` | `ADMIN`, `SUPER_ADMIN` |
| `QuizType` | `CHAPTER`, `TEST_SERIES` |
| `QuizAttemptStatus` | `IN_PROGRESS`, `SUBMITTED`, `AUTO_SUBMITTED`, `EXPIRED` |
| `QuizAnswerStatus` | `NOT_ANSWERED`, `ANSWERED`, `MARKED`, `MARKED_AND_ANSWERED` |
| `SubscriptionStatus` | `PENDING`, `ACTIVE`, `EXPIRED`, `CANCELLED` |
| `PaymentStatus` | `CREATED`, `AUTHORIZED`, `SUCCESS`, `FAILED`, `REFUNDED` |

### Models
All models have `id` (uuid), `createdAt`, `updatedAt` unless noted.

**User** — `phone` (unique), `name?`, `targetYear?`, `city?`, `schoolName?`, `profileComplete` (default false), `isActive` (default true), `deviceId?`, `fcmToken?`, `accessToken?`, `lastActiveAt?`

**UserDailyActivity** — `userId`, `date` (one row per user per IST day; powers DAU/WAU/MAU)

**Admin** — `email` (unique), `password` (bcrypt), `name?`, `role` (default ADMIN), `isActive`, `accessToken?`

**Subject** — `name`, `slug` (unique, auto-generated)

**AcademicClass** — `name`, `slug` (unique, auto-generated)

**Chapter** — `name`, `slug`, `order`, `classId`, `subjectId` · unique `(classId, subjectId, slug)`

**AudioLecture** / **KeywordRevision** (same shape) — `title`, `slug`, `description?`, `audioKey`, `imageKey?`, `duration` (seconds), `order`, `chapterId`, `isActive` (default **false**) · unique `(chapterId, slug)`

**Quiz** — `title`, `description?`, `type`, `chapterId?` (required when `type=CHAPTER`), `durationMinutes?`, `correctMarks` (4), `wrongMarks` (-1), `skippedMarks` (0), `isActive` (default false)

**Question** — `quizId`, `question`, `explanation?`, `imageKey?`, `explanationImageKey?`, `order`, `isActive` (default true)

**QuestionOption** — `questionId`, `text`, `isCorrect`, `imageKey?`, `order`

**QuizAttempt** — `quizId`, `userId`, `status`, `startedAt`, `expiresAt`, `submittedAt?`, `score?`, `correctAnswers`, `wrongAnswers`, `skippedAnswers`, `questionsSnapshot` (JSON copy of the quiz at start, so later edits don't change history)

**QuizAttemptAnswer** — `attemptId`, `questionId`, `questionOrder`, `selectedOptionId?`, `status`, `isCorrect?`, `marks?`

**SubscriptionPlan** — `name`, `description?`, `price` (**paise**), `originalPrice?` (paise), `currency` (INR), `durationDays`, `features` (string[]), `order`, `isActive` (default false)

**Subscription** — `userId`, `planId`, `status`, `startsAt?`, `expiresAt?`, `cancelledAt?`, `cancelAtPeriodEnd`, `planSnapshot` (JSON)

**Payment** — `userId`, `subscriptionId`, `amount` (paise), `currency`, `status`, `provider` (RAZORPAY), `providerOrderId` (unique), `providerPaymentId?`, `providerSignature?`, `failureReason?`, `paidAt?`

---

## 3. API flows

### 3.1 Student (mobile app)

```
1. POST /auth/send-otp          { phone }
2. POST /auth/verify-otp        { phone, otp }        + x-device-id
        → accessToken, user.profileComplete
3. if !profileComplete:
   POST /auth/register          { name, ... }         + Bearer + x-device-id
4. GET  /auth/me                                       (on app start)
5. Content:  GET /audio-lectures?chapterId=…  ·  GET /keyword-revisions?chapterId=…
6. Buy plan: POST /subscriptions/checkout { planId }
             → open Razorpay checkout with { orderId, amount, currency, keyId }
             POST /subscriptions/verify-payment { razorpayOrderId, razorpayPaymentId, razorpaySignature }
             GET  /subscriptions/me
7. POST /auth/logout
```

> Note: OTP verification is currently stubbed — the accepted OTP is `000000` (SMS provider not yet wired).

### 3.2 Admin panel — content setup

Content must be created top-down because each level references the one above:

```
1. POST /auth/admin/login              { email, password } → accessToken
2. POST /subjects                      { name }            → subjectId
3. POST /classes                       { name }            → classId
4. POST /chapters                      { name, order, classId, subjectId } → chapterId
5. POST /audio-lectures      (multipart: audio, image?, title, order, chapterId, ...)
   POST /keyword-revisions   (multipart: audio, image?, title, duration, order, chapterId, ...)
6. POST /quizzes                       { title, type, chapterId?, ... } → quizId
7. POST /quizzes/:quizId/questions     (multipart, one question)
   or POST /quizzes/:quizId/questions/import  (multipart file=.docx/.xlsx, bulk)
8. Publish: PATCH /audio-lectures/:id/status, PATCH /quizzes/:id { isActive: true }, ...
9. POST /subscriptions/plans + PATCH /subscriptions/plans/:id/status
```

New lectures, revisions, quizzes and plans are created **inactive** — toggle them on to publish.

---

## 4. Endpoint reference

Legend — **Auth**: `Public`, `S` = STUDENT, `A` = ADMIN + SUPER_ADMIN, `SA` = SUPER_ADMIN only, `Any` = any logged-in role.

### 4.1 Auth — `/auth`
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/admin/login` | Public | `{ email, password (min 6) }` | `{ accessToken, user: { id, email, name, role } }` |
| POST | `/auth/admin/logout` | A | — | — |
| GET | `/auth/admin/me` | A | — | current admin |
| POST | `/auth/send-otp` | Public | `{ phone }` (10 digits, starts 6–9) | — |
| POST | `/auth/verify-otp` | Public + `x-device-id` | `{ phone, otp (6 digits) }` | `{ accessToken, user: { id, phone, name, targetYear, city, schoolName, profileComplete } }` |
| POST | `/auth/register` | S | `{ name (min 2), targetYear? (int ≥ current year), city?, schoolName? }` | user profile (sets `profileComplete=true`) |
| POST | `/auth/logout` | S | — | — |
| GET | `/auth/me` | S | — | user profile |

### 4.2 Admins — `/admins` (A)
| Method | Path | Body / Query |
|---|---|---|
| GET | `/admins` | `?page&limit&search` |
| GET | `/admins/:id` | — |
| POST | `/admins` | `{ email, password (min 6), name?, role? }` |
| PATCH | `/admins/:id` | any of `{ email, name, role, isActive }` (≥1 required) |
| PATCH | `/admins/:id/status` | — (toggles `isActive`) |
| DELETE | `/admins/:id` | SA only |

### 4.3 Users (students) — `/users` (A)
| Method | Path | Body / Query |
|---|---|---|
| GET | `/users` | `?page&limit&search` |
| GET | `/users/:id` | — |
| POST | `/users` | `{ phone, name?, targetYear?, city?, schoolName?, profileComplete? }` |
| PATCH | `/users/:id` | any of the create fields (≥1 required) |
| PATCH | `/users/:id/status` | — (toggles `isActive`) |
| PATCH | `/users/:id/reset-device` | — (clears bound `deviceId`) |
| DELETE | `/users/:id` | SA only |

### 4.4 Subjects — `/subjects` (A)
| Method | Path | Body / Query |
|---|---|---|
| GET | `/subjects` | `?page&limit&search` |
| GET | `/subjects/:id` | — |
| GET | `/subjects/slug/:slug` | — |
| POST | `/subjects` | `{ name (min 2) }` |
| PATCH | `/subjects/:id` | `{ name }` |
| DELETE | `/subjects/:id` | SA only |

### 4.5 Classes — `/classes` (A)
| Method | Path | Body / Query |
|---|---|---|
| GET | `/classes` | `?page&limit&search` |
| GET | `/classes/:id` | — |
| GET | `/classes/slug/:slug` | — |
| POST | `/classes` | `{ name }` |
| PATCH | `/classes/:id` | `{ name }` |
| DELETE | `/classes/:id` | SA only |

### 4.6 Chapters — `/chapters` (A)
| Method | Path | Body / Query |
|---|---|---|
| GET | `/chapters` | `?page&limit&search&classId&subjectId` |
| GET | `/chapters/:id` | — |
| GET | `/chapters/slug/:slug` | — |
| POST | `/chapters` | `{ name, order (int ≥1), classId, subjectId }` |
| PATCH | `/chapters/:id` | any of `{ name, order }` |
| DELETE | `/chapters/:id` | SA only |

### 4.7 Audio lectures — `/audio-lectures`
| Method | Path | Auth | Body / Query |
|---|---|---|---|
| GET | `/audio-lectures` | Any | `?page&limit&search&chapterId&isActive` |
| GET | `/audio-lectures/:id` | Any | — |
| GET | `/audio-lectures/chapter/:chapterId/slug/:slug` | Any | — |
| POST | `/audio-lectures` | A | multipart: `audio` (file, required), `image?` (file), `title`, `description?`, `order`, `chapterId`, `isActive?` — duration is read from the file |
| PATCH | `/audio-lectures/:id` | A | multipart: any of the above, plus `removeImage?` (`"true"`) |
| PATCH | `/audio-lectures/:id/status` | A | — (toggles `isActive`) |
| DELETE | `/audio-lectures/:id` | SA | — |

### 4.8 Keyword revisions — `/keyword-revisions`
Same as audio lectures, except `duration` (seconds, int ≥1) **is required** on create.

| Method | Path | Auth |
|---|---|---|
| GET | `/keyword-revisions` | Any |
| GET | `/keyword-revisions/:id` | Any |
| GET | `/keyword-revisions/chapter/:chapterId/slug/:slug` | Any |
| POST | `/keyword-revisions` | A |
| PATCH | `/keyword-revisions/:id` | A |
| PATCH | `/keyword-revisions/:id/status` | A |
| DELETE | `/keyword-revisions/:id` | SA |

### 4.9 Quizzes & questions — `/quizzes` (A)
| Method | Path | Body / Query |
|---|---|---|
| GET | `/quizzes` | `?page&limit&search&chapterId&type&isActive=true\|false` |
| GET | `/quizzes/:id` | — |
| POST | `/quizzes` | `{ title, description?, type, chapterId? (required if CHAPTER), durationMinutes?, correctMarks?, wrongMarks?, skippedMarks?, isActive? }` |
| PATCH | `/quizzes/:id` | any of the above (`chapterId: null` detaches; rejected for CHAPTER quizzes) |
| DELETE | `/quizzes/:id` | SA only |
| GET | `/quizzes/:quizId/questions` | `?page&limit&search&isActive` |
| GET | `/quizzes/:quizId/questions/:questionId` | — |
| POST | `/quizzes/:quizId/questions` | multipart (see below) |
| POST | `/quizzes/:quizId/questions/import` | multipart `file` = .docx / .xlsx → `{ imported, skipped: [...] }` |
| PATCH | `/quizzes/:quizId/questions/:questionId` | multipart (see below) |
| DELETE | `/quizzes/:quizId/questions/:questionId` | SA only |

**Create question (multipart)**
| Field | Type | Notes |
|---|---|---|
| `question` | text | required |
| `explanation` | text | optional |
| `isActive` | `"true"`/`"false"` | default true |
| `options` | JSON string | `[{ "text": "…", "isCorrect": false }, …]` — 2–6 options, exactly one correct; `text` may be empty if that option has an image |
| `image` | file | question image |
| `explanationImage` | file | |
| `optionImage0`…`optionImage5` | file | matches index in `options` |

**Update question** — same fields, all optional, plus `removeImage`, `removeExplanationImage`, and per-option `removeImage` inside `options`. An option keeps its existing image (by index) unless replaced or removed.

**Import formats**
- **.xlsx** — header row with `Question`, `Option A`…`Option F`, `Answer` (letter), optional `Explanation`. One question per row.
- **.docx** — numbered questions (`Q1.`, `1)`, `Question 2:`), lettered options, and an `Ans:` line; images and equations are supported.

Invalid questions are skipped and reported; valid ones are imported.

### 4.10 Subscriptions — `/subscriptions`
| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/subscriptions/checkout` | S | `{ planId }` | `{ subscriptionId, orderId, amount, currency, keyId, plan }` |
| POST | `/subscriptions/verify-payment` | S | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` | activated subscription (idempotent) |
| GET | `/subscriptions/me` | S | — | `{ isSubscribed, current, upcoming[], accessExpiresAt }` |
| GET | `/subscriptions/plans` | A | `?page&limit&search&isActive` | |
| GET | `/subscriptions/plans/:id` | A | — | |
| POST | `/subscriptions/plans` | A | `{ name, description?, price, originalPrice? (≥ price), currency? (3 letters), durationDays, features?: string[], order?, isActive? }` | |
| PATCH | `/subscriptions/plans/:id` | A | any of the above | |
| PATCH | `/subscriptions/plans/:id/status` | A | — (toggles `isActive`) | |
| DELETE | `/subscriptions/plans/:id` | SA | — (`409` if the plan has subscriptions — deactivate instead) | |

**Payment flow**
1. `checkout` creates a Razorpay order, a `PENDING` subscription and a `CREATED` payment.
2. The app opens Razorpay with `keyId`, `orderId`, `amount`.
3. `verify-payment` checks the signature → payment `SUCCESS`, subscription `ACTIVE`. If the user already has an active plan, the new one starts when that one ends (it shows under `upcoming`).

### 4.11 Dashboard — `/dashboard` (A)
| Method | Path | Query |
|---|---|---|
| GET | `/dashboard/overview` | — |
| GET | `/dashboard/user-trends` | `?year` (default current year) |
| GET | `/dashboard/active-users` | `?days` (DAU series length, default 30) `&inactiveAfterDays` (default 30) |
