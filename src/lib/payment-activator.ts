import pool from "@/lib/db";
import { getAdminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { addDays, format, isAfter } from "date-fns";

export const DEFAULT_PBKDF2_PASSWORD_HASH =
  "828d85e0c4aabeb99e8986dafa56a004$d5a8046bc95c478b53b95887ea154aab548be35bb91f8bc7e751f30f5d8200f7";

export interface ActivationParams {
  orderId: string;
  orderType: "registration" | "renewal";
  membershipType: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentType?: string;
  registrationId?: string;
  memberId?: string;
}

export interface ActivationResult {
  success: boolean;
  memberId: string;
  name: string;
  whatsapp: string;
  expiredDate: string;
  isNewMember: boolean;
  defaultPassword?: string;
  error?: string;
}

/**
 * Aktivasi otomatis member SynFit setelah pembayaran Midtrans berhasil
 * Tanpa memerlukan persetujuan manual admin.
 */
export async function activateMemberFromPayment(
  params: ActivationParams
): Promise<ActivationResult> {
  const {
    orderId,
    orderType,
    membershipType,
    amount,
    customerName,
    customerPhone,
    customerEmail,
    paymentType,
    registrationId,
    memberId: initialMemberId,
  } = params;

  const today = new Date();
  const durationDays = membershipType === "3 Bulan" ? 90 : 30;
  const cleanPhone = (customerPhone || "").replace(/\D/g, "");

  try {
    // ==========================================
    // 1. KASUS PERPANJANGAN (RENEWAL)
    // ==========================================
    if (orderType === "renewal" && initialMemberId) {
      // Cari data expired saat ini di MariaDB
      const [memberRows]: [any[], any] = await pool.query(
        "SELECT * FROM members WHERE id = ? LIMIT 1",
        [initialMemberId]
      );

      let newExpiredDate: Date;
      if (memberRows.length > 0 && memberRows[0].tanggal_expired) {
        const currentExp = new Date(memberRows[0].tanggal_expired);
        if (isAfter(currentExp, today)) {
          newExpiredDate = addDays(currentExp, durationDays);
        } else {
          newExpiredDate = addDays(today, durationDays);
        }
      } else {
        newExpiredDate = addDays(today, durationDays);
      }

      const expFormatted = format(newExpiredDate, "yyyy-MM-dd");

      // Update Member di MariaDB
      await pool.query(
        "UPDATE members SET status = 'Active', tanggal_expired = ?, membership_type = ? WHERE id = ?",
        [expFormatted, membershipType, initialMemberId]
      );

      // Update Member di Firestore
      if (admin.apps.length) {
        const firestore = getAdminDb();
        await firestore.collection("members").doc(initialMemberId).update({
          status: "Active",
          tanggal_expired: expFormatted,
          membership_type: membershipType,
        });
      }

      // Catat ke Transactions MariaDB
      const transId = `TRX-${Date.now()}`;
      await pool.query(
        `INSERT INTO transactions (id, member, type, amount, method, status, date, notes) 
         VALUES (?, ?, ?, ?, ?, 'Success', ?, ?)`,
        [
          transId,
          customerName || memberRows[0]?.nama || "Member",
          "Perpanjangan Membership",
          amount,
          paymentType ? `Midtrans (${paymentType})` : "Midtrans",
          format(today, "dd/MM/yyyy HH:mm"),
          `Order ID: ${orderId} (Otomatis Aktif Midtrans)`,
        ]
      );

      // Catat ke Firestore transactions
      if (admin.apps.length) {
        const firestore = getAdminDb();
        await firestore.collection("transactions").add({
          member: customerName || memberRows[0]?.nama || "Member",
          type: "Perpanjangan Membership",
          amount: Number(amount),
          method: paymentType ? `Midtrans (${paymentType})` : "Midtrans",
          status: "Success",
          date: format(today, "dd/MM/yyyy HH:mm"),
          notes: `Order ID: ${orderId} (Otomatis Aktif Midtrans)`,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return {
        success: true,
        memberId: initialMemberId,
        name: customerName,
        whatsapp: customerPhone,
        expiredDate: expFormatted,
        isNewMember: false,
      };
    }

    // ==========================================
    // 2. KASUS PENDAFTARAN BARU (REGISTRATION)
    // ==========================================
    const newExpiredDate = addDays(today, durationDays);
    const expFormatted = format(newExpiredDate, "yyyy-MM-dd");
    const regDateFormatted = format(today, "yyyy-MM-dd");
    const qrToken = `AR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Cek apakah nomor WhatsApp sudah ada di tabel members
    const [existingMembers]: [any[], any] = await pool.query(
      "SELECT id, nama, tanggal_expired FROM members WHERE nomor_whatsapp = ? OR nomor_whatsapp = ? LIMIT 1",
      [customerPhone, cleanPhone]
    );

    let finalMemberId = "";
    let isNew = true;

    if (existingMembers.length > 0) {
      // Member sudah ada, perpanjang saja
      finalMemberId = existingMembers[0].id;
      isNew = false;

      let expDateObj = newExpiredDate;
      if (existingMembers[0].tanggal_expired) {
        const curExp = new Date(existingMembers[0].tanggal_expired);
        if (isAfter(curExp, today)) {
          expDateObj = addDays(curExp, durationDays);
        }
      }
      const existingExpFormatted = format(expDateObj, "yyyy-MM-dd");

      await pool.query(
        "UPDATE members SET status = 'Active', tanggal_expired = ?, membership_type = ? WHERE id = ?",
        [existingExpFormatted, membershipType, finalMemberId]
      );

      if (admin.apps.length) {
        const firestore = getAdminDb();
        await firestore.collection("members").doc(finalMemberId).update({
          status: "Active",
          tanggal_expired: existingExpFormatted,
          membership_type: membershipType,
        });
      }
    } else {
      // Buat Member Baru di MariaDB & Firestore
      finalMemberId = `MEM-${Date.now()}`;

      // 1. Simpan ke Firestore terlebih dahulu untuk mendapatkan ID Firestore jika diperlukan
      if (admin.apps.length) {
        const firestore = getAdminDb();
        const fsDocRef = await firestore.collection("members").add({
          nama: customerName,
          nomor_whatsapp: cleanPhone || customerPhone,
          email: customerEmail || null,
          alamat: "-",
          membership_type: membershipType,
          status: "Active",
          must_change_password: true,
          tanggal_daftar: regDateFormatted,
          tanggal_expired: expFormatted,
          qr_token: qrToken,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        finalMemberId = fsDocRef.id;

        // Tambah Akun Member di Firestore
        await firestore.collection("member_accounts").add({
          member_id: finalMemberId,
          nama: customerName,
          nomor_whatsapp: cleanPhone || customerPhone,
          email: customerEmail || null,
          password_hash: DEFAULT_PBKDF2_PASSWORD_HASH,
          must_change_password: true,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // 2. Simpan ke MariaDB members
      await pool.query(
        `INSERT INTO members (id, nama, email, nomor_whatsapp, membership_type, status, tanggal_daftar, tanggal_expired, qr_token, must_change_password, email_verified)
         VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, 1, 0)
         ON DUPLICATE KEY UPDATE status = 'Active', tanggal_expired = VALUES(tanggal_expired)`,
        [
          finalMemberId,
          customerName,
          customerEmail || null,
          cleanPhone || customerPhone,
          membershipType,
          regDateFormatted,
          expFormatted,
          qrToken,
        ]
      );

      // 3. Simpan ke MariaDB member_accounts
      const accId = `ACC-${Date.now()}`;
      await pool.query(
        `INSERT INTO member_accounts (id, member_id, nama, nomor_whatsapp, email, password_hash, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE member_id = VALUES(member_id)`,
        [
          accId,
          finalMemberId,
          customerName,
          cleanPhone || customerPhone,
          customerEmail || null,
          DEFAULT_PBKDF2_PASSWORD_HASH,
        ]
      );
    }

    // Update status pendaftaran di Registrations jika registrationId disediakan
    if (registrationId) {
      await pool.query(
        "UPDATE registrations SET status = 'Approved', member_id = ?, payment_method = ? WHERE id = ?",
        [
          finalMemberId,
          paymentType ? `Midtrans (${paymentType})` : "Midtrans",
          registrationId,
        ]
      );

      if (admin.apps.length) {
        const firestore = getAdminDb();
        try {
          await firestore.collection("registrations").doc(registrationId).update({
            status: "Approved",
            member_id: finalMemberId,
            payment_method: paymentType ? `Midtrans (${paymentType})` : "Midtrans",
          });
        } catch (e) {
          console.warn("Could not update firestore registration:", e);
        }
      }
    }

    // Catat ke Transactions MariaDB
    const transId = `TRX-${Date.now()}`;
    await pool.query(
      `INSERT INTO transactions (id, member, type, amount, method, status, date, notes) 
       VALUES (?, ?, ?, ?, ?, 'Success', ?, ?)`,
      [
        transId,
        customerName,
        isNew ? "Pendaftaran Member Baru (Otomatis)" : "Perpanjangan Membership (Otomatis)",
        amount,
        paymentType ? `Midtrans (${paymentType})` : "Midtrans",
        format(today, "dd/MM/yyyy HH:mm"),
        `Order ID: ${orderId} (Auto-Approved via Midtrans Tanpa Admin)`,
      ]
    );

    // Catat ke Firestore transactions
    if (admin.apps.length) {
      const firestore = getAdminDb();
      await firestore.collection("transactions").add({
        member: customerName,
        type: isNew ? "New Registration (Online Instant)" : "Membership Renewal",
        amount: Number(amount),
        method: paymentType ? `Midtrans (${paymentType})` : "Midtrans",
        status: "Success",
        date: format(today, "dd/MM/yyyy HH:mm"),
        notes: `Order ID: ${orderId} (Auto-Approved Midtrans Tanpa Persetujuan Admin)`,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      memberId: finalMemberId,
      name: customerName,
      whatsapp: cleanPhone || customerPhone,
      expiredDate: expFormatted,
      isNewMember: isNew,
      defaultPassword: "synfit123",
    };
  } catch (error: any) {
    console.error("Error in activateMemberFromPayment:", error);
    return {
      success: false,
      memberId: "",
      name: customerName,
      whatsapp: customerPhone,
      expiredDate: "",
      isNewMember: false,
      error: error.message || "Failed to activate member",
    };
  }
}

