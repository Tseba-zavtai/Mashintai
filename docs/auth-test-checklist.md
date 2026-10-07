# Registration and phone-login verification

Server changes deployed to the linked Tureesly Supabase project:
- `dan-oauth-callback`: incomplete DAN registration can resume; consent is saved even if an auth trigger already created the profile.
- `dan-auth-finish-signup`: confirms consent and identity, saves credentials, then atomically commits profile/default contact/completion.
- `change-login-phone`: requires the existing password, rejects duplicate login numbers, retains the password, and rolls credentials back if the database save fails.
- `20261005000000_atomic_login_phone_profile.sql`: service-role-only transaction for profile/default-contact updates. Existing ads and other contact numbers remain unchanged.
- `20261005001000_atomic_default_contact_phone.sql`: authenticated owners select a default contact atomically; a failed selection cannot clear their previous default.

Client changes require a new build. Terms are accepted **before** DAN authentication, not at the end. Terms that failed to load cannot be accepted. Auth-state work is deferred outside the auth lock. Incomplete DAN profiles return to onboarding after restart.

## Phone meanings

- **Profile → Нэвтрэх дугаар солих** changes the actual login number after password confirmation. The password does not change. The new number also becomes the default contact number.
- The pencil beside the profile opens **Миний холбоо барих дугаарууд**. This changes only the contact number used for ads/requests, not the login number. An office number can be kept here without changing how the user logs in.
- Saving a number is not SMS verification of ownership. DAN verifies the citizen; this flow does not claim that DAN verifies the entered phone number.

## New-build device checklist (Android and iOS)

1. Register a previously unregistered DAN identity. Check terms → DAN → phone/password/confirmation → success.
2. Log out, then log in with the saved 8-digit number and exact password. Wrong password must fail.
3. Stop after DAN but before saving credentials. Restart: onboarding should reopen. Log out there, then repeat registration: the same identity must resume, not duplicate.
4. Use an already registered number during onboarding: clear duplicate-number error, with onboarding still available.
5. In Profile, change the login number with the existing password. Check displayed login number/default contact, log out, and log in using new number + same password. Old login number must fail.
   Check that previous listings still appear in “Миний зарууд”; ownership follows the account ID, not the old phone number.
6. Try wrong password and another account's number while changing login number. Existing credentials must remain usable.
7. Add/select an office number with the profile pencil. Restart and confirm contact selection persists; login number remains unchanged.
8. Use “Нууц үг мартсан уу?” → DAN → new password. Log out and verify new password succeeds, old password fails.
9. Disable network before opening terms. The error message must not allow consent. Reconnect and reopen terms to retry.

## Automated checks

`node --test tests/auth-flows.cjs` executes the actual handlers with isolated service doubles. It covers credentials mapping, duplicate numbers, authentication, rollback, consent, completion/retry, DAN callback resume and auth-lock deferral. It does not replace a real DAN/device end-to-end run.

Also run TypeScript, lint and Expo exports for both platforms. No real user's password or DAN identity is needed for these automated checks.

`node tests/auth-live-smoke.cjs` performs only unauthenticated rejection and invalid-callback checks against the deployed endpoints. `tests/auth-db-smoke.sql` checks database function privileges/invalid input inside a rolled-back transaction.
