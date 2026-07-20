import { create } from "zustand";

interface UIState {
  // Board view
  activeBoardId: string | null;
  setActiveBoardId: (id: string | null) => void;

  // Ticket panel
  openTicketId: string | null;
  setOpenTicketId: (id: string | null) => void;
  closeTicketPanel: () => void;

  // Filters on dashboard
  filterDepartment: string;
  filterAssigneeId: string;
  filterPriority: string;
  filterLabel: string;
  setFilter: (key: keyof Pick<UIState, "filterDepartment" | "filterAssigneeId" | "filterPriority" | "filterLabel">, value: string) => void;
  clearFilters: () => void;

  // Create board dialog
  createBoardOpen: boolean;
  setCreateBoardOpen: (open: boolean) => void;

  // Create user dialog
  createUserOpen: boolean;
  setCreateUserOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeBoardId: null,
  setActiveBoardId: (id) => set({ activeBoardId: id }),

  openTicketId: null,
  setOpenTicketId: (id) => set({ openTicketId: id }),
  closeTicketPanel: () => set({ openTicketId: null }),

  filterDepartment: "all",
  filterAssigneeId: "all",
  filterPriority: "all",
  filterLabel: "all",
  setFilter: (key, value) => set({ [key]: value }),
  clearFilters: () =>
    set({
      filterDepartment: "all",
      filterAssigneeId: "all",
      filterPriority: "all",
      filterLabel: "all",
    }),

  createBoardOpen: false,
  setCreateBoardOpen: (open) => set({ createBoardOpen: open }),

  createUserOpen: false,
  setCreateUserOpen: (open) => set({ createUserOpen: open }),
}));
