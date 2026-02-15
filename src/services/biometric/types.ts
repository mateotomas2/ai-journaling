/**
 * Biometric authentication types and interfaces
 */

export interface BiometricCredential {
  id: string;
  rawId: ArrayBuffer;
  type: 'public-key';
}

export interface BiometricRegistrationResult {
  credentialId: string;
  publicKey: ArrayBuffer;
  attestation?: ArrayBuffer;
}

export interface BiometricAuthenticationResult {
  credentialId: string;
  signature: ArrayBuffer;
  authenticatorData: ArrayBuffer;
  clientDataJSON: ArrayBuffer;
  /** PRF extension output - deterministic secret for key derivation */
  prfOutput: ArrayBuffer | null;
}

export interface StoredBiometricKey {
  credentialId: string;
  wrappedKey: string; // base64-encoded encrypted key
  wrappingKey: string; // base64-encoded wrapping key (stored, not derived from PRF)
  salt: string; // base64-encoded salt for HKDF if needed
  iv: string; // base64-encoded IV for AES-GCM
  wrappedSyncKey?: string; // base64-encoded encrypted sync key (added later, optional for migration)
  syncIv?: string; // base64-encoded IV for sync key AES-GCM wrapping
  enrolledAt: number; // timestamp
}

export type BiometricType = 'fingerprint' | 'face' | 'unknown';

export interface BiometricSupport {
  isAvailable: boolean;
  type: BiometricType;
  platformName?: string;
}

export class BiometricError extends Error {
  constructor(
    message: string,
    public code: BiometricErrorCode,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'BiometricError';
  }
}

export enum BiometricErrorCode {
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  USER_CANCELLED = 'USER_CANCELLED',
  TIMEOUT = 'TIMEOUT',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  KEYSTORE_ERROR = 'KEYSTORE_ERROR',
  INVALID_STATE = 'INVALID_STATE',
}
