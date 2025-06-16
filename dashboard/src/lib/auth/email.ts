import nodemailer from "nodemailer";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { magicLinkTokens } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

// Support both Resend and Nodemailer
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const transporter = !resend
  ? nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      secure: process.env.EMAIL_SERVER_PORT === "465",
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })
  : null;

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const from = process.env.EMAIL_FROM || "noreply@nestshield.dev";

  if (resend) {
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
  } else if (transporter) {
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
  } else {
    throw new Error(
      "No email service configured. Set RESEND_API_KEY or EMAIL_SERVER_* environment variables.",
    );
  }
}

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  const token = generateId();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store magic link token
  await db.insert(magicLinkTokens).values({
    id: generateId(),
    email,
    token,
    expires,
  });

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in to NestShield Dashboard</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-1px);
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px 30px;
          text-align: center;
          font-size: 14px;
          color: #64748b;
        }
        .security-notice {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛡️ NestShield Dashboard</h1>
          <p>Secure Access Request</p>
        </div>
        <div class="content">
          <h2>Sign in to your account</h2>
          <p>Hello,</p>
          <p>You requested to sign in to your NestShield Dashboard account. Click the button below to complete your sign-in:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" class="button">Sign In Securely</a>
          </div>
          
          <div class="security-notice">
            <strong>Security Notice:</strong>
            <ul>
              <li>This link will expire in 10 minutes</li>
              <li>Only use this link if you requested it</li>
              <li>Never share this link with anyone</li>
            </ul>
          </div>
          
          <p>If you didn't request this email, you can safely ignore it. Your account remains secure.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p><strong>Alternative:</strong> If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
            ${url}
          </p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email}</p>
          <p>NestShield Dashboard • Secure API Protection Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "🛡️ Sign in to NestShield Dashboard",
    html: emailHtml,
  });
}

export async function sendTwoFactorEmail(email: string, code: string): Promise<void> {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Two-Factor Authentication Code</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .code {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 32px;
          font-weight: bold;
          padding: 20px;
          border-radius: 8px;
          letter-spacing: 8px;
          margin: 30px 0;
          font-family: monospace;
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px 30px;
          text-align: center;
          font-size: 14px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Two-Factor Authentication</h1>
        </div>
        <div class="content">
          <h2>Your verification code</h2>
          <p>Enter this code in your authenticator app or dashboard:</p>
          
          <div class="code">${code}</div>
          
          <p><strong>This code expires in 5 minutes.</strong></p>
          <p>If you didn't request this code, please secure your account immediately.</p>
        </div>
        <div class="footer">
          <p>NestShield Dashboard Security Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "🔐 Your NestShield 2FA Code",
    html: emailHtml,
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .content {
          padding: 40px 30px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px 30px;
          text-align: center;
          font-size: 14px;
          color: #64748b;
        }
        .warning {
          background-color: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔑 Password Reset</h1>
        </div>
        <div class="content">
          <h2>Reset your password</h2>
          <p>You requested to reset your password for your NestShield Dashboard account.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          
          <div class="warning">
            <strong>Security Notice:</strong>
            <ul>
              <li>This link expires in 1 hour</li>
              <li>Only use this link if you requested it</li>
              <li>If you didn't request this, secure your account</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          <p>NestShield Dashboard Security Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "🔑 Reset Your NestShield Password",
    html: emailHtml,
  });
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to NestShield</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .button { background: #10b981; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to NestShield!</h1>
        </div>
        <div class="content">
          <h2>Hi ${name || "there"}!</h2>
          <p>Welcome to NestShield Dashboard! Your account has been successfully created.</p>
          <p>You can now access advanced API protection features, real-time monitoring, and comprehensive security management.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}" class="button">Get Started</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "🎉 Welcome to NestShield Dashboard",
    html: emailHtml,
  });
}
