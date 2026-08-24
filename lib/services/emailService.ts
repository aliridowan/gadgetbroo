import nodemailer, { type Transporter } from "nodemailer";
import { StoreSettingsService } from "@/lib/services/storeSettingsService";

// The single file that talks to the SMTP provider (Brevo, via nodemailer) —
// same reasoning as MediaService for storage: if the email provider ever
// changes, this is the only file that should need new logic. Every route
// and component goes through EmailService, never nodemailer directly.
const transporter: Transporter | null = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const COMPANY_NAME = "GadgetBroo";
const FROM_ADDRESS = `${COMPANY_NAME} <info@gadgetbroo.com>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CTA_BUTTON_STYLE =
  "display:inline-block;background:#d4af37;color:#0a0906;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;font-size:14px;";

/**
 * The dark/gold shell (logo, colors, footer) is fixed in code — every
 * notification email shares it, and there's no raw-HTML editing surface
 * that could break the layout or be used to inject something into an
 * email. Branding content comes from StoreSettings (the same table the
 * storefront Footer/Navbar already read), fetched fresh per email rather
 * than passed in by the caller, matching how every other *Service in
 * this codebase owns its own data access.
 */
async function renderBrandedShell(bodyHtml: string): Promise<string> {
  const settings = await StoreSettingsService.getSettings();
  const logoUrl = settings.faviconUrl;
  const addressLines = settings.contactAddress
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return `
  <div style="background:#0a0906;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#15120c;border:1px solid #3a2f1c;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
      <div style="padding:24px 32px;border-bottom:2px solid #d4af37;">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(COMPANY_NAME)}" width="36" height="36" style="border-radius:8px;vertical-align:middle;margin-right:10px;" />` : ""}
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:700;color:#d4af37;vertical-align:middle;">${escapeHtml(COMPANY_NAME)}</span>
      </div>
      <div style="padding:28px 32px;color:#f3ecd9;font-size:14px;line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="padding:18px 32px;border-top:1px solid #3a2f1c;color:#766c56;font-size:12px;line-height:1.5;">
        ${addressLines.map(escapeHtml).join("<br/>")}
        ${
          settings.contactEmail
            ? `${addressLines.length ? "<br/>" : ""}Questions? Contact <a href="mailto:${escapeHtml(settings.contactEmail)}" style="color:#d4af37;">${escapeHtml(settings.contactEmail)}</a>`
            : ""
        }
      </div>
    </div>
  </div>`;
}

export const EmailService = {
  /**
   * resetUrl is passed in whole, not built here — better-auth's own
   * sendResetPassword callback (wired in lib/auth.ts) already generates
   * the full, correct link (token creation, expiry, the validate-then-
   * redirect hop through /api/auth/reset-password/:token) before calling
   * this. This function's only job is turning that URL into an email.
   */
  async sendPasswordResetEmail(params: {
    to: string;
    fullName: string | null;
    resetUrl: string;
  }): Promise<void> {
    const { to, fullName, resetUrl } = params;
    const subject = `Reset your ${COMPANY_NAME} password`;

    const body = `
      <p>Hi ${escapeHtml(fullName || "there")},</p>
      <p>Click below to reset your password. This link expires in 1 hour and can only be used once.</p>
      <p style="margin:28px 0;"><a href="${resetUrl}" style="${CTA_BUTTON_STYLE}">Reset password</a></p>
      <p style="color:#766c56;font-size:12px;">Or paste this link into your browser:<br/><a href="${resetUrl}" style="color:#d4af37;">${resetUrl}</a></p>
      <p style="margin-top:20px;">If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
    `;
    const html = await renderBrandedShell(body);

    if (!transporter) {
      console.log(`[dev email] Password reset for ${to}: ${resetUrl}`);
      return;
    }

    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html });
  },
};
