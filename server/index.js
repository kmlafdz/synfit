/**
 * SynFit Dedicated Payment & AI Proxy Backend Server
 * Berjalan mandiri di VPS / Server Anda untuk menangani API Midtrans, AI Proxy, & sinkronisasi database.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const midtransClient = require('midtrans-client');
const admin = require('firebase-admin');

// 1. Baca Konfigurasi Lingkungan (.env.local)
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        let key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const PORT = process.env.PORT || 5000;
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '';
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB limit to prevent memory DoS

// CORS Allowlist
const DEFAULT_ALLOWED_ORIGINS = [
  'https://synfitgym.web.app',
  'https://synfitgym.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'capacitor://localhost',
  'http://localhost',
];
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .concat(DEFAULT_ALLOWED_ORIGINS)
);

function getCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return 'https://synfitgym.web.app';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  return 'https://synfitgym.web.app';
}

// Simple in-memory rate limiter for AI proxy (20 requests / minute / IP)
const aiRateMap = new Map();
function checkAiRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const maxReq = 20;
  const entry = aiRateMap.get(ip) || [];
  const recent = entry.filter((t) => now - t < windowMs);
  if (recent.length >= maxReq) {
    aiRateMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  aiRateMap.set(ip, recent);
  return true;
}

// 2. Inisialisasi Midtrans Client
const snap = new midtransClient.Snap({
  isProduction,
  serverKey,
  clientKey,
});

const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey,
  clientKey,
});

// 3. Inisialisasi Database MariaDB Pool (tanpa hardcoded credentials)
const hasDbConfig = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
const pool = hasDbConfig
  ? mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 2500,
      queueLimit: 0,
    })
  : null;

if (!pool) {
  console.warn('MariaDB pool skipped: DB_HOST/DB_USER/DB_NAME belum dikonfigurasi di environment.');
}

// 4. Inisialisasi Firebase Admin jika Service Account tersedia
try {
  let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}';
  rawKey = rawKey.trim();
  if ((rawKey.startsWith("'") && rawKey.endsWith("'")) || (rawKey.startsWith('"') && rawKey.endsWith('"'))) {
    rawKey = rawKey.slice(1, -1);
  }
  const sa = JSON.parse(rawKey);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');

  if (!admin.apps.length && sa.project_id) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
    });
    console.log('Firebase Admin SDK initialized successfully');
  }
} catch (e) {
  console.warn('Firebase Admin SDK initialization skipped:', e.message);
}

const DEFAULT_PBKDF2_PASSWORD_HASH =
  '828d85e0c4aabeb99e8986dafa56a004$d5a8046bc95c478b53b95887ea154aab548be35bb91f8bc7e751f30f5d8200f7';

// Helper: JSON Parser dengan batas ukuran payload
function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Payload terlalu besar (maksimal 1 MB)'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Format JSON tidak valid'));
      }
    });
    req.on('error', reject);
  });
}

// Helper: Response JSON dengan CORS allowlist
function sendJson(req, res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getCorsOrigin(req),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  });
  res.end(JSON.stringify(payload));
}

// 5. Server HTTP Utama
const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': getCorsOrigin(req),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  try {
    // Health Check
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
      return sendJson(req, res, 200, {
        status: 'online',
        service: 'SynFit Payment & AI Backend',
        environment: isProduction ? 'production' : 'sandbox',
        time: new Date().toISOString(),
      });
    }

    // ENDPOINT 0: Secure AI Chat Proxy (Gemini API key tetap aman di server)
    if (req.method === 'POST' && pathname === '/api/ai/chat') {
      const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
        .toString()
        .split(',')[0]
        .trim();
      if (!checkAiRateLimit(clientIp)) {
        return sendJson(req, res, 429, {
          success: false,
          error: 'Terlalu banyak permintaan. Silakan coba lagi dalam 1 menit.',
        });
      }

      const geminiKey = process.env.GEMINI_API_KEY || '';
      if (!geminiKey) {
        return sendJson(req, res, 503, { success: false, error: 'AI service belum dikonfigurasi di server.' });
      }

      const body = await getJsonBody(req);
      const queryText = typeof body.query === 'string' ? body.query.trim().slice(0, 1000) : '';
      const contextText = typeof body.context === 'string' ? body.context.slice(0, 6000) : '';

      if (!queryText) {
        return sendJson(req, res, 400, { success: false, error: 'Pertanyaan tidak boleh kosong.' });
      }

      const modelName = process.env.AI_MODEL_NAME || 'gemini-2.0-flash';
      const sysPrompt =
        'Anda adalah Asisten Resmi SynFit / Areta Sport Fitness. ' +
        'Bantulah anggota gym dengan ramah, suportif, dan edukatif mengenai kebugaran, latihan, nutrisi, atau fasilitas gym. ' +
        'Gunakan konteks gym di bawah ini sebagai acuan resmi.';

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `${sysPrompt}\n\nKONTEKS RESMI SYNFIT:\n${contextText}\n\nPERTANYAAN PENGGUNA:\n${queryText}`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!geminiRes.ok) {
        return sendJson(req, res, 502, { success: false, error: 'Gagal menghubungi layanan AI.' });
      }

      const geminiData = await geminiRes.json();
      const parts = geminiData?.candidates?.[0]?.content?.parts;
      const answer = Array.isArray(parts)
        ? parts.find((p) => p && typeof p.text === 'string')?.text
        : null;

      return sendJson(req, res, 200, { success: true, answer: answer || null });
    }

    // ENDPOINT 1: Create Snap Token
    if (req.method === 'POST' && pathname === '/api/payment/create-snap') {
      const body = await getJsonBody(req);
      const { orderType, membershipType, amount, name, email, phone, memberId, registrationId } = body;

      if (!amount || !name || !phone) {
        return sendJson(req, res, 400, {
          success: false,
          error: 'Data pembayaran tidak lengkap (nama, phone, amount wajib).',
        });
      }

      const orderId = `SYNFIT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: Math.round(Number(amount)),
        },
        customer_details: {
          first_name: name,
          phone: phone,
          email: email || undefined,
        },
        item_details: [
          {
            id: membershipType === '3 Bulan' ? 'plan-3-month' : 'plan-1-month',
            price: Math.round(Number(amount)),
            quantity: 1,
            name: `Membership SynFit ${membershipType || '1 Bulan'}`,
          },
        ],
      };

      const transaction = await snap.createTransaction(parameter);

      // Simpan ke Firestore payment_orders
      if (admin.apps.length) {
        try {
          await admin.firestore().collection('payment_orders').doc(orderId).set({
            orderId,
            amount: Number(amount),
            status: 'Pending',
            customer_name: name,
            customer_phone: phone,
            customer_email: email || null,
            order_type: orderType || 'registration',
            membership_type: membershipType || '1 Bulan',
            member_id: memberId || null,
            registration_id: registrationId || null,
            snap_token: transaction.token,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (fsErr) {
          console.warn('Firestore insert payment_orders warning:', fsErr.message);
        }
      }

      // Simpan ke MariaDB payment_orders (tanpa memblokir respons jika DB offline)
      if (pool) {
        pool
          .query(
            `INSERT INTO payment_orders (order_id, amount, status, customer_name, customer_phone, customer_email, order_type, membership_type, member_id, registration_id, snap_token)
             VALUES (?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              amount,
              name,
              phone,
              email || null,
              orderType || 'registration',
              membershipType || '1 Bulan',
              memberId || null,
              registrationId || null,
              transaction.token,
            ]
          )
          .catch((dbErr) => {
            console.warn('MariaDB insert payment_orders warning:', dbErr.message);
          });
      }

      return sendJson(req, res, 200, {
        success: true,
        orderId,
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
      });
    }

    // ENDPOINT 2: Confirm Order & Auto-Activate Member (Idempotent)
    if (req.method === 'POST' && pathname === '/api/payment/confirm-order') {
      const body = await getJsonBody(req);
      const { orderId } = body;

      if (!orderId) {
        return sendJson(req, res, 400, { success: false, error: 'orderId wajib diisi' });
      }

      // Ambil status dari Midtrans
      let isPaid = false;
      let paymentType = 'qris';
      try {
        const midtransStatus = await coreApi.transaction.status(orderId);
        const txStatus = midtransStatus.transaction_status;
        const fraudStatus = midtransStatus.fraud_status;
        paymentType = midtransStatus.payment_type || paymentType;

        if (txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept')) {
          isPaid = true;
        }
      } catch (mErr) {
        console.warn('Midtrans status check warning:', mErr.message);
      }

      if (!isPaid) {
        return sendJson(req, res, 200, {
          success: false,
          message: 'Pembayaran belum terkonfirmasi oleh Midtrans',
        });
      }

      // Ambil data order dari database (Firestore atau MariaDB)
      let order = {};
      if (admin.apps.length) {
        try {
          const docSnap = await admin.firestore().collection('payment_orders').doc(orderId).get();
          if (docSnap.exists) {
            order = docSnap.data() || {};
          }
        } catch (e) {
          console.warn('Firestore fetch order warning:', e.message);
        }
      }

      if (!order.customer_name && pool) {
        try {
          const [orderRows] = await pool.query('SELECT * FROM payment_orders WHERE order_id = ? LIMIT 1', [orderId]);
          if (orderRows && orderRows[0]) order = orderRows[0];
        } catch (dbErr) {
          console.warn('MariaDB fetch order error:', dbErr.message);
        }
      }

      // Idempotency guard: jika order sudah Completed, jangan buat duplikat member_accounts
      if (order.status === 'Completed' && order.member_id) {
        return sendJson(req, res, 200, {
          success: true,
          activated: true,
          alreadyCompleted: true,
          memberId: order.member_id,
          name: order.customer_name || body.name || 'Member',
          whatsapp: order.customer_phone || body.phone || '',
          message: 'Order sudah teraktivasi sebelumnya',
        });
      }

      const customerName = order.customer_name || body.name || 'Member';
      const customerPhone = order.customer_phone || body.phone || '';
      const customerEmail = order.customer_email || body.email || null;
      const membershipType = order.membership_type || body.membershipType || '1 Bulan';
      const durationDays = membershipType === '3 Bulan' ? 90 : 30;

      const today = new Date();
      const expDate = new Date(today);
      expDate.setDate(expDate.getDate() + durationDays);
      const expFormatted = expDate.toISOString().split('T')[0];
      const todayFormatted = today.toISOString().split('T')[0];
      const qrToken = `AR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      const memberId = order.member_id || body.memberId || `MEM-${Date.now()}`;

      // Buat / Update di MariaDB (jika MariaDB aktif)
      if (pool) {
        try {
          await pool.query(
            `INSERT INTO members (id, nama, email, nomor_whatsapp, membership_type, status, tanggal_daftar, tanggal_expired, qr_token, must_change_password)
             VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE status = 'Active', tanggal_expired = VALUES(tanggal_expired)`,
            [memberId, customerName, customerEmail, customerPhone, membershipType, todayFormatted, expFormatted, qrToken]
          );

          await pool.query(
            `INSERT INTO member_accounts (id, member_id, nama, nomor_whatsapp, email, password_hash, must_change_password)
             VALUES (?, ?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE member_id = VALUES(member_id)`,
            [`ACC-${memberId}`, memberId, customerName, customerPhone, customerEmail, DEFAULT_PBKDF2_PASSWORD_HASH]
          );

          await pool.query('UPDATE payment_orders SET status = "Completed", payment_type = ? WHERE order_id = ?', [
            paymentType,
            orderId,
          ]);
        } catch (dbErr) {
          console.warn('MariaDB sync warning:', dbErr.message);
        }
      }

      // Update Firestore secara idempotent (pakai doc ID deterministik)
      if (admin.apps.length) {
        try {
          const fsDb = admin.firestore();
          await fsDb.collection('members').doc(memberId).set(
            {
              nama: customerName,
              nomor_whatsapp: customerPhone,
              email: customerEmail,
              status: 'Active',
              membership_type: membershipType,
              tanggal_daftar: todayFormatted,
              tanggal_expired: expFormatted,
              qr_token: qrToken,
              must_change_password: true,
            },
            { merge: true }
          );

          await fsDb.collection('member_accounts').doc(memberId).set(
            {
              member_id: memberId,
              nama: customerName,
              nomor_whatsapp: customerPhone,
              email: customerEmail,
              password_hash: DEFAULT_PBKDF2_PASSWORD_HASH,
              must_change_password: true,
            },
            { merge: true }
          );

          await fsDb.collection('payment_orders').doc(orderId).set(
            {
              status: 'Completed',
              member_id: memberId,
              payment_type: paymentType,
              updated_at: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (fsErr) {
          console.warn('Firestore sync warning:', fsErr.message);
        }
      }

      return sendJson(req, res, 200, {
        success: true,
        activated: true,
        memberId,
        name: customerName,
        whatsapp: customerPhone,
        expiredDate: expFormatted,
        defaultPassword: 'synfit123',
        message: 'Member berhasil diaktifkan secara otomatis',
      });
    }

    // ENDPOINT 3: Webhook Notification dari Midtrans
    if (req.method === 'POST' && pathname === '/api/payment/notification') {
      const body = await getJsonBody(req);
      const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, payment_type } =
        body;

      // Verifikasi Hash SHA-512
      const hash = crypto
        .createHash('sha512')
        .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
        .digest('hex');
      if (hash.toLowerCase() !== (signature_key || '').toLowerCase()) {
        return sendJson(req, res, 403, { error: 'Signature tidak valid' });
      }

      const isSuccess =
        transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept');

      if (isSuccess) {
        if (pool) {
          pool
            .query(
              'UPDATE payment_orders SET status = "Completed", payment_type = ?, raw_notification = ? WHERE order_id = ?',
              [payment_type, JSON.stringify(body), order_id]
            )
            .catch((dbErr) => console.warn('MariaDB webhook update warning:', dbErr.message));
        }
        if (admin.apps.length && order_id) {
          admin
            .firestore()
            .collection('payment_orders')
            .doc(order_id)
            .set(
              {
                status: 'Completed',
                payment_type: payment_type || 'midtrans',
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            )
            .catch((fsErr) => console.warn('Firestore webhook update warning:', fsErr.message));
        }
      }

      return sendJson(req, res, 200, { status: 'OK' });
    }

    return sendJson(req, res, 404, { error: 'Endpoint tidak ditemukan' });
  } catch (err) {
    console.error('API Error:', err);
    return sendJson(req, res, 500, { success: false, error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(` SynFit Payment & AI API Server di Port ${PORT}`);
  console.log(` Mode: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(`===============================================`);
});
