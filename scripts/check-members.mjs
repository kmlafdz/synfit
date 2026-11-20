import admin from "firebase-admin";
import fs from "fs";

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

async function check() {
  const members = await db.collection("members").get();
  console.log("Total members in DB:", members.size);
  const accounts = await db.collection("member_accounts").get();
  console.log("Total member_accounts in DB:", accounts.size);
  
  const accMemberIds = new Set();
  accounts.forEach((d) => {
    const data = d.data();
    if (data.member_id) accMemberIds.add(data.member_id);
    console.log("Account doc:", d.id, "member_id:", data.member_id, "phone:", data.nomor_whatsapp, "has_hash:", Boolean(data.password_hash));
  });

  console.log("\nChecking members missing from member_accounts:");
  members.forEach((m) => {
    const data = m.data();
    const inAcc = accMemberIds.has(m.id);
    console.log("Member:", m.id, data.nama, data.nomor_whatsapp, "-> has account:", inAcc, "has_direct_pass:", Boolean(data.password_hash || data.password));
  });
}
check().catch(console.error);
