"use client";

import { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import * as Y from "yjs";
import SupabaseProvider from "y-supabase";
import { createClient } from "@supabase/supabase-js";
import { updateNotebookContent } from "@/server/actions/wiki.actions";
import Toolbar from "./Toolbar";

interface WikiEditorProps {
  notebookId: string;
  initialContent: string;
  currentUser: { id: string; name: string; color: string };
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function WikiEditor({
  notebookId,
  initialContent,
  currentUser,
  supabaseUrl,
  supabaseAnonKey,
}: WikiEditorProps) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [setup, setSetup] = useState<{ doc: Y.Doc; provider: SupabaseProvider } | null>(null);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey || typeof window === "undefined") return;
    
    const doc = new Y.Doc();
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const provider = new SupabaseProvider(doc, supabase, {
      channel: `wiki-notebook-${notebookId}`,
      id: notebookId,
      tableName: "realtime_doc_store",
      columnName: "doc",
      resyncInterval: 0,
    });

    setSetup({ doc, provider });

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [notebookId, supabaseUrl, supabaseAnonKey]);

  const editor = useEditor({
    extensions: [
      (StarterKit as any).configure({
        history: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      ...(setup ? [
        Collaboration.configure({
          document: setup.doc,
        }),
        CollaborationCursor.configure({
          provider: setup.provider,
          user: {
            name: currentUser.name,
            color: currentUser.color,
          },
        }),
      ] : []),
    ],
    content: initialContent, // Only used if no Yjs history exists
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none w-full min-h-[500px]",
      },
    },
    onUpdate: ({ editor }) => {
      // Debounce saving the HTML to our Postgres DB
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        updateNotebookContent(notebookId, editor.getHTML());
      }, 2000);
    },
  });

  useEffect(() => {
    if (!setup) return;
    
    const handleStatus = (event: any) => {
      setStatus(event.status || "disconnected");
    };

    setup.provider.on("status", handleStatus);
    
    return () => {
      setup.provider.off("status", handleStatus);
    };
  }, [setup]);

  if (!supabaseUrl || !supabaseAnonKey) {
    return <div className="p-8 text-red-500">Missing Supabase credentials in environment.</div>;
  }

  return (
    <div className="h-full flex flex-col relative bg-[#f3f4f6] dark:bg-[#1f2023]">
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 custom-scrollbar">
        {editor && <Toolbar editor={editor} />}
        
        <div className="max-w-4xl mx-auto pb-32">
          {editor ? (
            <div className="bg-white dark:bg-[#2b2c31] shadow-md rounded-xl p-8 sm:p-12 md:p-16 min-h-[800px] border border-black/5 dark:border-white/5 transition-all">
              <EditorContent editor={editor} />
            </div>
          ) : (
            <div className="bg-white dark:bg-[#2b2c31] shadow-md rounded-xl p-8 sm:p-12 md:p-16 min-h-[800px] border border-black/5 dark:border-white/5 animate-pulse flex flex-col gap-4">
              <div className="h-10 bg-surface-elevated rounded w-1/3"></div>
              <div className="h-4 bg-surface-elevated rounded w-full"></div>
              <div className="h-4 bg-surface-elevated rounded w-5/6"></div>
              <div className="h-4 bg-surface-elevated rounded w-4/6"></div>
            </div>
          )}
        </div>
      </div>
      
      {/* Collaboration Status Bar */}
      <div className="absolute bottom-4 right-6 flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-surface-elevated border border-surface-border shadow-sm">
        <div className={`w-2 h-2 rounded-full ${
          status === "connected" ? "bg-emerald-500 animate-pulse" : 
          status === "connecting" ? "bg-amber-500 animate-pulse" : "bg-red-500"
        }`} />
        <span className="text-muted-foreground capitalize">{status}</span>
      </div>
      
      {/* CSS for Cursors */}
      <style dangerouslySetInnerHTML={{__html: `
        .collaboration-cursor__caret {
          border-left: 2px solid;
          border-right: 2px solid;
          margin-left: -2px;
          margin-right: -2px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }
        .collaboration-cursor__label {
          border-radius: 4px 4px 4px 0;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          left: -2px;
          line-height: normal;
          padding: 2px 6px;
          position: absolute;
          top: -1.8em;
          user-select: none;
          white-space: nowrap;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9CA3AF;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}} />
    </div>
  );
}
