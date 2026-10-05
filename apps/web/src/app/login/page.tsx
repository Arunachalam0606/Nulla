'use client';

import { Suspense } from 'react';
import Link from 'next/link';

import { useLoginLogic } from '@/hooks/useLoginLogic';

import {
  ShieldCheckIcon,
  CircleNotchIcon,
  ArrowRightIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react';

function LoginContent() {
  const {
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
  } = useLoginLogic();

  return (
    <section className="min-h-screen bg-[#fbfbfd] dark:bg-[#161618] flex flex-col justify-between p-6 transition-colors">
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-base font-bold tracking-widest text-neutral-900 dark:text-white">
            NULLA
          </span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-mono bg-neutral-200/60 dark:bg-white/5 border border-black/5 dark:border-white/10 px-3 py-1 rounded-full">
          <ShieldCheckIcon size={14} className="text-emerald-500" />

          <span>Zero-Knowledge Vault</span>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 p-8 rounded-2xl shadow-xl shadow-black/5 my-8">
        {resetToken ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                <span>Set New Vault Password</span>
              </h1>

              <p className="text-xs text-neutral-500">
                <span>Enter your new master passphrase to re-encrypt your authentication key.</span>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
                <span>{error}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 bg-neutral-100 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-2">
                <CircleNotchIcon size={14} className="animate-spin" />

                <span>{statusMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-500">
                  <span>New Password</span>
                </label>

                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong passphrase..."
                  className="bg-neutral-100 dark:bg-[#141416] border border-black/5 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs py-2.5 rounded-full hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <CircleNotchIcon size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Update Password</span>

                    <ArrowRightIcon size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : isForgot ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleForgot}
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeftIcon size={16} />
              </button>

              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                <span>Reset Password</span>
              </h1>
            </div>

            <p className="text-xs text-neutral-500 -mt-3">
              <span>Enter your email to receive a password reset token via Resend.</span>
            </p>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircleIcon size={16} className="shrink-0" />

                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-500">
                  <span>Email Address</span>
                </label>

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@nulla.app"
                  className="bg-neutral-100 dark:bg-[#141416] border border-black/5 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs py-2.5 rounded-full hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <CircleNotchIcon size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Send Reset Email</span>

                    <ArrowRightIcon size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                <span>{isRegister ? 'Create Your Vault' : 'Sign In'}</span>
              </h1>

              <p className="text-xs text-neutral-500">
                <span>
                  {isRegister
                    ? 'Your files are encrypted on your device. Only you possess the decryption key.'
                    : 'Enter your account details to unlock your encrypted drive.'}
                </span>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircleIcon size={16} className="shrink-0" />

                <span>{successMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 bg-neutral-100 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-2">
                <CircleNotchIcon size={14} className="animate-spin" />

                <span>{statusMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-500">
                  <span>Email Address</span>
                </label>

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@nulla.app"
                  className="bg-neutral-100 dark:bg-[#141416] border border-black/5 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-neutral-500">
                    <span>Password</span>
                  </label>

                  {isRegister ? (
                    <button
                      type="button"
                      onClick={handleGenerateKey}
                      className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-mono"
                    >
                      <KeyIcon size={12} />

                      <span>Generate Strong Password</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleToggleForgot}
                      className="text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      <span>Forgot password?</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full bg-neutral-100 dark:bg-[#141416] border border-black/5 dark:border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all font-mono"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  >
                    {showPassword ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
                  </button>
                </div>

                {passwordNotice && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    <span>{passwordNotice}</span>
                  </p>
                )}
              </div>

              {isRegister && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-neutral-500">
                    <span>Device Name</span>
                  </label>

                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="MacBook Pro"
                    className="bg-neutral-100 dark:bg-[#141416] border border-black/5 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs py-2.5 rounded-full hover:opacity-90 transition-all disabled:opacity-50"
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

            <div className="pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
              <span className="text-neutral-500">
                {isRegister ? 'Already have an account?' : 'Need a new vault?'}
              </span>

              <button
                type="button"
                onClick={handleToggleMode}
                className="text-neutral-900 dark:text-white font-medium hover:underline"
              >
                <span>{isRegister ? 'Sign In' : 'Create Vault'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-neutral-400 font-mono">
        <span>Protected by Nulla Zero-Knowledge Architecture</span>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#161618] flex items-center justify-center">
          <CircleNotchIcon size={24} className="animate-spin text-neutral-500" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
