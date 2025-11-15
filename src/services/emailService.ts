// src/services/emailService.ts
import nodemailer from "nodemailer";

type SendOrderConfirmationOptions = {
  to: string;
  name?: string;
  orderNumber?: string;
  link?: string;
  pdfFilename?: string | null;
};

type SendPasswordResetOptions = {
  to: string;
  name?: string;
  resetLink: string;
};

// 🔹 Transporter config – uses .env, with sensible fallbacks
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",      // fallback: Gmail
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  secure: process.env.SMTP_SECURE === "true",           // for 587 => false
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
});

/**
 * 🧾 Order confirmation email
 */
export async function sendOrderConfirmationEmail(
  opts: SendOrderConfirmationOptions
) {
  if (!opts || !opts.to) {
    throw new Error("sendOrderConfirmationEmail: missing recipient");
  }

  const subject = `Order Confirmation ${
    opts.orderNumber ? `- ${opts.orderNumber}` : ""
  }`;

  const textLines = [
    `Hello ${opts.name ?? ""}`.trim(),
    "",
    `Thank you for your order${
      opts.orderNumber ? ` (${opts.orderNumber})` : ""
    }.`,
    opts.link ? `You can view your order here: ${opts.link}` : "",
    "",
    "Regards,",
    "Your Store",
  ].filter(Boolean);

  const mailOptions: any = {
    from:
      process.env.EMAIL_FROM ||
      process.env.SMTP_USER ||
      "no-reply@example.com",
    to: opts.to,
    subject,
    text: textLines.join("\n"),
    html: `<p>Hello ${opts.name ?? "Customer"},</p>
           <p>Thank you for your order${
             opts.orderNumber
               ? ` (<strong>${opts.orderNumber}</strong>)`
               : ""
           }.</p>
           ${
             opts.link
               ? `<p><a href="${opts.link}">View your order</a></p>`
               : ""
           }
           <p>Regards,<br/>Your Store</p>`,
  };

  if (opts.pdfFilename) {
    const invoicePathBase =
      process.env.INVOICE_UPLOAD_DIR || process.cwd() + "/uploads/invoices";
    mailOptions.attachments = [
      {
        filename: opts.pdfFilename,
        path: `${invoicePathBase}/${opts.pdfFilename}`,
      },
    ];
  }

  return transporter.sendMail(mailOptions);
}

/**
 * 🔐 Password reset email
 */
export async function sendPasswordResetEmail(
  opts: SendPasswordResetOptions
) {
  if (!opts || !opts.to || !opts.resetLink) {
    throw new Error("sendPasswordResetEmail: missing to or resetLink");
  }

  const subject = "Reset your Laundry24 password";

  const text = [
    `Hello ${opts.name ?? ""}`.trim(),
    "",
    "We received a request to reset your password.",
    "If this was you, click the link below (valid for 1 hour):",
    opts.resetLink,
    "",
    "If you did not request this, you can safely ignore this email.",
    "",
    "Regards,",
    "Laundry24",
  ].join("\n");

  const html = `
    <p>Hello ${opts.name ?? "Customer"},</p>
    <p>We received a request to reset your password for your <strong>Laundry24</strong> account.</p>
    <p>
      <a href="${opts.resetLink}"
         style="background:#ea580c;color:#fff;padding:10px 18px;border-radius:4px;
                text-decoration:none;display:inline-block;">
        Reset Password
      </a>
    </p>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p><a href="${opts.resetLink}">${opts.resetLink}</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
    <p>Regards,<br/>Laundry24</p>
  `;

  const mailOptions: any = {
    from:
      process.env.EMAIL_FROM ||
      process.env.SMTP_USER ||
      "no-reply@example.com",
    to: opts.to,
    subject,
    text,
    html,
  };

  return transporter.sendMail(mailOptions);
}

export default {
  sendOrderConfirmationEmail,
  sendPasswordResetEmail,
};
