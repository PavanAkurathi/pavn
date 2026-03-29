# Email

`@repo/email` owns shared email delivery helpers and templates.

## Responsibilities

- OTP email delivery
- shared transactional email templates

## Source Layout

- `src/index.ts`
  - email send helpers
- `src/templates/otp.tsx`
  - OTP email template

## Boundary Rule

This package should contain shared email delivery concerns.

It should not own:

- auth/session policy
- notification scheduling
- business workflow decisions about who should receive an email
