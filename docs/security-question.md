# Password changes and security questions

Status: verified against local PostgreSQL. The password-recovery and security-question migrations have also been applied to the configured Neon schema; table access was checked without modifying account data.

After signing in, open **Security settings** and set a question and answer. The answer is saved as a salted scrypt hash and is not returned by the API or written to the audit log. Answers are trimmed, Unicode-normalized and compared without case sensitivity. Choose a hard-to-guess answer, and avoid including the answer in the question.

To change a password, enter the current password, answer the configured question, and choose a new password of at least 12 characters. The change signs the user out of all sessions and invalidates unused recovery codes. Changing an existing question requires the current password and current answer.

If the user has forgotten their answer, another administrator can open **Users → Reset security question**, independently verify the user, reauthenticate with their own password, and record the verification method and reason. Never enter the old answer into the method or reason. The administrator sets the replacement question and answer and conveys the answer privately. The reset revokes the user's sessions and unused recovery codes. An administrator cannot use this flow to reset their own question.

Someone who cannot sign in can use the separate [administrator-assisted recovery code](password-recovery-plan.md). No email delivery is provided. If the only administrator cannot sign in, an independently controlled offline recovery procedure is required.

A security question is an additional knowledge check, not a strong independent second factor. Answers can be guessed or discovered. The attempt limits are process-local; a production system needs shared rate limiting, a trusted identity-verification procedure, and preferably a phishing-resistant authenticator.
