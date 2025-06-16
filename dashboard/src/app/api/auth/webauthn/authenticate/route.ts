import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  generateWebAuthnAuthenticationOptions,
  verifyWebAuthnAuthentication,
} from "@/lib/auth/webauthn";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("email");

    const options = await generateWebAuthnAuthenticationOptions({
      userEmail: userEmail || undefined,
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error("WebAuthn authentication options error:", error);
    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { authenticationResponse, expectedChallenge, userEmail } = body;

    if (!authenticationResponse || !expectedChallenge) {
      return NextResponse.json({ error: "Missing authentication data" }, { status: 400 });
    }

    const result = await verifyWebAuthnAuthentication(
      authenticationResponse as AuthenticationResponseJSON,
      expectedChallenge,
      userEmail,
    );

    if (!result.verified) {
      return NextResponse.json({ error: result.error || "Authentication failed" }, { status: 400 });
    }

    return NextResponse.json({
      verified: true,
      userId: result.userId,
      authenticatorId: result.authenticatorId,
    });
  } catch (error) {
    console.error("WebAuthn authentication verification error:", error);
    return NextResponse.json({ error: "Authentication verification failed" }, { status: 500 });
  }
}
