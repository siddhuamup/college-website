import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../../src/utils/auth.js';
import { parsePagination, paginatedResponse } from '../../src/utils/pagination.js';

describe('Auth Utilities', () => {
  const secret = 'super-secret-jwt-key-for-testing-purposes-min-64-characters-long!';

  it('should hash and verify passwords correctly', async () => {
    const raw = 'StrongP@ssw0rd!2026';
    const hash = await hashPassword(raw);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(raw);

    const match = await verifyPassword(raw, hash);
    expect(match).toBe(true);

    const wrongMatch = await verifyPassword('WrongPassword123!', hash);
    expect(wrongMatch).toBe(false);
  });

  it('should sign and verify JWT tokens', () => {
    const payload = { _id: 'usr_123', role: 'admin', email: 'admin@ssccjunnar.edu' };
    const token = signToken(payload, secret, '1h');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token, secret);
    expect(decoded._id).toBe('usr_123');
    expect(decoded.role).toBe('admin');
    expect(decoded.email).toBe('admin@ssccjunnar.edu');
  });

  it('should throw error when verifying invalid token', () => {
    expect(() => verifyToken('invalid.token.here', secret)).toThrow();
  });
});

describe('Pagination Utility', () => {
  it('should parse default pagination correctly', () => {
    const { page, limit, skip, take } = parsePagination({});
    expect(page).toBe(1);
    expect(limit).toBe(25);
    expect(skip).toBe(0);
    expect(take).toBe(25);
  });

  it('should respect custom query params within bounds', () => {
    const { page, limit, skip, take } = parsePagination({ page: '3', limit: '50' });
    expect(page).toBe(3);
    expect(limit).toBe(50);
    expect(skip).toBe(100);
    expect(take).toBe(50);
  });

  it('should cap limit to maxLimit', () => {
    const { limit } = parsePagination({ limit: '999' }, 25, 100);
    expect(limit).toBe(100);
  });

  it('should format paginated response correctly', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const res = paginatedResponse(items, 50, { page: 1, limit: 10 });
    expect(res.data).toHaveLength(2);
    expect(res.pagination.total).toBe(50);
    expect(res.pagination.totalPages).toBe(5);
    expect(res.pagination.hasNext).toBe(true);
    expect(res.pagination.hasPrev).toBe(false);
  });
});
