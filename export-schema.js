import fs from 'fs';
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// SQL Server 2000 এর জন্য কানেকশন কনফিগারেশন
const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'your_password',
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_NAME || 'your_db_name',
  options: {
    encrypt: false, // SQL Server 2000-এ এনক্রিপশন সাপোর্ট করে না
    trustServerCertificate: true,
    enableArithAbort: true,
    tdsVersion: '7_1' // SQL Server 2000 TDS Protocol Standard
  }
};

async function exportSchema() {
  try {
    console.log("SQL Server 2000-এ কানেক্ট করা হচ্ছে...");
    let pool = await sql.connect(config);
    
    console.log("সমস্ত Table এবং View-এর মেটাডাটা এক্সট্র্যাক্ট করা হচ্ছে...");
    
    const query = `
      SELECT 
        t.TABLE_NAME as objectName,
        t.TABLE_TYPE as objectType,
        c.COLUMN_NAME as columnName,
        c.DATA_TYPE as dataType,
        c.CHARACTER_MAXIMUM_LENGTH as maxLength,
        c.IS_NULLABLE as isNullable,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isPrimaryKey
      FROM INFORMATION_SCHEMA.TABLES t
      INNER JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME
      LEFT JOIN (
        SELECT ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
          AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE t.TABLE_TYPE IN ('BASE TABLE', 'VIEW')
      ORDER BY t.TABLE_TYPE, t.TABLE_NAME, c.ORDINAL_POSITION;
    `;

    const result = await pool.request().query(query);
    
    const schemaMap = {
      tables: {},
      views: {}
    };

    result.recordset.forEach(row => {
      const targetCategory = row.objectType === 'VIEW' ? 'views' : 'tables';
      
      if (!schemaMap[targetCategory][row.objectName]) {
        schemaMap[targetCategory][row.objectName] = [];
      }
      
      schemaMap[targetCategory][row.objectName].push({
        column: row.columnName,
        type: row.dataType,
        maxLength: row.maxLength,
        nullable: row.isNullable === 'YES',
        isPrimaryKey: row.isPrimaryKey === 1
      });
    });

    fs.writeFileSync('db-schema.json', JSON.stringify(schemaMap, null, 2));
    console.log("সফলভাবে সমস্ত Table এবং View 'db-schema.json' ফাইলে এক্সপোর্ট হয়েছে!");
    process.exit(0);
  } catch (err) {
    console.error("কানেকশন বা এক্সপোর্টে এরর হয়েছে:", err);
    process.exit(1);
  }
}

exportSchema();