import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { enableTwoFactor, generateTwoFactorSecret } from "@/lib/auth/two-factor";

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const twoFactorSetup = await generateTwoFactorSecret(session.user.id, session.user.email!);

    return NextResponse.json(twoFactorSetup);
  } catch (error) {
    console.error("2FA setup error:", error);
    return NextResponse.json({ error: "Failed to generate 2FA setup" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { secret, token } = body;

    if (!secret || !token) {
      return NextResponse.json({ error: "Missing secret or token" }, { status: 400 });
    }

    const success = await enableTwoFactor(session.user.id, secret, token);

    if (!success) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("2FA enable error:", error);
    return NextResponse.json({ error: "Failed to enable 2FA" }, { status: 500 });
  }
}
