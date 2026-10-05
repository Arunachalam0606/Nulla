'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { deriveKeys, generateSalt } from '@nulla/crypto';

import { useAuthStore } from '@/stores/authStore';

import { fetchUserSalt, loginAccount, registerAccount } from '@/lib/api';

import {
  ShieldCheckIcon,
  CircleNotchIcon,
  ArrowRightIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@phosphor-icons/react';

const RECOVERY_WORDS = [
  'alpha', 'anchor', 'beacon', 'breeze', 'canyon', 'cedar', 'cloud', 'delta',
  'ember', 'falcon', 'forest', 'frost', 'galaxy', 'glacier', 'harbor', 'haven',
  'island', 'jasper', 'jungle', 'karma', 'lunar', 'meadow', 'meteor', 'nebula',
  'oasis', 'ocean', 'orbit', 'peak', 'prism', 'quartz', 'river', 'shadow',
  'silver', 'solar', 'spark', 'summit', 'timber', 'valley', 'vortex', 'zenith'
];

function generate12WordPhrase(): string {
  const words: string[] = [];
  const randomValues = new Uint8Array(12);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < 12; i++) {
    words.push(RECOVERY_WORDS[randomValues[i] % RECOVERY_WORDS.length]);
  }

  return words.join(' ');
}

export default function LoginPage() {
  const router = useRouter();

  const setAuth = useAuthStore((state) => state.setAuth);

  const defaultEmail = '';
  const defaultPassword = '';
  const defaultDeviceName = 'Mac Client';
  const defaultIsRegister = false;
  const defaultIsSubmitting = false;
  const defaultShowPassword = false;
  const defaultStatusMessage = '';
  const defaultError = '';

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [deviceName, setDeviceName] = useState(defaultDeviceName);
  const [isRegister, setIsRegister] = useState(defaultIsRegister);
  const [isSubmitting, setIsSubmitting] = useState(defaultIsSubmitting);
  const [showPassword, setShowPassword] = useState(defaultShowPassword);
  const [statusMessage, setStatusMessage] = useState(defaultStatusMessage);
  const [error, setError] = useState(defaultError);

  const handleToggleMode = () => {
    setIsRegister(!isRegister);
    setError(defaultError);
    setStatusMessage(defaultStatusMessage);
  };

  const handleGenerateKey = () => {
    const phrase = generate12WordPhrase();
    setPassword(phrase);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <section className="min-h-screen bg-[#050505] flex flex-col justify-between p-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tracking-widest text-white">NULLA</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-[#71717a] font-mono border border-[#1f1f1f] bg-[#0b0b0b] px-3 py-1.5 rounded-md">
          <ShieldCheckIcon size={14} className="text-[#10b981]" />

          <span>Zero-Knowledge Encryption</span>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto bg-[#0a0a0a] border border-[#1f1f1f] p-8 rounded-2xl shadow-2xl my-8">
        <div className="flex flex-col gap-1 mb-8">
          <h1 className="text-xl font-bold tracking-tight text-white">
            <span>{isRegister ? 'Create Your Vault' : 'Sign In'}</span>
          </h1>

          <p className="text-xs text-[#71717a]">
            <span>
              {isRegister
                ? 'Your files are encrypted on your device. Only you possess the decryption key.'
                : 'Enter your account details to unlock your encrypted drive.'}
            </span>
          </p>
        </div>

        {error && (
          <div className="p-3 mb-6 bg-red-950/30 border border-red-900/50 rounded-lg text-xs text-red-400">
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 mb-6 bg-[#111111] border border-[#222222] rounded-lg text-xs text-emerald-400 font-mono flex items-center gap-2">
            <CircleNotchIcon size={14} className="animate-spin" />

            <span>{statusMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-[#888888]">
              <span>Email Address</span>
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@nulla.app"
              className="bg-[#121212] border border-[#222222] rounded-lg px-3.5 py-2 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#888888]">
                <span>Password</span>
              </label>

              {isRegister && (
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors font-mono"
                >
                  <KeyIcon size={12} />

                  <span>Generate Secure Key</span>
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password or 12-word key..."
                className="w-full bg-[#121212] border border-[#222222] rounded-lg px-3.5 py-2 pr-10 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition-colors font-mono"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
              >
                {showPassword ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#888888]">
                <span>Device Name</span>
              </label>

              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="MacBook Pro"
                className="bg-[#121212] border border-[#222222] rounded-lg px-3.5 py-2 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition-colors"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 flex items-center justify-center gap-2 bg-white text-black font-semibold text-xs py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <CircleNotchIcon size={16} className="animate-spin" />
            ) : (
              <>
                <span>{isRegister ? 'Create Vault' : 'Sign In'}</span>

                <ArrowRightIcon size={14} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#181818] flex items-center justify-between text-xs">
          <span className="text-[#666666]">
            {isRegister ? 'Already have an account?' : 'Need a new vault?'}
          </span>

          <button
            type="button"
            onClick={handleToggleMode}
            className="text-white hover:underline underline-offset-2 font-medium"
          >
            <span>{isRegister ? 'Sign In' : 'Create Vault'}</span>
          </button>
        </div>
      </div>

      <div className="text-center text-[11px] text-[#555555] font-mono">
        <span>Protected by Nulla Zero-Knowledge Architecture</span>
      </div>
    </section>
  );
}
