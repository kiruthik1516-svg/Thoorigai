# Reports flow

1. Open **Reports**. Both sections (Financial and Staff & Academic) share one date bar; it defaults to the current month through today, with 7d, 30d, This month and YTD presets.
2. **Financial** (admins only): revenue, GST, payment methods and velocity use payments dated inside the range. The cohort is every student enrolled on or before the end date, and their paid amount, balance and paid status are as of the end date (a student with no payment by then shows nothing paid). Cancelled invoices never count. **Download CSV** exports exactly these numbers plus the period's invoices.
3. **Staff & Academic**: attendance and assessments inside the range for the courses the viewer can see. **Download CSV** is a private, no-store server export of the same attendance and assessment summary; it holds no money, so staff and admins get the same file.

Reports read every row in pages, so long ranges are complete. Attendance uses one rule everywhere: Present and Late count as attended, Exempt sessions are left out of the percentage, and below 75% is flagged. The pass mark is 40% of the maximum score. Students with no gender recorded are shown as "Not recorded", not as "Other". CSV cells that could run as spreadsheet formulas are prefixed with an apostrophe. Staff never receive fees, paid amounts or paid status.
