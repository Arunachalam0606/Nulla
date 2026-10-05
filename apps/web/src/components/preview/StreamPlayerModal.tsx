import { MediaPreviewModal } from '@/components/explorer/MediaPreviewModal';
import type { DecryptedNode } from '@/schemas/node';

export interface StreamPlayerModalProps {
  node: DecryptedNode | null;
  onClose: () => void;
}

export const StreamPlayerModal = (props: StreamPlayerModalProps) => {
  return <MediaPreviewModal node={props.node} onClose={props.onClose} />;
};
