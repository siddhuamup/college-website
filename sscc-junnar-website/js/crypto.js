/**
 * ANTIGRAVITY E2EE CRYPTOGRAPHY MODULE
 * Native browser Web Crypto API implementation (Zero third-party crypto dependencies)
 * Algorithm: AES-256-GCM + ECDH P-256 Key Exchange + PBKDF2 (100,000 iterations)
 */

const CryptoModule = {
  // Derive AES-GCM wrapping key from user password
  async deriveKeyFromPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Generate ECDH P-256 key pair
  async generateKeyPair() {
    return window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );
  },

  // Export public key as Base64 (SPKI)
  async exportPublicKey(publicKey) {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  },

  // Import public key from Base64 (SPKI)
  async importPublicKey(base64) {
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return window.crypto.subtle.importKey(
      'spki',
      binary.buffer,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
  },

  // Export private key (encrypted with password-derived key)
  async exportPrivateKey(privateKey, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const wrappingKey = await this.deriveKeyFromPassword(password, salt);
    const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      wrappingKey,
      exported
    );
    return {
      encryptedPrivateKey: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt))
    };
  },

  // Import private key (decrypt with password)
  async importPrivateKey(encryptedData, password) {
    const salt = Uint8Array.from(atob(encryptedData.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    const encrypted = Uint8Array.from(atob(encryptedData.encryptedPrivateKey), c => c.charCodeAt(0));
    const wrappingKey = await this.deriveKeyFromPassword(password, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      wrappingKey,
      encrypted
    );
    return window.crypto.subtle.importKey(
      'pkcs8',
      decrypted,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey']
    );
  },

  // Derive shared secret using ECDH agreement
  async deriveSharedSecret(privateKey, publicKey) {
    return window.crypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Encrypt message plaintext with AES-256-GCM
  async encryptMessage(sharedSecret, plaintext) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedSecret,
      encoder.encode(plaintext)
    );
    const ciphertextArray = new Uint8Array(ciphertext);
    const authTagBytes = ciphertextArray.slice(-16);
    return {
      encryptedContent: btoa(String.fromCharCode(...ciphertextArray)),
      iv: btoa(String.fromCharCode(...iv)),
      authTag: btoa(String.fromCharCode(...authTagBytes))
    };
  },

  // Decrypt ciphertext blob with AES-256-GCM
  async decryptMessage(sharedSecret, encryptedContent, iv) {
    const binary = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      sharedSecret,
      binary
    );
    return new TextDecoder().decode(decrypted);
  },

  // Generate random symmetric group key
  async generateGroupKey() {
    return window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  },

  // Export raw group key as Base64
  async exportGroupKey(key) {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  },

  // Encrypt group key for target member using ECDH + AES-GCM
  async encryptGroupKeyForMember(groupKeyBase64, memberPublicKeyBase64, myPrivateKey) {
    const memberPublicKey = await this.importPublicKey(memberPublicKeyBase64);
    const sharedSecret = await this.deriveSharedSecret(myPrivateKey, memberPublicKey);
    return this.encryptMessage(sharedSecret, groupKeyBase64);
  },

  // Decrypt group key as member
  async decryptGroupKey(encryptedGroupKey, iv, creatorPublicKeyBase64, myPrivateKey) {
    const creatorPublicKey = await this.importPublicKey(creatorPublicKeyBase64);
    const sharedSecret = await this.deriveSharedSecret(myPrivateKey, creatorPublicKey);
    return this.decryptMessage(sharedSecret, encryptedGroupKey, iv);
  }
};

window.CryptoModule = CryptoModule;
