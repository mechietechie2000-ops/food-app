# Food App

## Run locally

Install dependencies at the repository root and in the backend:

```sh
npm install
npm --prefix backend install
```

Start both the API and frontend together while developing:

```sh
npm run dev:all
```

The frontend runs at `http://localhost:5316`; the API listens on port `5005`.
The frontend proxies `/api` requests to the API. User accounts and push
subscriptions are stored in `backend/data/food-app.sqlite`.
Stop both services with **Ctrl+C**.

## Food data

On API startup, the final household schema in
`backend/food_app_schema_final.sql` is applied and the idempotent sample dataset
in `backend/food-app-sample-data.sql` is loaded into the same SQLite database.
Fresh vegetable purchases are stored as separate inventory lots; pantry staples
are always available and are not tracked as inventory. Grocery entry and
purchase confirmation are manual. Dal sides rotate through Moong, Toor, Masoor,
Rajma, Chana Masala, and Black Beans on alternate dinner days; they are separate
plan entries from the vegetable dish and are not inventory-tracked. Receipt
photos are preview-only; receipt parsing is not implemented. For kids tiffin,
lunch, and dinner, mark a plan **Skipped** when it was not eaten; an unskipped
plan is assumed cooked after its date passes and required fresh inventory is
updated then. Adult tiffin keeps its separate manual confirmation.

## Weekly plan, reminders and catch-up

The API process runs a small scheduler (checked every minute, server local
time). Times and thresholds live in `backend/config/rules.json`:

| What | When | Notes |
| --- | --- | --- |
| Weekly plan generation | Sunday 18:00, for the week ahead | Fills only **empty** slots; a manual plan row is never changed. The current week is also checked, so a missed run is made up for. Turn off with `weekly_generation_enabled`. |
| Evening confirmation push | 19:30 daily | One push listing today's unanswered meals; sets `notified_at`. |
| Soak/marination warning | 20:00 daily | Only if tomorrow's planned recipe has `requires_soak_marination = 1`. |
| Retry push | `push_retry_hours` (3) after `notified_at` | One retry per row; `retry_sent_at` stops a second one. |

Every scheduled run is recorded in `scheduler_run_log`, so restarting the
server never resends a push or regenerates a week twice. If nobody is
subscribed to push, `notified_at` is left empty and the in-app backstops below
still apply.

The app itself is the backstop when a push is lost: meals still unanswered
within `catchup_lookback_days` (7) show on the Home screen as a "needs your
attention" banner, a catch-up dialog opens on app open (Cooked / Skipped /
Away per meal), and the Home and Confirm icons in the bottom bar carry badges.
**Away** also writes an `away_log` row so the planner ignores that day.

Plan generation (`backend/services/mealPlanner.js`, `decideMeal()`) applies the
spec's pipeline: required inventory (one lot is never promised to two meals),
cooldown, festival and dietary days, weekend non-veg/frozen preference, slot
rules, repeat avoidance, then soonest-expiring produce first. Tiffin slots come
from the `tiffin_schedule` table; the seeded default is Mon/Tue adult, Wed/Fri
kids, other days none. Change a row's `tiffin_type` to change the pattern.
Menu → **Generate this week** runs the same generator on demand.

Run the backend tests (in-memory database, no network) with:

```sh
npm --prefix backend test
```

## Test on a phone

For phone/PWA testing, use the bundled app instead of the development server;
it builds the frontend and starts the API and preview server together:

```sh
FOOD_APP_HOST=your-device.your-tailnet.ts.net npm run app
```

The preview server uses port `5316` and proxies `/api` to the API on port `5005`,
so the existing Tailscale Serve route can stay unchanged. Stop both services
with **Ctrl+C**.

Set only the hostname (no scheme or path); Vite allows that hostname and rejects
others. For desktop development through Tailscale with hot reload, use:

```sh
FOOD_APP_HOST=your-device.your-tailnet.ts.net npm run dev
```

## Push notification testing

Copy `.env.example` to `.env`, set a strong `JWT_SECRET`, and generate a VAPID
key pair with `backend/node_modules/.bin/web-push generate-vapid-keys`. Put the generated keys and a
`VAPID_SUBJECT` mailto address in `.env`, then restart the backend.

Sign in, enable notifications for the current browser/device, then select
**Send test notification** in notification settings on the weekly planner. Each
device gets its own subscription under the signed-in account.

For phone testing, deploy the frontend and API behind HTTPS on the staging
origin. On iPhone/iPad (iOS/iPadOS 16.4 or later), open the site in Safari,
choose **Add to Home Screen**, launch the installed app, sign in, and enable
notifications. On Android, use an up-to-date browser and install the PWA before
testing background delivery. Permission must be requested from a user gesture.

For production, configure a strong `JWT_SECRET` and valid VAPID settings.


## Start 
FOOD_APP_HOST='<hostname>' npm run app

## Start in background?

## Kill / Stop 
npm run app starts Node child processes for the API and frontend. Killing the npm process can leave those children running, so ps | grep npm won’t necessarily show them.

Find the process serving port xxxx:
``` lsof -nP -iTCP:5316 -sTCP:LISTEN ```

Check the listed PID before stopping it:

``` ps -p <PID> -o pid,ppid,command ```

Then stop that specific process:

```kill -TERM <PID>```

The backend may still be running on port 5005. Check it the same way:
```lsof -nP -iTCP:5005 -sTCP:LISTEN```

Stop its specific PID with kill -TERM <PID> too. Replace <PID> with the number shown by lsof; don’t include the angle brackets.