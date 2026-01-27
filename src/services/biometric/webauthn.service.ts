/**
 * WebAuthn service for biometric authentication
 * Handles registration and authentication using platform authenticators
 */

import {
  BiometricRegistrationResult,
  BiometricAuthenticationResult,
  BiometricError,
  BiometricErrorCode,
} from './types';

const RP_NAME = 'Daily Journal';
const RP_ID = window.location.hostname;
const USER_ID = 'daily-journal-user'; // Single-user app
const USER_NAME = 'journal-user';
const USER_DISPLAY_NAME = 'Journal User';
const TIMEOUT = 60000; // 60 seconds

/**
 * Register a new biometric credential
 */
export async function registerBiometric(): Promise<BiometricRegistrationResult> {
  try {
    // Generate a random challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // User ID as Uint8Array
    const userIdBytes = new TextEncoder().encode(USER_ID);

    // Create credential options
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions =
      {
        challenge,
        rp: {
          name: RP_NAME,
          id: RP_ID,
        },
        user: {
          id: userIdBytes,
          name: USER_NAME,
          displayName: USER_DISPLAY_NAME,
        },
        pubKeyCredParams: [
          {
            type: 'public-key',
            alg: -7, // ES256 (ECDSA with SHA-256)
          },
          {
            type: 'public-key',
            alg: -257, // RS256 (RSA with SHA-256)
          },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Built-in biometric
          userVerification: 'required', // Require biometric verification
          requireResidentKey: false,
        },
        timeout: TIMEOUT,
        attestation: 'none', // Don't need attestation for this use case
      };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new BiometricError(
        'Failed to create credential',
        BiometricErrorCode.REGISTRATION_FAILED
      );
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      credentialId: arrayBufferToBase64(credential.rawId),
      publicKey: response.getPublicKey() || new ArrayBuffer(0),
      attestation: response.attestationObject,
    };
  } catch (error) {
    if (error instanceof BiometricError) {
      throw error;
    }

    // Handle specific WebAuthn errors
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new BiometricError(
          'Biometric registration was cancelled',
          BiometricErrorCode.USER_CANCELLED,
          error
        );
      }

      if (error.name === 'NotSupportedError') {
        throw new BiometricError(
          'Biometric authentication is not supported',
          BiometricErrorCode.NOT_SUPPORTED,
          error
        );
      }

      if (error.name === 'InvalidStateError') {
        throw new BiometricError(
          'A credential already exists',
          BiometricErrorCode.INVALID_STATE,
          error
        );
      }

      if (error.name === 'TimeoutError') {
        throw new BiometricError(
          'Biometric registration timed out',
          BiometricErrorCode.TIMEOUT,
          error
        );
      }
    }

    throw new BiometricError(
      'Failed to register biometric',
      BiometricErrorCode.REGISTRATION_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Authenticate using an existing biometric credential
 * @param credentialId The credential ID to authenticate with
 * @param prfSalt Optional salt for PRF extension - provides deterministic secret for key derivation
 */
export async function authenticateBiometric(
  credentialId: string,
  prfSalt?: Uint8Array
): Promise<BiometricAuthenticationResult> {
  try {
    // Generate a random challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // Decode credential ID
    const allowCredentials = [
      {
        type: 'public-key' as const,
        id: base64ToArrayBuffer(credentialId),
      },
    ];

    // Build extensions object with PRF if salt provided
    const extensions: AuthenticationExtensionsClientInputs = {};
    if (prfSalt) {
      // PRF extension for deterministic secret derivation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (extensions as any).prf = {
        eval: {
          first: prfSalt,
        },
      };
    }

    // Create authentication options
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions =
      {
        challenge,
        allowCredentials,
        timeout: TIMEOUT,
        userVerification: 'required', // Require biometric verification
        rpId: RP_ID,
        extensions,
      };

    const credential = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new BiometricError(
        'Failed to authenticate',
        BiometricErrorCode.AUTHENTICATION_FAILED
      );
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    // Extract PRF output if available
    const clientExtensions = credential.getClientExtensionResults();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prfResults = (clientExtensions as any).prf?.results;
    const prfOutput = prfResults?.first
      ? (prfResults.first as ArrayBuffer)
      : null;

    return {
      credentialId: arrayBufferToBase64(credential.rawId),
      signature: response.signature,
      authenticatorData: response.authenticatorData,
      clientDataJSON: response.clientDataJSON,
      prfOutput,
    };
  } catch (error) {
    if (error instanceof BiometricError) {
      throw error;
    }

    // Handle specific WebAuthn errors
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new BiometricError(
          'Biometric authentication was cancelled',
          BiometricErrorCode.USER_CANCELLED,
          error
        );
      }

      if (error.name === 'NotSupportedError') {
        throw new BiometricError(
          'Biometric authentication is not supported',
          BiometricErrorCode.NOT_SUPPORTED,
          error
        );
      }

      if (error.name === 'TimeoutError') {
        throw new BiometricError(
          'Biometric authentication timed out',
          BiometricErrorCode.TIMEOUT,
          error
        );
      }
    }

    throw new BiometricError(
      'Failed to authenticate with biometric',
      BiometricErrorCode.AUTHENTICATION_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if biometric is available on this device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (
    !window.PublicKeyCredential ||
    !navigator.credentials ||
    !navigator.credentials.create
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Check if PRF (Pseudo-Random Function) extension is supported
 * PRF is required for deterministic key derivation from WebAuthn
 * Without PRF, biometric unlock cannot work (signatures are non-deterministic)
 */
export async function isPrfSupported(): Promise<boolean> {
  if (!(await isBiometricAvailable())) {
    return false;
  }

  // Check browser support for PRF extension
  // Chrome 116+, Safari 17+, Edge 116+ support PRF
  const ua = navigator.userAgent;

  const chromeMatch = /Chrome\/(\d+)/.exec(ua);
  const edgeMatch = /Edg\/(\d+)/.exec(ua);
  const safariMatch = /Version\/(\d+).*Safari/.exec(ua);

  // Edge reports both Edge and Chrome in UA, check Edge first
  if (edgeMatch?.[1] && parseInt(edgeMatch[1], 10) >= 116) {
    return true;
  }

  // Check Chrome (but not Edge which also has Chrome in UA)
  if (chromeMatch?.[1] && !edgeMatch && parseInt(chromeMatch[1], 10) >= 116) {
    return true;
  }

  // Check Safari
  if (safariMatch?.[1] && parseInt(safariMatch[1], 10) >= 17) {
    return true;
  }

  return false;
}
