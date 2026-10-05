'use client';

import { useAuthStore } from '@/stores/authStore';

import { useDeviceLogic } from '@/hooks/useDeviceLogic';

import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';
import { DeviceList } from '@/components/devices/DeviceList';

import { ShieldCheckIcon } from '@phosphor-icons/react';

export default function DevicesPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { devices, isLoading, handleRevoke } = useDeviceLogic();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <section className="min-h-screen bg-[#050505] flex flex-col">
      <Header />

      <div className="flex-1 flex">
        <Sidebar />

        <div className="flex-1 flex flex-col p-8 min-h-[calc(100vh-3.5rem)] overflow-y-auto max-w-5xl">
          <div className="border-b border-[#1b1b1b] pb-4 mb-6">
            <h1 className="text-xl font-bold tracking-tight text-white">
              <span>Hardware & Session Management</span>
            </h1>

            <p className="text-xs text-[#71717a] mt-1">
              <span>
                Monitor active Mac, Web, and Mobile instances authorized to stream your encrypted files.
              </span>
            </p>
          </div>

          <DeviceList
            devices={devices}
            isLoading={isLoading}
            onRevoke={handleRevoke}
          />
        </div>
      </div>
    </section>
  );
}
