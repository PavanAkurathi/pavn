# @repo/email

Shared email service package for sending transactional emails in the Antigravity SaaS platform. Wraps the [Resend](https://resend.com) SDK.

## Features

-   **Resend Integration**: Simple API for sending emails.
-   **React Templates**: Supports React components for email content (future implementation).

## Usage

```ts
import { sendOtp } from "@repo/email";

await sendOtp("user@example.com", "123456");
```

## Configuration

Ensure the `RESEND_API_KEY` environment variable is set in your application.
