/**
 * Biometric detection service
 * Detects WebAuthn support and biometric type
 */

import { BiometricSupport, BiometricType } from './types';

/**
 * Check if biometric authentication is supported
 */
export async function checkBiometricSupport(): Promise<BiometricSupport> {
  // Check if WebAuthn is available
  if (
    !window.PublicKeyCredential ||
    !navigator.credentials ||
    !navigator.credentials.create
  ) {
    return {
      isAvailable: false,
      type: 'unknown',
    };
  }

  // Check if platform authenticator (biometric) is available
  try {
    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

    if (!available) {
      return {
        isAvailable: false,
        type: 'unknown',
      };
    }

    return {
      isAvailable: true,
      type: getBiometricType(),
      platformName: getPlatformName(),
    };
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return {
      isAvailable: false,
      type: 'unknown',
    };
  }
}

/**
 * Detect the biometric type based on user agent
 */
export function getBiometricType(): BiometricType {
  const ua = navigator.userAgent.toLowerCase();

  // iOS devices with Face ID (iPhone X and newer)
  if (
    /iphone|ipad|ipod/.test(ua) &&
    !/(iphone os (8|9|10|11)_|cpu os (8|9|10|11)_)/.test(ua)
  ) {
    return 'face';
  }

  // Android devices typically have fingerprint
  if (/android/.test(ua)) {
    return 'fingerprint';
  }

  // macOS - could be Touch ID or Face ID
  if (/mac os x/.test(ua)) {
    // Touch ID is more common on MacBooks
    return 'fingerprint';
  }

  // Windows Hello - could be face, fingerprint, or iris
  if (/windows/.test(ua)) {
    return 'face'; // Default to face for Windows Hello
  }

  return 'unknown';
}

/**
 * Get platform name for display
 */
export function getPlatformName(): string {
  const ua = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return 'Face ID or Touch ID';
  }

  if (/android/.test(ua)) {
    return 'Fingerprint';
  }

  if (/mac os x/.test(ua)) {
    return 'Touch ID';
  }

  if (/windows/.test(ua)) {
    return 'Windows Hello';
  }

  return 'Biometric';
}

/**
 * Get friendly biometric name for UI
 */
export function getBiometricName(type: BiometricType): string {
  switch (type) {
    case 'fingerprint':
      return 'Fingerprint';
    case 'face':
      return 'Face ID';
    case 'unknown':
      return 'Biometric';
  }
}
