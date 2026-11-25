# Certificate flow

1. An admin opens a student's certificate page and issues the certificate. Printing issues it first if needed.
2. The database issues it in one transaction (`issue_certificate`): it checks the fee is fully paid (HTTP 409 otherwise), allows one active certificate per student and course, numbers it `TAI-<year>-nnnn` from a sequence, takes the student's name and course from the student record, and creates the verification record in the same step.
3. **Revoke** (admins, with a reason) keeps the record, marks it revoked and makes its QR code stop verifying. A replacement can then be issued.

Bulk issue by batch is not implemented.
