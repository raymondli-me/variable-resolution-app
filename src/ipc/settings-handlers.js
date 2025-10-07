const { ipcMain, app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Secure encryption for API keys using Electron's safeStorage
// Uses OS-level encryption: macOS Keychain, Windows DPAPI, Linux libsecret
function encrypt(text) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  const encrypted = safeStorage.encryptString(text);
  // Return as base64 string prefixed with 'v2:' to distinguish from old format
  return 'v2:' + encrypted.toString('base64');
}

function decrypt(encryptedData) {
  try {
    // Check if this is new format (v2:) or old format (hex:hex)
    if (encryptedData.startsWith('v2:')) {
      // New format using safeStorage
      const buffer = Buffer.from(encryptedData.substring(3), 'base64');
      return safeStorage.decryptString(buffer);
    } else {
      // Old format - migrate from hardcoded key encryption
      return decryptLegacy(encryptedData);
    }
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Legacy decryption for migration purposes only
function decryptLegacy(hash) {
  try {
    const algorithm = 'aes-256-ctr';
    const secretKey = 'vr-collector-secret-key-32-chars';
    const parts = hash.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Legacy decryption error:', error);
    return null;
  }
}

function registerSettingsHandlers(getSettings, saveSettings) {
  // Settings handlers
  ipcMain.handle('settings:saveApiKey', async (event, { service, apiKey }) => {
    try {
      const settings = getSettings();
      if (!settings.apiKeys) {
        settings.apiKeys = {};
      }
      // Encrypt the API key before storing
      settings.apiKeys[service] = encrypt(apiKey);
      saveSettings();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:getApiKey', async (event, service) => {
    try {
      const settings = getSettings();
      if (settings.apiKeys && settings.apiKeys[service]) {
        const decrypted = decrypt(settings.apiKeys[service]);
        return { success: true, apiKey: decrypted };
      }
      return { success: true, apiKey: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// Migrate API keys from old encryption to new safeStorage encryption
function migrateApiKeys(settings, saveSettings) {
  if (!settings.apiKeys) return;

  let migrated = false;
  for (const [service, encryptedKey] of Object.entries(settings.apiKeys)) {
    // Check if this key is in old format (doesn't start with 'v2:')
    if (!encryptedKey.startsWith('v2:')) {
      console.log(`Migrating API key for service: ${service}`);
      try {
        // Decrypt using old method
        const decryptedKey = decryptLegacy(encryptedKey);
        if (decryptedKey) {
          // Re-encrypt using new secure method
          settings.apiKeys[service] = encrypt(decryptedKey);
          migrated = true;
          console.log(`Successfully migrated API key for ${service}`);
        } else {
          console.error(`Failed to decrypt legacy key for ${service}`);
        }
      } catch (error) {
        console.error(`Error migrating key for ${service}:`, error);
      }
    }
  }

  // Save if any keys were migrated
  if (migrated) {
    saveSettings();
    console.log('API key migration completed and saved');
  }
}

module.exports = {
  registerSettingsHandlers,
  migrateApiKeys,
  encrypt,
  decrypt
};
