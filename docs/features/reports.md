# Reports flow

1. Open **Reports**. The default date range is the current month through today; change start/end dates and select **Apply date range** to recompute the summary in PostgreSQL.
2. Select **Download CSV** to receive a private, no-store CSV summary for the selected dates, built by the authenticated server route. Cells that could run as spreadsheet formulas (starting with `=`, `+`, `-` or `@`) are prefixed with an apostrophe.

Enrollment and course mix use student creation dates; payment revenue uses payment dates. Outstanding balances and eligibility are current values for students enrolled during the selected range. Values use the shared INR formatter.
