import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { Buffer } from "node:buffer";
import { db } from "@/lib/db";
import { authenticators, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logActivity } from "@/lib/auth/activity";

// WebAuthn configuration
const RP_NAME = "NestShield Dashboard";
const RP_ID = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : "localhost";
const ORIGIN = process.env.NEXTAUTH_URL || "http://localhost:3000";

export type WebAuthnRegistrationOptions = {
  userId: string;
  userEmail: string;
  userName: string;
  excludeCredentials?: boolean;
};

export type WebAuthnAuthenticationOptions = {
  userEmail?: string;
  allowCredentials?: string[];
};

export async function generateWebAuthnRegistrationOptions(options: WebAuthnRegistrationOptions) {
  const { userId, userEmail, userName, excludeCredentials = true } = options;

  // Get existing authenticators for this user
  let excludeCredentialsList: { id: Uint8Array; type: "public-key" }[] = [];

  if (excludeCredentials) {
    const existingAuthenticators = await db
      .select()
      .from(authenticators)
      .where(eq(authenticators.userId, userId));

    excludeCredentialsList = existingAuthenticators.map((auth) => ({
      id: Buffer.from(auth.credentialId, "base64"),
      type: "public-key" as const,
    }));
  }

  const registrationOptions = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,

    userID: userId,
    userName: userEmail,
    userDisplayName: userName,
    timeout: 60000,
    attestationType: "indirect",
    excludeCredentials: excludeCredentialsList,
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "preferred",
      residentKey: "preferred",
    },
    supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
  });

  // Store challenge in session or temporary storage
  // In production, you might want to store this in Redis or database with expiration
  // For now, we'll return it and expect the client to send it back

  return {
    options: registrationOptions,
    challenge: registrationOptions.challenge,
  };
}

export async function verifyWebAuthnRegistration(
  userId: string,
  registrationResponse: RegistrationResponseJSON,
  expectedChallenge: string,
  authenticatorName?: string,
): Promise<{ verified: boolean; authenticatorId?: string; error?: string }> {
  try {
    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      await logActivity({
        userId,
        action: "webauthn_registration_failed",
        details: {
          error: "Verification failed",
          credentialId: registrationResponse.id,
        },
        success: false,
        errorMessage: "WebAuthn registration verification failed",
      });

      return {
        verified: false,
        error: "Registration verification failed",
      };
    }

    const { registrationInfo } = verification;
    const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } =
      registrationInfo;

    // Save authenticator to database
    const authenticatorId = generateId();
    await db.insert(authenticators).values({
      id: authenticatorId,
      userId,
      credentialId: Buffer.from(credentialID).toString("base64"),
      credentialPublicKey: Buffer.from(credentialPublicKey).toString("base64"),
      counter,
      credentialDeviceType,
      credentialBackedUp,
      transports: registrationResponse.response.transports || [],
      name: authenticatorName || "WebAuthn Authenticator",
      createdAt: new Date(),
    });

    // Log successful registration
    await logActivity({
      userId,
      action: "webauthn_registered",
      details: {
        authenticatorId,
        credentialId: registrationResponse.id,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      },
      success: true,
    });

    return {
      verified: true,
      authenticatorId,
    };
  } catch (error) {
    console.error("WebAuthn registration verification error:", error);

    await logActivity({
      userId,
      action: "webauthn_registration_error",
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
        credentialId: registrationResponse.id,
      },
      success: false,
      errorMessage: error instanceof Error ? error.message : "Registration error",
    });

    return {
      verified: false,
      error: error instanceof Error ? error.message : "Registration failed",
    };
  }
}

export async function generateWebAuthnAuthenticationOptions(
  options: WebAuthnAuthenticationOptions = {},
) {
  const { userEmail, allowCredentials = [] } = options;

  let allowCredentialsList: { id: Uint8Array; type: "public-key"; transports?: string[] }[] = [];

  if (userEmail) {
    // Get user's authenticators
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);

    if (user) {
      const userAuthenticators = await db
        .select()
        .from(authenticators)
        .where(eq(authenticators.userId, user.id));

      allowCredentialsList = userAuthenticators.map((auth) => ({
        id: Buffer.from(auth.credentialId, "base64"),
        type: "public-key" as const,
        transports: auth.transports as string[] | undefined,
      }));
    }
  } else if (allowCredentials.length > 0) {
    // Use provided credential IDs
    allowCredentialsList = allowCredentials.map((id) => ({
      id: Buffer.from(id, "base64"),
      type: "public-key" as const,
    }));
  }

  const authenticationOptions = await generateAuthenticationOptions({
    timeout: 60000,
    allowCredentials: allowCredentialsList,
    userVerification: "preferred",
    rpID: RP_ID,
  });

  return {
    options: authenticationOptions,
    challenge: authenticationOptions.challenge,
  };
}

