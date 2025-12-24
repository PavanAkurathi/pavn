# @repo/email

Transactional email service for Antigravity SaaS, built on [Resend](https://resend.com).

## Features
- **OTP Verification**: Templated emails for one-time passwords.
- **Environment Aware**: Logs to console in development, sends real emails in production.
- **Type-safe**: Built with TypeScript.

## Setup

Ensure your `.env` file contains the Resend API key:

```bash
RESEND_API_KEY=re_123...
```

## Usage

```typescript
import { sendOtp } from "@repo/email";

await sendOtp("user@example.com", "123456");
```

## Templates
- `OtpEmail`: Verification code template.
