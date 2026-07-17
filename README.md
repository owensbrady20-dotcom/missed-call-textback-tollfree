# Missed Call Text-Back — Toll-Free Edition

If a call goes unanswered, the caller automatically gets a text back. Each business (or your own personal test line) is a "tenant" — one dedicated **Twilio toll-free number**, an optional forwarding phone, and a custom SMS template — managed from a password-protected admin console.

This is a from-scratch rebuild of the original local-number version, built specifically to avoid **A2P 10DLC** (brand + campaign registration through The Campaign Registry). Twilio is still the SMS/voice provider and the code is otherwise the same shape — only the number type changes.

## Why toll-free instead of a local number

A2P 10DLC applies to *local* (10-digit) numbers and requires registering a "brand" and a "campaign" through The Campaign Registry, including CTA (call-to-action / opt-in proof) vetting. **Toll-free numbers are not part of that system at all.** They go through a separate, lighter process called **Toll-Free Verification (TFV)** — submitted directly to Twilio, no TCR brand/campaign, no CTA vetting.

This matters if you've been hitting CTA rejection errors on campaign submissions, or if your business EIN isn't usable yet (e.g. a fresh EIN with an IRS processing delay) — TFV's form doesn't route through the same registry, so it isn't blocked by the same things. A toll-free number can also **send SMS immediately, unverified**, at lower throughput and with a higher chance of carrier filtering — enough to build and fully test this app end-to-end right now, with Toll-Free Verification submitted whenever your business info is ready.

## How it works

There are two ways a tenant can be set up, depending on `forwardingNumber`:

**Pattern A — tenant's real number stays their main number (the normal pitch for a business customer).** Their existing published number conditionally forwards to the assigned toll-free number only on no-answer/busy, at the carrier level. By the time Twilio sees the call, the carrier has already established it was missed, so `forwardingNumber` is left **blank** for this tenant: `POST /voice` skips any redial and texts the caller back immediately (no double-ring).

**Pattern B — the toll-free number itself is dialed directly** (e.g. your own quick test line, or a tenant willing to use the toll-free number as-is). Set `forwardingNumber` to the phone that should actually ring. `POST /voice` tells Twilio to `<Dial>` it with a timeout; if nobody answers (no-answer/busy/failed), Twilio calls `POST /voice/status` and we text back then.

