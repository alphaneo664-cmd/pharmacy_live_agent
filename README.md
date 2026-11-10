<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Fatema Pharmacy Stock and Order Manager

This contains everything you need to run your app locally.

## Run locally on Windows

Prerequisite: install Node.js 18 or newer.

1. Double-click `mom.bat`.
2. The launcher starts the server without leaving a black command window open,
   waits for the health endpoint, and opens `http://localhost:3001`.
3. To start it automatically with Windows, press `Win+R`, enter
   `shell:startup`, and place a shortcut to `mom.bat` in that folder.

The first launch installs npm packages if `node_modules` is missing. Startup
errors are written to `mom-server.log` next to the launcher.

## Database performance

The server keeps a reusable SQL connection pool and prevents overlapping syncs.
Supplier and medicine reads start together, while the UI continues to use its
cached snapshot during a database reconnect.

Selecting a supplier in the navigation tree or supplier dropdown performs one
targeted refresh for that supplier before showing its items. The full inventory
is not transferred for that selection, and the saved snapshot is used if the
database is temporarily unavailable.

SQL Server settings are read from `.env`. Optional timeout overrides are:

```env
DB_CONNECT_TIMEOUT=2500
DB_REQUEST_TIMEOUT=8000
```

Increase them for a slow local SQL Server instead of changing the UI or source.
