# Notification & Tracking Service Documentation

## Overview
The Notification & Tracking Service (Epic WH-200) provides a robust infrastructure for reliable worker notifications, shift reminders, and location-based tracking (Geofence & GPS).

## Architecture

### 1. Notification Pipeline
- **Scheduling**: Notifications are generated 48 hours in advance (rolling window) by the `NotificationScheduler.ts` service.
- **Queue**: Scheduled notifications are stored in the `scheduled_notifications` table with a `pending` status.
- **Worker**: A background Cron job (`packages/notification-worker`) polls for pending notifications due now/past.
- **Delivery**: The worker uses `expo-batch-push` (via `@repo/notifications`) to send payloads to Expo's Push API.

### 2. Location Tracking
- **iOS**: Uses `expo-location` via `BackgroundFetch` logic.
- **Android**: Uses a `Foreground Service` with a persistent notification ("Tracking active") to ensure reliability.
- **Geofencing**: Shifts with valid lat/long coordinates automatically register geofences on the mobile device. Entering a geofence triggers a local "Tap to Clock In" notification.

## Database Schema
- **`scheduled_notifications`**: Stores the queue of upcoming alerts.
- **`device_tokens`**: Maps `workerId` to Expo Push Tokens.
- **`worker_notification_preferences`**: Stores user toggles (e.g., "Night Before" enabled/disabled).

## Setup & Configuration

### Environment Variables
Ensure these are set in `packages/api/.env` and `apps/workers/.env`:
```bash
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_ACCESS_TOKEN=your_expo_token # For sending pushes
```

### Android Permissions
The mobile app (`apps/workers`) requires the following permissions in `app.json` for foreground tracking:
- `android.permission.FOREGROUND_SERVICE`
- `android.permission.FOREGROUND_SERVICE_LOCATION`
- `android.permission.ACCESS_BACKGROUND_LOCATION`

## Troubleshooting

### Notifications Not Sending
1. Check `scheduled_notifications` table: Are rows created? Is status `pending` or `sent`?
2. Check `device_tokens`: Does the user have a valid token?
3. Check Worker Logs: Is the cron job running? (`bun run worker`)

### Location Not Updating
1. **iOS**: Ensure "Always Allow" location permission is granted.
2. **Android**: Ensure the "Tracking active" notification is visible in the status bar.
3. **Geofencing**: Verify the venue has valid Lat/Lng in the database.

## API Reference
- `POST /devices/register`: Store a push token.
- `GET /preferences`: Get worker settings.
- `PATCH /preferences`: Update worker settings.