In both cases, we send the caller an SMS (the tenant's custom template) via the Twilio REST API, and log the call. Every call is recorded in the database (`CallLog`), viewable per-tenant from the admin console.

## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ADMIN_TOKEN, PUBLIC_BASE_URL
npx prisma migrate dev --name init
npm run dev
```

Requires a reachable Postgres instance for `DATABASE_URL` (a local Postgres/Docker container, or Railway's hosted Postgres reachable from your machine). Use a **separate** database from the original local-number project — this app doesn't share data with it.

## Testing locally with ngrok (before deploying)

Twilio needs to reach your webhook over the public internet, so for local testing use ngrok:

```bash
ngrok http 3000
```

1. Set `PUBLIC_BASE_URL` in your `.env` to the ngrok `https://...` URL and restart the app.
2. In the Twilio Console, temporarily point a **toll-free** Twilio number's **Voice → "A call comes in"** webhook at `https://<ngrok-url>/voice` (POST).
3. Register that number as a business via the admin console (see below). To test Pattern B, set `forwardingNumber` to your own cell and call the toll-free number directly, letting it ring out. To test Pattern A, leave `forwardingNumber` blank and call your *real* number instead (with conditional forwarding set up per step 4 under Onboarding) — you should get a text back either way, and see a `CallLog` row via the admin console.
4. When done testing, point the number's webhook back at your deployed Railway URL.

## Getting a toll-free number and verifying it

1. **Buy a toll-free number** in the Twilio Console (Phone Numbers → Buy a Number → filter by "Toll-Free"). It works immediately for voice and can send SMS right away at low, unverified volume.
2. **Submit Toll-Free Verification** (Messaging → Senders → Toll-Free Verification, or via the Console prompt on the number itself) once your business details are ready: legal business name, address, website, use case description ("missed-call auto text-back"), a sample message, and how customers consent (e.g. "customer's number is texted only after they call this business's line and the call goes unanswered"). This is a single form — no brand, no campaign, no CTA vetting.
3. Verification typically takes a few business days. Traffic sent before verification completes may be filtered more aggressively by carriers, so treat unverified sending as good enough for building/testing, not for real customer volume.

## Deploying to Railway

1. Create a Railway project, add the **Postgres** plugin (this provides `DATABASE_URL` automatically). Use a separate Railway project/database from the original local-number app.
2. Connect this repo as a service (or `railway up` from the CLI).
3. In the service's variables, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `ADMIN_TOKEN`, and optionally `SMS_COOLDOWN_MINUTES` / `DEFAULT_DIAL_TIMEOUT_SECONDS`. Leave `PUBLIC_BASE_URL` for now.
4. Deploy once to get Railway's generated domain (`*.up.railway.app`).
5. Set `PUBLIC_BASE_URL` to that domain (no trailing slash) and redeploy — this value is used both to build the Dial callback URL and to validate Twilio's request signatures, so it must exactly match the URL Twilio actually calls.
6. Confirm `GET /healthz` returns `200 ok` over HTTPS.
7. The `start` script (`npx prisma migrate deploy && node src/server.js`) applies pending migrations on every deploy — no separate migration step needed.

## Onboarding a tenant (yourself first, then a business)

1. **Buy a toll-free Twilio number** for this tenant (Phone Numbers → Buy a Number → Toll-Free).
2. **Point its Voice webhook** at `https://<your-railway-domain>/voice` (POST) — Console → the number → Voice Configuration → "A call comes in".
3. **Register the tenant** at `https://<your-railway-domain>/admin` — enter the admin token once (stored in your browser), then fill in the "Add a business" form:
   - **Toll-free number**: the number from step 1.
   - **Forwarding number**: leave **blank** for the normal business pitch (Pattern A, step 4 below); only set this to an actual phone if the tenant is fine giving out the toll-free number directly (Pattern B).
   - **SMS template**: what the caller receives, e.g. `"Sorry we missed your call at Joe's Plumbing! We'll call you back shortly."`
   - **Owner notify number** (optional): a number that also gets a "you missed a call from X" text.
4. **For the normal pitch — the tenant keeps their existing published number.** They set their carrier's *conditional* call forwarding — forward on **no-answer/busy only**, not unconditional — to the toll-free number from step 1. This is carrier-specific; e.g. many US carriers use `*71<number>` to enable and `*73` to disable. There's no way to automate this per-carrier, so walk each business through their carrier's steps.
5. Test end-to-end: call the tenant's real number, let it ring out unanswered so the carrier forwards it, and confirm the text arrives and a call-log entry (outcome `no-answer`) shows up in the admin console for that business.

## Scaling to 10-15 new tenants a month

The multi-tenant schema (one `Business` row per tenant) already comfortably handles well beyond this volume — no architectural changes needed. What's built in specifically for steady onboarding at this pace:

- The admin console's businesses table is **paginated and searchable** (by name or number) via `GET /admin/businesses?search=&take=&skip=`, so the list stays usable as it grows past a page.
- Creating a business with a **duplicate toll-free number** returns a clean `409` error instead of a raw database error.
- Buying the number, pointing its webhook, and filling in the admin form (steps 1-3 above) is still manual per tenant — fine by hand at 10-15/month. If volume grows well beyond that, the natural next step is auto-purchasing numbers and auto-configuring webhooks via the Twilio API, which is intentionally not built here yet.

## Admin console

`https://<your-railway-domain>/admin` — prompts once for `ADMIN_TOKEN`, then lets you add businesses, search/page through them, toggle them active/inactive, and view each business's call log.

## What's deliberately not built yet

- Auto-purchasing toll-free numbers / auto-configuring webhooks via the Twilio API (currently manual, in the Twilio Console).
- Multi-admin-user logins (one shared `ADMIN_TOKEN` for now).
- Billing/subscriptions (e.g. Stripe).
- Business-hours-aware call handling.
- Retry queue for failed SMS sends (currently logged via `smsSkipReason` and not retried).
