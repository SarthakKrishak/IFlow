import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import * as Y from "yjs";
import SupabaseProvider from "y-supabase";
import { useEffect } from "react";

interface PageEditorProps {
  pageIndex: number;
  doc: Y.Doc;
  provider: SupabaseProvider;
  currentUser: { name: string; color: string };
  initialHtml: string;
  onUpdate: (index: number, html: string) => void;
  onFocus: (editor: Editor) => void;
}

export default function PageEditor({
  pageIndex,
  doc,
  provider,
  currentUser,
  initialHtml,
  onUpdate,
  onFocus,
}: PageEditorProps) {
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
        field: `page-${pageIndex}`,
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
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert focus:outline-none max-w-none w-full min-h-[800px]",
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(pageIndex, editor.getHTML());
    },
    onFocus: ({ editor }) => {
      onFocus(editor);
    },
  });

  // To set the initial active editor when the first page loads
  useEffect(() => {
    if (editor && pageIndex === 0 && !editor.isFocused) {
      // Just pass it up so toolbar has something by default
      onFocus(editor);
    }
  }, [editor, pageIndex, onFocus]);

  return (
    <div className="bg-surface-elevated shadow-md rounded-xl p-8 sm:p-12 md:p-16 min-h-[800px] border border-surface-border transition-all mb-8 w-full max-w-4xl mx-auto flex-shrink-0">
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
    </div>
  );
}
