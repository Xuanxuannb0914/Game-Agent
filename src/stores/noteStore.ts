import { create } from "zustand";

export interface Note {
  id: string;
  content: string;
  updatedAt: number;
}

const KEY = "ga:notes";

interface NoteStore {
  notes: Note[];
  hydrate: () => void;
  create: () => Note;
  update: (id: string, content: string) => void;
  remove: (id: string) => void;
}

function persist(notes: Note[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* 存储不可用时仅保留内存态 */
  }
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],

  hydrate: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) set({ notes: JSON.parse(raw) });
    } catch {
      /* 忽略损坏的本地数据 */
    }
  },

  create: () => {
    const note: Note = {
      id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      content: "",
      updatedAt: Date.now(),
    };
    const notes = [note, ...get().notes];
    persist(notes);
    set({ notes });
    return note;
  },

  update: (id, content) => {
    const notes = get().notes.map((n) =>
      n.id === id ? { ...n, content, updatedAt: Date.now() } : n,
    );
    persist(notes);
    set({ notes });
  },

  remove: (id) => {
    const notes = get().notes.filter((n) => n.id !== id);
    persist(notes);
    set({ notes });
  },
}));