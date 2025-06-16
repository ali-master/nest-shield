import * as speakeasy from "speakeasy";
import * as QRCode from "qrcode";
import { db } from "@/lib/db";
import { twoFactorBackupCodes, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export type TwoFactorSetup = {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
};

export async function generateTwoFactorSecret(
  userId: string,
  userEmail: string,
): Promise<TwoFactorSetup> {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `NestShield Dashboard (${userEmail})`,
    issuer: "NestShield",
    length: 32,
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  // Store backup codes in database
  const backupCodeRecords = backupCodes.map((code) => ({
    id: generateId(),
    userId,
    code,
  }));

  await db.insert(twoFactorBackupCodes).values(backupCodeRecords);

  return {
    secret: secret.base32!,
    qrCodeUrl,
    backupCodes,
  };
}

export async function enableTwoFactor(
  userId: string,
  secret: string,
  token: string,
): Promise<boolean> {
  // Verify the token before enabling
  const isValid = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 2, // Allow 2 time steps before/after current time
  });

  if (!isValid) {
    return false;
  }

  // Enable 2FA for user
  await db
    .update(users)
    .set({
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    })
    .where(eq(users.id, userId));

  return true;
}

export async function disableTwoFactor(userId: string): Promise<void> {
  // Disable 2FA
  await db
    .update(users)
    .set({
      twoFactorEnabled: false,
      twoFactorSecret: null,
    })
    .where(eq(users.id, userId));

  // Remove backup codes
  await db.delete(twoFactorBackupCodes).where(eq(twoFactorBackupCodes.userId, userId));
}

export async function verifyTwoFactor(userId: string, token: string): Promise<boolean> {
  // Get user's 2FA secret
  const [user] = await db
    .select({ twoFactorSecret: users.twoFactorSecret })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.twoFactorSecret) {
    return false;
  }

  // Check if it's a backup code
  if (token.length === 8 && /^\d+$/.test(token)) {
    return await verifyBackupCode(userId, token);
  }

  // Verify TOTP token
  return speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
    window: 2,
  });
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const [backupCode] = await db
    .select()
    .from(twoFactorBackupCodes)
    .where(
      and(
        eq(twoFactorBackupCodes.userId, userId),
        eq(twoFactorBackupCodes.code, code),
        eq(twoFactorBackupCodes.used, false),
      ),
    )
    .limit(1);

  if (!backupCode) {
    return false;
  }

  // Mark backup code as used
  await db
    .update(twoFactorBackupCodes)
    .set({
      used: true,
      usedAt: new Date(),
    })
    .where(eq(twoFactorBackupCodes.id, backupCode.id));

  return true;
}

export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-digit backup codes
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    codes.push(code);
  }

  return codes;
}

export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  // Remove existing backup codes
  await db.delete(twoFactorBackupCodes).where(eq(twoFactorBackupCodes.userId, userId));

  // Generate new backup codes
  const newCodes = generateBackupCodes();

  const backupCodeRecords = newCodes.map((code) => ({
    id: generateId(),
    userId,
    code,
  }));

  await db.insert(twoFactorBackupCodes).values(backupCodeRecords);

  return newCodes;
}
