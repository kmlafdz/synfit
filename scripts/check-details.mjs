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

async function checkDetails() {
  const accounts = await db.collection("member_accounts").get();
  accounts.forEach((d) => {
    const data = d.data();
    console.log("Account:", d.id, {
      member_id: data.member_id,
      nama: data.nama,
      phone: data.nomor_whatsapp,
      has_hash: Boolean(data.password_hash),
      hash_snippet: data.password_hash ? data.password_hash.substring(0, 20) + "..." : null,
      has_plain_password: Boolean(data.password),
      plain_val: data.password || null,
      must_change: data.must_change_password
    });
  });
}
checkDetails().catch(console.error);
