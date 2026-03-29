# Notification Worker

`@repo/notification-worker` is a thin worker wrapper around the canonical notification dispatcher in `@repo/notifications`.

It should own:

- process orchestration for a background runtime
- worker-specific startup / polling concerns

It should not own:

- separate notification dispatch rules
- duplicate queue processing logic
- business decisions about when notifications exist

The actual delivery and retry behavior lives in [packages/notifications](/Users/av/Documents/pavn/packages/notifications).
