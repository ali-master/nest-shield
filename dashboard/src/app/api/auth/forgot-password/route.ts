import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { sendPasswordResetEmail } from "@/lib/auth/email";
import { logActivity } from "@/lib/auth/activity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate reset token
      const token = generateId();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await db.insert(verificationTokens).values({
        identifier: email.toLowerCase(),
        token,
        expires,
        type: "password_reset",
      });

      // Create reset URL
      const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      // Send reset email
      try {
        await sendPasswordResetEmail(email.toLowerCase(), resetUrl);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Continue execution - don't reveal email send failure
      }

      // Log password reset request
      await logActivity({
        userId: user.id,
        action: "password_reset_requested",
        details: {
          email: email.toLowerCase(),
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "",
        success: true,
      });
    } else {
      // Log failed password reset attempt (no user found)
      await logActivity({
        action: "password_reset_failed",
        details: {
          email: email.toLowerCase(),
          reason: "user_not_found",
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "",
        success: false,
        errorMessage: "User not found for password reset",
      });
    }

    // Always return success message to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, we have sent a password reset link.",
    });
  } catch (error) {
    console.error("Password reset error:", error);

    await logActivity({
      action: "password_reset_error",
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "",
      success: false,
      errorMessage: "Password reset process failed",
    });

    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 },
    );
  }
}
