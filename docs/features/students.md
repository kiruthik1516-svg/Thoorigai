# Student flows

1. Open **Students** to search and page through student records.
2. Use **New student** to enter student details. Admins enter the fee and may take an initial payment (one atomic transaction). Staff enrol at the course fee, which the database sets; they do not see or enter fees. The course must exist, and its stored name is used.
3. Open a student to review their profile, attendance and scores. Admins also see payments, invoice links and the certificate route.
4. **Edit** changes a student's details: staff for students in their own courses, admins for anyone. Only admins change the fee, and it cannot drop below what has been paid. Moving a student to another course requires an existing course.
5. **Delete** (admins only) removes a student with no invoices or certificates, along with their attendance and scores. A student with invoices must stay on record; cancel the invoices instead.

CSV import with dry-run and row-level errors, export, and duplicate-phone warnings are not connected yet.
