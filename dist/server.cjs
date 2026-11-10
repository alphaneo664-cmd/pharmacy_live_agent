var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express3 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_vite = require("vite");
var import_mssql4 = __toESM(require("mssql"), 1);

// src/utils/crystalFormulas.ts
function getSupplierCategory(postCode) {
  const code = (postCode || "").trim().toUpperCase();
  if (code === "B") {
    return "B-Grade";
  } else if (code === "A") {
    return "A-Grade";
  } else if (code === "M") {
    return "Market Collection";
  } else if (code === "F") {
    return "Broker Collections";
  } else if (code === "X") {
    return "Others";
  } else {
    return "Unknown";
  }
}
function getPercentage(discPct = 0, retailDiscount = 0) {
  const p = discPct === 0 ? retailDiscount : discPct;
  return Number(p.toFixed(2));
}
function getSaleRate(rate = 0, percentage = 0) {
  const saleRate = rate - percentage / 100 * rate;
  return Number(saleRate.toFixed(2));
}

// auth.ts
var import_express = require("express");
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_mssql = __toESM(require("mssql"), 1);
var AUTH_COOKIE = "pharmacy_auth";
var AUTH_ISSUER = "fatema-pharmacy";
var SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1e3;
var PASSWORD_MIN_LENGTH = 8;
var authPool = null;
var authPoolPromise = null;
function authSecret() {
  const secret = process.env.AUTH_JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Authentication is not configured. Set AUTH_JWT_SECRET or a SESSION_SECRET with at least 32 characters.");
  }
  return secret;
}
function authDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Authentication database is not configured. Set DATABASE_URL for UserAuthDB.");
  }
  const parsed = import_mssql.default.ConnectionPool.parseConnectionString(connectionString);
  return {
    ...parsed,
    connectionTimeout: Number(process.env.AUTH_DB_CONNECT_TIMEOUT || 5e3),
    requestTimeout: Number(process.env.AUTH_DB_REQUEST_TIMEOUT || 8e3),
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 3e4,
      ...parsed.pool || {}
    },
    options: {
      ...parsed.options || {},
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true
    }
  };
}
async function getAuthPool() {
  if (authPool?.connected) {
    return authPool;
  }
  if (!authPoolPromise) {
    authPoolPromise = new import_mssql.default.ConnectionPool(authDatabaseConfig()).connect().then((pool) => {
      authPool = pool;
      return pool;
    }).catch((error) => {
      authPoolPromise = null;
      throw error;
    });
  }
  return authPoolPromise;
}
function normalizeUser(row) {
  return {
    id: Number(row.id),
    username: String(row.username),
    name: String(row.display_name || row.username),
    email: String(row.email),
    role: String(row.role || "user"),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}
function getCookie(request, name) {
  const header = request.headers.cookie;
  if (!header) return void 0;
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : void 0;
}
function issueToken(user) {
  return import_jsonwebtoken.default.sign(
    {
      sub: String(user.id),
      username: user.username,
      email: user.email,
      role: user.role
    },
    authSecret(),
    { expiresIn: "8h", issuer: AUTH_ISSUER }
  );
}
function readToken(request) {
  const token = getCookie(request, AUTH_COOKIE);
  if (!token) return null;
  try {
    const payload = import_jsonwebtoken.default.verify(token, authSecret(), { issuer: AUTH_ISSUER });
    if (typeof payload === "string" || !payload.sub || !payload.username || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}
function setAuthCookie(response, token) {
  response.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/"
  });
}
function clearAuthCookie(response) {
  response.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}
function clientAddress(request) {
  return request.ip || request.socket.remoteAddress || "unknown";
}
var attempts = /* @__PURE__ */ new Map();
function allowAuthAttempt(request) {
  const now = Date.now();
  const key = clientAddress(request);
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1e3 });
    return true;
  }
  if (current.count >= 12) return false;
  current.count += 1;
  return true;
}
function requestBody(request) {
  return request.body && typeof request.body === "object" ? request.body : {};
}
function validEmail(value) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function validUsername(value) {
  return value.length >= 3 && value.length <= 50 && /^[a-zA-Z0-9_.-]+$/.test(value);
}
function validationError(body, signup) {
  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (signup && !validUsername(username)) {
    return "Username must be 3\u201350 characters and contain only letters, numbers, dots, hyphens, or underscores.";
  }
  if (!validEmail(email)) return "Enter a valid email address.";
  if (password.length < PASSWORD_MIN_LENGTH || password.length > 128) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and 128 characters.`;
  }
  return null;
}
function databaseError(error) {
  return error instanceof Error ? error.message : "Authentication database is unavailable.";
}
var requireAuth = (request, response, next) => {
  const payload = readToken(request);
  if (!payload) {
    clearAuthCookie(response);
    response.status(401).json({ error: "Authentication required." });
    return;
  }
  response.locals.authUser = {
    id: Number(payload.sub),
    username: payload.username,
    email: payload.email,
    role: payload.role
  };
  next();
};
function createAuthRouter() {
  const router = (0, import_express.Router)();
  router.post("/signup", async (request, response) => {
    if (!allowAuthAttempt(request)) {
      response.status(429).json({ error: "Too many authentication attempts. Try again later." });
      return;
    }
    const body = requestBody(request);
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const error = validationError(body, true);
    if (error) {
      response.status(400).json({ error });
      return;
    }
    try {
      const pool = await getAuthPool();
      const existing = await pool.request().input("username", import_mssql.default.NVarChar(50), username).input("email", import_mssql.default.NVarChar(320), email).query("SELECT TOP 1 id FROM dbo.Users WHERE username = @username OR email = @email");
      if (existing.recordset.length > 0) {
        response.status(409).json({ error: "That username or email is already registered." });
        return;
      }
      const passwordHash = await import_bcryptjs.default.hash(password, 12);
      const result = await pool.request().input("username", import_mssql.default.NVarChar(50), username).input("email", import_mssql.default.NVarChar(320), email).input("passwordHash", import_mssql.default.NVarChar(255), passwordHash).query(
        `INSERT INTO dbo.Users (username, email, password_hash, display_name)
            OUTPUT INSERTED.id, INSERTED.username, INSERTED.email, INSERTED.role, INSERTED.created_at, INSERTED.display_name
            VALUES (@username, @email, @passwordHash, @username)`
      );
      const user = normalizeUser(result.recordset[0]);
      setAuthCookie(response, issueToken(user));
      response.status(201).json({ user });
    } catch (error2) {
      if (typeof error2 === "object" && error2 !== null && "number" in error2 && [2601, 2627].includes(Number(error2.number))) {
        response.status(409).json({ error: "That username or email is already registered." });
        return;
      }
      console.error("[Auth signup error]", databaseError(error2));
      response.status(503).json({ error: "Authentication service is temporarily unavailable." });
    }
  });
  router.post("/login", async (request, response) => {
    if (!allowAuthAttempt(request)) {
      response.status(429).json({ error: "Too many authentication attempts. Try again later." });
      return;
    }
    const body = requestBody(request);
    const identifier = String(body.identifier || body.email || body.username || "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier || password.length < PASSWORD_MIN_LENGTH || password.length > 128) {
      response.status(400).json({ error: "Enter your username or email and password." });
      return;
    }
    try {
      const pool = await getAuthPool();
      const result = await pool.request().input("identifier", import_mssql.default.NVarChar(320), identifier.toLowerCase()).query(
        `SELECT TOP 1 id, username, email, password_hash, role, created_at, display_name
           FROM dbo.Users
           WHERE LOWER(username) = @identifier OR LOWER(email) = @identifier`
      );
      const row = result.recordset[0];
      const passwordMatches = row ? await import_bcryptjs.default.compare(password, String(row.password_hash)) : false;
      if (!row || !passwordMatches) {
        response.status(401).json({ error: "Invalid username/email or password." });
        return;
      }
      const user = normalizeUser(row);
      setAuthCookie(response, issueToken(user));
      response.json({ user });
    } catch (error) {
      console.error("[Auth login error]", databaseError(error));
      response.status(503).json({ error: "Authentication service is temporarily unavailable." });
    }
  });
  router.get("/me", async (request, response) => {
    const payload = readToken(request);
    if (!payload) {
      clearAuthCookie(response);
      response.status(401).json({ error: "Not authenticated." });
      return;
    }
    try {
      const pool = await getAuthPool();
      const result = await pool.request().input("id", import_mssql.default.Int, Number(payload.sub)).query("SELECT TOP 1 id, username, email, role, created_at, display_name FROM dbo.Users WHERE id = @id");
      if (result.recordset.length === 0) {
        clearAuthCookie(response);
        response.status(401).json({ error: "Your account no longer exists." });
        return;
      }
      response.json({ user: normalizeUser(result.recordset[0]) });
    } catch (error) {
      console.error("[Auth me error]", databaseError(error));
      response.status(503).json({ error: "Authentication service is temporarily unavailable." });
    }
  });
  router.put("/profile", async (request, response) => {
    const payload = readToken(request);
    if (!payload) {
      clearAuthCookie(response);
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!allowAuthAttempt(request)) {
      response.status(429).json({ error: "Too many authentication attempts. Try again later." });
      return;
    }
    const body = requestBody(request);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!name || name.length > 100) {
      response.status(400).json({ error: "Name is required and must be 100 characters or fewer." });
      return;
    }
    if (!validEmail(email)) {
      response.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    if (currentPassword.length < PASSWORD_MIN_LENGTH || currentPassword.length > 128) {
      response.status(400).json({ error: "Enter your current password to confirm profile changes." });
      return;
    }
    if (newPassword && (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > 128)) {
      response.status(400).json({ error: `New password must be between ${PASSWORD_MIN_LENGTH} and 128 characters.` });
      return;
    }
    try {
      const pool = await getAuthPool();
      const existing = await pool.request().input("id", import_mssql.default.Int, Number(payload.sub)).query("SELECT TOP 1 id, password_hash FROM dbo.Users WHERE id = @id");
      const row = existing.recordset[0];
      if (!row) {
        clearAuthCookie(response);
        response.status(401).json({ error: "Your account no longer exists." });
        return;
      }
      if (!await import_bcryptjs.default.compare(currentPassword, String(row.password_hash))) {
        response.status(401).json({ error: "Current password is incorrect." });
        return;
      }
      const passwordHash = newPassword ? await import_bcryptjs.default.hash(newPassword, 12) : String(row.password_hash);
      const result = await pool.request().input("id", import_mssql.default.Int, Number(payload.sub)).input("name", import_mssql.default.NVarChar(100), name).input("email", import_mssql.default.NVarChar(320), email).input("passwordHash", import_mssql.default.NVarChar(255), passwordHash).query(
        `UPDATE dbo.Users
           SET display_name = @name, email = @email, password_hash = @passwordHash
           WHERE id = @id;
           SELECT TOP 1 id, username, email, role, created_at, display_name
           FROM dbo.Users WHERE id = @id`
      );
      const user = normalizeUser(result.recordset[0]);
      setAuthCookie(response, issueToken(user));
      response.json({ user });
    } catch (error) {
      if (typeof error === "object" && error !== null && "number" in error && [2601, 2627].includes(Number(error.number))) {
        response.status(409).json({ error: "That email address is already registered." });
        return;
      }
      console.error("[Auth profile update error]", databaseError(error));
      response.status(503).json({ error: "Profile could not be updated. Check that the updated UserAuthDB schema has been applied." });
    }
  });
  router.post("/logout", (request, response) => {
    clearAuthCookie(response);
    response.status(204).end();
  });
  return router;
}

// reports.ts
var import_mssql2 = __toESM(require("mssql"), 1);
async function saveDailySummaryReport(report, userId) {
  const pool = await getAuthPool();
  const reportJson = JSON.stringify({
    ...report,
    expiryCashAdjustment: report.expiryCashAdjustment ?? { amount: 0, transactions: 0 }
  });
  const transaction = new import_mssql2.default.Transaction(pool);
  const createdBy = userId !== null && Number.isInteger(userId) && userId > 0 ? userId : null;
  await transaction.begin();
  try {
    const request = transaction.request().input("reportDate", import_mssql2.default.Date, report.date).input("generatedAt", import_mssql2.default.DateTime, new Date(report.generatedAt)).input("createdBy", import_mssql2.default.Int, createdBy).input("dailyPurchaseAmount", import_mssql2.default.Decimal(19, 2), report.dailyPurchase.amount).input("purchaseTransactions", import_mssql2.default.Int, report.dailyPurchase.transactions).input("purchaseItems", import_mssql2.default.Int, report.dailyPurchase.items).input("liveSalesAmount", import_mssql2.default.Decimal(19, 2), report.liveSales.amount).input("salesTransactions", import_mssql2.default.Int, report.liveSales.transactions).input("salesItems", import_mssql2.default.Int, report.liveSales.items).input("paidAfterDiscount", import_mssql2.default.Decimal(19, 2), report.paidAfterDiscount).input("dueCollection", import_mssql2.default.Decimal(19, 2), report.dueCollection).input("totalCollection", import_mssql2.default.Decimal(19, 2), report.totalCollection).input("supplierPaymentAmount", import_mssql2.default.Decimal(19, 2), report.supplierPayment.amount).input("employeePaymentAmount", import_mssql2.default.Decimal(19, 2), report.employeePayment.amount).input("inventoryItems", import_mssql2.default.Int, report.inventory.items).input("inventoryUnits", import_mssql2.default.Decimal(19, 2), report.inventory.units).input("inventoryValuation", import_mssql2.default.Decimal(19, 2), report.inventory.valuation).input("expensesTotal", import_mssql2.default.Decimal(19, 2), report.expensesTotal).input("reportJson", import_mssql2.default.NVarChar(import_mssql2.default.MAX), reportJson);
    const result = await request.query(
      `UPDATE dbo.DailySummaryReports
       SET generated_at = @generatedAt,
           created_by = @createdBy,
           daily_purchase_amount = @dailyPurchaseAmount,
           purchase_transactions = @purchaseTransactions,
           purchase_items = @purchaseItems,
           live_sales_amount = @liveSalesAmount,
           sales_transactions = @salesTransactions,
           sales_items = @salesItems,
           paid_after_discount = @paidAfterDiscount,
           due_collection = @dueCollection,
           total_collection = @totalCollection,
           supplier_payment_amount = @supplierPaymentAmount,
           employee_payment_amount = @employeePaymentAmount,
           inventory_items = @inventoryItems,
           inventory_units = @inventoryUnits,
           inventory_valuation = @inventoryValuation,
           expenses_total = @expensesTotal,
           report_json = @reportJson,
           saved_at = GETDATE()
       WHERE report_date = @reportDate;

       IF @@ROWCOUNT = 0
       BEGIN
         INSERT INTO dbo.DailySummaryReports (
           report_date, generated_at, created_by,
           daily_purchase_amount, purchase_transactions, purchase_items,
           live_sales_amount, sales_transactions, sales_items,
           paid_after_discount, due_collection, total_collection,
           supplier_payment_amount, employee_payment_amount,
           inventory_items, inventory_units, inventory_valuation,
           expenses_total, report_json
         )
         VALUES (
           @reportDate, @generatedAt, @createdBy,
           @dailyPurchaseAmount, @purchaseTransactions, @purchaseItems,
           @liveSalesAmount, @salesTransactions, @salesItems,
           @paidAfterDiscount, @dueCollection, @totalCollection,
           @supplierPaymentAmount, @employeePaymentAmount,
           @inventoryItems, @inventoryUnits, @inventoryValuation,
           @expensesTotal, @reportJson
         );
       END;

       SELECT TOP 1 id, report_date, saved_at
       FROM dbo.DailySummaryReports
       WHERE report_date = @reportDate;`
    );
    await transaction.commit();
    const row = result.recordset[0];
    return {
      id: Number(row.id),
      date: report.date,
      savedAt: new Date(row.saved_at).toISOString()
    };
  } catch (error) {
    await transaction.rollback().catch(() => {
    });
    throw error;
  }
}
var reportNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
function savedPaymentAmount(row, column, snapshotKey) {
  const storedAmount = reportNumber(row[column]);
  if (storedAmount !== 0 || !row.report_json) return storedAmount;
  try {
    const snapshot = typeof row.report_json === "string" ? JSON.parse(row.report_json) : row.report_json;
    if (!snapshot || typeof snapshot !== "object") return storedAmount;
    const payment = snapshot[snapshotKey];
    if (!payment || typeof payment !== "object") return storedAmount;
    return reportNumber(payment.amount);
  } catch {
    return storedAmount;
  }
}
function savedExpiryCashAdjustmentAmount(row) {
  if (!row.report_json) return 0;
  try {
    const snapshot = typeof row.report_json === "string" ? JSON.parse(row.report_json) : row.report_json;
    if (!snapshot || typeof snapshot !== "object") return 0;
    const adjustment = snapshot.expiryCashAdjustment;
    if (!adjustment || typeof adjustment !== "object") return 0;
    return reportNumber(adjustment.amount);
  } catch {
    return 0;
  }
}
var dateKey = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};
var utcDateKey = (year, monthIndex, day = 1) => new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
var addDays = (value, days) => {
  const date = /* @__PURE__ */ new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
var emptyMetric = (period, label) => ({
  period,
  label,
  totalRevenue: 0,
  totalPurchases: 0,
  totalExpenses: 0,
  totalCollections: 0,
  totalExpiryCashAdjustments: 0,
  totalSupplierPayments: 0,
  totalEmployeePayments: 0,
  inventoryValuation: 0,
  netAfterPayments: 0,
  salesTransactions: 0,
  purchaseTransactions: 0,
  daysReported: 0
});
function aggregateMetric(rows, period, label) {
  const metric = emptyMetric(period, label);
  metric.totalRevenue = rows.reduce((sum, row) => sum + reportNumber(row.live_sales_amount), 0);
  metric.totalPurchases = rows.reduce((sum, row) => sum + reportNumber(row.daily_purchase_amount), 0);
  metric.totalExpenses = rows.reduce((sum, row) => sum + reportNumber(row.expenses_total), 0);
  metric.totalCollections = rows.reduce((sum, row) => sum + reportNumber(row.total_collection), 0);
  metric.totalExpiryCashAdjustments = rows.reduce((sum, row) => sum + savedExpiryCashAdjustmentAmount(row), 0);
  metric.totalSupplierPayments = rows.reduce(
    (sum, row) => sum + savedPaymentAmount(row, "supplier_payment_amount", "supplierPayment"),
    0
  );
  metric.totalEmployeePayments = rows.reduce(
    (sum, row) => sum + savedPaymentAmount(row, "employee_payment_amount", "employeePayment"),
    0
  );
  metric.salesTransactions = rows.reduce((sum, row) => sum + reportNumber(row.sales_transactions), 0);
  metric.purchaseTransactions = rows.reduce((sum, row) => sum + reportNumber(row.purchase_transactions), 0);
  metric.daysReported = rows.length;
  const lastRow = rows[rows.length - 1];
  metric.inventoryValuation = lastRow ? reportNumber(lastRow.inventory_valuation) : 0;
  metric.netAfterPayments = metric.totalCollections - metric.totalExpenses - metric.totalSupplierPayments - metric.totalEmployeePayments;
  Object.keys(metric).forEach((key) => {
    if (key !== "period" && key !== "label") {
      const numericKey = key;
      if (typeof metric[numericKey] === "number") {
        metric[numericKey] = Math.round(metric[numericKey] * 100) / 100;
      }
    }
  });
  return metric;
}
function groupRows(rows, keyFor, labelFor) {
  const groups = /* @__PURE__ */ new Map();
  rows.forEach((row) => {
    const key = keyFor(dateKey(row.report_date));
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  });
  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([key, group]) => aggregateMetric(group, key, labelFor(key)));
}
function parseReportDate(value, fallbackYear, fallbackMonth) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return utcDateKey(fallbackYear, fallbackMonth - 1);
}
async function getHistoricalReport(query) {
  const pool = await getAuthPool();
  const compare = query.view === "yearly" && query.compare === true;
  const safeYear = Number.isInteger(query.year) && query.year >= 1900 && query.year <= 2200 ? query.year : (/* @__PURE__ */ new Date()).getUTCFullYear();
  const safeMonth = Number.isInteger(query.month) && query.month >= 1 && query.month <= 12 ? query.month : (/* @__PURE__ */ new Date()).getUTCMonth() + 1;
  let startDate;
  let endDate;
  let label;
  if (query.view === "daily") {
    startDate = parseReportDate(query.date, safeYear, safeMonth);
    endDate = addDays(startDate, 1);
    label = `Daily report \xB7 ${startDate}`;
  } else if (query.view === "monthly") {
    startDate = utcDateKey(safeYear, safeMonth - 1);
    endDate = utcDateKey(safeYear, safeMonth);
    label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(`${startDate}T12:00:00.000Z`));
  } else if (compare) {
    startDate = "1900-01-01";
    endDate = "2201-01-01";
    label = "All reported years";
  } else {
    startDate = utcDateKey(safeYear, 0);
    endDate = utcDateKey(safeYear + 1, 0);
    label = `Year ${safeYear}`;
  }
  const result = await pool.request().input("startDate", import_mssql2.default.Date, startDate).input("endDate", import_mssql2.default.Date, endDate).query(`
      SELECT
        report_date,
        daily_purchase_amount,
        purchase_transactions,
        live_sales_amount,
        sales_transactions,
        total_collection,
        supplier_payment_amount,
        employee_payment_amount,
        inventory_valuation,
        expenses_total,
        report_json
      FROM dbo.DailySummaryReports
      WHERE report_date >= @startDate
        AND report_date < @endDate
      ORDER BY report_date ASC
    `);
  const rows = result.recordset;
  const trend = query.view === "daily" ? rows.length ? [aggregateMetric(rows, startDate, startDate)] : [] : query.view === "monthly" ? groupRows(rows, (date) => date, (date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(`${date}T12:00:00.000Z`))) : groupRows(
    rows,
    (date) => compare ? date.slice(0, 4) : date.slice(0, 7),
    (key) => compare ? key : new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(`${key}-01T12:00:00.000Z`))
  );
  const summary = aggregateMetric(rows, compare ? "all" : query.view === "daily" ? startDate : String(safeYear), label);
  const yearsResult = await pool.request().query(`
    SELECT DISTINCT DATEPART(year, report_date) AS report_year
    FROM dbo.DailySummaryReports
    ORDER BY report_year DESC
  `);
  const availableYears = yearsResult.recordset.map((row) => Number(row.report_year)).filter(Number.isInteger);
  return {
    view: query.view,
    compare,
    year: safeYear,
    ...query.view === "monthly" ? { month: safeMonth } : {},
    label,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: "UserAuthDB.dbo.DailySummaryReports",
    summary,
    trend,
    availableYears
  };
}

// pharmacy-settings.ts
var import_express2 = require("express");
var import_mssql3 = __toESM(require("mssql"), 1);
var MAX_LOGO_BYTES = 1.5 * 1024 * 1024;
var SETTINGS_SCHEMA_ERROR = "Pharmacy settings are not configured. Run sql/user-auth-schema.sql in UserAuthDB first.";
function settingsFromRow(row) {
  const mimeType = row.logo_mime_type ? String(row.logo_mime_type) : null;
  const logoData = row.logo_data ? Buffer.from(row.logo_data).toString("base64") : null;
  return {
    name: String(row.pharmacy_name),
    address: String(row.address),
    phone: String(row.phone),
    logoDataUrl: mimeType && logoData ? `data:${mimeType};base64,${logoData}` : null
  };
}
function validLogo(mimeType, image) {
  if (mimeType === "image/png") {
    return image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") {
    return image.length >= 3 && image[0] === 255 && image[1] === 216 && image[2] === 255;
  }
  return false;
}
function createPharmacySettingsRouter() {
  const router = (0, import_express2.Router)();
  router.get("/", async (_request, response) => {
    try {
      const pool = await getAuthPool();
      const result = await pool.request().query("SELECT TOP 1 pharmacy_name, address, phone, logo_mime_type, logo_data FROM dbo.PharmacySettings WHERE id = 1");
      if (!result.recordset[0]) {
        response.status(503).json({ error: SETTINGS_SCHEMA_ERROR });
        return;
      }
      response.json({ pharmacy: settingsFromRow(result.recordset[0]) });
    } catch (error) {
      console.error("[Pharmacy settings read error]", error instanceof Error ? error.message : error);
      response.status(503).json({ error: SETTINGS_SCHEMA_ERROR });
    }
  });
  router.put("/", async (request, response) => {
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!name || name.length > 100) {
      response.status(400).json({ error: "Pharmacy name is required and must be 100 characters or fewer." });
      return;
    }
    if (address.length > 300 || phone.length > 40) {
      response.status(400).json({ error: "Address must be 300 characters or fewer and phone must be 40 characters or fewer." });
      return;
    }
    try {
      const pool = await getAuthPool();
      const result = await pool.request().input("name", import_mssql3.default.NVarChar(100), name).input("address", import_mssql3.default.NVarChar(300), address).input("phone", import_mssql3.default.NVarChar(40), phone).query(
        `UPDATE dbo.PharmacySettings
           SET pharmacy_name = @name, address = @address, phone = @phone, updated_at = GETDATE()
           WHERE id = 1;
           SELECT TOP 1 pharmacy_name, address, phone, logo_mime_type, logo_data
           FROM dbo.PharmacySettings WHERE id = 1`
      );
      if (!result.recordset[0]) {
        response.status(503).json({ error: SETTINGS_SCHEMA_ERROR });
        return;
      }
      response.json({ pharmacy: settingsFromRow(result.recordset[0]) });
    } catch (error) {
      console.error("[Pharmacy settings update error]", error instanceof Error ? error.message : error);
      response.status(503).json({ error: SETTINGS_SCHEMA_ERROR });
    }
  });
  router.put("/logo", async (request, response) => {
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
    const match = /^data:(image\/(?:png|jpeg));base64,([a-zA-Z0-9+/]+=*)$/.exec(dataUrl);
    if (!match) {
      response.status(400).json({ error: "Choose a PNG or JPEG image." });
      return;
    }
    const mimeType = match[1];
    const image = Buffer.from(match[2], "base64");
    if (image.length === 0 || image.length > MAX_LOGO_BYTES || !validLogo(mimeType, image)) {
      response.status(400).json({ error: "The logo must be a valid PNG or JPEG image no larger than 1.5 MB." });
      return;
    }
    try {
      const pool = await getAuthPool();
      const result = await pool.request().input("mimeType", import_mssql3.default.NVarChar(20), mimeType).input("image", import_mssql3.default.VarBinary(import_mssql3.default.MAX), image).query(
        `UPDATE dbo.PharmacySettings
           SET logo_mime_type = @mimeType, logo_data = @image, updated_at = GETDATE()
           WHERE id = 1;
           SELECT TOP 1 pharmacy_name, address, phone, logo_mime_type, logo_data
           FROM dbo.PharmacySettings WHERE id = 1`
      );
      if (!result.recordset[0]) {
        response.status(503).json({ error: SETTINGS_SCHEMA_ERROR });
        return;
      }
      response.json({ pharmacy: settingsFromRow(result.recordset[0]) });
    } catch (error) {
      console.error("[Pharmacy logo update error]", error instanceof Error ? error.message : error);
      response.status(503).json({ error: SETTINGS_SCHEMA_ERROR });
    }
  });
  return router;
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express3.default)();
app.disable("x-powered-by");
var PORT = Number(process.env.PORT || 3001);
var REPORT_TIME_ZONE = process.env.REPORT_TIME_ZONE || "Asia/Dhaka";
var dbSchema = JSON.parse(import_fs.default.readFileSync(import_path.default.join(process.cwd(), "db-schema.json"), "utf8"));
function schemaObject(kind, name) {
  if (!dbSchema[kind]?.[name]) {
    throw new Error(`Database object ${kind}.${name} is not present in db-schema.json`);
  }
  return `[${name}]`;
}
function schemaColumn(kind, objectName, columnName) {
  const columns = dbSchema[kind]?.[objectName] || [];
  if (!columns.some((column) => column.column === columnName)) {
    throw new Error(`Database column ${objectName}.${columnName} is not present in db-schema.json`);
  }
  return `[${columnName}]`;
}
app.use(import_express3.default.json({ limit: "3mb" }));
var cachedMedicines = [];
var cachedSuppliers = [];
var lastSyncTime = (/* @__PURE__ */ new Date()).toISOString();
var connectionError = null;
var isConnectedToSql = false;
var sharedPool = null;
var sharedPoolPromise = null;
var activeSyncPromise = null;
var activeSupplierSyncs = /* @__PURE__ */ new Map();
function getSqlConfig(overrides = {}) {
  const configuredServer = overrides.server || process.env.DB_SERVER || "localhost";
  const serverParts = configuredServer.split("\\").filter(Boolean);
  const server = serverParts[0] || configuredServer;
  const configuredInstanceValue = process.env.DB_INSTANCE_NAME?.trim() || "";
  const configuredInstance = configuredInstanceValue.toUpperCase() === "MSSQLSERVER" ? "" : configuredInstanceValue;
  const parsedInstance = serverParts.length > 1 ? serverParts[serverParts.length - 1] : "";
  const instanceName = configuredInstance || (parsedInstance && parsedInstance.toUpperCase() !== "MSSQLSERVER" ? parsedInstance : void 0);
  return {
    ...overrides,
    user: overrides.user || process.env.DB_USER || "sa",
    password: overrides.password !== void 0 ? overrides.password : process.env.DB_PASSWORD || "",
    server,
    port: overrides.port || parseInt(process.env.DB_PORT || "1433", 10),
    database: overrides.database || process.env.DB_NAME || "HDMS",
    options: {
      ...overrides.options || {},
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      // Keep these configurable for slower local SQL Server installations while
      // using shorter defaults so an unavailable database does not block the UI.
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 2500),
      requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT || 8e3),
      tdsVersion: "7_1",
      // Compatible with legacy SQL Server 2000
      ...instanceName ? { instanceName } : {}
    }
  };
}
function mapRecordToMedicine(row, index) {
  const postCode = (row.Post_Code || "").trim();
  const supplierCate = row.Supplier_Cate || getSupplierCategory(postCode);
  const rate = Number(row.Rate || 0);
  const discPct = Number(row.Disc_Pct || 0);
  const retailDiscount = Number(row.Retail_Discount || 0);
  const percentage = getPercentage(discPct, retailDiscount);
  const saleRate = getSaleRate(rate, percentage);
  const phBalance = Number(row.Balance || 0);
  const storeBalance = Number(row.Store_Balance || 0);
  const totalBalance = phBalance + storeBalance;
  return {
    id: row.Item_ID || index + 1,
    Item_ID: Number(row.Item_ID || index + 1),
    Item_Name: String(row.Item_Name || "Unnamed Medicine"),
    Item_Code: row.Item_Code ? String(row.Item_Code) : "",
    Catagory_Id: row.Catagory_Id !== void 0 && row.Catagory_Id !== null ? Number(row.Catagory_Id) : void 0,
    Category_Name: row.Category_Name ? String(row.Category_Name) : void 0,
    Item_Type: row.Item_Type !== void 0 && row.Item_Type !== null ? row.Item_Type : "",
    Specimen: row.Specimen ? String(row.Specimen) : void 0,
    Rate: rate,
    Making_Time: row.Making_Time ? String(row.Making_Time) : void 0,
    Purchase_Rate: row.Purchase_Rate !== void 0 && row.Purchase_Rate !== null ? Number(row.Purchase_Rate) : void 0,
    Comments: row.Comments ? String(row.Comments) : void 0,
    Reorder_Level: Number(row.Reorder_Level || 0),
    Balance: phBalance,
    VAT: Boolean(row.VAT),
    Inv_Rep_Type: row.Inv_Rep_Type !== void 0 && row.Inv_Rep_Type !== null ? Number(row.Inv_Rep_Type) : void 0,
    Generic_Name: row.Generic_Name ? String(row.Generic_Name) : "",
    Unit: row.Unit ? String(row.Unit) : "Pkt",
    Service_Charge: Boolean(row.Service_Charge),
    OB: row.OB !== void 0 && row.OB !== null ? Number(row.OB) : void 0,
    OB_Date: row.OB_Date ? String(row.OB_Date) : void 0,
    Debit: Number(row.Debit || 0),
    Credit: row.Credit !== void 0 && row.Credit !== null ? Number(row.Credit) : void 0,
    Flexible_Rate: Boolean(row.Flexible_Rate),
    Barcode: row.Barcode ? String(row.Barcode) : void 0,
    Location: row.Location ? String(row.Location) : void 0,
    Expire_Date: row.Expire_Date ? String(row.Expire_Date) : void 0,
    Group_Test: Boolean(row.Group_Test),
    Supplier_ID: row.Supplier_ID !== void 0 && row.Supplier_ID !== null ? Number(row.Supplier_ID) : void 0,
    Cost_Price: Number(row.Cost_Price || 0),
    OB_Exp_Qty: row.OB_Exp_Qty !== void 0 && row.OB_Exp_Qty !== null ? Number(row.OB_Exp_Qty) : void 0,
    OB_SDate_Qty: row.OB_SDate_Qty !== void 0 && row.OB_SDate_Qty !== null ? Number(row.OB_SDate_Qty) : void 0,
    Disc_Pct: discPct,
    Audit_Balance: row.Audit_Balance !== void 0 && row.Audit_Balance !== null ? Number(row.Audit_Balance) : void 0,
    Manu_ID: row.Manu_ID !== void 0 && row.Manu_ID !== null ? Number(row.Manu_ID) : void 0,
    // Calculated / Joined fields
    Store_Balance: storeBalance,
    Total_Balance: totalBalance,
    Retail_Discount: retailDiscount,
    Percentage: percentage,
    SaleRate: saleRate,
    SName: row.SName ? String(row.SName) : "General Supplier",
    Post_Code: postCode,
    Supplier_Cate: supplierCate,
    Group_Name: row.Generic_Name || row.Category_Name || "Standard Items"
  };
}
function mapRecordToSupplier(row) {
  const postCode = (row.Post_Code || "").trim();
  const supplierCate = row.Supplier_Cate || getSupplierCategory(postCode);
  return {
    Supplier_ID: Number(row.Supplier_ID),
    SName: String(row.SName || "Unnamed Supplier"),
    Contact_Person: row.Contact_Person ? String(row.Contact_Person) : void 0,
    Contact_Person_Designation: row.Contact_Person_Designation ? String(row.Contact_Person_Designation) : void 0,
    Address: row.Address ? String(row.Address) : void 0,
    City: row.City ? String(row.City) : void 0,
    Post_Code: postCode,
    Supplier_Cate: supplierCate,
    StateOrProvince: row.StateOrProvince ? String(row.StateOrProvince) : void 0,
    Country: row.Country ? String(row.Country) : void 0,
    Phone: row.Phone ? String(row.Phone) : void 0,
    Email: row.Email ? String(row.Email) : void 0,
    Favorite: Boolean(row.Favorite),
    OB: row.OB ? Number(row.OB) : void 0,
    Retail_Discount: row.Retail_Discount !== void 0 ? Number(row.Retail_Discount) : void 0,
    Wholesale_Discount: row.Wholesale_Discount !== void 0 ? Number(row.Wholesale_Discount) : void 0
  };
}
async function getSharedPool(config) {
  if (sharedPool?.connected) {
    return sharedPool;
  }
  if (!sharedPoolPromise) {
    sharedPoolPromise = new import_mssql4.default.ConnectionPool(config).connect().then((pool) => {
      sharedPool = pool;
      return pool;
    }).catch((error) => {
      sharedPoolPromise = null;
      throw error;
    });
  }
  return sharedPoolPromise;
}
async function resetSharedPool() {
  const pool = sharedPool;
  sharedPool = null;
  sharedPoolPromise = null;
  if (pool) {
    try {
      await pool.close();
    } catch {
    }
  }
}
async function fetchMedicinesFromDatabase(customConfig) {
  if (!customConfig && activeSyncPromise) {
    return activeSyncPromise;
  }
  const operation = fetchMedicinesFromDatabaseInternal(customConfig);
  if (customConfig) {
    return operation;
  }
  activeSyncPromise = operation;
  try {
    return await operation;
  } finally {
    activeSyncPromise = null;
  }
}
async function fetchMedicinesFromDatabaseInternal(customConfig, supplierName) {
  const config = customConfig || getSqlConfig();
  const normalizedSupplier = supplierName?.trim() || void 0;
  const fallbackMedicines = normalizedSupplier ? cachedMedicines.filter((medicine) => medicine.SName === normalizedSupplier) : cachedMedicines;
  if (!config.server || config.server === "localhost" && !process.env.DB_PASSWORD) {
    return {
      medicines: fallbackMedicines,
      suppliers: cachedSuppliers,
      connected: false,
      error: "SQL Server configuration is missing. Set DB_SERVER, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME in .env."
    };
  }
  let pool = null;
  const usesSharedPool = !customConfig;
  try {
    pool = usesSharedPool ? await getSharedPool(config) : await new import_mssql4.default.ConnectionPool(config).connect();
    const suppliersQuery = normalizedSupplier ? Promise.resolve(null) : pool.request().query(`
        SELECT 
          Supplier_ID,
          SName,
          Contact_Person,
          Contact_Person_Designation,
          Address,
          City,
          Post_Code,
          StateOrProvince,
          Country,
          Phone,
          Email,
          Favorite,
          OB,
          Retail_Discount,
          Wholesale_Discount
        FROM Suppliers
        ORDER BY SName ASC
      `);
    const supplierFilter = normalizedSupplier ? "WHERE s.SName = @supplier" : "";
    const viewSupplierFilter = normalizedSupplier ? "WHERE SName = @supplier" : "";
    const createItemsRequest = () => {
      const request = pool.request();
      if (normalizedSupplier) {
        request.input("supplier", import_mssql4.default.VarChar(255), normalizedSupplier);
      }
      return request;
    };
    let rows = [];
    try {
      const itemsQuery = `
        SELECT 
          i.Item_ID,
          i.Item_Name,
          i.Item_Code,
          i.Catagory_Id,
          i.Item_Type,
          i.Specimen,
          i.Rate,
          i.Making_Time,
          i.Purchase_Rate,
          i.Comments,
          i.Reorder_Level,
          i.Balance,
          i.VAT,
          i.Inv_Rep_Type,
          i.Generic_Name,
          i.Unit,
          i.Service_Charge,
          i.OB,
          i.OB_Date,
          i.Debit,
          i.Credit,
          i.Flexible_Rate,
          i.Barcode,
          i.Location,
          i.Expire_Date,
          i.Group_Test,
          i.Supplier_ID,
          i.Cost_Price,
          i.OB_Exp_Qty,
          i.OB_SDate_Qty,
          i.Disc_Pct,
          i.Audit_Balance,
          i.Manu_ID,
          s.SName,
          s.Post_Code,
          s.Retail_Discount,
          s.Wholesale_Discount,
          ISNULL(b.Store_Balance, 0) AS Store_Balance
        FROM dbo.Items i
        LEFT OUTER JOIN dbo.Suppliers s ON i.Supplier_ID = s.Supplier_ID
        LEFT OUTER JOIN dbo.qryStore_Item_Balance b ON i.Item_ID = b.Item_ID
           ${supplierFilter}
        ORDER BY s.SName, i.Item_Name
      `;
      const itemsResult = await createItemsRequest().query(itemsQuery);
      rows = itemsResult.recordset;
      console.log(`[SQL Server] Successfully read ${rows.length} records directly from Items table joined with qryStore_Item_Balance.`);
    } catch (itemsErr) {
      console.warn("[SQL Server] Query on Items with qryStore_Item_Balance view failed, trying direct subquery with qryStore_Transaction_Sum_Posted:", itemsErr);
      try {
        const inlineStoreBalQuery = `
          SELECT 
            i.Item_ID,
            i.Item_Name,
            i.Item_Code,
            i.Catagory_Id,
            i.Item_Type,
            i.Specimen,
            i.Rate,
            i.Making_Time,
            i.Purchase_Rate,
            i.Comments,
            i.Reorder_Level,
            i.Balance,
            i.VAT,
            i.Inv_Rep_Type,
            i.Generic_Name,
            i.Unit,
            i.Service_Charge,
            i.OB,
            i.OB_Date,
            i.Debit,
            i.Credit,
            i.Flexible_Rate,
            i.Barcode,
            i.Location,
            i.Expire_Date,
            i.Group_Test,
            i.Supplier_ID,
            i.Cost_Price,
            i.OB_Exp_Qty,
            i.OB_SDate_Qty,
            i.Disc_Pct,
            i.Audit_Balance,
            i.Manu_ID,
            s.SName,
            s.Post_Code,
            s.Retail_Discount,
            s.Wholesale_Discount,
            ISNULL(st.Store_Balance, 0) AS Store_Balance
          FROM dbo.Items i
          LEFT OUTER JOIN dbo.Suppliers s ON i.Supplier_ID = s.Supplier_ID
          LEFT OUTER JOIN (
            SELECT 
              Item_ID,
              SUM(ISNULL(Received_Qty_Sum - Delivered_Qty_Sum, 0)) AS Store_Balance
            FROM dbo.qryStore_Transaction_Sum_Posted
            GROUP BY Item_ID
          ) st ON i.Item_ID = st.Item_ID
           ${supplierFilter}
          ORDER BY s.SName, i.Item_Name
        `;
        const inlineResult = await createItemsRequest().query(inlineStoreBalQuery);
        rows = inlineResult.recordset;
        console.log(`[SQL Server] Successfully calculated Store_Balance via qryStore_Transaction_Sum_Posted.`);
      } catch (inlineErr) {
        console.warn("[SQL Server] Inline store balance failed, trying qryMedicine view:", inlineErr);
        try {
          const qryResult = await createItemsRequest().query(
            `SELECT TOP 2000 * FROM qryMedicine ${viewSupplierFilter} ORDER BY SName, Item_Name`
          );
          rows = qryResult.recordset;
        } catch (qryErr) {
          console.warn("[SQL Server] Query on qryMedicine failed, trying basic Items SELECT:", qryErr);
          const basicQuery = `
             SELECT TOP 2000 i.*, s.SName, s.Post_Code, s.Retail_Discount,
               s.Wholesale_Discount, 0 AS Store_Balance
             FROM dbo.Items i
             LEFT OUTER JOIN dbo.Suppliers s ON i.Supplier_ID = s.Supplier_ID
             ${supplierFilter}
             ORDER BY i.Item_Name
           `;
          const basicResult = await createItemsRequest().query(basicQuery);
          rows = basicResult.recordset;
        }
      }
    }
    try {
      const suppliersResult = await suppliersQuery;
      if (suppliersResult?.recordset && suppliersResult.recordset.length > 0) {
        cachedSuppliers = suppliersResult.recordset.map((r) => mapRecordToSupplier(r));
        console.log(`[SQL Server] Loaded ${cachedSuppliers.length} suppliers from Suppliers table.`);
      }
    } catch (suppErr) {
      console.warn("[SQL Server] Could not query Suppliers table directly, keeping cached suppliers:", suppErr);
    }
    if (rows && rows.length > 0) {
      const mapped = rows.map((r, i) => mapRecordToMedicine(r, i));
      if (!normalizedSupplier) {
        cachedMedicines = mapped;
      }
      lastSyncTime = (/* @__PURE__ */ new Date()).toISOString();
      isConnectedToSql = true;
      connectionError = null;
      return { medicines: mapped, suppliers: cachedSuppliers, connected: true };
    } else {
      return { medicines: fallbackMedicines, suppliers: cachedSuppliers, connected: true };
    }
  } catch (err) {
    const errorMsg = err.message || "Failed to connect to SQL Server 2000";
    isConnectedToSql = false;
    connectionError = errorMsg;
    if (usesSharedPool) {
      await resetSharedPool();
    }
    return {
      medicines: fallbackMedicines,
      suppliers: cachedSuppliers,
      connected: false,
      error: errorMsg
    };
  } finally {
    if (pool && customConfig) {
      try {
        await pool.close();
      } catch {
      }
    }
  }
}
async function fetchSupplierMedicinesFromDatabase(supplierName) {
  const normalizedSupplier = supplierName.trim();
  if (!normalizedSupplier) {
    return fetchMedicinesFromDatabase();
  }
  const existingSync = activeSupplierSyncs.get(normalizedSupplier);
  if (existingSync) {
    return existingSync;
  }
  const sync = fetchMedicinesFromDatabaseInternal(void 0, normalizedSupplier);
  activeSupplierSyncs.set(normalizedSupplier, sync);
  try {
    return await sync;
  } finally {
    activeSupplierSyncs.delete(normalizedSupplier);
  }
}
setInterval(async () => {
  try {
    const result = await fetchMedicinesFromDatabase();
    if (result.connected) {
      console.log(`[Auto-Sync] Successfully synchronized ${result.medicines.length} medicines from SQL Server at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`);
    }
  } catch (err) {
    console.error("[Auto-Sync Error]:", err);
  }
}, 5 * 60 * 1e3);
fetchMedicinesFromDatabase().catch(() => {
});
app.use("/api", createAuthRouter());
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});
app.use("/api", requireAuth);
app.use("/api/settings", createPharmacySettingsRouter());
app.get("/api/db-status", (req, res) => {
  const status = {
    connected: isConnectedToSql,
    mode: isConnectedToSql ? "mssql" : "unavailable",
    server: process.env.DB_SERVER || "localhost",
    database: process.env.DB_NAME || "PharmacyDB",
    port: parseInt(process.env.DB_PORT || "1433", 10),
    lastSync: lastSyncTime,
    recordCount: cachedMedicines.length,
    errorMessage: connectionError || void 0
  };
  res.json(status);
});
app.get("/api/medicines", async (req, res) => {
  const query = String(req.query.q || "").toLowerCase();
  const category = String(req.query.category || "");
  const supplier = String(req.query.supplier || "");
  const lowStockOnly = req.query.lowStock === "true";
  const source = supplier ? await fetchSupplierMedicinesFromDatabase(supplier) : {
    medicines: cachedMedicines,
    connected: isConnectedToSql
  };
  let filtered = source.medicines;
  if (query) {
    filtered = filtered.filter(
      (m) => m.Item_Name.toLowerCase().includes(query) || m.Item_Code && m.Item_Code.toLowerCase().includes(query) || m.Generic_Name && m.Generic_Name.toLowerCase().includes(query) || m.SName.toLowerCase().includes(query)
    );
  }
  if (category) {
    filtered = filtered.filter((m) => m.Supplier_Cate === category);
  }
  if (supplier) {
    filtered = filtered.filter((m) => m.SName === supplier);
  }
  if (lowStockOnly) {
    filtered = filtered.filter((m) => m.Total_Balance <= m.Reorder_Level || m.Total_Balance === 0);
  }
  res.json({
    data: filtered,
    total: supplier ? source.medicines.length : cachedMedicines.length,
    filteredCount: filtered.length,
    lastSync: lastSyncTime,
    connected: source.connected
  });
});
app.get("/api/suppliers", (req, res) => {
  const supplierCounts = /* @__PURE__ */ new Map();
  cachedMedicines.forEach((m) => {
    const s = m.SName || "Unknown";
    supplierCounts.set(s, (supplierCounts.get(s) || 0) + 1);
  });
  const enrichedSuppliers = cachedSuppliers.map((s) => ({
    ...s,
    itemCount: supplierCounts.get(s.SName) || 0
  }));
  res.json({
    data: enrichedSuppliers,
    total: enrichedSuppliers.length,
    connected: isConnectedToSql
  });
});
function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}
function dateKey2(date = /* @__PURE__ */ new Date()) {
  return date.toISOString().slice(0, 10);
}
function localDateKey(date = /* @__PURE__ */ new Date(), timeZone = REPORT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function previousDateKey(value) {
  const date = /* @__PURE__ */ new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
function millisecondsUntilNextLocalMidnight() {
  const now = Date.now();
  const currentDate = localDateKey(new Date(now));
  let upper = now + 24 * 60 * 60 * 1e3;
  while (localDateKey(new Date(upper)) === currentDate && upper < now + 72 * 60 * 60 * 1e3) {
    upper += 60 * 60 * 1e3;
  }
  let lower = now;
  for (let iteration = 0; iteration < 42; iteration += 1) {
    const midpoint = Math.floor((lower + upper) / 2);
    if (localDateKey(new Date(midpoint)) === currentDate) {
      lower = midpoint;
    } else {
      upper = midpoint;
    }
  }
  return Math.max(1e3, upper - now + 1e3);
}
var automaticSummaryTimer = null;
function scheduleAutomaticDailySummary() {
  if (automaticSummaryTimer) clearTimeout(automaticSummaryTimer);
  const delay = millisecondsUntilNextLocalMidnight();
  automaticSummaryTimer = setTimeout(async () => {
    const reportDate = previousDateKey(localDateKey());
    try {
      const report = await fetchAnalyticsFromDatabase(reportDate);
      const saved = await saveDailySummaryReport(report, null);
      console.log(`[Daily Summary] Automatically saved ${saved.date} to UserAuthDB (${REPORT_TIME_ZONE}).`);
    } catch (error) {
      console.error(`[Daily Summary] Automatic save failed for ${reportDate}:`, error?.message || error);
    } finally {
      scheduleAutomaticDailySummary();
    }
  }, delay);
  automaticSummaryTimer.unref();
  console.log(`[Daily Summary] Next automatic save scheduled for ${new Date(Date.now() + delay).toISOString()} (${REPORT_TIME_ZONE}).`);
}
async function fetchAnalyticsFromDatabase(date) {
  const pool = await getSharedPool(getSqlConfig());
  const purchaseTable = schemaObject("tables", "Purchase");
  const purchaseSubTable = schemaObject("tables", "Purchase_sub");
  const supplierTable = schemaObject("tables", "Suppliers");
  const transactionTable = schemaObject("tables", "transactions");
  const transactionParticularsTable = schemaObject("tables", "transactions_particulars");
  const transactionPaymentsTable = schemaObject("tables", "transactions_payments");
  const paymentModeTable = schemaObject("tables", "Payment_Mode");
  const expenseTable = schemaObject("tables", "Expense");
  const expenseSubTable = schemaObject("tables", "Expense_Sub");
  const purchasePaymentsTable = schemaObject("tables", "purchase_payments");
  const partyPaymentTable = schemaObject("tables", "Party_Payment");
  const employeeTransactionTable = schemaObject("tables", "Employee_Transaction");
  const expiryCashTable = schemaObject("tables", "Medicine_Expiry_Cash_Transaction");
  const purchaseDate = schemaColumn("tables", "Purchase", "Date");
  const purchaseTime = schemaColumn("tables", "Purchase", "Time");
  const purchaseId = schemaColumn("tables", "Purchase", "Purchase_Id");
  const purchaseNo = schemaColumn("tables", "Purchase", "Purchase_No");
  const purchaseInvoice = schemaColumn("tables", "Purchase", "Invoicel_No");
  const purchaseAmount = schemaColumn("tables", "Purchase", "Total_Amount");
  const purchaseDiscount = schemaColumn("tables", "Purchase", "Discount");
  const purchaseVatAmount = schemaColumn("tables", "Purchase", "VAT_Amount");
  const purchasePosted = schemaColumn("tables", "Purchase", "Posted");
  const purchaseSupplierId = schemaColumn("tables", "Purchase", "Supplier_ID");
  const purchaseSubId = schemaColumn("tables", "Purchase_sub", "Purchase_ID");
  const purchaseSubRate = schemaColumn("tables", "Purchase_sub", "Rate");
  const purchaseSubQty = schemaColumn("tables", "Purchase_sub", "Qty");
  const purchaseSubAmount = schemaColumn("tables", "Purchase_sub", "Amount");
  const purchaseSubVatPct = schemaColumn("tables", "Purchase_sub", "Item_VAT_Pct");
  const purchaseSubVatAmount = schemaColumn("tables", "Purchase_sub", "Item_VAT_Amount");
  const purchaseSubDiscountPct = schemaColumn("tables", "Purchase_sub", "Item_Discount_Pct");
  const purchaseSubDiscountAmount = schemaColumn("tables", "Purchase_sub", "Item_Discount_Amount");
  const purchaseSubPosted = schemaColumn("tables", "Purchase_sub", "Posted");
  const supplierId = schemaColumn("tables", "Suppliers", "Supplier_ID");
  const supplierName = schemaColumn("tables", "Suppliers", "SName");
  const saleDate = schemaColumn("tables", "transactions", "entry_date");
  const saleTime = schemaColumn("tables", "transactions", "time");
  const saleId = schemaColumn("tables", "transactions", "trans_id");
  const saleMedicineBillNo = schemaColumn("tables", "transactions", "Medicine_Bill_no");
  const saleAmount = schemaColumn("tables", "transactions", "total_bill");
  const saleDiscount = schemaColumn("tables", "transactions", "discount");
  const saleTotalPaid = schemaColumn("tables", "transactions", "total_paid");
  const saleAmountPaid = schemaColumn("tables", "transactions", "Amount_Paid");
  const salePaymentMode = schemaColumn("tables", "transactions", "pay_mode");
  const saleUser = schemaColumn("tables", "transactions", "user_name");
  const saleCounter = schemaColumn("tables", "transactions", "computer_name");
  const salePosted = schemaColumn("tables", "transactions", "posted");
  const saleParticularsId = schemaColumn("tables", "transactions_particulars", "trans_id");
  const saleParticularsQty = schemaColumn("tables", "transactions_particulars", "qty");
  const saleParticularsAmount = schemaColumn("tables", "transactions_particulars", "amount");
  const saleParticularsDiscountPct = schemaColumn("tables", "transactions_particulars", "Item_Discount_Pct");
  const saleParticularsDiscountAmount = schemaColumn("tables", "transactions_particulars", "Item_Discount_Amount");
  const saleParticularsPosted = schemaColumn("tables", "transactions_particulars", "posted");
  const dueCollectionDate = schemaColumn("tables", "transactions_payments", "Date");
  const dueCollectionTime = schemaColumn("tables", "transactions_payments", "Time");
  const dueCollectionId = schemaColumn("tables", "transactions_payments", "T_Payment_ID");
  const dueCollectionAmount = schemaColumn("tables", "transactions_payments", "Amount");
  const dueCollectionTransId = schemaColumn("tables", "transactions_payments", "Trans_ID");
  const dueCollectionParticulars = schemaColumn("tables", "transactions_payments", "Particulars");
  const dueCollectionUserName = schemaColumn("tables", "transactions_payments", "UserName");
  const dueCollectionComputerName = schemaColumn("tables", "transactions_payments", "ComputerName");
  const dueCollectionPayMode = schemaColumn("tables", "transactions_payments", "Pay_Mode");
  const dueCollectionPayModeDetails = schemaColumn("tables", "transactions_payments", "Pay_Mode_Details");
  const dueCollectionPosted = schemaColumn("tables", "transactions_payments", "Posted");
  const paymentModeId = schemaColumn("tables", "Payment_Mode", "ID");
  const paymentModeName = schemaColumn("tables", "Payment_Mode", "Name");
  const expenseDate = schemaColumn("tables", "Expense", "Date");
  const expenseTime = schemaColumn("tables", "Expense", "Time");
  const expenseId = schemaColumn("tables", "Expense", "Exp_ID");
  const expenseVoucher = schemaColumn("tables", "Expense", "Exp_Vouvher_No");
  const expenseAmount = schemaColumn("tables", "Expense", "Total_Exp");
  const expenseRemark = schemaColumn("tables", "Expense", "Exp_Remark");
  const expensePosted = schemaColumn("tables", "Expense", "Posted");
  const expenseSubId = schemaColumn("tables", "Expense_Sub", "Exp_ID");
  const expenseHead = schemaColumn("tables", "Expense_Sub", "Exp_Head");
  const expenseSubPosted = schemaColumn("tables", "Expense_Sub", "Posted");
  const purchasePaymentDate = schemaColumn("tables", "purchase_payments", "Date");
  const purchasePaymentAmount = schemaColumn("tables", "purchase_payments", "Amount");
  const purchasePaymentPosted = schemaColumn("tables", "purchase_payments", "Posted");
  const partyPaymentDate = schemaColumn("tables", "Party_Payment", "Date");
  const partyPaymentAmount = schemaColumn("tables", "Party_Payment", "Amount");
  const partyPaymentPosted = schemaColumn("tables", "Party_Payment", "Posted");
  const employeeTransactionDate = schemaColumn("tables", "Employee_Transaction", "Date");
  const employeeTransactionAmount = schemaColumn("tables", "Employee_Transaction", "Amount");
  const expiryCashDate = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Date");
  const expiryCashAmount = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Amount");
  const [
    purchaseResult,
    salesResult,
    expenseResult,
    dueCollectionResult,
    purchasePaymentResult,
    partyPaymentResult,
    employeePaymentResult,
    expiryCashAdjustmentResult
  ] = await Promise.all([
    pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
      `SELECT
        p.${purchaseDate} AS entry_date,
        p.${purchaseTime} AS entry_time,
        p.${purchaseId} AS purchase_id,
        p.${purchaseNo} AS purchase_no,
        p.${purchaseInvoice} AS invoice_no,
         ISNULL(ps.invoice_amount, ISNULL(p.${purchaseAmount}, 0))
           + ISNULL(p.${purchaseVatAmount}, 0)
           - ISNULL(p.${purchaseDiscount}, 0) AS amount,
        s.${supplierName} AS supplier,
        ISNULL(ps.items, 0) AS items
       FROM ${purchaseTable} p
       LEFT OUTER JOIN ${supplierTable} s
         ON p.${purchaseSupplierId} = s.${supplierId}
       LEFT OUTER JOIN (
          SELECT
            ${purchaseSubId} AS purchase_id,
            SUM(ISNULL(${purchaseSubQty}, 0)) AS items,
            SUM(
              ISNULL(${purchaseSubAmount}, 0)
              + CASE
                  WHEN ISNULL(${purchaseSubVatAmount}, 0) = 0
                    THEN ISNULL(${purchaseSubVatPct}, 0) / 100 * ISNULL(${purchaseSubRate}, 0) * ISNULL(${purchaseSubQty}, 0)
                  ELSE ISNULL(${purchaseSubVatAmount}, 0)
                END
              - (
                  ISNULL(${purchaseSubDiscountPct}, 0) / 100 * ISNULL(${purchaseSubRate}, 0) * ISNULL(${purchaseSubQty}, 0)
                  + ISNULL(${purchaseSubDiscountAmount}, 0)
                )
            ) AS invoice_amount
         FROM ${purchaseSubTable}
         WHERE ${purchaseSubPosted} = 1
         GROUP BY ${purchaseSubId}
       ) ps ON p.${purchaseId} = ps.purchase_id
       WHERE CONVERT(varchar(10), p.${purchaseDate}, 120) = @date
         AND ISNULL(p.${purchasePosted}, 0) = 1
       ORDER BY p.${purchaseDate} DESC, p.${purchaseTime} DESC, p.${purchaseId} DESC`
    ),
    pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
      `SELECT
        t.${saleDate} AS entry_date,
        t.${saleTime} AS entry_time,
        t.${saleId} AS trans_id,
        t.${saleMedicineBillNo} AS medicine_bill_no,
         ISNULL(tp.gross_amount, ISNULL(t.${saleAmount}, 0))
           - ISNULL(tp.item_discount, 0)
           - ISNULL(t.${saleDiscount}, 0) AS net_payable,
        ISNULL(t.${saleTotalPaid}, t.${saleAmountPaid}) AS paid_after_discount,
        t.${salePaymentMode} AS pay_mode,
        pm.${paymentModeName} AS payment_mode_name,
        t.${saleUser} AS user_name,
        t.${saleCounter} AS computer_name,
        ISNULL(tp.items, 0) AS items
       FROM ${transactionTable} t
       LEFT OUTER JOIN ${paymentModeTable} pm
         ON t.${salePaymentMode} = pm.${paymentModeId}
       LEFT OUTER JOIN (
          SELECT
            ${saleParticularsId} AS trans_id,
            SUM(ISNULL(${saleParticularsQty}, 0)) AS items,
            SUM(ISNULL(${saleParticularsAmount}, 0)) AS gross_amount,
            SUM(
              (ISNULL(${saleParticularsAmount}, 0) * ISNULL(${saleParticularsDiscountPct}, 0) / 100)
              + ISNULL(${saleParticularsDiscountAmount}, 0)
            ) AS item_discount
         FROM ${transactionParticularsTable}
         WHERE ${saleParticularsPosted} = 1
         GROUP BY ${saleParticularsId}
       ) tp ON t.${saleId} = tp.trans_id
       WHERE CONVERT(varchar(10), t.${saleDate}, 120) = @date
         AND ISNULL(t.${salePosted}, 0) = 1
       ORDER BY t.${saleDate} DESC, t.${saleTime} DESC, t.${saleId} DESC`
    ),
    pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
      `SELECT
        e.${expenseDate} AS entry_date,
        e.${expenseTime} AS entry_time,
        e.${expenseId} AS exp_id,
        e.${expenseVoucher} AS voucher,
        e.${expenseAmount} AS amount,
        e.${expenseRemark} AS remark,
        es.exp_head AS exp_head
       FROM ${expenseTable} e
       LEFT OUTER JOIN (
         SELECT ${expenseSubId} AS exp_id, MIN(${expenseHead}) AS exp_head
         FROM ${expenseSubTable}
         WHERE ${expenseSubPosted} = 1
         GROUP BY ${expenseSubId}
       ) es ON e.${expenseId} = es.exp_id
       WHERE CONVERT(varchar(10), e.${expenseDate}, 120) = @date
         AND ISNULL(e.${expensePosted}, 0) = 1
       ORDER BY e.${expenseDate} DESC, e.${expenseTime} DESC, e.${expenseId} DESC`
    ),
    pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
      `SELECT
         p.${dueCollectionId} AS payment_id,
         p.${dueCollectionTime} AS payment_time,
         p.${dueCollectionAmount} AS amount,
         p.${dueCollectionParticulars} AS particulars,
         p.${dueCollectionUserName} AS user_name,
         p.${dueCollectionComputerName} AS computer_name,
         p.${dueCollectionPayMode} AS pay_mode,
         p.${dueCollectionPayModeDetails} AS pay_mode_details,
         t.${saleMedicineBillNo} AS medicine_bill_no,
         pm.${paymentModeName} AS payment_mode_name
       FROM ${transactionPaymentsTable} p
       LEFT OUTER JOIN ${transactionTable} t
         ON p.${dueCollectionTransId} = t.${saleId}
       LEFT OUTER JOIN ${paymentModeTable} pm
         ON p.${dueCollectionPayMode} = pm.${paymentModeId}
       WHERE CONVERT(varchar(10), p.${dueCollectionDate}, 120) = @date
         AND ISNULL(p.${dueCollectionPosted}, 0) = 1
       ORDER BY p.${dueCollectionDate} DESC, p.${dueCollectionTime} DESC, p.${dueCollectionId} DESC`
    ),
    pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
      `SELECT
         COUNT(*) AS transactions,
         SUM(ISNULL(p.${purchasePaymentAmount}, 0)) AS amount
       FROM ${purchasePaymentsTable} p
       WHERE CONVERT(varchar(10), p.${purchasePaymentDate}, 120) = @date
         AND ISNULL(p.${purchasePaymentPosted}, 0) = 1`
    ),
    pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
      `SELECT
         COUNT(*) AS transactions,
         SUM(ISNULL(p.${partyPaymentAmount}, 0)) AS amount
       FROM ${partyPaymentTable} p
       WHERE CONVERT(varchar(10), p.${partyPaymentDate}, 120) = @date
         AND ISNULL(p.${partyPaymentPosted}, 0) = 1`
    ),
    pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
      `SELECT
         COUNT(*) AS transactions,
         SUM(ISNULL(e.${employeeTransactionAmount}, 0)) AS amount
       FROM ${employeeTransactionTable} e
       WHERE CONVERT(varchar(10), e.${employeeTransactionDate}, 120) = @date`
    ),
    pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
      `SELECT
          COUNT(*) AS transactions,
          SUM(ISNULL(e.${expiryCashAmount}, 0)) AS amount
        FROM ${expiryCashTable} e
        WHERE CONVERT(varchar(10), e.${expiryCashDate}, 120) = @date`
    )
  ]);
  const purchases = purchaseResult.recordset.map((row, index) => ({
    id: row.purchase_id ?? index,
    time: String(row.entry_time || ""),
    invoice: String(row.invoice_no || row.purchase_no || row.purchase_id || "\u2014"),
    supplier: String(row.supplier || "Unknown supplier"),
    amount: money(row.amount),
    items: Number(row.items || 0),
    status: "Posted"
  }));
  const sales = salesResult.recordset.map((row, index) => ({
    id: row.trans_id ?? index,
    time: String(row.entry_time || ""),
    medicineBillNo: row.medicine_bill_no === null || row.medicine_bill_no === void 0 ? "\u2014" : String(row.medicine_bill_no),
    amount: money(row.net_payable),
    due: money(Math.abs(money(row.net_payable) - money(row.paid_after_discount))),
    items: Number(row.items || 0),
    employee: String(row.user_name || "Unassigned"),
    counter: String(row.computer_name || "Main counter"),
    payment: String(row.payment_mode_name || (row.pay_mode === null || row.pay_mode === void 0 ? "Recorded" : `Mode ${row.pay_mode}`))
  }));
  const expenses = expenseResult.recordset.map((row, index) => ({
    id: row.exp_id ?? index,
    head: String(row.exp_head || "General"),
    voucher: String(row.voucher || "\u2014"),
    amount: money(row.amount),
    remark: String(row.remark || ""),
    time: String(row.entry_time || "")
  }));
  const dueCollections = dueCollectionResult.recordset.map((row, index) => ({
    id: row.payment_id ?? index,
    time: String(row.payment_time || ""),
    medicineBillNo: row.medicine_bill_no === null || row.medicine_bill_no === void 0 ? "\u2014" : String(row.medicine_bill_no),
    amount: money(row.amount),
    paymentMode: String(row.payment_mode_name || row.pay_mode_details || (row.pay_mode === null || row.pay_mode === void 0 ? "Recorded" : `Mode ${row.pay_mode}`)),
    particulars: String(row.particulars || "Due bill payment"),
    userName: String(row.user_name || "Unassigned"),
    computerName: String(row.computer_name || "Main counter")
  }));
  const paidAfterDiscount = salesResult.recordset.reduce(
    (sum, row) => sum + Math.min(money(row.net_payable), money(row.paid_after_discount)),
    0
  );
  const dueCollection = money(dueCollections.reduce((sum, item) => sum + item.amount, 0));
  const purchasePaymentRow = purchasePaymentResult.recordset[0] || {};
  const partyPaymentRow = partyPaymentResult.recordset[0] || {};
  const employeePaymentRow = employeePaymentResult.recordset[0] || {};
  const expiryCashAdjustmentRow = expiryCashAdjustmentResult.recordset[0] || {};
  const expiryCashAdjustmentAmount = money(expiryCashAdjustmentRow.amount);
  const totalCollection = money(paidAfterDiscount + dueCollection + expiryCashAdjustmentAmount);
  const supplierPaymentAmount = money(Number(purchasePaymentRow.amount || 0) + Number(partyPaymentRow.amount || 0));
  const supplierPaymentTransactions = Number(purchasePaymentRow.transactions || 0) + Number(partyPaymentRow.transactions || 0);
  const groupBy = (rows, key) => {
    const result = /* @__PURE__ */ new Map();
    rows.forEach((row) => {
      const name = row[key] || "Unassigned";
      const current = result.get(name) || { transactions: 0, amount: 0 };
      current.transactions += 1;
      current.amount += row.amount;
      result.set(name, current);
    });
    return Array.from(result, ([name, values]) => ({ name, ...values })).sort((a, b) => b.amount - a.amount);
  };
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    date,
    dailyPurchase: {
      amount: purchases.reduce((sum, item) => sum + item.amount, 0),
      transactions: purchases.length,
      items: purchases.reduce((sum, item) => sum + item.items, 0)
    },
    liveSales: {
      amount: sales.reduce((sum, item) => sum + item.amount, 0),
      transactions: sales.length,
      items: sales.reduce((sum, item) => sum + item.items, 0)
    },
    paidAfterDiscount,
    dueCollection,
    totalCollection,
    supplierPayment: { amount: supplierPaymentAmount, transactions: supplierPaymentTransactions },
    employeePayment: {
      amount: money(employeePaymentRow.amount),
      transactions: Number(employeePaymentRow.transactions || 0)
    },
    expiryCashAdjustment: {
      amount: expiryCashAdjustmentAmount,
      transactions: Number(expiryCashAdjustmentRow.transactions || 0)
    },
    inventory: { items: cachedMedicines.length, units: cachedMedicines.reduce((sum, item) => sum + item.Total_Balance, 0), valuation: cachedMedicines.reduce((sum, item) => sum + item.Total_Balance * item.Cost_Price, 0) },
    expensesTotal: expenses.reduce((sum, item) => sum + item.amount, 0),
    purchases,
    sales,
    employees: groupBy(sales, "employee"),
    counters: groupBy(sales, "counter"),
    expenses,
    dueCollections
  };
}
app.get("/api/analytics", async (req, res) => {
  try {
    const requestedDate = String(req.query.date || dateKey2());
    const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : dateKey2();
    res.json(await fetchAnalyticsFromDatabase(date));
  } catch (error) {
    res.status(503).json({ error: error.message || "Analytics unavailable" });
  }
});
app.get("/api/expiry-cash-adjustments", async (req, res) => {
  const requestedDate = String(req.query.date || dateKey2());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    res.status(400).json({ error: "A valid adjustment date is required." });
    return;
  }
  try {
    const pool = await getSharedPool(getSqlConfig());
    const adjustmentTable = schemaObject("tables", "Medicine_Expiry_Cash_Transaction");
    const supplierTable = schemaObject("tables", "Suppliers");
    const adjustmentId = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Exp_Cash_Trans_ID");
    const adjustmentDate = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Date");
    const adjustmentTime = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Time");
    const adjustmentSupplierId = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Supplier_ID");
    const adjustmentAmount = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Amount");
    const adjustmentRemark = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Remark");
    const adjustmentUserName = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "User_Name");
    const adjustmentComputerName = schemaColumn("tables", "Medicine_Expiry_Cash_Transaction", "Computer_Name");
    const supplierId = schemaColumn("tables", "Suppliers", "Supplier_ID");
    const supplierName = schemaColumn("tables", "Suppliers", "SName");
    const result = await pool.request().input("date", import_mssql4.default.VarChar(10), requestedDate).query(
      `SELECT
          a.${adjustmentId} AS adjustment_id,
          CONVERT(varchar(10), a.${adjustmentDate}, 120) AS adjustment_date,
          a.${adjustmentTime} AS adjustment_time,
          a.${adjustmentSupplierId} AS supplier_id,
          s.${supplierName} AS supplier_name,
          a.${adjustmentAmount} AS amount,
          a.${adjustmentRemark} AS remark,
          a.${adjustmentUserName} AS user_name,
          a.${adjustmentComputerName} AS computer_name
         FROM ${adjustmentTable} a
         LEFT OUTER JOIN ${supplierTable} s
           ON a.${adjustmentSupplierId} = s.${supplierId}
         WHERE CONVERT(varchar(10), a.${adjustmentDate}, 120) = @date
         ORDER BY a.${adjustmentDate} DESC, a.${adjustmentTime} DESC, a.${adjustmentId} DESC`
    );
    const records = result.recordset.map((row) => ({
      id: Number(row.adjustment_id),
      date: String(row.adjustment_date || requestedDate),
      time: String(row.adjustment_time || ""),
      supplierId: Number(row.supplier_id),
      supplierName: String(row.supplier_name || "Unknown supplier"),
      amount: money(row.amount),
      remark: String(row.remark || ""),
      userName: String(row.user_name || ""),
      computerName: String(row.computer_name || "")
    }));
    res.json({
      date: requestedDate,
      total: money(records.reduce((sum, record) => sum + record.amount, 0)),
      transactions: records.length,
      records
    });
  } catch (error) {
    console.error("[Expiry cash adjustments error]", error?.message || error);
    res.status(503).json({ error: "Expiry cash adjustments could not be loaded from SQL Server." });
  }
});
app.get("/api/payment-details", async (req, res) => {
  const kind = String(req.query.kind || "");
  const requestedDate = String(req.query.date || dateKey2());
  if (kind !== "supplier" && kind !== "employee") {
    res.status(400).json({ error: "A valid payment type is required." });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    res.status(400).json({ error: "A valid payment date is required." });
    return;
  }
  try {
    const pool = await getSharedPool(getSqlConfig());
    const paymentModeTable = schemaObject("tables", "Payment_Mode");
    const paymentModeId = schemaColumn("tables", "Payment_Mode", "ID");
    const paymentModeName = schemaColumn("tables", "Payment_Mode", "Name");
    const date = requestedDate;
    let result;
    if (kind === "supplier") {
      const purchasePaymentsTable = schemaObject("tables", "purchase_payments");
      const partyPaymentTable = schemaObject("tables", "Party_Payment");
      const purchaseTable = schemaObject("tables", "Purchase");
      const supplierTable = schemaObject("tables", "Suppliers");
      const purchasePaymentDate = schemaColumn("tables", "purchase_payments", "Date");
      const purchasePaymentTime = schemaColumn("tables", "purchase_payments", "Time");
      const purchasePaymentId = schemaColumn("tables", "purchase_payments", "P_Payment_ID");
      const purchasePaymentAmount = schemaColumn("tables", "purchase_payments", "Amount");
      const purchasePaymentPurchaseId = schemaColumn("tables", "purchase_payments", "Purchase_Id");
      const purchasePaymentPosted = schemaColumn("tables", "purchase_payments", "Posted");
      const purchasePaymentParticulars = schemaColumn("tables", "purchase_payments", "Particulars");
      const purchasePaymentUserName = schemaColumn("tables", "purchase_payments", "UserName");
      const purchasePaymentComputerName = schemaColumn("tables", "purchase_payments", "ComputerName");
      const purchasePaymentMode = schemaColumn("tables", "purchase_payments", "Pay_Mode");
      const purchasePaymentModeDetails = schemaColumn("tables", "purchase_payments", "Pay_Mode_Details");
      const purchaseId = schemaColumn("tables", "Purchase", "Purchase_Id");
      const purchaseNo = schemaColumn("tables", "Purchase", "Purchase_No");
      const purchaseInvoice = schemaColumn("tables", "Purchase", "Invoicel_No");
      const purchaseSupplierId = schemaColumn("tables", "Purchase", "Supplier_ID");
      const supplierId = schemaColumn("tables", "Suppliers", "Supplier_ID");
      const supplierName = schemaColumn("tables", "Suppliers", "SName");
      const partyPaymentDate = schemaColumn("tables", "Party_Payment", "Date");
      const partyPaymentTime = schemaColumn("tables", "Party_Payment", "Time");
      const partyPaymentId = schemaColumn("tables", "Party_Payment", "Payment_ID");
      const partyPaymentPartyId = schemaColumn("tables", "Party_Payment", "Party_ID");
      const partyPaymentAmount = schemaColumn("tables", "Party_Payment", "Amount");
      const partyPaymentPosted = schemaColumn("tables", "Party_Payment", "Posted");
      const partyPaymentParticulars = schemaColumn("tables", "Party_Payment", "Particulars");
      const partyPaymentUserName = schemaColumn("tables", "Party_Payment", "Username");
      const partyPaymentComputerName = schemaColumn("tables", "Party_Payment", "Computer_Name");
      const partyPaymentMode = schemaColumn("tables", "Party_Payment", "Pay_Mode_ID");
      const partyPaymentModeDetails = schemaColumn("tables", "Party_Payment", "Pay_Mode_Detail");
      const partyPaymentBillNo = schemaColumn("tables", "Party_Payment", "PP_Bill_No");
      result = await pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
        `SELECT * FROM (
          SELECT
            'purchase-' + CONVERT(varchar(50), p.${purchasePaymentId}) AS payment_id,
            p.${purchasePaymentTime} AS payment_time,
            'Purchase payment' AS category,
            COALESCE(
              CONVERT(varchar(50), h.${purchaseInvoice}),
              CONVERT(varchar(50), h.${purchaseNo}),
              CONVERT(varchar(50), h.${purchaseId})
            ) AS reference,
            ISNULL(s.${supplierName}, 'Unknown supplier') AS counterparty,
            COALESCE(pm.${paymentModeName}, p.${purchasePaymentModeDetails},
              CASE WHEN p.${purchasePaymentMode} IS NULL THEN 'Recorded'
                   ELSE 'Mode ' + CONVERT(varchar(20), p.${purchasePaymentMode}) END) AS payment_mode,
            ISNULL(p.${purchasePaymentParticulars}, '') AS particulars,
            ISNULL(p.${purchasePaymentUserName}, '') AS user_name,
            ISNULL(p.${purchasePaymentComputerName}, '') AS computer_name,
            ISNULL(p.${purchasePaymentAmount}, 0) AS amount,
            p.${purchasePaymentDate} AS payment_date
          FROM ${purchasePaymentsTable} p
          LEFT OUTER JOIN ${purchaseTable} h
            ON p.${purchasePaymentPurchaseId} = h.${purchaseId}
          LEFT OUTER JOIN ${supplierTable} s
            ON h.${purchaseSupplierId} = s.${supplierId}
          LEFT OUTER JOIN ${paymentModeTable} pm
            ON p.${purchasePaymentMode} = pm.${paymentModeId}
          WHERE CONVERT(varchar(10), p.${purchasePaymentDate}, 120) = @date
            AND ISNULL(p.${purchasePaymentPosted}, 0) = 1

          UNION ALL

          SELECT
            'party-' + CONVERT(varchar(50), p.${partyPaymentId}) AS payment_id,
            p.${partyPaymentTime} AS payment_time,
            'Party payment' AS category,
            COALESCE(CONVERT(varchar(50), p.${partyPaymentBillNo}),
              CONVERT(varchar(50), p.${partyPaymentPartyId})) AS reference,
            CASE WHEN p.${partyPaymentPartyId} IS NULL THEN 'Party'
              ELSE 'Party ' + CONVERT(varchar(50), p.${partyPaymentPartyId}) END AS counterparty,
            COALESCE(pm.${paymentModeName}, p.${partyPaymentModeDetails},
              CASE WHEN p.${partyPaymentMode} IS NULL THEN 'Recorded'
                   ELSE 'Mode ' + CONVERT(varchar(20), p.${partyPaymentMode}) END) AS payment_mode,
            ISNULL(p.${partyPaymentParticulars}, '') AS particulars,
            ISNULL(p.${partyPaymentUserName}, '') AS user_name,
            ISNULL(p.${partyPaymentComputerName}, '') AS computer_name,
            ISNULL(p.${partyPaymentAmount}, 0) AS amount,
            p.${partyPaymentDate} AS payment_date
          FROM ${partyPaymentTable} p
          LEFT OUTER JOIN ${paymentModeTable} pm
            ON p.${partyPaymentMode} = pm.${paymentModeId}
          WHERE CONVERT(varchar(10), p.${partyPaymentDate}, 120) = @date
            AND ISNULL(p.${partyPaymentPosted}, 0) = 1
        ) payments
        ORDER BY payment_date DESC, payment_time DESC, payment_id DESC`
      );
    } else {
      const employeeTransactionTable = schemaObject("tables", "Employee_Transaction");
      const employeeTable = schemaObject("tables", "Employee");
      const employeeDate = schemaColumn("tables", "Employee_Transaction", "Date");
      const employeeTime = schemaColumn("tables", "Employee_Transaction", "Time");
      const employeeTransactionId = schemaColumn("tables", "Employee_Transaction", "EL_ID");
      const employeeId = schemaColumn("tables", "Employee_Transaction", "E_ID");
      const employeeAmount = schemaColumn("tables", "Employee_Transaction", "Amount");
      const employeeParticular = schemaColumn("tables", "Employee_Transaction", "Particular");
      const employeeUserName = schemaColumn("tables", "Employee_Transaction", "UserName");
      const employeeComputerName = schemaColumn("tables", "Employee_Transaction", "ComputerName");
      const employeePaymentMode = schemaColumn("tables", "Employee_Transaction", "Pay_Mode_ID");
      const employeePaymentModeDetail = schemaColumn("tables", "Employee_Transaction", "Pay_Mode_Detail");
      const employeeMasterId = schemaColumn("tables", "Employee", "Eid");
      const employeeName = schemaColumn("tables", "Employee", "Name");
      result = await pool.request().input("date", import_mssql4.default.VarChar(10), date).query(
        `SELECT
          e.${employeeTransactionId} AS payment_id,
          e.${employeeTime} AS payment_time,
          'Employee payment' AS category,
          CONVERT(varchar(50), e.${employeeTransactionId}) AS reference,
          ISNULL(emp.${employeeName}, 'Unknown employee') AS counterparty,
          COALESCE(pm.${paymentModeName}, e.${employeePaymentModeDetail},
            CASE WHEN e.${employeePaymentMode} IS NULL THEN 'Recorded'
                 ELSE 'Mode ' + CONVERT(varchar(20), e.${employeePaymentMode}) END) AS payment_mode,
          ISNULL(e.${employeeParticular}, '') AS particulars,
          ISNULL(e.${employeeUserName}, '') AS user_name,
          ISNULL(e.${employeeComputerName}, '') AS computer_name,
          ISNULL(e.${employeeAmount}, 0) AS amount,
          e.${employeeDate} AS payment_date
        FROM ${employeeTransactionTable} e
        LEFT OUTER JOIN ${employeeTable} emp
          ON e.${employeeId} = emp.${employeeMasterId}
        LEFT OUTER JOIN ${paymentModeTable} pm
          ON e.${employeePaymentMode} = pm.${paymentModeId}
        WHERE CONVERT(varchar(10), e.${employeeDate}, 120) = @date
        ORDER BY e.${employeeDate} DESC, e.${employeeTime} DESC, e.${employeeTransactionId} DESC`
      );
    }
    const records = result.recordset.map((row, index) => ({
      id: row.payment_id ?? index,
      time: String(row.payment_time || ""),
      category: String(row.category || ""),
      reference: String(row.reference || "\u2014"),
      counterparty: String(row.counterparty || "\u2014"),
      paymentMode: String(row.payment_mode || "Recorded"),
      particulars: String(row.particulars || ""),
      userName: String(row.user_name || "\u2014"),
      computerName: String(row.computer_name || "\u2014"),
      amount: money(row.amount)
    }));
    res.json({
      date,
      total: money(records.reduce((sum, record) => sum + record.amount, 0)),
      transactions: records.length,
      records
    });
  } catch (error) {
    res.status(503).json({ error: error.message || "Payment details are unavailable." });
  }
});
app.post("/api/reports/daily-summary", async (req, res) => {
  const requestedDate = String(req.body?.date || dateKey2());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    res.status(400).json({ error: "A valid report date is required." });
    return;
  }
  try {
    const report = await fetchAnalyticsFromDatabase(requestedDate);
    const userId = Number(res.locals.authUser?.id);
    const saved = await saveDailySummaryReport(report, Number.isInteger(userId) ? userId : null);
    res.status(201).json({ success: true, report: saved });
  } catch (error) {
    console.error("[Daily summary save error]", error?.message || error);
    res.status(503).json({ error: "Daily summary could not be saved. Check the SQL Server connections and report table." });
  }
});
app.get("/api/reports/analytics", async (req, res) => {
  const requestedView = String(req.query.view || "monthly");
  if (!["daily", "monthly", "yearly"].includes(requestedView)) {
    res.status(400).json({ error: "Report view must be daily, monthly, or yearly." });
    return;
  }
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const date = String(req.query.date || "");
  const compare = req.query.compare === "true";
  if (req.query.year !== void 0 && (!Number.isInteger(year) || year < 1900 || year > 2200)) {
    res.status(400).json({ error: "A valid report year is required." });
    return;
  }
  if (req.query.month !== void 0 && (!Number.isInteger(month) || month < 1 || month > 12)) {
    res.status(400).json({ error: "A valid report month is required." });
    return;
  }
  if (req.query.date !== void 0 && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "A valid report date is required." });
    return;
  }
  try {
    const report = await getHistoricalReport({
      view: requestedView,
      year: Number.isInteger(year) ? year : (/* @__PURE__ */ new Date()).getUTCFullYear(),
      month: Number.isInteger(month) ? month : void 0,
      date: date || void 0,
      compare
    });
    res.json(report);
  } catch (error) {
    console.error("[Historical report error]", error?.message || error);
    res.status(503).json({ error: "Historical analytics are unavailable. Check the UserAuthDB report table." });
  }
});
app.get("/api/sales/:id/receipt", async (req, res) => {
  const transactionId = Number(req.params.id);
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    res.status(400).json({ error: "A valid transaction id is required" });
    return;
  }
  try {
    const pool = await getSharedPool(getSqlConfig());
    const transactionTable = schemaObject("tables", "transactions");
    const transactionParticularsTable = schemaObject("tables", "transactions_particulars");
    const paymentModeTable = schemaObject("tables", "Payment_Mode");
    const saleId = schemaColumn("tables", "transactions", "trans_id");
    const saleDate = schemaColumn("tables", "transactions", "entry_date");
    const saleTime = schemaColumn("tables", "transactions", "time");
    const saleMedicineBillNo = schemaColumn("tables", "transactions", "Medicine_Bill_no");
    const salePatientName = schemaColumn("tables", "transactions", "Patient_Name");
    const saleTotalBill = schemaColumn("tables", "transactions", "total_bill");
    const saleTotalPaid = schemaColumn("tables", "transactions", "total_paid");
    const saleAmountPaid = schemaColumn("tables", "transactions", "Amount_Paid");
    const saleDiscount = schemaColumn("tables", "transactions", "discount");
    const salePaymentMode = schemaColumn("tables", "transactions", "pay_mode");
    const saleUser = schemaColumn("tables", "transactions", "user_name");
    const saleCounter = schemaColumn("tables", "transactions", "computer_name");
    const salePosted = schemaColumn("tables", "transactions", "posted");
    const paymentModeId = schemaColumn("tables", "Payment_Mode", "ID");
    const paymentModeName = schemaColumn("tables", "Payment_Mode", "Name");
    const particularsId = schemaColumn("tables", "transactions_particulars", "trans_sub_id");
    const particularsTransactionId = schemaColumn("tables", "transactions_particulars", "trans_id");
    const particularsItems = schemaColumn("tables", "transactions_particulars", "items");
    const particularsRate = schemaColumn("tables", "transactions_particulars", "rate");
    const particularsQty = schemaColumn("tables", "transactions_particulars", "qty");
    const particularsAmount = schemaColumn("tables", "transactions_particulars", "amount");
    const particularsDiscountPct = schemaColumn("tables", "transactions_particulars", "Item_Discount_Pct");
    const particularsDiscountAmount = schemaColumn("tables", "transactions_particulars", "Item_Discount_Amount");
    const particularsPosted = schemaColumn("tables", "transactions_particulars", "posted");
    const result = await pool.request().input("transactionId", import_mssql4.default.Int, transactionId).query(
      `SELECT
          t.${saleId} AS trans_id,
          t.${saleDate} AS entry_date,
          t.${saleTime} AS entry_time,
          t.${saleMedicineBillNo} AS medicine_bill_no,
          t.${salePatientName} AS patient_name,
          t.${saleTotalBill} AS total_bill,
          ISNULL(t.${saleTotalPaid}, t.${saleAmountPaid}) AS total_paid,
          t.${saleDiscount} AS bill_discount,
          t.${salePaymentMode} AS pay_mode,
          pm.${paymentModeName} AS payment_mode_name,
          t.${saleUser} AS user_name,
          t.${saleCounter} AS computer_name,
          tp.${particularsId} AS trans_sub_id,
          tp.${particularsItems} AS item_name,
          tp.${particularsRate} AS rate,
          tp.${particularsQty} AS qty,
          tp.${particularsAmount} AS amount,
          tp.${particularsDiscountPct} AS item_discount_pct,
          tp.${particularsDiscountAmount} AS item_discount_amount
         FROM ${transactionTable} t
         LEFT OUTER JOIN ${paymentModeTable} pm
           ON t.${salePaymentMode} = pm.${paymentModeId}
         LEFT OUTER JOIN ${transactionParticularsTable} tp
           ON t.${saleId} = tp.${particularsTransactionId}
          AND ISNULL(tp.${particularsPosted}, 0) = 1
         WHERE t.${saleId} = @transactionId
           AND ISNULL(t.${salePosted}, 0) = 1
         ORDER BY tp.${particularsId}`
    );
    if (result.recordset.length === 0) {
      res.status(404).json({ error: "Posted sale was not found" });
      return;
    }
    const header = result.recordset[0];
    const items = result.recordset.filter((row) => row.trans_sub_id !== null && row.trans_sub_id !== void 0).map((row) => {
      const amount = money(row.amount);
      const itemDiscount2 = money(
        amount * Number(row.item_discount_pct || 0) / 100 + Number(row.item_discount_amount || 0)
      );
      return {
        id: row.trans_sub_id,
        name: String(row.item_name || "Unnamed item"),
        qty: Number(row.qty || 0),
        rate: money(row.rate),
        amount,
        itemDiscount: itemDiscount2,
        netAmount: money(amount - itemDiscount2)
      };
    });
    const grossSubtotal = money(items.reduce((sum, item) => sum + item.amount, 0));
    const itemDiscount = money(items.reduce((sum, item) => sum + item.itemDiscount, 0));
    const billDiscount = money(header.bill_discount);
    const fallbackGrossSubtotal = money(header.total_bill);
    const netPayable = money((items.length > 0 ? grossSubtotal : fallbackGrossSubtotal) - itemDiscount - billDiscount);
    const totalPaid = money(header.total_paid);
    res.json({
      id: header.trans_id,
      medicineBillNo: header.medicine_bill_no === null || header.medicine_bill_no === void 0 ? "\u2014" : String(header.medicine_bill_no),
      date: String(header.entry_date || ""),
      time: String(header.entry_time || ""),
      customer: String(header.patient_name || "Walk-in customer"),
      employee: String(header.user_name || "Unassigned"),
      counter: String(header.computer_name || "Main counter"),
      paymentMode: String(header.payment_mode_name || (header.pay_mode === null || header.pay_mode === void 0 ? "Recorded" : `Mode ${header.pay_mode}`)),
      items,
      grossSubtotal,
      itemDiscount,
      billDiscount,
      netPayable,
      totalPaid,
      due: money(Math.abs(netPayable - totalPaid))
    });
  } catch (error) {
    res.status(503).json({ error: error.message || "Receipt unavailable" });
  }
});
app.post("/api/sync", async (req, res) => {
  const result = await fetchMedicinesFromDatabase();
  lastSyncTime = (/* @__PURE__ */ new Date()).toISOString();
  res.json({
    success: result.connected,
    connected: result.connected,
    recordCount: cachedMedicines.length,
    supplierCount: cachedSuppliers.length,
    lastSync: lastSyncTime,
    message: result.connected ? `Successfully synchronized ${cachedMedicines.length} medicines and ${cachedSuppliers.length} suppliers from SQL Server 2000.` : `Live SQL Server sync failed; no mock data was used. ${result.error || "Check the SQL Server settings in .env."}`
  });
});
app.post("/api/test-connection", async (req, res) => {
  const { server, port, user, password, database } = req.body;
  const testConfig = getSqlConfig({
    server,
    port: parseInt(port || "1433", 10),
    user,
    password,
    database
  });
  try {
    const pool = await new import_mssql4.default.ConnectionPool(testConfig).connect();
    const result = await pool.request().query("SELECT @@VERSION AS version, DB_NAME() AS dbname");
    await pool.close();
    res.json({
      success: true,
      message: "Connection to SQL Server successful!",
      version: result.recordset[0]?.version,
      dbname: result.recordset[0]?.dbname
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Connection failed",
      hint: "For SQL Server 2000: Ensure TCP/IP is enabled on port 1433, Mixed Mode (SQL Server and Windows Authentication) is selected, and firewall allows port 1433."
    });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express3.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Medicine Order Manager running on http://0.0.0.0:${PORT}`);
  });
}
scheduleAutomaticDailySummary();
startServer();
//# sourceMappingURL=server.cjs.map
