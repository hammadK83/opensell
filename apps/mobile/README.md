# Mobile API address

The app reads `EXPO_PUBLIC_API_URL` when Expo bundles it. Set it to the API **origin** (for example, `http://127.0.0.1:5000`), without `/api/v1` or a trailing path. Both the authentication and protected API clients use this address.

For local development, copy `.env.example` to `.env.local` in this directory and change the address to one your device can reach. A physical phone usually needs the development computer's private LAN address. Local HTTP is accepted only for loopback and private LAN addresses in development. HTTPS also works in development.

For a release build, supply `EXPO_PUBLIC_API_URL` with your real HTTPS API origin in the build environment or an untracked `.env.production.local` file. There is no built-in production address. A missing or invalid address stops the app during startup, and release code rejects HTTP. The variable is public in the app bundle, so do not place credentials or secrets in it.

Expo reads `.env` files for CLI commands and replaces `EXPO_PUBLIC_` references in the client bundle. Changing this address requires a new bundle or build. See the [Expo SDK 55 Metro configuration reference](https://docs.expo.dev/versions/v55.0.0/config/metro/#environment-variables) and [Expo environment variable guide](https://docs.expo.dev/guides/environment-variables/).
