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
**Send test notification** on the sample recipe page. Each device gets its own
subscription under the signed-in account.

For phone testing, deploy the frontend and API behind HTTPS on the staging
origin. On iPhone/iPad (iOS/iPadOS 16.4 or later), open the site in Safari,
choose **Add to Home Screen**, launch the installed app, sign in, and enable
notifications. On Android, use an up-to-date browser and install the PWA before
testing background delivery. Permission must be requested from a user gesture.

For production, configure a strong `JWT_SECRET` and valid VAPID settings.
