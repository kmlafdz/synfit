const admin = require('firebase-admin');
const mysql = require('mysql2/promise');

let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}';
rawKey = rawKey.trim();
if ((rawKey.startsWith("'") && rawKey.endsWith("'")) || (rawKey.startsWith('"') && rawKey.endsWith('"'))) {
  rawKey = rawKey.slice(1, -1);
}
const sa = JSON.parse(rawKey);
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

async function run() {
  console.log('--- Checking Firebase Auth ---');
  let authUser = null;
  for (const email of ['kemal@dev.com', 'kmlafdz@dev.com', 'kmlafdz@gmail.com', 'kmlafdz@synfit.com']) {
    try {
      const u = await admin.auth().getUserByEmail(email);
      console.log(`Found in Auth: ${email} -> UID: ${u.uid}`);
      authUser = u;
    } catch (e) {
      // not found
    }
  }

  console.log('\n--- Checking Firestore users collection ---');
  const firestore = admin.firestore();
  const snap = await firestore.collection('users').get();
  snap.forEach(d => {
    console.log(`Doc: ${d.id}`, d.data());
  });

  console.log('\n--- Checking MariaDB users table ---');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '100.98.152.11',
    user: process.env.DB_USER || 'kemal',
    password: process.env.DB_PASSWORD || 'test123',
    database: process.env.DB_NAME || 'synfit_db'
  });
  const [rows] = await conn.execute('SELECT * FROM users');
  console.log(rows);
  await conn.end();
}

run().catch(console.error);

