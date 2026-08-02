"use client";

import { type Editor } from "@tiptap/react";
import { Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Undo, Redo, Eraser } from "lucide-react";

export default function Toolbar({ editor }: { editor: Editor }) {
  if (!editor) return null;

  return (
    <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-sm px-4 py-2 flex flex-wrap items-center gap-2 sticky top-4 z-40 mx-auto max-w-3xl justify-center mb-6 backdrop-blur-sm bg-surface-elevated/90">
      
      {/* Undo / Redo */}
      <div className="flex items-center gap-1 border-r border-surface-border pr-2 mr-1">
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-base hover:text-foreground disabled:opacity-30 transition-colors"
          title="Undo"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-base hover:text-foreground disabled:opacity-30 transition-colors"
          title="Redo"
        >
          <Redo size={16} />
        </button>
      </div>

      {/* Headings */}
      <div className="flex items-center gap-1 border-r border-surface-border pr-2 mr-1">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded-lg transition-colors ${
            editor.isActive("heading", { level: 1 }) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-base hover:text-foreground"
          }`}
          title="Heading 1"
        >
          <Heading1 size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded-lg transition-colors ${
            editor.isActive("heading", { level: 2 }) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-base hover:text-foreground"
          }`}
          title="Heading 2"
        >
          <Heading2 size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded-lg transition-colors ${
            editor.isActive("heading", { level: 3 }) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-base hover:text-foreground"
          }`}
          title="Heading 3"
        >
          <Heading3 size={18} />
        </button>
      </div>

      {/* Formatting */}
      <div className="flex items-center gap-1 border-r border-surface-border pr-2 mr-1">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg transition-colors ${
            editor.isActive("bold") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-base hover:text-foreground"
          }`}
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg transition-colors ${
            editor.isActive("italic") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-base hover:text-foreground"
          }`}
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded-lg transition-colors ${
            editor.isActive("strike") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-base hover:text-foreground"
          }`}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </button>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-1 border-r border-surface-border pr-2 mr-1">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg transition-colors ${
            editor.isActive("bulletList") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-base hover:text-foreground"
          }`}
          title="Bullet List"
        >
          <List size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-lg transition-colors ${
            editor.isActive("orderedList") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-base hover:text-foreground"
          }`}
          title="Ordered List"
        >
          <ListOrdered size={18} />
        </button>
      </div>
      
      {/* Clear Formatting */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-base hover:text-red-500 transition-colors"
          title="Clear Formatting"
        >
          <Eraser size={18} />
        </button>
      </div>

    </div>
  );
}
