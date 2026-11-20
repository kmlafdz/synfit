const admin = require('firebase-admin');
const fs = require('fs');

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');
const env = {};
for (const line of lines) {
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

const db = admin.firestore();

async function checkCollections() {
  const collections = ['users', 'members', 'member_accounts', 'registrations', 'transactions', 'equipment', 'workout_programs', 'configs', 'checkins'];
  for (const c of collections) {
    try {
      const snap = await db.collection(c).get();
      console.log(c + ':', snap.size, 'documents');
    } catch(e) {
      console.log(c + ' error:', e.message);
    }
  }
}
checkCollections();
