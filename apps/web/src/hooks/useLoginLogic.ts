import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { deriveKeys, generateSalt } from '@nulla/crypto';

import { useAuthStore } from '@/stores/authStore';

import {
  fetchUserSalt,
  loginAccount,
  registerAccount,
  requestPasswordReset,
  completePasswordReset,
} from '@/lib/api';

function generateStrongPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]';
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

export const useLoginLogic = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setAuth = useAuthStore((state) => state.setAuth);

  const defaultEmail = '';
  const defaultPassword = '';
  const defaultNewPassword = '';
  const defaultDeviceName = 'Mac Client';
  const defaultIsRegister = false;
  const defaultIsForgot = false;
  const defaultIsSubmitting = false;
  const defaultShowPassword = false;
  const defaultStatusMessage = '';
  const defaultSuccessMessage = '';
  const defaultError = '';
  const defaultPasswordNotice = '';

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [newPassword, setNewPassword] = useState(defaultNewPassword);
  const [deviceName, setDeviceName] = useState(defaultDeviceName);
  const [isRegister, setIsRegister] = useState(defaultIsRegister);
  const [isForgot, setIsForgot] = useState(defaultIsForgot);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(defaultIsSubmitting);
  const [showPassword, setShowPassword] = useState(defaultShowPassword);
  const [statusMessage, setStatusMessage] = useState(defaultStatusMessage);
  const [successMessage, setSuccessMessage] = useState(defaultSuccessMessage);
  const [error, setError] = useState(defaultError);
  const [passwordNotice, setPasswordNotice] = useState(defaultPasswordNotice);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('reset_token');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleToggleMode = () => {
    setIsRegister(!isRegister);
    setIsForgot(false);
    setError(defaultError);
    setStatusMessage(defaultStatusMessage);
    setSuccessMessage(defaultSuccessMessage);
    setPasswordNotice(defaultPasswordNotice);
  };

  const handleToggleForgot = () => {
    setIsForgot(!isForgot);
    setIsRegister(false);
    setError(defaultError);
    setStatusMessage(defaultStatusMessage);
    setSuccessMessage(defaultSuccessMessage);
    setPasswordNotice(defaultPasswordNotice);
  };

  const handleGenerateKey = () => {
    const strongPassword = generateStrongPassword();
    setPassword(strongPassword);
    setShowPassword(true);
    setPasswordNotice('Make sure you save this password in your password manager.');
  };

  const handleForgotPasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      setError('Please provide your account email address');
      return;
    }

    setIsSubmitting(true);
    setError(defaultError);
    setSuccessMessage(defaultSuccessMessage);

    try {
      const response = await requestPasswordReset(email);
      setSuccessMessage(response.message || 'Check your email for the reset instructions.');
      if (response.reset_token) {
        setResetToken(response.reset_token);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to request password reset';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetToken || !newPassword) {
      setError('Please enter a new password');
      return;
    }

    setIsSubmitting(true);
    setError(defaultError);

    try {
      setStatusMessage('Deriving new vault credentials...');
      const salt = generateSalt();
      const keys = await deriveKeys(newPassword, salt);

      await completePasswordReset({
        token: resetToken,
        new_server_auth_key: keys.serverAuthKey,
        new_salt: salt,
      });

      setSuccessMessage('Password reset successfully. Sign in with your new password.');
      setResetToken(null);
      setIsForgot(false);
      setPassword(newPassword);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password reset failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
      setStatusMessage(defaultStatusMessage);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password');
      return;
    }

    setIsSubmitting(true);
    setError(defaultError);

    try {
      if (isRegister) {
        setStatusMessage('Generating cryptographic salt...');
        const salt = generateSalt();

        setStatusMessage('Deriving encryption key in memory...');
        const keys = await deriveKeys(password, salt);

        setStatusMessage('Creating encrypted account...');
        const response = await registerAccount({
          email,
          salt,
          server_auth_key: keys.serverAuthKey,
          device_name: deviceName || 'Mac Client',
          device_type: 'mac',
        });

        setAuth({
          user: response.user,
          token: response.token,
          masterKey: keys.masterKey,
          masterKeyRaw: keys.masterKeyRaw,
          masterKeyHex: keys.masterKeyHex,
        });

        router.push('/app');
      } else {
        setStatusMessage('Querying vault identity...');
        const saltData = await fetchUserSalt(email);

        setStatusMessage('Deriving encryption key in memory...');
        const keys = await deriveKeys(password, saltData.salt);

        setStatusMessage('Verifying credentials...');
        const response = await loginAccount({
          email,
          server_auth_key: keys.serverAuthKey,
          device_name: deviceName || 'Mac Client',
          device_type: 'mac',
        });

        setAuth({
          user: response.user,
          token: response.token,
          masterKey: keys.masterKey,
          masterKeyRaw: keys.masterKeyRaw,
          masterKeyHex: keys.masterKeyHex,
        });

        router.push('/app');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
      setStatusMessage(defaultStatusMessage);
    }
  };

  return {
    email,
    password,
    newPassword,
    deviceName,
    isRegister,
    isForgot,
    resetToken,
    isSubmitting,
    showPassword,
    statusMessage,
    successMessage,
    error,
    passwordNotice,
    setEmail,
    setPassword,
    setNewPassword,
    setDeviceName,
    setShowPassword,
    handleToggleMode,
    handleToggleForgot,
    handleGenerateKey,
    handleSubmit,
    handleForgotPasswordSubmit,
    handleResetPasswordSubmit,
  };
};
