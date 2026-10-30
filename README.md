# Studio (mobile)

The Studio app for iPhone and Android, built with Expo. It talks to the Studio API at
`studio.cencori.com` (see `src/lib/config.ts`) and signs in with the same accounts.

## Preview on your phone

1. Install **Expo Go** from the App Store or Play Store.
2. `npm install`, then `npx expo start`.
3. Scan the QR code: with the Camera app on iPhone, or from Expo Go on Android. Phone and Mac on the same Wi-Fi
   (or `npx expo start --tunnel` if they can't be).

Edits reload on the phone as you save.

Push notifications don't work in Expo Go. They need a development build with an EAS project:
`npx eas-cli@latest init`, then `npx eas-cli@latest build --profile development`.

## What's in it

- Sign in with a password, or a 6-digit code by email.
- Home (today, what needs you, the brief), Inbox and conversations (step in, reply, hand back),
  Sales (orders and bookings), Money (totals, confirming transfers), AI (what the assistant does).
- Switching business, signing out.

Setup, Copilot, products, events and plans are still on studio.cencori.com.

## Where things are

- `src/app/` screens (Expo Router): `sign-in`, `(app)/(tabs)/*`, `(app)/conversation/[id]`, `(app)/profile`
- `src/lib/` session (token in secure storage), API client, workspace, data hooks, push, types
- `src/ui/` theme and small components

Point at another server with `EXPO_PUBLIC_API_URL` in `.env.local`.
