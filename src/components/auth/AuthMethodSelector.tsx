import { useState, useEffect } from 'react';
import { Lock, Fingerprint, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBiometricName } from '@/services/biometric';
import type { BiometricType } from '@/services/biometric';

interface AuthMethodSelectorProps {
  biometricType: BiometricType;
  defaultMethod?: 'password' | 'biometric';
  onMethodChange: (method: 'password' | 'biometric') => void;
}

const LAST_METHOD_KEY = 'reflekt_last_auth_method';

export function AuthMethodSelector({
  biometricType,
  defaultMethod,
  onMethodChange,
}: AuthMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<
    'password' | 'biometric'
  >(() => {
    // Load last used method from localStorage
    if (defaultMethod) {
      return defaultMethod;
    }
    const lastMethod = localStorage.getItem(LAST_METHOD_KEY);
    return (lastMethod as 'password' | 'biometric') || 'biometric';
  });

  useEffect(() => {
    // Save selected method
    localStorage.setItem(LAST_METHOD_KEY, selectedMethod);
    onMethodChange(selectedMethod);
  }, [selectedMethod, onMethodChange]);

  const biometricName = getBiometricName(biometricType);
  const biometricIcon =
    biometricType === 'face' ? (
      <ShieldCheck className="w-4 h-4" />
    ) : (
      <Fingerprint className="w-4 h-4" />
    );

  return (
    <div className="flex gap-2 w-full mb-4">
      <Button
        variant={selectedMethod === 'biometric' ? 'default' : 'outline'}
        onClick={() => setSelectedMethod('biometric')}
        className="flex-1 h-11"
      >
        {biometricIcon}
        <span className="ml-2">{biometricName}</span>
      </Button>
      <Button
        variant={selectedMethod === 'password' ? 'default' : 'outline'}
        onClick={() => setSelectedMethod('password')}
        className="flex-1 h-11"
      >
        <Lock className="w-4 h-4" />
        <span className="ml-2">Password</span>
      </Button>
    </div>
  );
}
