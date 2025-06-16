import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import {
  generateWebAuthnRegistrationOptions,
  verifyWebAuthnRegistration,
} from "@/lib/auth/webauthn";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const options = await generateWebAuthnRegistrationOptions({
      userId: session.user.id,
      userEmail: session.user.email!,
      userName: session.user.name || session.user.email!,
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error("WebAuthn registration options error:", error);
    return NextResponse.json({ error: "Failed to generate registration options" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { registrationResponse, expectedChallenge, authenticatorName } = body;

    if (!registrationResponse || !expectedChallenge) {
      return NextResponse.json({ error: "Missing registration data" }, { status: 400 });
    }

    const result = await verifyWebAuthnRegistration(
      session.user.id,
      registrationResponse as RegistrationResponseJSON,
      expectedChallenge,
      authenticatorName,
    );

    if (!result.verified) {
      return NextResponse.json({ error: result.error || "Registration failed" }, { status: 400 });
    }

    return NextResponse.json({
      verified: true,
      authenticatorId: result.authenticatorId,
    });
  } catch (error) {
    console.error("WebAuthn registration verification error:", error);
    return NextResponse.json({ error: "Registration verification failed" }, { status: 500 });
  }
}
