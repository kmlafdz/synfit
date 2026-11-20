import admin from "firebase-admin";
import fs from "fs";
import crypto from "crypto";

// Read .env.local manually
const envContent = fs.readFileSync(".env.local", "utf-8");
let rawKey = "";
for (const line of envContent.split("\n")) {
  if (line.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY=")) {
    rawKey = line.substring("FIREBASE_SERVICE_ACCOUNT_KEY=".length).trim();
    break;
  }
}
if ((rawKey.startsWith("'") && rawKey.endsWith("'")) || (rawKey.startsWith('"') && rawKey.endsWith('"'))) {
  rawKey = rawKey.slice(1, -1);
}
const sa = JSON.parse(rawKey);
if (sa.private_key) {
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");
}

admin.initializeApp({
  credential: admin.credential.cert(sa)
});
const db = admin.firestore();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256").toString("hex");
  return `${salt}$${hash}`;
}

async function syncAndClean() {
  console.log("=== SYNCING MEMBER AUTH IN FIRESTORE ===");
  const membersSnap = await db.collection("members").get();
  const accountsSnap = await db.collection("member_accounts").get();

  console.log(`Found ${membersSnap.size} members, ${accountsSnap.size} account records.`);

  // Group accounts by member_id
  const accountsByMember = new Map();
  accountsSnap.forEach(docSnap => {
    const data = docSnap.data();
    const memId = data.member_id;
    if (memId) {
      if (!accountsByMember.has(memId)) {
        accountsByMember.set(memId, []);
      }
      accountsByMember.get(memId).push({ id: docSnap.id, ref: docSnap.ref, data });
    }
  });

  // 1. Process each member
  for (const memDoc of membersSnap.docs) {
    const memData = memDoc.data();
    const memberId = memDoc.id;
    const accList = accountsByMember.get(memberId) || [];

    if (accList.length === 0) {
      console.log(`Member ${memData.nama} (${memberId}) has NO account record. Creating one...`);
      const defaultHash = hashPassword("areta123");
      const newRef = await db.collection("member_accounts").add({
        member_id: memberId,
        nama: memData.nama || "Member",
        nomor_whatsapp: memData.nomor_whatsapp || "",
        password_hash: defaultHash,
        must_change_password: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Created account ${newRef.id} for member ${memData.nama}`);
    } else {
      // Pick the primary account (preferably one with password_hash)
      const primaryAcc = accList.find(a => a.data.password_hash) || accList[0];
      
      // If there are duplicate account records for this member, remove duplicates
      if (accList.length > 1) {
        console.log(`Member ${memData.nama} (${memberId}) has ${accList.length} accounts. Keeping primary ${primaryAcc.id} and cleaning duplicates...`);
        for (const extra of accList) {
          if (extra.id !== primaryAcc.id) {
            await extra.ref.delete();
            console.log(`Deleted duplicate account doc: ${extra.id}`);
          }
        }
      }

      // Check if primary account needs upgrade (e.g. legacy plain password -> PBKDF2 hash)
      let needsUpdate = false;
      const updateData = {};

      if (!primaryAcc.data.password_hash) {
        const plainPass = primaryAcc.data.password || "areta123";
        updateData.password_hash = hashPassword(plainPass);
        updateData.password = admin.firestore.FieldValue.delete();
        updateData.must_change_password = true;
        needsUpdate = true;
      }

      // Keep phone number & name synchronized
      if (primaryAcc.data.nomor_whatsapp !== memData.nomor_whatsapp) {
        updateData.nomor_whatsapp = memData.nomor_whatsapp;
        needsUpdate = true;
      }
      if (primaryAcc.data.nama !== memData.nama) {
        updateData.nama = memData.nama;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updateData.updated_at = admin.firestore.FieldValue.serverTimestamp();
        await primaryAcc.ref.update(updateData);
        console.log(`Updated & secured account ${primaryAcc.id} for member ${memData.nama}`);
      } else {
        console.log(`Account ${primaryAcc.id} for member ${memData.nama} is already up to date and secured.`);
      }
    }
  }

  // 2. Also ensure members collection doesn't hold dangling plaintext passwords
  for (const memDoc of membersSnap.docs) {
    const memData = memDoc.data();
    if (memData.password) {
      await memDoc.ref.update({
        password: admin.firestore.FieldValue.delete()
      });
      console.log(`Removed plaintext password field from member ${memDoc.id}`);
    }
  }

  console.log("=== SYNC COMPLETE ===");
}

syncAndClean().catch(console.error);
