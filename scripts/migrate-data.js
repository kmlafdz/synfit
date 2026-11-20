const admin = require('firebase-admin');
const fs = require('fs');
const mysql = require('mysql2/promise');

// 1. Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

// 2. Init Firebase
let rawKey = env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}';
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
const firestore = admin.firestore();

function convertTimestamp(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (val.seconds) {
    return new Date(val.seconds * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function runDataMigration() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST || '100.98.152.11',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'kemal',
    password: env.DB_PASSWORD || 'test123',
    database: env.DB_NAME || 'synfit_db'
  });
  console.log('Connected to MariaDB at', env.DB_HOST);

  try {
    // 0. Update column type to LONGTEXT for large base64 proof images
    await conn.query('ALTER TABLE registrations MODIFY COLUMN bukti_pembayaran LONGTEXT;');
    await conn.query('ALTER TABLE members MODIFY COLUMN foto_url LONGTEXT;');
    await conn.query('ALTER TABLE equipment MODIFY COLUMN foto_url LONGTEXT;');

    // 1. Migrate Users
    const usersSnap = await firestore.collection('users').get();
    console.log(`Migrating ${usersSnap.size} users...`);
    for (const doc of usersSnap.docs) {
      const d = doc.data();
      await conn.query(
        `INSERT INTO users (id, username, email, name, role, photo_url, initial, settings, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), settings=VALUES(settings)`,
        [
          doc.id,
          d.username || null,
          d.email || `${doc.id}@synfit.local`,
          d.name || 'Staff User',
          ['ADMIN', 'OWNER', 'STAFF', 'DEVELOPER'].includes(String(d.role).toUpperCase()) ? String(d.role).toUpperCase() : 'STAFF',
          d.photoUrl || null,
          d.initial || (d.name ? d.name.charAt(0) : 'U'),
          d.settings ? JSON.stringify(d.settings) : null,
          convertTimestamp(d.created_at) || new Date()
        ]
      );
    }

    // 2. Migrate Registrations
    const regSnap = await firestore.collection('registrations').get();
    console.log(`Migrating ${regSnap.size} registrations...`);
    for (const doc of regSnap.docs) {
      const d = doc.data();
      await conn.query(
        `INSERT INTO registrations (id, nama, email, nomor_whatsapp, alamat, membership_type, payment_method, bukti_pembayaran, amount, status, is_renewal, member_id, uid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [
          doc.id,
          d.nama || 'Registrant',
          d.email || null,
          d.nomor_whatsapp || '-',
          d.alamat || null,
          d.membership_type || '1 Bulan',
          d.payment_method || 'Cash',
          d.bukti_pembayaran || null,
          Number(d.amount) || 0,
          ['Pending', 'Approved', 'Rejected'].includes(d.status) ? d.status : 'Pending',
          Boolean(d.is_renewal),
          d.member_id || null,
          d.uid || null,
          convertTimestamp(d.created_at) || new Date()
        ]
      );
    }

    // 3. Migrate Transactions
    const transSnap = await firestore.collection('transactions').get();
    console.log(`Migrating ${transSnap.size} transactions...`);
    for (const doc of transSnap.docs) {
      const d = doc.data();
      await conn.query(
        `INSERT INTO transactions (id, member, type, amount, method, status, date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [
          doc.id,
          d.member || 'Member',
          d.type || 'Membership',
          Number(d.amount) || 0,
          d.method || 'Cash',
          d.status || 'Success',
          d.date || null,
          d.notes || null,
          convertTimestamp(d.created_at) || new Date()
        ]
      );
    }

    // 4. Migrate Equipment
    const equipSnap = await firestore.collection('equipment').get();
    console.log(`Migrating ${equipSnap.size} equipment items...`);
    for (const doc of equipSnap.docs) {
      const d = doc.data();
      await conn.query(
        `INSERT INTO equipment (id, nama, kategori, kondisi, jumlah, foto_url, deskripsi, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nama=VALUES(nama), kondisi=VALUES(kondisi)`,
        [
          doc.id,
          d.nama || 'Alat Fitness',
          d.kategori || 'General',
          d.kondisi || 'Baik',
          Number(d.jumlah) || 1,
          d.foto_url || null,
          d.deskripsi || null,
          convertTimestamp(d.created_at) || new Date()
        ]
      );
    }

    // 5. Migrate Workout Programs
    const progSnap = await firestore.collection('workout_programs').get();
    console.log(`Migrating ${progSnap.size} workout programs...`);
    for (const doc of progSnap.docs) {
      const d = doc.data();
      await conn.query(
        `INSERT INTO workout_programs (id, member_id, name, description, source, status, preferences, sessions, current_week, total_weeks, completed_session_ids, start_date, end_date, version, created_at, activated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), status=VALUES(status)`,
        [
          doc.id,
          d.memberId || 'legacy-member',
          d.name || 'Program Latihan Personal',
          d.description || null,
          d.source || 'manual',
          ['draft', 'active', 'completed', 'archived'].includes(d.status) ? d.status : 'draft',
          d.preferences ? JSON.stringify(d.preferences) : null,
          d.sessions ? JSON.stringify(d.sessions) : null,
          Number(d.currentWeek) || 1,
          Number(d.totalWeeks) || 8,
          d.completedSessionIds ? JSON.stringify(d.completedSessionIds) : null,
          d.startDate ? new Date(d.startDate) : null,
          d.endDate ? new Date(d.endDate) : null,
          Number(d.version) || 1,
          convertTimestamp(d.createdAt) || new Date(),
          convertTimestamp(d.activatedAt) || null
        ]
      );
    }

    // 6. Migrate Checkins
    const checkinSnap = await firestore.collection('checkins').get();
    console.log(`Migrating ${checkinSnap.size} checkin records...`);
    for (const doc of checkinSnap.docs) {
      const d = doc.data();
      await conn.query(
        `INSERT INTO checkins (id, member_id, member_name, checkin_time, checkout_time, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [
          doc.id,
          d.member_id || d.memberId || 'unknown',
          d.member_name || d.nama || 'Member',
          convertTimestamp(d.checkin_time || d.timestamp) || new Date(),
          convertTimestamp(d.checkout_time) || null,
          d.latitude || null,
          d.longitude || null,
          d.status || 'Completed'
        ]
      );
    }

    // 7. Migrate Configs
    const configSnap = await firestore.collection('configs').get();
    console.log(`Migrating ${configSnap.size} config documents...`);
    for (const doc of configSnap.docs) {
      const d = doc.data();
      await conn.query(
        `INSERT INTO configs (key_name, config_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)`,
        [
          doc.id,
          JSON.stringify(d)
        ]
      );
    }

    console.log('ALL DATA MIGRATED SUCCESSFULLY TO MARIADB!');
  } catch (err) {
    console.error('Data migration error:', err);
  } finally {
    await conn.end();
  }
}

runDataMigration();
