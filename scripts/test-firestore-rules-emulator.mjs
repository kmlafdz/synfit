/**
 * FIRESTORE RULES ENGINE VERIFICATION VIA LOCAL FIREBASE EMULATOR
 * Executes real requests against the Cloud Firestore Rules Engine in the local emulator.
 */

import http from "http";

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8085";
const PROJECT_ID = "test-synfit";
const BASE_PATH = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let pass = 0;
let fail = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    pass++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    fail++;
  }
}

// Generate unsigned mock JWT accepted by Firebase Firestore Emulator
function createMockToken(uid, email, role = "ADMIN") {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: uid,
      user_id: uid,
      uid: uid,
      email: email,
      role: role,
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
    })
  ).toString("base64url");
  return `${header}.${payload}.`;
}

async function firestoreRequest(method, docPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const [hostname, port] = EMULATOR_HOST.split(":");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname,
        port: Number(port) || 8085,
        path: `${BASE_PATH}${docPath}`,
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            json = data;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );

    req.on("error", (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runEmulatorTests() {
  console.log("========================================================================");
  console.log(`   FIREBASE EMULATOR RULES ENGINE VERIFICATION (${EMULATOR_HOST})`);
  console.log("========================================================================");

  const staffToken = createMockToken("staff_uid_101", "staff@synfit.id", "ADMIN");
  const unprivilegedToken = createMockToken("guest_uid_202", "guest@gmail.com", "GUEST");

  // 1. Anonymous Read /users -> MUST BE FORBIDDEN (No reconnaissance!)
  console.log("\n[EMULATOR 1] Anonymous reading /users/staff_uid_101");
  const r1 = await firestoreRequest("GET", "/users/staff_uid_101");
  assert(r1.status === 403, `Membaca data akun staf tanpa auth ditolak (Status: ${r1.status})`);

  // 2. Authenticated Staff Read /users -> ALLOWED
  console.log("\n[EMULATOR 2] Authenticated staff reading /users/staff_uid_101");
  const r2 = await firestoreRequest("GET", "/users/staff_uid_101", null, staffToken);
  assert(r2.status === 200 || r2.status === 404, `Staf terautentikasi dapat membaca data user (Status: ${r2.status})`);

  // 3. Client SDK creating /users with role='Owner' -> FORBIDDEN (No privilege escalation!)
  console.log("\n[EMULATOR 3] Client SDK creating /users with forged role='Owner'");
  const r3 = await firestoreRequest(
    "POST",
    "/users",
    {
      fields: {
        uid: { stringValue: "staff_uid_101" },
        name: { stringValue: "Impostor" },
        username: { stringValue: "impostor" },
        email: { stringValue: "impostor@synfit.id" },
        role: { stringValue: "Owner" },
        status: { stringValue: "Active" },
        created_at: { stringValue: new Date().toISOString() },
      },
    },
    staffToken
  );
  assert(r3.status === 403, `Eskalasi role Owner lewat Client SDK ditolak (Status: ${r3.status})`);

  // 4. Client SDK creating /users with role='Admin' & valid fields -> ALLOWED
  console.log("\n[EMULATOR 4] Client SDK creating /users with role='Admin' & valid fields");
  const r4 = await firestoreRequest(
    "POST",
    "/users",
    {
      fields: {
        uid: { stringValue: "staff_uid_102" },
        name: { stringValue: "New Admin" },
        username: { stringValue: "newadmin" },
        email: { stringValue: "newadmin@synfit.id" },
        role: { stringValue: "Admin" },
        status: { stringValue: "Active" },
        created_at: { stringValue: new Date().toISOString() },
      },
    },
    staffToken
  );
  assert(r4.status === 200, `Pembuatan staf Admin dengan format sah diizinkan (Status: ${r4.status})`);

  // 5. Client SDK direct delete on /users -> FORBIDDEN (Must go through /api/users/delete)
  console.log("\n[EMULATOR 5] Client SDK direct delete on /users/staff_uid_102");
  const r5 = await firestoreRequest("DELETE", "/users/staff_uid_102", null, staffToken);
  assert(r5.status === 403, `Penghapusan user via Client SDK diblokir total (Status: ${r5.status})`);

  // 6. Anonymous Read /members -> FORBIDDEN
  console.log("\n[EMULATOR 6] Anonymous reading /members/M001");
  const r6 = await firestoreRequest("GET", "/members/M001");
  assert(r6.status === 403, `Membaca data member tanpa auth ditolak (Status: ${r6.status})`);

  // 7. Authenticated Staff Read /members -> ALLOWED
  console.log("\n[EMULATOR 7] Authenticated staff reading /members/M001");
  const r7 = await firestoreRequest("GET", "/members/M001", null, staffToken);
  assert(r7.status === 200 || r7.status === 404, `Staf terautentikasi dapat membaca data member (Status: ${r7.status})`);

  // 8. Anonymous Read /member_accounts -> FORBIDDEN
  console.log("\n[EMULATOR 8] Anonymous reading /member_accounts/081234567890");
  const r8 = await firestoreRequest("GET", "/member_accounts/081234567890");
  assert(r8.status === 403, `Membaca akun kredensial member tanpa auth ditolak (Status: ${r8.status})`);

  // 9. Anonymous Read /checkins -> FORBIDDEN
  console.log("\n[EMULATOR 9] Anonymous reading /checkins/chk001");
  const r9 = await firestoreRequest("GET", "/checkins/chk001");
  assert(r9.status === 403, `Membaca checkin tanpa auth ditolak (Status: ${r9.status})`);

  // 10. Anonymous Read /member_chats -> FORBIDDEN
  console.log("\n[EMULATOR 10] Anonymous reading /member_chats/chat001");
  const r10 = await firestoreRequest("GET", "/member_chats/chat001");
  assert(r10.status === 403, `Membaca chat member tanpa auth ditolak (Status: ${r10.status})`);

  // 11. Anonymous Read /notifications -> FORBIDDEN
  console.log("\n[EMULATOR 11] Anonymous reading /notifications/notif001");
  const r11 = await firestoreRequest("GET", "/notifications/notif001");
  assert(r11.status === 403, `Membaca notifikasi tanpa auth ditolak (Status: ${r11.status})`);

  // 12. Anonymous Write /transactions -> FORBIDDEN
  console.log("\n[EMULATOR 12] Anonymous writing /transactions");
  const r12 = await firestoreRequest("POST", "/transactions", {
    fields: {
      member: { stringValue: "Hacker" },
      amount: { integerValue: "100000" },
    },
  });
  assert(r12.status === 403, `Menulis transaksi tanpa auth ditolak (Status: ${r12.status})`);

  // 13. Client SDK direct write /workout_sessions -> FORBIDDEN (Allow write: if false)
  console.log("\n[EMULATOR 13] Client SDK direct write /workout_sessions (allow write: if false)");
  const r13 = await firestoreRequest(
    "POST",
    "/workout_sessions",
    {
      fields: {
        member_id: { stringValue: "m1" },
        reps: { integerValue: "50" },
      },
    },
    staffToken
  );
  assert(r13.status === 403, `Menulis sesi latihan langsung dari client SDK ditolak total (Status: ${r13.status})`);

  // 14. Public Read /configs/gym -> ALLOWED
  console.log("\n[EMULATOR 14] Public read /configs/gym (allow read: if true)");
  const r14 = await firestoreRequest("GET", "/configs/gym");
  assert(r14.status === 200 || r14.status === 404, `Membaca configs gym publik diperbolehkan (Status: ${r14.status}, bukan 403)`);

  // 15. Public Read /equipment/eq1 -> ALLOWED
  console.log("\n[EMULATOR 15] Public read /equipment/eq1 (allow read: if true)");
  const r15 = await firestoreRequest("GET", "/equipment/eq1");
  assert(r15.status === 200 || r15.status === 404, `Membaca katalog alat gym publik diperbolehkan (Status: ${r15.status}, bukan 403)`);

  // 16. Public Submit Registration with Pending status -> ALLOWED
  console.log("\n[EMULATOR 16] Public create /registrations with status='Pending' & whitelisted fields");
  const r16 = await firestoreRequest("POST", "/registrations", {
    fields: {
      nama: { stringValue: "Budi Santoso" },
      nomor_whatsapp: { stringValue: "081234567890" },
      status: { stringValue: "Pending" },
    },
  });
  assert(r16.status === 200, `Pendaftaran publik baru dengan status Pending berhasil dibuat (Status: ${r16.status})`);

  // 17. Public Submit Registration with unwhitelisted extra fields (e.g. role) -> FORBIDDEN
  console.log("\n[EMULATOR 17] Public create /registrations attempting extra unwhitelisted field (role='ADMIN')");
  const r17 = await firestoreRequest("POST", "/registrations", {
    fields: {
      nama: { stringValue: "Hacker" },
      nomor_whatsapp: { stringValue: "081234567890" },
      status: { stringValue: "Pending" },
      role: { stringValue: "ADMIN" }, // Forbidden extra key
    },
  });
  assert(r17.status === 403, `Pendaftaran publik dengan field tambahan tidak diizinkan ditolak (Status: ${r17.status})`);

  // 18. Public Submit Registration with forged status='Approved' -> FORBIDDEN
  console.log("\n[EMULATOR 18] Public create /registrations attempting forged status='Approved'");
  const r18 = await firestoreRequest("POST", "/registrations", {
    fields: {
      nama: { stringValue: "Hacker" },
      nomor_whatsapp: { stringValue: "081234567890" },
      status: { stringValue: "Approved" },
    },
  });
  assert(r18.status === 403, `Upaya pemalsuan approval status pendaftaran ditolak oleh rules (Status: ${r18.status})`);

  // 19. Catch-all Default Deny on unknown collection /secret_data -> FORBIDDEN
  console.log("\n[EMULATOR 19] Catch-all default deny on /secret_data/doc1");
  const r19 = await firestoreRequest("GET", "/secret_data/doc1");
  assert(r19.status === 403, `Koleksi tidak terdaftar diblokir oleh default deny catch-all (Status: ${r19.status})`);

  console.log("\n========================================================================");
  console.log(`EMULATOR TEST RESULTS: ${pass} PASSED, ${fail} FAILED`);
  console.log("========================================================================");

  if (fail > 0) process.exit(1);
  process.exit(0);
}

runEmulatorTests().catch((e) => {
  console.error("Emulator tests failed to run:", e);
  process.exit(1);
});
