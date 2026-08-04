/**
 * Payment Gateway Integration Router — SSCC Junnar ERP
 * Supports Razorpay order creation and webhook verification.
 * Falls back to mock transaction references when RAZORPAY_KEY_ID is not configured.
 */
import { Router } from 'express';
import crypto from 'crypto';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

export function paymentsRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);

  // POST /api/payments/create-order — Create Razorpay fee payment order
  r.post('/create-order', auth, requireRole(Role.student), async (req, res) => {
    const { feeStructureId, amount } = req.body || {};
    if (!feeStructureId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'feeStructureId and valid amount required' });
    }

    const feeStruct = await prisma.feeStructure.findUnique({ where: { id: feeStructureId } });
    if (!feeStruct) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const receipt = `REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!keyId) {
      // Mock payment order for dev / test mode
      return res.json({
        ok: true,
        isMock: true,
        orderId: `order_mock_${receipt}`,
        amount: Math.round(Number(amount) * 100), // in paise
        currency: 'INR',
        receiptNumber: receipt,
        keyId: 'rzp_test_mock_key',
        message: 'Mock payment order generated. Set RAZORPAY_KEY_ID in .env for live gateway.'
      });
    }

    // Live Razorpay Order Creation via REST API (no extra npm dependency)
    try {
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${process.env.RAZORPAY_KEY_SECRET || ''}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(Number(amount) * 100), // paise
          currency: 'INR',
          receipt,
          notes: {
            studentId: req.user.id,
            feeStructureId,
          }
        })
      });

      const orderData = await response.json();
      if (!response.ok) {
        throw new Error(orderData.error?.description || 'Razorpay order creation failed');
      }

      res.json({
        ok: true,
        isMock: false,
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        receiptNumber: receipt,
        keyId,
      });
    } catch (err) {
      console.error('[PAYMENTS] Razorpay order creation failed:', err.message);
      res.status(500).json({ error: 'Payment gateway initialization failed: ' + err.message });
    }
  });

  // POST /api/payments/verify — Verify Razorpay payment signature & record FeePayment
  r.post('/verify', auth, requireRole(Role.student), async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, feeStructureId, amountPaid, semester } = req.body || {};

    if (!feeStructureId || !amountPaid) {
      return res.status(400).json({ error: 'feeStructureId and amountPaid required' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    let verified = false;

    if (!keySecret || String(razorpay_order_id || '').startsWith('order_mock_')) {
      // Mock payment verification
      verified = true;
    } else {
      // HMAC SHA256 Signature verification
      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
      verified = expectedSignature === razorpay_signature;
    }

    if (!verified) {
      return res.status(400).json({ error: 'Payment signature verification failed. Transaction rejected.' });
    }

    // Atomic transaction: Increment counter for receipt number + record FeePayment
    const payment = await prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: { name: 'fee_receipt' },
        update: { value: { increment: 1 } },
        create: { name: 'fee_receipt', value: 1001 }
      });
      const receiptNumber = `REC-${new Date().getFullYear()}-${counter.value}`;

      const rec = await tx.feePayment.create({
        data: {
          studentId: req.user.id,
          feeStructureId,
          amountPaid: Number(amountPaid),
          paymentMode: razorpay_payment_id ? 'online_razorpay' : 'online_mock',
          transactionRef: razorpay_payment_id || `MOCK-${Date.now()}`,
          receiptNumber,
          semester: semester ? String(semester) : '',
          status: 'completed',
          remarks: `Online Payment (Ref: ${razorpay_payment_id || 'Mock'})`,
        }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          userRole: 'student',
          action: 'FEE_PAYMENT_ONLINE',
          target: receiptNumber,
          entityType: 'FeePayment',
          entityId: rec.id,
          details: JSON.stringify({ amount: amountPaid, receiptNumber }),
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        }
      });

      return rec;
    });

    res.status(201).json({
      ok: true,
      message: 'Payment verified and receipt generated successfully!',
      payment: withMongoId(payment),
    });
  });

  return r;
}
