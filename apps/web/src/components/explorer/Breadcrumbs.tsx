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
      <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
        <HardDriveIcon size={15} className="text-neutral-900 dark:text-white" />
      </div>

      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={item.id ?? 'root'} className="flex items-center gap-1.5">
            {index > 0 && <CaretRightIcon size={12} className="text-neutral-400 dark:text-neutral-600" />}

            <button
              onClick={() => onNavigate(item, index)}
              disabled={isLast}
              className={`hover:text-neutral-900 dark:hover:text-white transition-colors font-mono ${
                isLast
                  ? 'text-neutral-900 dark:text-white font-semibold cursor-default'
                  : 'text-neutral-500 dark:text-neutral-400 cursor-pointer'
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
