import { create } from 'zustand';

export type WebSlidePanel = 'profile' | 'activity';

type WebSlidePanelState = {
  panel: WebSlidePanel | null;
  open: (panel: WebSlidePanel) => void;
  close: () => void;
};

export const useWebSlidePanelStore = create<WebSlidePanelState>((set) => ({
  panel: null,
  open: (panel) => set({ panel }),
  close: () => set({ panel: null }),
}));
