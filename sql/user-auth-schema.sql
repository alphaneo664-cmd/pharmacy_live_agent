/*
  Run this script in SQL Server 2008 R2, inside the UserAuthDB database.
  It can be rerun safely to add profile, pharmacy settings, and report storage.
  The application uses only this database for authentication and settings writes.
*/
IF DB_NAME() <> N'UserAuthDB'
BEGIN
  RAISERROR ('Run this script while connected to the UserAuthDB database.', 16, 1);
  RETURN;
END;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    id INT IDENTITY(1, 1) NOT NULL
      CONSTRAINT PK_Users PRIMARY KEY CLUSTERED,
    username NVARCHAR(50) NOT NULL,
    email NVARCHAR(320) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(30) NOT NULL
      CONSTRAINT DF_Users_role DEFAULT (N'user'),
    created_at DATETIME NOT NULL
      CONSTRAINT DF_Users_created_at DEFAULT (GETDATE())
  );
END;
GO

IF COL_LENGTH(N'dbo.Users', N'display_name') IS NULL
BEGIN
  ALTER TABLE dbo.Users
    ADD display_name NVARCHAR(100) NOT NULL
      CONSTRAINT DF_Users_display_name DEFAULT (N'');
END;
GO

UPDATE dbo.Users
SET display_name = username
WHERE display_name = N'';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'UQ_Users_username'
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_Users_username ON dbo.Users(username);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'UQ_Users_email'
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_Users_email ON dbo.Users(email);
END;
GO

IF OBJECT_ID(N'dbo.PharmacySettings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PharmacySettings (
    id TINYINT NOT NULL
      CONSTRAINT PK_PharmacySettings PRIMARY KEY CLUSTERED
      CONSTRAINT CK_PharmacySettings_id CHECK (id = 1),
    pharmacy_name NVARCHAR(100) NOT NULL,
    address NVARCHAR(300) NOT NULL,
    phone NVARCHAR(40) NOT NULL,
    logo_mime_type NVARCHAR(20) NULL,
    logo_data VARBINARY(MAX) NULL,
    updated_at DATETIME NOT NULL
      CONSTRAINT DF_PharmacySettings_updated_at DEFAULT (GETDATE())
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.PharmacySettings WHERE id = 1)
BEGIN
  INSERT INTO dbo.PharmacySettings (id, pharmacy_name, address, phone)
  VALUES (1, N'FATEMA PHARMACY', N'Sherpur Road, Kanusgari, Bogura', N'01919-006067');
END;
GO

IF OBJECT_ID(N'dbo.DailySummaryReports', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DailySummaryReports (
    id INT IDENTITY(1, 1) NOT NULL
      CONSTRAINT PK_DailySummaryReports PRIMARY KEY CLUSTERED,
    report_date DATE NOT NULL,
    generated_at DATETIME NOT NULL,
    created_by INT NULL,
    daily_purchase_amount DECIMAL(19, 2) NOT NULL,
    purchase_transactions INT NOT NULL,
    purchase_items INT NOT NULL,
    live_sales_amount DECIMAL(19, 2) NOT NULL,
    sales_transactions INT NOT NULL,
    sales_items INT NOT NULL,
    paid_after_discount DECIMAL(19, 2) NOT NULL,
    due_collection DECIMAL(19, 2) NOT NULL,
    total_collection DECIMAL(19, 2) NOT NULL,
    supplier_payment_amount DECIMAL(19, 2) NOT NULL
      CONSTRAINT DF_DailySummaryReports_supplier_payment_amount DEFAULT (0),
    employee_payment_amount DECIMAL(19, 2) NOT NULL
      CONSTRAINT DF_DailySummaryReports_employee_payment_amount DEFAULT (0),
    inventory_items INT NOT NULL,
    inventory_units DECIMAL(19, 2) NOT NULL,
    inventory_valuation DECIMAL(19, 2) NOT NULL,
    expenses_total DECIMAL(19, 2) NOT NULL,
    report_json NVARCHAR(MAX) NOT NULL,
    saved_at DATETIME NOT NULL
      CONSTRAINT DF_DailySummaryReports_saved_at DEFAULT (GETDATE())
  );
END;
GO

IF COL_LENGTH(N'dbo.DailySummaryReports', N'supplier_payment_amount') IS NULL
BEGIN
  ALTER TABLE dbo.DailySummaryReports
    ADD supplier_payment_amount DECIMAL(19, 2) NOT NULL
      CONSTRAINT DF_DailySummaryReports_supplier_payment_amount DEFAULT (0);
END;
GO

IF COL_LENGTH(N'dbo.DailySummaryReports', N'employee_payment_amount') IS NULL
BEGIN
  ALTER TABLE dbo.DailySummaryReports
    ADD employee_payment_amount DECIMAL(19, 2) NOT NULL
      CONSTRAINT DF_DailySummaryReports_employee_payment_amount DEFAULT (0);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.DailySummaryReports') AND name = N'UQ_DailySummaryReports_report_date'
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_DailySummaryReports_report_date
    ON dbo.DailySummaryReports(report_date);
END;
GO

IF OBJECT_ID(N'dbo.EmailNotificationSettings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EmailNotificationSettings (
    id TINYINT NOT NULL
      CONSTRAINT PK_EmailNotificationSettings PRIMARY KEY CLUSTERED
      CONSTRAINT CK_EmailNotificationSettings_id CHECK (id = 1),
    sender_email NVARCHAR(320) NULL,
    app_password_ciphertext VARBINARY(MAX) NULL,
    app_password_iv VARBINARY(16) NULL,
    app_password_auth_tag VARBINARY(16) NULL,
    updated_at DATETIME NOT NULL
      CONSTRAINT DF_EmailNotificationSettings_updated_at DEFAULT (GETDATE())
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.EmailNotificationSettings WHERE id = 1)
BEGIN
  INSERT INTO dbo.EmailNotificationSettings (id, sender_email)
  VALUES (1, NULL);
END;
GO

IF OBJECT_ID(N'dbo.HourlySummaryReports', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.HourlySummaryReports (
    id INT IDENTITY(1, 1) NOT NULL
      CONSTRAINT PK_HourlySummaryReports PRIMARY KEY CLUSTERED,
    snapshot_hour_utc DATETIME NOT NULL,
    generated_at DATETIME NOT NULL,
    stock_valuation DECIMAL(19, 2) NOT NULL,
    daily_purchase DECIMAL(19, 2) NOT NULL,
    live_sale DECIMAL(19, 2) NOT NULL,
    paid_after_discount DECIMAL(19, 2) NOT NULL,
    daily_due_collections DECIMAL(19, 2) NOT NULL,
    total_collection DECIMAL(19, 2) NOT NULL,
    saved_at DATETIME NOT NULL
      CONSTRAINT DF_HourlySummaryReports_saved_at DEFAULT (GETDATE())
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.HourlySummaryReports') AND name = N'UQ_HourlySummaryReports_snapshot_hour_utc'
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_HourlySummaryReports_snapshot_hour_utc
    ON dbo.HourlySummaryReports(snapshot_hour_utc);
END;
GO