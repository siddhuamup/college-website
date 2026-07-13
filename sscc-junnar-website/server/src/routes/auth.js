import { Router } from 'express';
import crypto from 'crypto';
import { prisma, withMongoId } from '../db/client.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../utils/auth.js';
import { Role } from '@prisma/client';
import { loginLimiter, adminAccessLimiter } from '../middleware/rateLimit.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { sendEmail } from '../utils/email.js';


export function authRouter({ jwtSecret, jwtExpiresIn }) {
  const r = Router();

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
  }

  r.post('/register-student', async (req, res) => {
    return res.status(403).json({ error: 'Self-registration is disabled. Students must be admitted by the administrator.' });
  });

  /** Unlock admin UI with server-side key from .env; issues JWT for existing admin user. */
  r.post('/admin-access', adminAccessLimiter, async (req, res) => {
    const expected = process.env.ADMIN_ACCESS_KEY;
    if (expected == null || String(expected).trim() === '') {
      return res.status(503).json({ error: 'ADMIN_ACCESS_KEY is not set in server/.env' });
    }
    const { accessKey } = req.body || {};
    if (String(accessKey || '') !== String(expected)) {
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

  r.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ _id: user.id, role: user.role, email: user.email }, jwtSecret, jwtExpiresIn);
    res.json({
      token,
      mustChangePassword: user.mustChangePassword || false,
      user: withMongoId({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        teacherProfile: typeof user.teacherProfile === 'string' ? JSON.parse(user.teacherProfile) : user.teacherProfile,
        studentProfile: typeof user.studentProfile === 'string' ? JSON.parse(user.studentProfile) : user.studentProfile,
      }),
    });
  });

  // ── Change Password ───────────────────────────────────────────────────
  const auth = createAuthMiddleware(jwtSecret);

  r.post('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    // Strength: must contain uppercase, lowercase, digit, special
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"|,.<>\/?]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return res.status(400).json({ error: 'Password must contain uppercase, lowercase, digit, and special character' });
    }

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

  r.get('/me', async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
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

  r.post('/forgot-password', async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    if (!user) {
      // Return 200 to prevent user enumeration security issues, but don't send email
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

    // Generate a random secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      }
    });
    
    // Send email with reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
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

  r.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    // Strength: must contain uppercase, lowercase, digit, special (same as change-password)
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"|,.<>\/?]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return res.status(400).json({ error: 'Password must contain uppercase, lowercase, digit, and special character' });
    }
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
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
