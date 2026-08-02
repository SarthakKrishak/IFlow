"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import * as Y from "yjs";
import SupabaseProvider from "y-supabase";
import { createClient } from "@supabase/supabase-js";
import { updateNotebookContent } from "@/server/actions/wiki.actions";
import Toolbar from "./Toolbar";
import PageEditor from "./PageEditor";
import { Plus } from "lucide-react";
import { type Editor } from "@tiptap/react";

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
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  
  // We use pageIds to robustly map pages and handle deletions without shifting indexes
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [initialHtmlArray, setInitialHtmlArray] = useState<Record<string, string>>({});
  const latestHtmlRef = useRef<Record<string, string>>({});

  // Parse initial content
  useEffect(() => {
    try {
      if (initialContent.trim().startsWith("[")) {
        const parsed = JSON.parse(initialContent);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Map array to initial page IDs based on legacy parsing
          const initialIds = parsed.map((_, i) => `page-${i}`);
          const htmlMap: Record<string, string> = {};
          parsed.forEach((html, i) => htmlMap[`page-${i}`] = html);
          
          setInitialHtmlArray(htmlMap);
          latestHtmlRef.current = htmlMap;
          return;
        } else if (typeof parsed === "object") {
          // Already in the new format (Record<string, string>)
          setInitialHtmlArray(parsed);
          latestHtmlRef.current = parsed;
          return;
        }
      } else if (initialContent.trim().startsWith("{")) {
        const parsed = JSON.parse(initialContent);
        setInitialHtmlArray(parsed);
        latestHtmlRef.current = parsed;
        return;
      }
    } catch (e) {
      // Fallback
    }
    
    const fallback = { "page-0": initialContent || "" };
    setInitialHtmlArray(fallback);
    latestHtmlRef.current = fallback;
  }, [initialContent]);

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

    // Sync page ids
    const metadata = doc.getMap("metadata");
    const syncPageIds = () => {
      let ids = metadata.get("pageIds") as string[];
      if (!ids || ids.length === 0) {
        // Migration from pageCount or initial setup
        const count = (metadata.get("pageCount") as number) || Math.max(1, Object.keys(latestHtmlRef.current).length);
        ids = Array.from({ length: count }).map((_, i) => `page-${i}`);
        metadata.set("pageIds", ids);
      }
      setPageIds([...ids]);
    };

    metadata.observe(syncPageIds);
    // Call once initially
    syncPageIds();

    return () => {
      metadata.unobserve(syncPageIds);
      provider.destroy();
      doc.destroy();
    };
  }, [notebookId, supabaseUrl, supabaseAnonKey]);

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

  const handleUpdate = useCallback((pageId: string, html: string) => {
    latestHtmlRef.current = {
      ...latestHtmlRef.current,
      [pageId]: html
    };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateNotebookContent(notebookId, JSON.stringify(latestHtmlRef.current));
    }, 2000);
  }, [notebookId]);

  const handleAddPage = () => {
    if (!setup || pageIds.length >= 5) return;
    const metadata = setup.doc.getMap("metadata");
    const newId = `page-${Date.now()}`;
    metadata.set("pageIds", [...pageIds, newId]);
  };

  const handleDeletePage = (pageId: string) => {
    if (!setup || pageIds.length <= 1) return;
    const metadata = setup.doc.getMap("metadata");
    const newPageIds = pageIds.filter(id => id !== pageId);
    metadata.set("pageIds", newPageIds);
    
    // Also remove it from local HTML cache
    const updatedHtml = { ...latestHtmlRef.current };
    delete updatedHtml[pageId];
    latestHtmlRef.current = updatedHtml;
    
    updateNotebookContent(notebookId, JSON.stringify(updatedHtml));
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return <div className="p-8 text-red-500">Missing Supabase credentials in environment.</div>;
  }

  return (
    <div className="h-full flex flex-col relative bg-surface-base">
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 custom-scrollbar">
        {activeEditor && <Toolbar editor={activeEditor} />}
        
        <div className="flex flex-col pb-32 items-center">
          {setup ? (
            pageIds.map((pageId, i) => (
              <PageEditor
                key={pageId}
                pageId={pageId}
                isFirst={i === 0}
                doc={setup.doc}
                provider={setup.provider}
                currentUser={currentUser}
                initialHtml={initialHtmlArray[pageId] || ""}
                onUpdate={handleUpdate}
                onFocus={setActiveEditor}
                onDelete={handleDeletePage}
              />
            ))
          ) : (
            // Loading skeleton
            <div className="bg-surface-elevated shadow-md rounded-xl p-8 sm:p-12 md:p-16 min-h-[800px] border border-surface-border animate-pulse flex flex-col gap-4 w-full max-w-4xl mx-auto">
              <div className="h-10 bg-surface-base rounded w-1/3"></div>
              <div className="h-4 bg-surface-base rounded w-full"></div>
              <div className="h-4 bg-surface-base rounded w-5/6"></div>
              <div className="h-4 bg-surface-base rounded w-4/6"></div>
            </div>
          )}

          {setup && (
            <button
              onClick={handleAddPage}
              disabled={pageIds.length >= 5}
              className={`mt-4 flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-dashed border-surface-border font-medium transition-all w-full max-w-4xl ${
                pageIds.length >= 5 
                  ? "text-muted-foreground opacity-50 cursor-not-allowed" 
                  : "text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 bg-surface-elevated"
              }`}
            >
              <Plus size={18} />
              {pageIds.length >= 5 ? "Maximum of 5 pages reached" : "Add Page"}
            </button>
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
