import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { sendWelcomeEmail } from "@/lib/auth/email";
import { logActivity } from "@/lib/auth/activity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          error: "Password does not meet requirements",
          feedback: passwordValidation.feedback,
        },
        { status: 400 },
      );
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // Hash password (TODO: Implement password storage table)
    await hashPassword(password);

    // Create user
    const userId = generateId();
    await db.insert(users).values({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase(),
      emailVerified: new Date(), // Auto-verify for now
      role: "user",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Store password hash in credentials table (you might want to create this)
    // For now, we'll skip this step as we haven't implemented password storage yet

    // Log user creation
    await logActivity({
      userId,
      action: "user_registered",
      details: {
        email: email.toLowerCase(),
        name: name.trim(),
        method: "credentials",
      },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "",
      success: true,
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(email.toLowerCase(), name.trim());
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail registration if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      userId,
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Log failed registration attempt
    await logActivity({
      action: "user_registration_failed",
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "",
      success: false,
      errorMessage: "Registration failed",
    });

    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
