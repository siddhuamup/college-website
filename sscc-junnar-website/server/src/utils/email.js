import nodemailer from 'nodemailer';

/**
 * sendEmail dispatch wrapper.
 * Supports multiple email providers via standard SMTP.
 * 
 * Provider configurations supported:
 * - gmail: SMTP settings configured automatically for Gmail (smtp.gmail.com)
 * - hostinger: SMTP settings configured for Hostinger (smtp.hostinger.com)
 * - zoho: SMTP settings configured for Zoho (smtp.zoho.com)
 * - office365: SMTP settings configured for Office365 (smtp.office365.com)
 * - custom: Configurable via custom SMTP environment variables
 * 
 * In the absence of complete configuration, gracefully falls back to console logging/simulation.
 * 
 * @param {Object} options
 * @param {string} options.to Recipient email
 * @param {string} options.subject Email subject
 * @param {string} options.text Plain text email content
 * @param {string} options.html HTML email content
 */
export async function sendEmail({ to, subject, text, html }) {
  const provider = process.env.EMAIL_PROVIDER || '';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM || user || 'no-reply@ssccjunnar.edu';

  if (!provider || !user || !pass) {
    console.log(`\n--- [EMAIL SIMULATION (SMTP configuration missing)] ---`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`From:    ${from}`);
    console.log(`Body:\n${text}`);
    console.log(`------------------------------------------------------\n`);
    return { simulated: true };
  }

  let host = '';
  let port = 587;
  let secure = false;

  const provLower = provider.toLowerCase().trim();
  if (provLower === 'gmail') {
    host = 'smtp.gmail.com';
    port = 587;
    secure = false;
  } else if (provLower === 'hostinger') {
    host = 'smtp.hostinger.com';
    port = 465;
    secure = true;
  } else if (provLower === 'zoho') {
    host = 'smtp.zoho.com';
    port = 465;
    secure = true;
  } else if (provLower === 'office365') {
    host = 'smtp.office365.com';
    port = 587;
    secure = false;
  } else {
    // Custom SMTP configuration
    host = process.env.EMAIL_HOST || '';
    port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    secure = process.env.EMAIL_SECURE === 'true';
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Email dispatched successfully: ${info.messageId}`);
  return info;
}
