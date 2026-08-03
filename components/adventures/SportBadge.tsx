import { sportMeta } from './sportMeta';
import type { AdventureSport } from '@/lib/adventures';

export function SportBadge({
  sportType,
  size = 'md',
  showLabel = true,
}: {
  sportType: AdventureSport;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  const { label, Icon, pill } = sportMeta(sportType);
  const pad = size === 'sm' ? 'px-2 py-0.5 gap-1' : 'px-2.5 py-1 gap-1.5';
  const icon = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <span className={`inline-flex items-center rounded-full text-xs font-medium ${pad} ${pill}`}>
      <Icon className={icon} aria-hidden="true" />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
