# Verification email delivery

The backend starts a MongoDB-backed verification email worker after connecting to MongoDB. Registration saves the account and an encrypted delivery job in one document, then returns `verificationEmailDelivery: "queued"`. The worker submits the message to SMTP and makes up to five automatic attempts, with backoff capped at one minute. After five attempts, a user resend restarts attempts for the same link once any active lease has expired. Resend returns a neutral response after updating MongoDB; it does not wait for SMTP. An older delivered link remains valid until SMTP accepts its replacement. A pending link can also be used if delivery was accepted just before a worker stopped.

Set `VERIFICATION_EMAIL_KEY` to 32 random bytes encoded as 64 hexadecimal characters in every backend environment. Keep it secret and consistent across backend instances. Do not rotate it while delivery jobs are pending; this version supports one key and cannot decrypt jobs written with a previous key. [`.env.example`](.env.example) lists the required variable and safe placeholders. A unique random key was generated in this workspace's ignored development environment file; production must be configured separately.

The worker uses a short MongoDB lease so another instance can retry after a crash. Each claim consumes one of the five automatic attempts before SMTP starts, so a crash can consume an attempt even if delivery is uncertain. After an abandoned fifth attempt, manual resend can restart delivery once its lease and the account cooldown have expired. A crash after SMTP accepts a message may cause that same link to be emailed again. Multiple backend instances can run the worker concurrently. Resend responses do not wait for SMTP, though database load can still make response times vary. F08 covers verification link expiry.

# Authentication request limits

Login is limited to 10 attempts per account and 30 per client IP in 15 minutes. Registration allows 5 requests per IP per hour. Verification allows 20 per IP in 15 minutes; refresh allows 30; resend allows 10. Each rejected request returns HTTP 429, a `RATE_LIMITED` error, and a `Retry-After` header. The limits and windows can be changed with the `AUTH_*` settings in [`.env.example`](.env.example).

All backend instances use MongoDB counters, so requests cannot evade limits by switching servers. Counter keys use a keyed hash of the account email or client IP. The backend creates the collection's expiry index before accepting requests; its MongoDB role must be allowed to create that index. If MongoDB cannot record a rate-limit attempt, the request fails rather than proceeding unthrottled. Each fixed window resets at the next window boundary; MongoDB removes old counters later through the expiry index.

`TRUST_PROXY_HOPS` defaults to `0`, which ignores forwarded IP headers. Set it to the exact number of trusted reverse proxies only when the backend is accessible solely through that route and the last proxy appends or overwrites `X-Forwarded-For`. If the backend is behind a proxy while this value remains `0`, clients share the proxy's IP budget. Never use an unbounded proxy trust setting: a client-controlled forwarded address would let a caller evade IP limits. Verify the production network path before changing this setting.

# Password length compatibility

New local-account passwords are limited to 72 UTF-8 bytes because bcrypt ignores input after that boundary. The shared registration schema, mobile guidance, and backend model all reject longer new passwords instead of truncating them. Login intentionally has no matching upper bound so accounts created before this policy can still authenticate with their existing password.

No existing password hashes are changed by this policy. A future password-change or account-recovery feature should require affected users to choose a password within the current limit; migrating hashes cannot recover bytes that bcrypt previously ignored.
