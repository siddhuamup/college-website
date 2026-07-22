import { Router } from 'express';
import crypto from 'crypto';
import { prisma, withMongoId } from '../db/client.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../utils/auth.js';
import { Role } from '@prisma/client';
import { loginLimiter, adminAccessLimiter, publicFormLimiter, checkAccountLockout, recordFailedLogin, clearFailedLogins, meLimiter } from '../middleware/rateLimit.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendEmail } from '../utils/email.js';
import { blacklistToken } from '../utils/tokenBlacklist.js';
import { safeJsonParse } from '../utils/json.js';

// Cookie options for JWT storage
const COOKIE_NAME = 'ssc_token';
function cookieOpts(maxAgeMs) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  };
}
import {
  validate,
  adminAccessSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../middleware/validation.js';

export function authRouter({ jwtSecret, jwtExpiresIn }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);

  /** Unlock admin UI with server-side key from .env; issues JWT for existing admin user. */
  r.post('/admin-access', adminAccessLimiter, validate(adminAccessSchema), async (req, res) => {
    const expected = process.env.ADMIN_ACCESS_KEY;
    if (expected == null || String(expected).trim() === '') {
      return res.status(503).json({ error: 'ADMIN_ACCESS_KEY is not set in server/.env' });
    }
    const { accessKey } = req.body;
    if (String(accessKey) !== String(expected)) {
      // Log failed admin access attempt for security audit
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      console.warn(`[SECURITY] Failed admin-access attempt from IP: ${ip} at ${new Date().toISOString()}`);
      return res.status(401).json({ error: 'Invalid access key' });
    }
    const admin = await prisma.user.findFirst({
      where: { role: Role.admin, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      return res.status(503).json({ error: 'No admin user in database. Run npm run seed in server/ once.' });
    }
    const token = signToken({ _id: admin.id, role: admin.role, email: admin.email }, jwtSecret, jwtExpiresIn);
    res.cookie(COOKIE_NAME, token, cookieOpts(7 * 24 * 60 * 60 * 1000));
    res.json({
      token,
      user: withMongoId({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
        phone: admin.phone,
        teacherProfile: admin.teacherProfile,
        studentProfile: admin.studentProfile,
      }),
    });
  });

  r.post('/login', loginLimiter, checkAccountLockout, validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const searchId = String(email).toLowerCase().trim();
    let user = await prisma.user.findUnique({
      where: { email: searchId },
    });
    if (!user) {
      // O(1) performance using SQLite JSON extraction function (avoid loading entire database into memory)
      const rawUsers = await prisma.$queryRaw`
        SELECT * FROM User 
        WHERE role = 'student' AND isDeleted = 0 AND (
          lower(json_extract(studentProfile, '$.studentId')) = ${searchId} OR 
          lower(json_extract(studentProfile, '$.personalEmail')) = ${searchId} OR 
          lower(json_extract(studentProfile, '$.collegeEmail')) = ${searchId}
        ) LIMIT 1
      `;
      user = rawUsers[0] || null;
    }
    if (!user || !user.isActive || user.isDeleted) {
      recordFailedLogin(searchId);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      recordFailedLogin(searchId);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Successful login — clear any failed attempt tracking
    clearFailedLogins(searchId);

    const token = signToken({ _id: user.id, role: user.role, email: user.email }, jwtSecret, jwtExpiresIn);
    res.cookie(COOKIE_NAME, token, cookieOpts(7 * 24 * 60 * 60 * 1000));
    res.json({
      token,
      mustChangePassword: user.mustChangePassword || false,
      user: withMongoId({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        teacherProfile: typeof user.teacherProfile === 'string' ? safeJsonParse(user.teacherProfile, null) : user.teacherProfile,
        studentProfile: typeof user.studentProfile === 'string' ? safeJsonParse(user.studentProfile, null) : user.studentProfile,
      }),
    });
  });

  // ── Logout — clear cookie and blacklist token ───────────────────────
  r.post('/logout', auth, (req, res) => {
    const token = req._token || req.cookies?.[COOKIE_NAME] || null;
    if (token) {
      try {
        const payload = verifyToken(token, jwtSecret);
        const exp = payload.exp ? payload.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
        blacklistToken(token, exp);
      } catch {
        // Token is already invalid — just clear the cookie
      }
    }
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', path: '/' });
    res.json({ ok: true, message: 'Logged out successfully' });
  });

  // ── Change Password ───────────────────────────────────────────────────
  r.post('/change-password', auth, validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
      },
    });

    res.json({ ok: true, message: 'Password changed successfully' });
  });

  r.get('/me', meLimiter, async (req, res) => {
    // Read from cookie first, fallback to header
    let token = req.cookies?.[COOKIE_NAME] || null;
    if (!token) {
      const header = req.headers.authorization || '';
      token = header.startsWith('Bearer ') ? header.slice(7) : null;
    }
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = verifyToken(token, jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          phone: true,
          avatarUrl: true,
          bio: true,
          teacherProfile: true,
          studentProfile: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });
      res.json({ user: withMongoId(user) });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  r.post('/forgot-password', publicFormLimiter, validate(forgotPasswordSchema), async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user || !user.isActive || user.isDeleted) {
      // Return 200 generic message with timing equalization to prevent email enumeration
      await new Promise((resolve) => setTimeout(resolve, 100));
      return res.json({ message: 'If the email exists, a reset link has been sent.' });
    }

    // Clean up expired tokens for this user first
    await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { userId: user.id },
          { expiresAt: { lt: new Date() } }
        ]
      }
    });

    // Generate a random secure raw token & store SHA-256 hash in DB
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
      }
    });
    
    // Send email with raw reset token in URL
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password.html?token=${rawToken}`;
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request — SSC College Junnar',
        text: `Dear ${user.name},\n\nYou requested a password reset. Click the link below to reset your password:\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nSSC College Junnar`,
        html: `<p>Dear <strong>${user.name}</strong>,</p>
               <p>You requested a password reset. Click the link below to reset your password:</p>
               <p><a href="${resetUrl}" style="padding: 10px 15px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
               <p>Or copy and paste this link in your browser:</p>
               <p>${resetUrl}</p>
               <p>This link is valid for 15 minutes.</p>
               <p>Best regards,<br/>SSC College Junnar</p>`
      });
    } catch (err) {
      console.error('Failed to send reset password email:', err);
    }
    
    res.json({ message: 'If the email exists, a reset link has been sent.' });
  });

  r.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
    const { token: rawToken, newPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(String(rawToken)).digest('hex');

    const record = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
      include: { user: true }
    });
    if (!record || record.expiresAt < new Date()) {
      if (record) {
        await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
      }
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const user = record.user;
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Update password hash and turn off forced password change
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(String(newPassword)),
        mustChangePassword: false,
      },
    });
    
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    res.json({ ok: true, message: 'Password has been reset successfully.' });
  });

  return r;
}
