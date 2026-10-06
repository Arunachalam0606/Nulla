'use client';

import { useState, useRef, use } from 'react';
import Link from 'next/link';

import { formatBytes } from '@/lib/utils';

import {
  UploadSimpleIcon,
  ShieldCheckIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  FolderOpenIcon,
} from '@phosphor-icons/react';

export interface FileRequestPageProps {
  params: Promise<{ token: string }>;
}

export default function FileRequestClient(props: FileRequestPageProps) {
  const { params } = props;
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const defaultIsUploading = false;
  const defaultProgress = 0;
  const defaultIsSuccess = false;
  const defaultFileName = '';
  const defaultFileSize = 0;
  const defaultError = '';

  const [isUploading, setIsUploading] = useState(defaultIsUploading);
  const [progress, setProgress] = useState(defaultProgress);
  const [isSuccess, setIsSuccess] = useState(defaultIsSuccess);
  const [fileName, setFileName] = useState(defaultFileName);
  const [fileSize, setFileSize] = useState(defaultFileSize);
  const [error, setError] = useState(defaultError);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      simulateDirectDropUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      simulateDirectDropUpload(e.dataTransfer.files[0]);
    }
  };

  const simulateDirectDropUpload = (file: File) => {
    setFileName(file.name);
    setFileSize(file.size);
    setIsUploading(true);
    setProgress(0);
    setError('');

    let current = 0;
    const interval = setInterval(() => {
      current += 15;
      if (current >= 100) {
        clearInterval(interval);
        setProgress(100);
        setIsUploading(false);
        setIsSuccess(true);
      } else {
        setProgress(current);
      }
    }, 200);
  };

  return (
    <section className="min-h-screen bg-[#050505] flex flex-col justify-between p-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="font-mono text-base font-bold text-white tracking-widest">
          <span>NULLA</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-[#71717a] font-mono border border-[#1f1f1f] bg-[#0b0b0b] px-3 py-1.5 rounded-md">
          <ShieldCheckIcon size={14} className="text-[#10b981]" />

          <span>Encrypted Vault Drop Target</span>
        </div>
      </div>

      <div className="max-w-lg w-full mx-auto bg-[#0a0a0a] border border-[#1f1f1f] p-8 rounded-2xl shadow-2xl my-8">
        <div className="flex flex-col gap-1 mb-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#141414] border border-[#222222] flex items-center justify-center text-white mx-auto mb-2">
            <FolderOpenIcon size={24} />
          </div>

          <h1 className="text-lg font-bold tracking-tight text-white">
            <span>Direct File Drop</span>
          </h1>

          <p className="text-xs text-[#71717a] max-w-sm mx-auto">
            <span>
              Upload large assets directly to this client vault. No account required. Files are ingested with 0 physical bytes on destination Macs.
            </span>
          </p>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-xl text-center">
            <CheckCircleIcon size={32} className="text-emerald-400" />

            <div>
              <span className="text-sm font-semibold text-white">{fileName}</span>

              <p className="text-xs text-emerald-400 mt-1">
                <span>Transferred successfully into the vault.</span>
              </p>
            </div>

            <button
              onClick={() => setIsSuccess(false)}
              className="mt-2 text-xs text-[#888888] hover:text-white underline underline-offset-2"
            >
              <span>Upload another file</span>
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={handleSelectFiles}
            className="border-2 border-dashed border-[#222222] hover:border-[#444444] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#080808]"
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <CircleNotchIcon size={28} className="animate-spin text-white" />

                <span className="text-xs font-mono text-white">
                  Uploading {fileName} ({formatBytes(fileSize)})...
                </span>

                <div className="w-full bg-[#1c1c1c] h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-white h-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <UploadSimpleIcon size={32} className="text-[#666666] mb-3" />

                <span className="text-xs font-semibold text-white">
                  Drag and drop files here, or browse
                </span>

                <span className="text-[11px] text-[#555555] mt-1 font-mono">
                  Supports multi-gigabyte video cuts, raw archives, and media
                </span>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-[#555555] font-mono">
        <span>Protected by Nulla Zero-Knowledge Architecture</span>
      </div>
    </section>
  );
}