export async function verifyWebAuthnAuthentication(
  authenticationResponse: AuthenticationResponseJSON,
  expectedChallenge: string,
  userEmail?: string,
): Promise<{ verified: boolean; userId?: string; authenticatorId?: string; error?: string }> {
  try {
    // Find the authenticator by credential ID
    const credentialId = Buffer.from(authenticationResponse.id, "base64").toString("base64");

    const [authenticator] = await db
      .select()
      .from(authenticators)
      .where(eq(authenticators.credentialId, credentialId))
      .limit(1);

    if (!authenticator) {
      return {
        verified: false,
        error: "Authenticator not found",
      };
    }

    // Verify the user if email is provided
    if (userEmail) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, authenticator.userId))
        .limit(1);

      if (!user || user.email !== userEmail) {
        await logActivity({
          userId: authenticator.userId,
          action: "webauthn_auth_user_mismatch",
          details: {
            expectedEmail: userEmail,
            actualUserId: authenticator.userId,
            credentialId: authenticationResponse.id,
          },
          success: false,
          errorMessage: "User email mismatch during WebAuthn authentication",
        });

        return {
          verified: false,
          error: "User mismatch",
        };
      }
    }

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: authenticator.credentialId,
        credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, "base64"),
        counter: authenticator.counter,
        transports: authenticator.transports as AuthenticatorTransport[],
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      await logActivity({
        userId: authenticator.userId,
        action: "webauthn_auth_failed",
        details: {
          credentialId: authenticationResponse.id,
          counter: verification.authenticationInfo?.newCounter,
        },
        success: false,
        errorMessage: "WebAuthn authentication verification failed",
      });

      return {
        verified: false,
        error: "Authentication verification failed",
      };
    }

    // Update authenticator counter and last used
    if (verification.authenticationInfo) {
      await db
        .update(authenticators)
        .set({
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        })
        .where(eq(authenticators.id, authenticator.id));
    }

    // Log successful authentication
    await logActivity({
      userId: authenticator.userId,
      action: "webauthn_auth_success",
      details: {
        authenticatorId: authenticator.id,
        credentialId: authenticationResponse.id,
        counter: verification.authenticationInfo?.newCounter,
      },
      success: true,
    });

    return {
      verified: true,
      userId: authenticator.userId,
      authenticatorId: authenticator.id,
    };
  } catch (error) {
    console.error("WebAuthn authentication verification error:", error);

    return {
      verified: false,
      error: error instanceof Error ? error.message : "Authentication failed",
    };
  }
}

export async function getUserAuthenticators(userId: string) {
  return await db
    .select()
    .from(authenticators)
    .where(eq(authenticators.userId, userId))
    .orderBy(authenticators.createdAt);
}

export async function deleteAuthenticator(
  userId: string,
  authenticatorId: string,
): Promise<boolean> {
  const result = await db
    .delete(authenticators)
    .where(and(eq(authenticators.id, authenticatorId), eq(authenticators.userId, userId)));

  if (result && result.length > 0) {
    await logActivity({
      userId,
      action: "webauthn_deleted",
      details: {
        authenticatorId,
      },
      success: true,
    });

    return true;
  }

  return false;
}

export async function updateAuthenticatorName(
  userId: string,
  authenticatorId: string,
  name: string,
): Promise<boolean> {
  const result = await db
    .update(authenticators)
    .set({ name })
    .where(and(eq(authenticators.id, authenticatorId), eq(authenticators.userId, userId)));

  if (result && result.length > 0) {
    await logActivity({
      userId,
      action: "webauthn_renamed",
      details: {
        authenticatorId,
        newName: name,
      },
      success: true,
    });

    return true;
  }

  return false;
}
