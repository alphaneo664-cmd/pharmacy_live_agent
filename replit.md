# Pharmacy Analyst & POS Dashboard

## Run

The Replit workflow runs the existing TypeScript/Express server on port 3001:

```bash
npm run dev
```

The frontend is served by Vite middleware and the production build uses `npm run build && npm start`.

## Brand and production protection

- Browser pages and the signed-in dashboard display `© 2026 ChitrolokStudio. All Rights Reserved.`; HTML metadata and an HTML comment also identify the copyright owner.
- Production builds disable source maps and obfuscate emitted frontend JavaScript as a deterrent to casual copying. Obfuscation cannot prevent a visitor from inspecting code sent to their browser; secrets and database credentials must remain server-side.
- Set `ALLOWED_HOSTS` in the production environment to a comma-separated list of exact authorized hostnames, without URL schemes or paths. Production requests are blocked until it is configured; hostnames are matched exactly. State-changing requests also require a matching same-host `Origin`.
- Production responses include a restrictive Content Security Policy and browser security headers. Development preview does not enforce the production host allowlist.

## Database

- The dashboard uses the SQL Server settings from `.env` and does not generate or display mock database data.
- Database queries are read-only `SELECT` statements. The server validates analytics table, view, and column identifiers against `db-schema.json` before building the queries.
- If SQL Server is unavailable, analytics returns an explicit connection error instead of silently falling back to sample data.
- SQL Server compatibility is configured for legacy SQL Server 2000 with `encrypt: false`, `trustServerCertificate: true`, `tdsVersion: '7_1'`, and `enableArithAbort: true`.

## Dashboard

The command center includes daily purchases, live sales, employee and POS-counter performance, expenses, inventory valuation, and reorder alert metrics.
- Live analytics reads the supplied SQL Server 2000 header/detail tables (`Purchase` + `Purchase_sub`, `transactions` + `transactions_particulars`, and `Expense` + `Expense_Sub`) so line items are aggregated once instead of duplicating dashboard totals through detail-expanded views.
- Daily purchase totals use each posted purchase line's amount plus VAT (stored VAT amount, or VAT percentage × rate × quantity when the stored amount is zero) minus percentage and fixed item discounts.
- Live-sale revenue uses the net payable formula: item amount minus item percentage/fixed discounts minus the transaction-level discount. The live-sales table also shows the absolute difference between net payable and total paid as due.

## Authentication

- Authentication uses an isolated SQL Server pool from `DATABASE_URL` for `UserAuthDB`; the existing HDMS pool remains read-only and unchanged.
- Run the updated `sql/user-auth-schema.sql` while connected to `UserAuthDB` to add the display-name and pharmacy-settings storage alongside the existing authentication and report tables.
- Set `DATABASE_URL` and either `AUTH_JWT_SECRET` or `SESSION_SECRET` before using the sign-in screen.
- Passwords are bcrypt-hashed. Authentication uses an httpOnly, SameSite cookie containing a short-lived signed JWT.
- Pharmacy name, address, phone, and the uploaded PNG/JPEG logo are stored in `UserAuthDB` and shared across signed-in users. Profile name, email, and password changes require the current password.
- The navigation drawer includes report actions, daily expense/payment metrics, pharmacy settings, profile editing, and logo upload.
- Daily summary snapshots can be saved to `dbo.DailySummaryReports` in `UserAuthDB`; run the updated `sql/user-auth-schema.sql` before using the save action.
- The server automatically saves the previous day's summary at local midnight using `REPORT_TIME_ZONE` (default `Asia/Dhaka`). The save is upserted by report date, and a temporary database failure is logged without stopping the server.
- Hourly snapshots are upserted by UTC hour into `dbo.HourlySummaryReports` in `UserAuthDB`. Run `sql/user-auth-schema.sql` to create the hourly snapshot table.
- The hourly job refreshes inventory, saves stock valuation and daily purchase/sale/collection metrics, then emails the summary using `EMAIL_USER` and `EMAIL_PASS` from `.env` or Replit Secrets. The configured Gmail address sends the report to itself; missing credentials skip email delivery without preventing the snapshot save.