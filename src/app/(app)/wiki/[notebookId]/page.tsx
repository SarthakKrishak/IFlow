import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WikiEditorWrapper from "./WikiEditorWrapper";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ notebookId: string }> }) {
  const { notebookId } = await params;
  const nb = await prisma.notebook.findUnique({ where: { id: notebookId } });
  return { title: nb ? `${nb.title} | Wiki` : "Notebook | Wiki" };
}

export default async function NotebookPage({ params }: { params: Promise<{ notebookId: string }> }) {
  const { notebookId } = await params;

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
  });

  if (!notebook) {
    return <div className="p-8 text-muted-foreground">Notebook not found.</div>;
  }

  // Get Supabase URL and Anon Key from env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const session = await auth();
  const userName = session?.user?.name || "Anonymous";
  const userId = session?.user?.id || "anon";
  
  // Generate a distinct cursor color based on username
  const colors = ["#5B5FEF", "#EC6A52", "#1EAE7C", "#D1495B", "#C79A3D", "#D9713C", "#7C3AED", "#059669"];
  const colorIndex = userName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const userColor = colors[colorIndex];

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base overflow-hidden relative">
      {/* Top Nav */}
      <div className="h-14 border-b border-surface-border bg-surface-elevated flex items-center justify-between px-6 flex-shrink-0 z-10 relative">
        <div className="flex items-center gap-4">
          <Link href={`/wiki`} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-base">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-foreground">{notebook.title}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <WikiEditorWrapper 
          notebookId={notebook.id} 
          initialContent={notebook.content || ""} 
          currentUser={{ id: userId, name: userName, color: userColor }}
          supabaseUrl={supabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
        />
      </div>
    </div>
  );
}
