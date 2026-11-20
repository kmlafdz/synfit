const mysql = require('mysql2/promise');

async function createPaymentTable() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '100.98.152.11',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'kemal',
    password: process.env.DB_PASSWORD || 'test123',
    database: process.env.DB_NAME || 'synfit_db',
  });

  const sql = `
    CREATE TABLE IF NOT EXISTS payment_orders (
      id VARCHAR(128) PRIMARY KEY,
      order_id VARCHAR(128) UNIQUE NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'Pending',
      payment_type VARCHAR(64),
      customer_name VARCHAR(191),
      customer_phone VARCHAR(32),
      customer_email VARCHAR(191),
      order_type VARCHAR(32) NOT NULL DEFAULT 'registration',
      membership_type VARCHAR(64),
      member_id VARCHAR(128),
      registration_id VARCHAR(128),
      snap_token VARCHAR(255),
      raw_notification JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_order_id (order_id),
      INDEX idx_order_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await pool.query(sql);
  console.log('payment_orders table created/verified successfully in MariaDB!');
  await pool.end();
}

createPaymentTable().catch(err => {
  console.error("Failed to create table:", err);
  process.exit(1);
});
