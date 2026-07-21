import { create } from 'zustand';

type UiState = {
  toastMessage: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  toastMessage: null,
  showToast: (toastMessage) => set({ toastMessage }),
  clearToast: () => set({ toastMessage: null }),
}));
