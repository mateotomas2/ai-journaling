/**
 * Unit tests for WebAuthn service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerBiometric,
  authenticateBiometric,
  isBiometricAvailable,
} from '@/services/biometric/webauthn.service';
import { BiometricErrorCode } from '@/services/biometric/types';

// Mock navigator.credentials
const mockCredentials = {
  create: vi.fn(),
  get: vi.fn(),
};

// Mock PublicKeyCredential
const mockPublicKeyCredential = {
  isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(),
};

describe('WebAuthn Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup global mocks
    global.navigator = {
      credentials: mockCredentials as unknown as CredentialsContainer,
    } as Navigator;

    global.PublicKeyCredential =
      mockPublicKeyCredential as unknown as typeof PublicKeyCredential;
  });

  describe('isBiometricAvailable', () => {
    it('should return true when platform authenticator is available', async () => {
      mockPublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable.mockResolvedValue(
        true
      );

      const result = await isBiometricAvailable();
      expect(result).toBe(true);
    });

    it('should return false when platform authenticator is not available', async () => {
      mockPublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable.mockResolvedValue(
        false
      );

      const result = await isBiometricAvailable();
      expect(result).toBe(false);
    });

    it('should return false when WebAuthn is not supported', async () => {
      global.PublicKeyCredential = undefined as unknown as typeof PublicKeyCredential;

      const result = await isBiometricAvailable();
      expect(result).toBe(false);
    });
  });

  describe('registerBiometric', () => {
    it('should successfully register a biometric credential', async () => {
      const mockCredential = {
        rawId: new ArrayBuffer(32),
        response: {
          getPublicKey: () => new ArrayBuffer(64),
          attestationObject: new ArrayBuffer(128),
        },
      };

      mockCredentials.create.mockResolvedValue(mockCredential);

      const result = await registerBiometric();

      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('publicKey');
      expect(result.credentialId).toBeTruthy();
    });

    it('should throw BiometricError when user cancels registration', async () => {
      const error = new Error('User cancelled');
      error.name = 'NotAllowedError';
      mockCredentials.create.mockRejectedValue(error);

      try {
        await registerBiometric();
        expect.fail('Should have thrown BiometricError');
      } catch (err) {
        expect(err).toHaveProperty('code', BiometricErrorCode.USER_CANCELLED);
      }
    });

    it('should throw BiometricError when not supported', async () => {
      const error = new Error('Not supported');
      error.name = 'NotSupportedError';
      mockCredentials.create.mockRejectedValue(error);

      try {
        await registerBiometric();
        expect.fail('Should have thrown BiometricError');
      } catch (err) {
        expect(err).toHaveProperty('code', BiometricErrorCode.NOT_SUPPORTED);
      }
    });

    it('should throw BiometricError on timeout', async () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      mockCredentials.create.mockRejectedValue(error);

      try {
        await registerBiometric();
        expect.fail('Should have thrown BiometricError');
      } catch (err) {
        expect(err).toHaveProperty('code', BiometricErrorCode.TIMEOUT);
      }
    });
  });

  describe('authenticateBiometric', () => {
    // Valid base64-encoded credential ID (32 bytes = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    const mockCredentialId = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

    it('should successfully authenticate with biometric', async () => {
      const mockCredential = {
        rawId: new ArrayBuffer(32),
        response: {
          signature: new ArrayBuffer(64),
          authenticatorData: new ArrayBuffer(37),
          clientDataJSON: new ArrayBuffer(128),
        },
        getClientExtensionResults: () => ({}),
      };

      mockCredentials.get.mockResolvedValue(mockCredential);

      const result = await authenticateBiometric(mockCredentialId);

      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('authenticatorData');
      expect(result).toHaveProperty('clientDataJSON');
      expect(result).toHaveProperty('prfOutput');
    });

    it('should throw BiometricError when user cancels authentication', async () => {
      const error = new Error('User cancelled');
      error.name = 'NotAllowedError';
      mockCredentials.get.mockRejectedValue(error);

      try {
        await authenticateBiometric(mockCredentialId);
        expect.fail('Should have thrown BiometricError');
      } catch (err) {
        expect(err).toHaveProperty('code', BiometricErrorCode.USER_CANCELLED);
      }
    });

    it('should throw BiometricError on authentication timeout', async () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      mockCredentials.get.mockRejectedValue(error);

      try {
        await authenticateBiometric(mockCredentialId);
        expect.fail('Should have thrown BiometricError');
      } catch (err) {
        expect(err).toHaveProperty('code', BiometricErrorCode.TIMEOUT);
      }
    });
  });
});
