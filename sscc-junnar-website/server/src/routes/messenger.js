/**
 * ANTIGRAVITY E2EE MESSENGER ROUTER
 * Server stores ONLY client-side encrypted ciphertext blobs (Zero Knowledge)
 */
import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { broadcastNotification } from './notifications.js';

export function messengerRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);

  // Get or create direct chat room
  r.post('/rooms/direct', auth, async (req, res) => {
    const { targetUserId } = req.body;
    const myId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    // Check if direct room already exists
    const existing = await prisma.chatRoom.findFirst({
      where: {
        type: 'direct',
        members: { some: { userId: myId } },
        AND: { members: { some: { userId: targetUserId } } }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, role: true } }
          }
        }
      }
    });

    if (existing) {
      return res.json({ room: existing });
    }

    const room = await prisma.chatRoom.create({
      data: {
        type: 'direct',
        createdBy: myId,
        members: {
          create: [
            { userId: myId, role: 'member' },
            { userId: targetUserId, role: 'member' }
          ]
        }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, role: true } }
          }
        }
      }
    });

    res.json({ room });
  });

  // Create group chat room
  r.post('/rooms/group', auth, async (req, res) => {
    const { name, memberIds, encryptedGroupKeys } = req.body;
    const myId = req.user.id;

    if (!name || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: 'Group name and memberIds array are required' });
    }

    const allMemberIds = Array.from(new Set([myId, ...memberIds]));
    const keysMap = encryptedGroupKeys || {};

    const room = await prisma.chatRoom.create({
      data: {
        name,
        type: 'group',
        createdBy: myId,
        members: {
          create: allMemberIds.map(id => ({
            userId: id,
            role: id === myId ? 'admin' : 'member',
            encryptedGroupKey: keysMap[id]?.encryptedContent || null,
            iv: keysMap[id]?.iv || null
          }))
        }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, role: true } }
          }
        }
      }
    });

    res.json({ room });
  });

  // Get active rooms for current user
  r.get('/rooms', auth, async (req, res) => {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: { some: { userId: req.user.id } },
        isActive: true
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, role: true } }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ rooms });
  });

  // Get messages in a room
  r.get('/rooms/:roomId/messages', auth, async (req, res) => {
    const { roomId } = req.params;
    const { before } = req.query;

    const member = await prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId: req.user.id } }
    });
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {})
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Update member lastReadAt
    await prisma.chatMember.update({
      where: { roomId_userId: { roomId, userId: req.user.id } },
      data: { lastReadAt: new Date() }
    });

    res.json({ messages: messages.reverse() });
  });

  // Send encrypted message
  r.post('/rooms/:roomId/messages', auth, async (req, res) => {
    const { roomId } = req.params;
    const { encryptedContent, iv, authTag, messageType, fileUrl, fileName, fileSize, replyToId } = req.body;

    if (!encryptedContent || !iv) {
      return res.status(400).json({ error: 'encryptedContent and iv are required' });
    }

    const member = await prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId: req.user.id } }
    });
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId: req.user.id,
        encryptedContent,
        iv,
        authTag: authTag || '',
        messageType: messageType || 'text',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: Number(fileSize) || null,
        replyToId: replyToId || null
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    // Touch room updatedAt timestamp
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() }
    });

    // Notify other room members via SSE stream
    const otherMembers = await prisma.chatMember.findMany({
      where: { roomId, userId: { not: req.user.id } },
      select: { userId: true }
    });

    otherMembers.forEach(m => {
      broadcastNotification(m.userId, {
        type: 'new_message',
        roomId,
        messageId: message.id,
        senderName: req.user.name || 'User'
      });
    });

    res.json({ message });
  });

  // Get user's public key for ECDH key agreement
  r.get('/users/:userId/public-key', auth, async (req, res) => {
    const keyPair = await prisma.userKeyPair.findUnique({
      where: { userId: req.params.userId }
    });
    if (!keyPair) {
      return res.status(404).json({ error: 'Target user has not initialized messenger key pair' });
    }
    res.json({ publicKey: keyPair.publicKey });
  });

  // Upload or update my public/encrypted-private keypair
  r.post('/my-keys', auth, async (req, res) => {
    const { publicKey, encryptedPrivateKey, iv, salt } = req.body;
    if (!publicKey || !encryptedPrivateKey || !iv || !salt) {
      return res.status(400).json({ error: 'publicKey, encryptedPrivateKey, iv, and salt are required' });
    }

    await prisma.userKeyPair.upsert({
      where: { userId: req.user.id },
      update: { publicKey, encryptedPrivateKey, iv, salt },
      create: { userId: req.user.id, publicKey, encryptedPrivateKey, iv, salt }
    });

    res.json({ ok: true });
  });

  // Get my stored encrypted key pair
  r.get('/my-keys', auth, async (req, res) => {
    const keyPair = await prisma.userKeyPair.findUnique({
      where: { userId: req.user.id }
    });
    if (!keyPair) {
      return res.status(404).json({ error: 'No keypair initialized' });
    }
    res.json({ keyPair });
  });

  return r;
}
