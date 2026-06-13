import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user, secret, expiresIn) {
  const sub = String(user._id ?? user.id ?? '');
  const role = user.role != null ? String(user.role) : '';
  return jwt.sign({ sub, role, email: user.email }, secret, { expiresIn });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}
