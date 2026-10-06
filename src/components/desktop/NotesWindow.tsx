"use client";

import { useNoteStore } from "@/stores/noteStore";
import { useWindowStore } from "@/stores/windowStore";
import { PlusIcon, TrashIcon } from "./icons";

/** 便签内容：黄色纸质感 + 横格线，内容写入 localStorage，支持多张（左上角 + 号新建） */
export default function NotesWindow({ noteId }: { noteId: string }) {
  const note = useNoteStore((s) => s.notes.find((n) => n.id === noteId));
  const update = useNoteStore((s) => s.update);
  const create = useNoteStore((s) => s.create);
  const remove = useNoteStore((s) => s.remove);
  const openNote = useWindowStore((s) => s.openNote);

  const addNote = () => {
    const n = create();
    openNote(n.id);
  };

  const deleteNote = () => {
    const s = useWindowStore.getState();
    const w = s.windows.find((x) => x.noteId === noteId);
    if (w) s.close(w.id);
    remove(noteId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ background: "#fdf6d3" }}>
      {/* 顶部工具条：左上角 + 号 */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-amber-900/10 px-2.5 py-1.5">
        <button
          type="button"
          aria-label="新建便签"
          title="新建便签"
          onClick={addNote}
          className="grid h-6 w-6 place-items-center rounded-md text-amber-900/70 transition-colors hover:bg-amber-900/10"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] tracking-wide text-amber-900/45">
          便签 · {noteId.slice(-4)}
        </span>
        <button
          type="button"
          aria-label="删除便签"
          title="删除便签"
          onClick={deleteNote}
          className="ml-auto grid h-6 w-6 place-items-center rounded-md text-amber-900/60 transition-colors hover:bg-amber-900/10"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 黄色纸：横格纹理 + 左侧装订线 */}
      <div
        className="relative min-h-0 flex-1"
        style={{
          backgroundColor: "#fdf6d3",
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent 0 27px, rgba(180,140,60,0.22) 27px 28px)",
        }}
      >
        <div className="pointer-events-none absolute top-0 bottom-0 left-6 w-px bg-rose-400/35" />
        <textarea
          value={note?.content ?? ""}
          onChange={(e) => update(noteId, e.target.value)}
          placeholder="写点什么…"
          spellCheck={false}
          className="no-scrollbar h-full w-full resize-none bg-transparent py-1 pr-4 pl-8 text-[13px] leading-7 text-amber-950/90 outline-none placeholder:text-amber-900/30"
        />
      </div>
    </div>
  );
}