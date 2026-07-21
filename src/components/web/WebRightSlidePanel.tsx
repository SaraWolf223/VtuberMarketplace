import type { ReactNode } from 'react';
import type { WebSlidePanel } from '@/stores/web-slide-panel-store';

type Props = {
  children: ReactNode;
  panel: WebSlidePanel;
  onClose: () => void;
  onSelectPanel: (panel: WebSlidePanel) => void;
};

/** Native / mobile web — no slide panel. */
export function WebRightSlidePanel({ children }: Props): React.JSX.Element {
  return <>{children}</>;
}
