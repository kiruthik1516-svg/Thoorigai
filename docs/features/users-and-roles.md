# Users and roles flow

1. An admin opens **Settings → Users and roles**. (The app has no MFA; admin sessions must sign in again after 12 hours.)
2. The admin chooses Admin, Staff or Pending for another profile. The control saves optimistically and restores the previous role if the request fails.
3. `admin_change_profile_role` checks that the caller is an admin, prevents changing your own role, keeps at least one admin (under an advisory lock), changes the profile and writes an audit-log row in one transaction.
4. **Disable User** never deletes the account: the role drops to Pending, the account is banned in Supabase Auth and its audit history stays intact. Approving the user again re-enables it.

The page is read-only for non-admin users. New account creation/invitations and email addresses are not part of this page.
