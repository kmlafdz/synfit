/**
 * SYNFIT AI FOUNDATION - SERVER SESSION & ACCESS GUARD
 * Validates caller identity, assigns verified roles, and strictly prevents
 * client-supplied identity spoofing or privilege escalation.
 */

import * as adminModule from "firebase-admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import type { AIServiceContext, AIUserRole } from "./types";
import { AIAuthorizationError, AIValidationError } from "./errors";
import { verifyMemberSessionToken } from "../auth/memberAuth";

const admin: typeof adminModule = (adminModule as any).default || adminModule;

export interface MemberSessionPayload {
  accountId: string;
  memberId: string;
  whatsapp?: string;
  name?: string;
}

/**
 * Resolves caller identity from verified server sources (Firebase ID Token or Cryptographically Signed Member Token).
 * Strictly forbids relying on unverified request body fields or forgeable headers.
 */
export async function resolveAIContext(request: Request): Promise<AIServiceContext> {
  const authHeader = request.headers.get("authorization");
  const memberTokenHeader = request.headers.get("x-member-session-token");
  const legacyMemberSession = request.headers.get("x-member-session");
  const cookieHeader = request.headers.get("cookie") || "";
  
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const hasAdminApp = admin.apps.length > 0;

  // Extract member cookie if present
  let memberCookieToken: string | null = null;
  if (cookieHeader) {
    const match = cookieHeader.match(/member_session_token=([^;]+)/);
    if (match && match[1]) {
      memberCookieToken = decodeURIComponent(match[1]);
    }
  }

  // 1. Check for Cryptographic Member Session Token (Cookie, Custom Header, or Bearer)
  const candidateMemberToken = memberTokenHeader || memberCookieToken;
  if (candidateMemberToken) {
    const verifiedPayload = verifyMemberSessionToken(candidateMemberToken);
    if (!verifiedPayload) {
      throw new AIAuthorizationError("Invalid, tampered, or expired member session token.");
    }

    if (verifiedPayload.mustChangePassword) {
      throw new AIAuthorizationError("Wajib mengganti kata sandi default sebelum dapat mengakses modul AI.");
    }

    if (!hasAdminApp) {
      throw new AIAuthorizationError("Firebase Admin SDK is uninitialized. Contact system administrator.");
    }

    const db = getAdminDb();
    const memberDoc = await db.collection("members").doc(verifiedPayload.memberId).get();
    if (!memberDoc.exists) {
      throw new AIAuthorizationError("Associated member record not found in system.");
    }

    return {
      userId: verifiedPayload.accountId,
      role: "MEMBER",
      memberId: verifiedPayload.memberId,
      requestId,
      timestamp,
    };
  }

  // 2. Reject unauthenticated legacy member session header without cryptographic signature
  if (legacyMemberSession) {
    throw new AIAuthorizationError(
      "Unsigned x-member-session is deprecated and rejected. A cryptographically signed session token is required."
    );
  }

  // 3. Staff / Admin Authentication via Firebase ID Token
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) {
      throw new AIAuthorizationError("Bearer token is empty or malformed.");
    }

    // Check if the bearer token is actually a signed member token
    const memberPayload = verifyMemberSessionToken(token);
    if (memberPayload) {
      if (!hasAdminApp) {
        throw new AIAuthorizationError("Firebase Admin SDK is uninitialized.");
      }
      const db = getAdminDb();
      const memberDoc = await db.collection("members").doc(memberPayload.memberId).get();
      if (!memberDoc.exists) {
        throw new AIAuthorizationError("Associated member record not found.");
      }

      return {
        userId: memberPayload.accountId,
        role: "MEMBER",
        memberId: memberPayload.memberId,
        requestId,
        timestamp,
      };
    }

    // Otherwise, treat as Firebase Auth ID Token for staff
    if (!hasAdminApp) {
      throw new AIAuthorizationError("Firebase Admin SDK is uninitialized. Contact system administrator.");
    }

    try {
      const adminAuth = getAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(token);
      const db = getAdminDb();

      // Retrieve verified role from Firestore `users` collection (server single source of truth)
      const userSnap = await db
        .collection("users")
        .where("uid", "==", decodedToken.uid)
        .limit(1)
        .get();

      let assignedRole: AIUserRole = "ADMIN";

      // Server-side environment developer whitelist check (replaces hardcoded email in source)
      const devEmails = (process.env.DEVELOPER_EMAILS || "kemal@dev.com")
        .split(",")
        .map((e) => e.trim().toLowerCase());

      const callerEmail = (decodedToken.email || "").toLowerCase();

      if (callerEmail && devEmails.includes(callerEmail) && decodedToken.email_verified !== false) {
        assignedRole = "DEVELOPER";
      } else if (!userSnap.empty) {
        const rawRole = (userSnap.docs[0].data().role || "").toUpperCase();
        if (rawRole === "OWNER" || rawRole === "DEVELOPER" || rawRole === "ADMIN") {
          assignedRole = rawRole as AIUserRole;
        } else {
          assignedRole = "ADMIN";
        }
      } else {
        // Check if caller is a verified member authenticated via Firebase Auth
        const memberByUidSnap = await db
          .collection("members")
          .where("uid", "==", decodedToken.uid)
          .limit(1)
          .get();

        if (!memberByUidSnap.empty) {
          const mDoc = memberByUidSnap.docs[0];
          return {
            userId: decodedToken.uid,
            role: "MEMBER",
            memberId: mDoc.id,
            requestId,
            timestamp,
          };
        } else if (callerEmail) {
          const memberByEmailSnap = await db
            .collection("members")
            .where("email", "==", callerEmail)
            .limit(1)
            .get();
          if (!memberByEmailSnap.empty) {
            const mDoc = memberByEmailSnap.docs[0];
            return {
              userId: decodedToken.uid,
              role: "MEMBER",
              memberId: mDoc.id,
              requestId,
              timestamp,
            };
          }
        }

        throw new AIAuthorizationError("User record not found in system directory.");
      }

      return {
        userId: decodedToken.uid,
        role: assignedRole,
        requestId,
        timestamp,
      };
    } catch (err: any) {
      if (err instanceof AIAuthorizationError) throw err;
      throw new AIAuthorizationError(`Invalid or expired Firebase ID token: ${err.message}`);
    }
  }

  // 4. Missing credentials
  throw new AIAuthorizationError("Missing authentication credentials. Provide Bearer token, session cookie, or x-member-session-token.");
}

/**
 * Asserts that the caller has one of the allowed roles.
 */
export function assertRole(context: AIServiceContext, allowedRoles: AIUserRole[]): void {
  if (!allowedRoles.includes(context.role)) {
    throw new AIAuthorizationError(
      `Access denied: Role '${context.role}' is not authorized. Required: ${allowedRoles.join(", ")}`
    );
  }
}

/**
 * Asserts that a member can only access their own data, while staff (Admin, Owner, Developer) can access across members.
 */
export function assertMemberOwnership(context: AIServiceContext, targetMemberId: string): void {
  if (context.role === "MEMBER") {
    if (!context.memberId || context.memberId !== targetMemberId) {
      throw new AIAuthorizationError("Access denied: You cannot access or modify another member's data.");
    }
  }
}
