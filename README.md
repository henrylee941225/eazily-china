# Eazily China

A China travel app built with React, TypeScript, Vite, Supabase, and Capacitor.

```bash
npm ci --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

Fill in the environment values before starting the app.

Map, restaurant, and transfer place searches call AMap Web Service directly from
the client. Set `VITE_AMAP_WEB_SERVICE_KEY` to a Web Service API key for local
or controlled mobile testing. This key is embedded in the client bundle and is not suitable
for unrestricted production distribution. The `amap-poi` Edge Function remains
available for a later server-side deployment. Route planning calls the existing
`amap-route` Edge Function, which needs `AMAP_WEB_SERVICE_KEY` on the backend.
MapTiler renders the returned POIs and routes.

For iOS and Android setup, build commands, and native configuration, see
[the mobile development guide](docs/mobile.md).
