import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WikiEditor from "./WikiEditor";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const p = await prisma.page.findUnique({ where: { id: pageId } });
  return { title: p ? `${p.title} | Wiki` : "Page | Wiki" };
}

export default async function PageEditor({ params }: { params: Promise<{ notebookId: string; pageId: string }> }) {
  const { notebookId, pageId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      notebook: true,
    },
  });

  if (!page || page.notebookId !== notebookId) {
    return <div className="p-8">Page not found.</div>;
  }

  // Get Supabase URL and Anon Key from env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base overflow-hidden relative">
      {/* Top Nav */}
      <div className="h-14 border-b border-surface-border bg-surface-elevated flex items-center justify-between px-6 flex-shrink-0 z-10 relative">
        <div className="flex items-center gap-4">
          <Link href={`/wiki/${notebookId}`} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-base">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{page.notebook.title}</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-foreground">{page.title}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <WikiEditor 
          pageId={page.id} 
          initialContent={page.content || ""} 
          currentUser={{ id: session.user.id, name: session.user.displayName, color: session.user.avatarColor || "#5B5FEF" }}
          supabaseUrl={supabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
        />
      </div>
    </div>
  );
}
