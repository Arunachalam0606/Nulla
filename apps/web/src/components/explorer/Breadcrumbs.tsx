import type { BreadcrumbItem } from '@/stores/explorerStore';

import { CaretRightIcon, HardDriveIcon } from '@phosphor-icons/react';

interface BreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem, index: number) => void;
}

export const Breadcrumbs = (props: BreadcrumbsProps) => {
  const { breadcrumbs, onNavigate } = props;

  return (
    <section className="flex items-center gap-1.5 text-xs select-none">
      <div className="flex items-center gap-1.5 text-[#71717a]">
        <HardDriveIcon size={14} className="text-white" />
      </div>

      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={item.id ?? 'root'} className="flex items-center gap-1.5">
            {index > 0 && <CaretRightIcon size={12} className="text-[#444444]" />}

            <button
              onClick={() => onNavigate(item, index)}
              disabled={isLast}
              className={`hover:text-white transition-colors font-mono ${
                isLast ? 'text-white font-medium cursor-default' : 'text-[#888888] cursor-pointer'
              }`}
            >
              <span>{item.name}</span>
            </button>
          </div>
        );
      })}
    </section>
  );
};
