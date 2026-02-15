# Pavn Workers App (`apps/workers`)

The mobile application for gig workers, built with **Expo (React Native)**.

## Features
- **Shift Discovery**: Browse and accept available shifts.
- **Schedule**: View upcoming and past shifts.
- **Clock-In/Out**: Geofence-validated attendance tracking.
- **Profile**: Manage worker profile and availability.

## Running Locally

1.  **Install Dependencies**:
    ```bash
    # From root
    bun install
    ```

2.  **Start Expo**:
    ```bash
    cd apps/workers
    npx expo start
    ```

3.  **Run on Device/Simulator**:
    - Press `i` to open in iOS Simulator.
    - Press `a` to open in Android Emulator.
    - Scan the QR code with Expo Go on a physical device (requires being on the same Wi-Fi).

## Configuration

- **`app.json`**: Expo configuration (Scheme: `workers://`, Icons, Permissions).
- **`lib/config.ts`**: API URL configuration (defaults to `localhost:4005` or LAN IP).

## Troubleshooting

- **"Network request failed"**: Ensure your backend is running (`bun run dev` in root) and your mobile device is on the same network. Check `lib/config.ts` if IP detection is incorrect.
- **"Invalid Origin"**: Ensure your IP or scheme (`workers://`) is added to the `trustedOrigins` in `packages/auth/src/auth.ts`.
