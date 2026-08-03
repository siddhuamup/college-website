/**
 * ANTIGRAVITY MESSENGER MODULE
 * End-to-end encrypted messaging controller for SSCC Junnar ERP
 * Uses Web Crypto API for zero-knowledge client-side encryption.
 */

const Messenger = {
  currentRoom: null,
  currentUser: null,
  myKeyPair: null,
  groupKey: null,
  roomsCache: [],

  async init() {
    try {
      const container = document.getElementById('messenger-panel') || document.getElementById('main-content');
      if (!container) return;

      // Render skeleton while loading
      container.innerHTML = '<div style="padding:2rem;" class="skeleton">Loading Messenger...</div>';

      // Load current user
      const authResult = await SSC_API.get('/auth/me');
      this.currentUser = authResult.user || authResult;

      // Initialize keys
      await this.loadOrGenerateKeys();

      // Render UI
      this.renderMessengerUI(container);

      // Load rooms
      await this.loadRooms();

      // Connect to notification stream for live delivery
      this.setupRealtime();
    } catch (err) {
      console.error('[MESSENGER-INIT-ERROR]', err);
      if (typeof Toast !== 'undefined') {
        Toast.error('Messenger init failed: ' + (err.message || err));
      }
    }
  },

  async loadOrGenerateKeys() {
    let password = sessionStorage.getItem('ssc_msg_pass');
    if (!password) {
      password = prompt('Enter a password to unlock your E2EE Messenger encryption key:', 'SSC@123') || 'SSC@123';
      sessionStorage.setItem('ssc_msg_pass', password);
    }

    try {
      const { keyPair } = await SSC_API.get('/messenger/my-keys');
      if (keyPair) {
        this.myKeyPair = {
          publicKey: await CryptoModule.importPublicKey(keyPair.publicKey),
          privateKey: await CryptoModule.importPrivateKey(keyPair, password)
        };
        return;
      }
    } catch {
      // Keypair not on server yet, generate new
    }

    // Generate new ECDH key pair
    const keyPair = await CryptoModule.generateKeyPair();
    const publicKeyBase64 = await CryptoModule.exportPublicKey(keyPair.publicKey);
    const encryptedData = await CryptoModule.exportPrivateKey(keyPair.privateKey, password);

    this.myKeyPair = keyPair;

    // Save keypair to server
    await SSC_API.post('/messenger/my-keys', {
      publicKey: publicKeyBase64,
      encryptedPrivateKey: encryptedData.encryptedPrivateKey,
      iv: encryptedData.iv,
      salt: encryptedData.salt
    });
  },

  async loadRooms() {
    const res = await SSC_API.get('/messenger/rooms');
    this.roomsCache = res.rooms || [];

    const list = document.getElementById('chat-rooms-list');
    if (!list) return;

    if (!this.roomsCache.length) {
      list.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--gray-500);font-size:13px;">No conversations yet</div>';
      return;
    }

    list.innerHTML = this.roomsCache.map(room => {
      const otherMember = room.type === 'direct'
        ? room.members.find(m => m.userId !== this.currentUser.id)
        : null;
      const displayName = room.type === 'direct'
        ? (otherMember?.user?.name || 'User')
        : (room.name || 'Group Chat');
      const activeClass = this.currentRoom === room.id ? 'active' : '';

      return `
        <div class="chat-room-item ${activeClass}" data-room-id="${room.id}" data-type="${room.type}">
          <div class="chat-room-avatar">${(displayName.charAt(0) || '?').toUpperCase()}</div>
          <div class="chat-room-info">
            <div class="chat-room-name">${window.escapeText(displayName)} ${room.type === 'group' ? '<span class="badge badge--info" style="font-size:10px;padding:2px 6px;">Group</span>' : ''}</div>
            <div class="chat-room-preview">Encrypted conversation</div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.chat-room-item').forEach(item => {
      item.addEventListener('click', () => this.openRoom(item.dataset.roomId, item.dataset.type));
    });
  },

  async openRoom(roomId, type) {
    this.currentRoom = roomId;

    document.querySelectorAll('.chat-room-item').forEach(el => {
      el.classList.toggle('active', el.dataset.roomId === roomId);
    });

    const header = document.getElementById('chat-header');
    const msgContainer = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');

    if (input) input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    const room = this.roomsCache.find(r => r.id === roomId);
    let displayName = 'Chat';
    if (room) {
      const otherMember = room.type === 'direct'
        ? room.members.find(m => m.userId !== this.currentUser.id)
        : null;
      displayName = room.type === 'direct' ? (otherMember?.user?.name || 'User') : (room.name || 'Group Chat');
    }
    if (header) {
      header.innerHTML = `<span>${window.escapeText(displayName)}</span> <span class="badge badge--success" style="font-size:11px;margin-left:8px;">🔒 E2EE Encrypted</span>`;
    }

    if (msgContainer) {
      msgContainer.innerHTML = '<div style="padding:1rem;" class="skeleton">Loading messages...</div>';
    }

    // Handle group key decryption if group room
    if (type === 'group' && room) {
      const myMember = room.members.find(m => m.userId === this.currentUser.id);
      if (myMember?.encryptedGroupKey && myMember?.iv) {
        try {
          const creatorMember = room.members.find(m => m.userId === room.createdBy) || room.members[0];
          const creatorKeyRes = await SSC_API.get(`/messenger/users/${creatorMember.userId}/public-key`);
          const groupKeyBase64 = await CryptoModule.decryptGroupKey(
            myMember.encryptedGroupKey,
            myMember.iv,
            creatorKeyRes.publicKey,
            this.myKeyPair.privateKey
          );
          const binary = Uint8Array.from(atob(groupKeyBase64), c => c.charCodeAt(0));
          this.groupKey = await window.crypto.subtle.importKey(
            'raw',
            binary.buffer,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
          );
        } catch (err) {
          console.error('Failed to decrypt group key:', err);
        }
      }
    }

    const { messages } = await SSC_API.get(`/messenger/rooms/${roomId}/messages`);
    await this.renderMessages(messages, type, room);
    this.setupMessageInput(roomId, type, room);
  },

  async renderMessages(messages, type, room) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';

    if (!messages.length) {
      container.innerHTML = '<div style="margin:auto;color:var(--gray-500);font-size:13px;text-align:center;">No messages yet. Send an encrypted message below!</div>';
      return;
    }

    for (const msg of messages) {
      const isMe = msg.senderId === this.currentUser.id;
      let decryptedText = '[Encrypted message]';

      try {
        if (type === 'direct') {
          const { publicKey: senderPublicKeyBase64 } = await SSC_API.get(`/messenger/users/${msg.senderId}/public-key`);
          const senderPublicKey = await CryptoModule.importPublicKey(senderPublicKeyBase64);
          const sharedSecret = await CryptoModule.deriveSharedSecret(this.myKeyPair.privateKey, senderPublicKey);
          decryptedText = await CryptoModule.decryptMessage(sharedSecret, msg.encryptedContent, msg.iv);
        } else if (this.groupKey) {
          decryptedText = await CryptoModule.decryptMessage(this.groupKey, msg.encryptedContent, msg.iv);
        }
      } catch (err) {
        decryptedText = '[Unable to decrypt message]';
      }

      const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const div = document.createElement('div');
      div.className = `chat-message ${isMe ? 'chat-message--me' : 'chat-message--other'}`;
      div.innerHTML = `
        <div class="chat-message-bubble">
          ${!isMe ? `<div class="chat-message-sender">${window.escapeText(msg.sender?.name || 'User')}</div>` : ''}
          <div class="chat-message-text">${window.escapeText(decryptedText)}</div>
          <div class="chat-message-time">${timeStr}</div>
        </div>
      `;
      container.appendChild(div);
    }

    container.scrollTop = container.scrollHeight;
  },

  setupMessageInput(roomId, type, room) {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if (!input || !sendBtn) return;

    const send = async () => {
      const text = input.value.trim();
      if (!text) return;

      sendBtn.disabled = true;
      try {
        let encrypted;
        if (type === 'direct') {
          const otherMember = room.members.find(m => m.userId !== this.currentUser.id);
          const { publicKey: otherPublicKeyBase64 } = await SSC_API.get(`/messenger/users/${otherMember.userId}/public-key`);
          const otherPublicKey = await CryptoModule.importPublicKey(otherPublicKeyBase64);
          const sharedSecret = await CryptoModule.deriveSharedSecret(this.myKeyPair.privateKey, otherPublicKey);
          encrypted = await CryptoModule.encryptMessage(sharedSecret, text);
        } else {
          if (!this.groupKey) {
            this.groupKey = await CryptoModule.generateGroupKey();
          }
          encrypted = await CryptoModule.encryptMessage(this.groupKey, text);
        }

        await SSC_API.post(`/messenger/rooms/${roomId}/messages`, {
          encryptedContent: encrypted.encryptedContent,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          messageType: 'text'
        });

        input.value = '';
        await this.openRoom(roomId, type);
      } catch (err) {
        if (typeof Toast !== 'undefined') Toast.error('Failed to send message: ' + err.message);
      } finally {
        sendBtn.disabled = false;
      }
    };

    sendBtn.onclick = send;
    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        send();
      }
    };
  },

  setupRealtime() {
    try {
      const evtSource = new EventSource('/api/notifications/stream');
      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'new_message' && data.roomId === this.currentRoom) {
          const room = this.roomsCache.find(r => r.id === data.roomId);
          this.openRoom(data.roomId, room?.type || 'direct');
        }
      };
    } catch { /* SSE optional */ }
  },

  renderMessengerUI(container) {
    container.innerHTML = `
      <div class="messenger-container">
        <div class="messenger-sidebar">
          <div class="messenger-header">
            <h3 style="margin:0;font-size:16px;">Messages</h3>
          </div>
          <div class="chat-rooms-list" id="chat-rooms-list"></div>
        </div>
        <div class="messenger-chat">
          <div class="chat-header" id="chat-header">
            <span>Select a conversation to start messaging</span>
          </div>
          <div class="chat-messages" id="chat-messages">
            <div style="margin:auto;color:var(--gray-500);font-size:13px;">Select a contact from the sidebar</div>
          </div>
          <div class="chat-input-area">
            <input type="text" id="chat-input" class="input" placeholder="Type an end-to-end encrypted message..." disabled/>
            <button class="btn btn--primary" id="chat-send-btn" disabled>Send</button>
          </div>
        </div>
      </div>
    `;
  }
};

window.Messenger = Messenger;
