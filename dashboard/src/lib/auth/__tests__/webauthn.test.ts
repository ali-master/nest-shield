import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateWebAuthnAuthenticationOptions,
  generateWebAuthnRegistrationOptions,
  type WebAuthnAuthenticationOptions,
  type WebAuthnRegistrationOptions,
} from "../webauthn";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

// Mock the schema
vi.mock("@/lib/db/schema", () => ({
  authenticators: {
    userId: "userId",
    credentialId: "credentialId",
    id: "id",
    credentialPublicKey: "credentialPublicKey",
    counter: "counter",
    transports: "transports",
    createdAt: "createdAt",
  },
  users: {
    id: "id",
    email: "email",
  },
}));

// Mock utilities
vi.mock("@/lib/utils", () => ({
  generateId: vi.fn(() => "test-id-123"),
}));

// Mock activity logging
vi.mock("@/lib/auth/activity", () => ({
  logActivity: vi.fn(),
}));

// Mock SimpleWebAuthn
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

// Mock Drizzle ORM
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

describe("webAuthn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateWebAuthnRegistrationOptions", () => {
    it("should generate registration options with correct parameters", async () => {
      const { generateRegistrationOptions } = await import("@simplewebauthn/server");
      const { db } = await import("@/lib/db");

      // Mock database to return empty array for existing authenticators
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]), // Return empty array
      } as any);

      const mockOptions = {
        challenge: "test-challenge",
        rp: { name: "NestShield Dashboard", id: "localhost" },
        user: {
          id: new TextEncoder().encode("user-123"),
          name: "test@example.com",
          displayName: "Test User",
        },
      };

      vi.mocked(generateRegistrationOptions).mockResolvedValue(mockOptions as any);

      const options: WebAuthnRegistrationOptions = {
        userId: "user-123",
        userEmail: "test@example.com",
        userName: "Test User",
      };

      const result = await generateWebAuthnRegistrationOptions(options);

      expect(result).toEqual({
        options: mockOptions,
        challenge: "test-challenge",
      });

      expect(generateRegistrationOptions).toHaveBeenCalledWith({
        rpName: "NestShield Dashboard",
        rpID: "localhost",
        userID: new TextEncoder().encode("user-123"),
        userName: "test@example.com",
        userDisplayName: "Test User",
        timeout: 60000,
        attestationType: "none",
        excludeCredentials: [],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred",
        },
        supportedAlgorithmIDs: [-7, -257],
      });
    });
  });

  describe("generateWebAuthnAuthenticationOptions", () => {
    it("should generate authentication options with no user specified", async () => {
      const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
      const mockOptions = {
        challenge: "test-challenge",
        rpId: "localhost",
        allowCredentials: [],
      };

      vi.mocked(generateAuthenticationOptions).mockResolvedValue(mockOptions as any);

      const result = await generateWebAuthnAuthenticationOptions();

      expect(result).toEqual({
        options: mockOptions,
        challenge: "test-challenge",
      });

      expect(generateAuthenticationOptions).toHaveBeenCalledWith({
        timeout: 60000,
        allowCredentials: [],
        userVerification: "preferred",
        rpID: "localhost",
      });
    });

    it("should generate authentication options with specific user email", async () => {
      const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
      const { db } = await import("@/lib/db");

      // Mock database responses
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "user-123" }]),
      } as any);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: "user-123" }]),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([
            {
              credentialId: "cred-123",
              transports: ["usb", "nfc"],
            },
          ]),
        } as any);

      const mockOptions = {
        challenge: "test-challenge",
        rpId: "localhost",
        allowCredentials: [{ id: "cred-123", transports: ["usb", "nfc"] }],
      };

      vi.mocked(generateAuthenticationOptions).mockResolvedValue(mockOptions as any);

      const options: WebAuthnAuthenticationOptions = {
        userEmail: "test@example.com",
      };

      const result = await generateWebAuthnAuthenticationOptions(options);

      expect(result).toEqual({
        options: mockOptions,
        challenge: "test-challenge",
      });
    });
  });
});
