# Pavn Auth (`@repo/auth`)

Authentication logic and configuration utilizing **[Better-Auth](https://better-auth.com/)**.

## Features
- **Core Auth**: Session management, cookies, and tokens.
- **Plugins**:
    - **SMS OTP**: Initialized with Twilio credentials.
    - **Expo**: Mobile app authentication support.
    - **Organization**: Multi-tenant organization support.

## Usage

Import the auth instance in your API or Server Actions:

```typescript
import { auth } from "@repo/auth";
```

## Configuration
The main configuration is located in `src/auth.ts`.
It defines:
- **Trusted Origins**: Domains allowed to authenticate (Web, Mobile URL Schemes).
- **Database Hooks**: Logic to run on user creation (e.g., creating a default organization).
