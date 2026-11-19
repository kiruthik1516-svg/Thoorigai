# Settings flows

- **GST:** `/settings/gst` displays configured invoice GST details. Users with the relevant permission can save changes.
- **Users and roles:** `/settings/users` is admin-only. Role changes are audited; see [users-and-roles.md](users-and-roles.md).
- **Trainer assignments:** `/settings/trainers` is admin-only and assigns staff to courses. Assignments restrict what staff can see; see [trainer-assignments.md](trainer-assignments.md).
- **Brand information:** `/settings/brand` shows the display, legal, contact, web and invoice-prefix settings. Admins can edit them (`POST /api/brand`); other roles see them read-only.
