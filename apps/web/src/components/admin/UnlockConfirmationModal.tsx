import {
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react';

interface UnlockConfirmationModalProps {
  isOpen: boolean;
  isCurrentlyUnlimited: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const UnlockConfirmationModal = (props: UnlockConfirmationModalProps) => {
  const {
    isOpen,
    isCurrentlyUnlimited,
    isLoading,
    onConfirm,
    onCancel,
  } = props;

  if (!isOpen) return null;

  const titleText = isCurrentlyUnlimited
    ? 'Re-enable 10 GB Free Tier Ceiling?'
    : 'Unlock Unlimited Storage Allocation?';

  const descriptionText = isCurrentlyUnlimited
    ? 'Enabling the 10 GB ceiling will restrict future quota expansions if the aggregate allocated storage across all accounts exceeds 10 GB.'
    : 'Disabling the 10 GB ceiling allows unlimited user quota assignments. Cloudflare R2 storage usage above 10 GB will accrue standard object storage costs.';

  const confirmButtonText = isCurrentlyUnlimited
    ? 'Enforce 10 GB Limit'
    : 'Confirm & Unlock Unlimited';

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0e0e0e] border border-[#242424] rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <WarningIcon size={22} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                <span>{titleText}</span>
              </h3>

              <span className="text-[11px] font-mono text-[#71717a]">
                Cloudflare D1 System Governance
              </span>
            </div>
          </div>

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-[#71717a] hover:text-white transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4 text-xs text-[#a1a1aa] leading-relaxed">
          <p>
            <span>{descriptionText}</span>
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-medium text-[#888888] hover:text-white transition-colors"
          >
            <span>Cancel</span>
          </button>

          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors"
          >
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
