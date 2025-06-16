import type { NextAuthOptions } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTwoFactor } from "@/lib/auth/two-factor";
import { logActivity } from "@/lib/auth/activity";
import { isIPAllowed } from "@/lib/auth/security";

// Custom providers for Microsoft and GitLab
function MicrosoftProvider(options: any): Provider {
  return {
    id: "microsoft",
    name: "Microsoft",
    type: "oauth",
    authorization: {
      url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      params: {
        scope: "openid profile email",
        response_type: "code",
      },
    },
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfo: "https://graph.microsoft.com/v1.0/me",
    profile(profile) {
      return {
        id: profile.id,
        name: profile.displayName,
        email: profile.mail || profile.userPrincipalName,
        image: null,
      };
    },
    ...options,
  };
}

function GitLabProvider(options: any): Provider {
  return {
    id: "gitlab",
    name: "GitLab",
    type: "oauth",
    authorization: {
      url: "https://gitlab.com/oauth/authorize",
      params: {
        scope: "read_user",
        response_type: "code",
      },
    },
    token: "https://gitlab.com/oauth/token",
    userinfo: "https://gitlab.com/api/v4/user",
    profile(profile) {
      return {
        id: profile.id.toString(),
        name: profile.name,
        email: profile.email,
        image: profile.avatar_url,
      };
    },
    ...options,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    // Credentials Provider for email/password login
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
        rememberMe: { label: "Remember Me", type: "checkbox" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const ipAddress =
          req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || "unknown";
        const userAgent = req.headers?.["user-agent"] || "";

        // Security checks
        if (!isIPAllowed(ipAddress as string)) {
          await logActivity({
            action: "login_blocked_ip",
            ipAddress: ipAddress as string,
            userAgent,
            success: false,
            errorMessage: "IP address not allowed",
          });
          throw new Error("Access denied from this location");
        }

        // Find user
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email))
          .limit(1);

        if (!user) {
          await logActivity({
            action: "login_failed",
            details: { email: credentials.email },
            ipAddress: ipAddress as string,
            userAgent,
            success: false,
            errorMessage: "User not found",
          });
          throw new Error("Invalid credentials");
        }

        // Check user status
        if (user.status === "banned") {
          await logActivity({
            userId: user.id,
            action: "login_blocked_banned",
            ipAddress: ipAddress as string,
            userAgent,
            success: false,
            errorMessage: "User account is banned",
          });
          throw new Error("Account has been banned");
        }

        if (user.status === "suspended") {
          await logActivity({
            userId: user.id,
            action: "login_blocked_suspended",
            ipAddress: ipAddress as string,
            userAgent,
            success: false,
            errorMessage: "User account is suspended",
          });
          throw new Error("Account has been suspended");
        }

        // Verify password (assuming you have a password field or separate credentials table)
        const passwordValid = await verifyPassword(credentials.password, user.id);
        if (!passwordValid) {
          await logActivity({
            userId: user.id,
            action: "login_failed",
            details: { reason: "invalid_password" },
            ipAddress: ipAddress as string,
            userAgent,
            success: false,
            errorMessage: "Invalid password",
          });
          throw new Error("Invalid credentials");
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled) {
          if (!credentials.totpCode) {
            throw new Error("2FA_REQUIRED");
          }

          const twoFactorValid = await verifyTwoFactor(user.id, credentials.totpCode);
          if (!twoFactorValid) {
            await logActivity({
              userId: user.id,
              action: "login_2fa_failed",
              ipAddress: ipAddress as string,
              userAgent,
              success: false,
              errorMessage: "Invalid 2FA code",
            });
            throw new Error("Invalid 2FA code");
          }
        }

        // Update last login
        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

        // Log successful login
        await logActivity({
          userId: user.id,
          action: "login_success",
          ipAddress: ipAddress as string,
          userAgent,
          success: true,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),

    // Magic Link Provider
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier: email, url, provider: _provider }) {
        await sendMagicLinkEmail(email, url);
      },
    }),

    // Social Providers
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    MicrosoftProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    }),

    GitLabProvider({
      clientId: process.env.GITLAB_CLIENT_ID!,
      clientSecret: process.env.GITLAB_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
    error: "/auth/error",
    verifyRequest: "/auth/verify-request",
    newUser: "/auth/welcome",
  },

  callbacks: {
    async signIn({ user, account, profile: _profile, email: _email, credentials: _credentials }) {
      // Additional security checks
      if (account?.provider === "email") {
        // Magic link verification
        return true;
      }

      if (
        account?.provider &&
        ["github", "google", "microsoft", "gitlab"].includes(account.provider)
      ) {
        // Social login security checks
        const ipAddress = "unknown"; // You'll need to pass this from the request

        if (!isIPAllowed(ipAddress)) {
          return false;
        }

        // Check if user exists and is allowed to use social login
        if (user.email) {
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          if (
            existingUser &&
            (existingUser.status === "banned" || existingUser.status === "suspended")
          ) {
            return false;
          }
        }
      }

      return true;
    },

    async session({ session, user, token: _token }) {
      if (session.user && user) {
        session.user.id = user.id;
        session.user.role = (user as any).role;
        session.user.status = (user as any).status;
        session.user.twoFactorEnabled = (user as any).twoFactorEnabled;
      }
      return session;
    },

    async jwt({ token, user, account: _account, profile: _profile, isNewUser: _isNewUser }) {
      if (user) {
        token.role = (user as any).role;
        token.status = (user as any).status;
        token.twoFactorEnabled = (user as any).twoFactorEnabled;
      }
      return token;
    },
  },

  events: {
    async signIn({ user, account, profile: _profile, isNewUser: _isNewUser }) {
      if (user.id) {
        await logActivity({
          userId: user.id,
          action: "signin",
          details: {
            provider: account?.provider,
            isNewUser,
          },
          success: true,
        });
      }
    },

    async signOut({ session, token }) {
      if (session?.user?.id || token?.sub) {
        await logActivity({
          userId: session?.user?.id || token?.sub,
          action: "signout",
          success: true,
        });
      }
    },

    async createUser({ user }) {
      await logActivity({
        userId: user.id,
        action: "user_created",
        details: {
          email: user.email,
          name: user.name,
        },
        success: true,
      });
    },
  },

  debug: process.env.NODE_ENV === "development",
};

export default authOptions;
