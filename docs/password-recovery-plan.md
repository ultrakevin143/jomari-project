# Administrator-assisted password recovery: implementation plan

Status: implemented and verified locally. The new database migration has been applied to the local demonstration database; the separate Neon runtime needs that reviewed migration before recovery can work there. Existing account passwords are unchanged.

When a user cannot sign in, the login page should direct them to an administrator. The administrator verifies identity through an established independent channel and records the verification method and reason, never the person's answer. Knowledge-based questions alone are not reliable proof of identity.

An administrator opens Users, verifies the person through an independent channel, provides their own password, records the verification method and reason, and creates a 15-minute, single-use code. Share the code privately; the recipient enters it in the login screen's Forgot password form and chooses a new password. The code is stored only as a hash, and redemption revokes existing sessions. No automatic message or email is sent. The service does not itself verify the claimed identity: the administrator is responsible for that verification. Never record verification answers in the method or reason fields. Resetting oneself is blocked; loss of the only administrator requires an offline recovery procedure.

The local integration suite checks expiry, single use, administrator reauthentication failure, wrong-role and cross-tenant attempts, simultaneous redemption, session invalidation, hashed token storage and audit redaction. Rate limits are process-local; production needs shared throttling, a secure identity-verification procedure and a documented offline administrator recovery process.

No automatic identity-verification service, delivery channel, MFA or production deployment is implemented.
