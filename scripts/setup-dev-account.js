const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('=== 1. Setup Firebase Auth for kemal@dev.com ===');
  let authUid = 'mS3GTiTn9KRRDqGwSfgNySxjX7w2';
  try {
    const user = await admin.auth().getUserByEmail('kemal@dev.com');
    authUid = user.uid;
    console.log('Existing user found with UID:', authUid);
  } catch (e) {
    console.log('Creating auth user kemal@dev.com...');
    const created = await admin.auth().createUser({
      email: 'kemal@dev.com',
      emailVerified: true,
      displayName: 'Muhammad Kemal',
    });
    authUid = created.uid;
  }

  // Ensure password is set to 'kemal123456' and emailVerified is true
  await admin.auth().updateUser(authUid, {
    password: 'kemal123456',
    emailVerified: true,
    displayName: 'Muhammad Kemal'
  });
  const authUser = await admin.auth().getUser(authUid);
  console.log('Firebase Auth confirmed:');
  console.log('  UID:', authUser.uid);
  console.log('  Email:', authUser.email);
  console.log('  EmailVerified:', authUser.emailVerified);

  console.log('\n=== 2. Setup Firestore users doc ===');
  const firestore = admin.firestore();
  const firestoreDocRef = firestore.collection('users').doc('dISTbYmGXNClxjoENif1');
  await firestoreDocRef.set({
    uid: authUid,
    name: 'Muhammad Kemal',
    username: 'kmlafdz',
    email: 'kemal@dev.com',
    role: 'DEVELOPER',
    status: 'Active',
    photoUrl: 'https://res.cloudinary.com/ddozkcgfm/image/upload/v1780881195/lc_udd5g8.gif',
    initial: 'K',
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log('Firestore doc dISTbYmGXNClxjoENif1 updated:');
  const fsDoc = await firestoreDocRef.get();
  console.log('  Data:', fsDoc.data());

  console.log('\n=== 3. Setup MariaDB users table ===');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '100.98.152.11',
    user: process.env.DB_USER || 'kemal',
    password: process.env.DB_PASSWORD || 'test123',
    database: process.env.DB_NAME || 'synfit_db'
  });

  // Check if password_hash column exists in users
  const [cols] = await conn.execute("SHOW COLUMNS FROM users LIKE 'password_hash'");
  if (cols.length === 0) {
    console.log('Adding password_hash column to users table...');
    await conn.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER role");
  }

  const hashedPassword = hashPassword('1234');

  await conn.execute(
    `UPDATE users 
     SET username = 'kmlafdz', 
         name = 'Muhammad Kemal', 
         role = 'DEVELOPER', 
         email = 'kemal@dev.com',
         password_hash = ?,
         updated_at = NOW() 
     WHERE id = 'dISTbYmGXNClxjoENif1' OR email = 'kemal@dev.com'`,
    [hashedPassword]
  );
  console.log('MariaDB users record updated!');

  const [rows] = await conn.execute("SELECT id, username, email, name, role, password_hash FROM users WHERE username = 'kmlafdz'");
  console.log('Verified MariaDB record:', rows[0]);

  await conn.end();
  console.log('\nAll database and auth configurations completed successfully!');
}

main().catch(console.error);
