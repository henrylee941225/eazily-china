# Eazily China

A China travel app built with React, TypeScript, Vite, Supabase, and Capacitor.

```bash
npm ci --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

Fill in the environment values before starting the app.

Map, restaurant, and transfer place searches call the authenticated `amap-poi` Edge Function.
Maps requires sign-in.
Set `AMAP_WEB_SERVICE_KEY` as a Supabase Edge Function secret. Route planning
uses the `amap-route` Edge Function and the same backend secret.
MapTiler renders the returned POIs and routes.

For iOS and Android setup, build commands, and native configuration, see
[the mobile development guide](docs/mobile.md).
