"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import * as Y from "yjs";
import SupabaseProvider from "y-supabase";
import { useEffect, useState } from "react";

import { Trash2 } from "lucide-react";

interface PageEditorProps {
  pageId: string;
  isFirst: boolean;
  doc: Y.Doc;
  provider: SupabaseProvider;
  currentUser: { name: string; color: string };
  initialHtml: string;
  onUpdate: (pageId: string, html: string) => void;
  onFocus: (editor: Editor) => void;
  onDelete: (pageId: string) => void;
}

export default function PageEditor({
  pageId,
  isFirst,
  doc,
  provider,
  currentUser,
  initialHtml,
  onUpdate,
  onFocus,
  onDelete,
}: PageEditorProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const editor = useEditor({
    extensions: [
      (StarterKit as any).configure({
        history: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Collaboration.configure({
        document: doc,
        field: pageId,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: currentUser.name,
          color: currentUser.color,
        },
      }),
    ],
    content: initialHtml, // Only used if no Yjs history exists
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none w-full min-h-[800px]",
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(pageId, editor.getHTML());
    },
    onFocus: ({ editor }) => {
      onFocus(editor);
    },
  });

  // To set the initial active editor when the first page loads
  useEffect(() => {
    if (editor && isFirst && !editor.isFocused) {
      // Just pass it up so toolbar has something by default
      onFocus(editor);
    }
  }, [editor, isFirst, onFocus]);

  const handleDelete = () => {
    if (!editor) return;
    const text = editor.getText().trim();
    if (text.length > 0) {
      setShowDeleteDialog(true);
    } else {
      onDelete(pageId);
    }
  };

  const confirmDelete = () => {
    setShowDeleteDialog(false);
    onDelete(pageId);
  };

  return (
    <div className="bg-surface-elevated shadow-md rounded-xl p-8 sm:p-12 md:p-16 min-h-[800px] border border-surface-border transition-all mb-8 w-full max-w-4xl mx-auto flex-shrink-0 relative group">
      
      {!isFirst && (
        <button 
          onClick={handleDelete}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete Page"
        >
          <Trash2 size={18} />
        </button>
      )}

      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-10 bg-surface-base rounded w-1/3"></div>
          <div className="h-4 bg-surface-base rounded w-full"></div>
          <div className="h-4 bg-surface-base rounded w-5/6"></div>
          <div className="h-4 bg-surface-base rounded w-4/6"></div>
        </div>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Page?</h3>
            <p className="text-text-secondary text-sm mb-6">
              This page has content. Are you sure you want to delete it? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
