"use client";

import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Save, Trash2, KeyRound, Copy, Check, Search } from "lucide-react";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, IconButton, Input, Segmented, Textarea } from "@/components/ui";
import Link from "next/link";
import { toast } from "sonner";
import { saveEnvironmentVariable, deleteEnvironmentVariable, saveMultipleEnvironmentVariables } from "@/server/actions/environment.actions";

type Variable = {
  id: string;
  key: string;
  value: string;
};

export function EnvironmentDetailClient({
  environment,
  variables: initialVariables,
  isAdmin,
  canWrite = false,
}: {
  environment: any;
  variables: Variable[];
  isAdmin: boolean;
  canWrite?: boolean;
}) {
  const [variables, setVariables] = useState<Variable[]>(initialVariables);
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggleVisibility = (id: string) => {
    setVisibleValues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSaving(true);
    try {
      if (bulkMode) {
        if (!bulkText.trim()) return setIsSaving(false);
        const lines = bulkText.split('\n');
        const parsedVars: { key: string, value: string }[] = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const splitIdx = trimmed.indexOf('=');
          if (splitIdx === -1) continue;
          
          const key = trimmed.substring(0, splitIdx).trim();
          let value = trimmed.substring(splitIdx + 1).trim();
          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          if (key && value) {
            parsedVars.push({ key, value });
          }
        }

        if (parsedVars.length === 0) {
          toast.error("No valid variables found in .env format");
          setIsSaving(false);
          return;
        }

        const res = await saveMultipleEnvironmentVariables(environment.id, parsedVars);
        
        // Update local state by re-merging
        setVariables(prev => {
          let updated = [...prev];
          for (let i = 0; i < res.length; i++) {
            const serverVar = res[i];
            const rawValue = parsedVars[i].value;
            const existingIdx = updated.findIndex(v => v.key === serverVar.key);
            if (existingIdx >= 0) {
              updated[existingIdx] = { id: serverVar.id, key: serverVar.key, value: rawValue };
            } else {
              updated.push({ id: serverVar.id, key: serverVar.key, value: rawValue });
            }
          }
          return updated;
        });
        
        setBulkText("");
        setBulkMode(false);
        toast.success(`Imported ${parsedVars.length} variables successfully`);
      } else {
        if (!newKey.trim() || !newValue.trim()) return setIsSaving(false);
        const res = await saveEnvironmentVariable(environment.id, newKey.trim(), newValue.trim());
        setVariables(prev => {
          const existing = prev.findIndex(v => v.key === newKey.trim());
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { id: res.id, key: res.key, value: newValue.trim() }; // Use raw value for local state
            return updated;
          }
          return [...prev, { id: res.id, key: res.key, value: newValue.trim() }];
        });
        setNewKey("");
        setNewValue("");
        toast.success("Variable saved successfully");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save variable(s)");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEnvironmentVariable(id, environment.id);
      setVariables(prev => prev.filter(v => v.id !== id));
      toast.success("Deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete variable");
    }
  };

  // Copy the whole file as NAME=value lines for pasting into a .env
  const handleCopyEnv = async () => {
    if (variables.length === 0) {
      toast.error("Nothing to copy yet");
      return;
    }
    const text = variables.map(v => `${v.key}=${v.value}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts / older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success(`Copied ${variables.length} variables as NAME=value`);
    setTimeout(() => setCopied(false), 2000);
  };

  const visible = variables.filter((v) => v.key.toLowerCase().includes(query.trim().toLowerCase()));
  const deleteVar = variables.find((v) => v.id === deleteId);

  const copyValue = async (v: Variable) => {
    try {
      await navigator.clipboard.writeText(v.value);
      toast.success(`Copied ${v.key}`);
    } catch {
      toast.error("Couldn’t copy — your browser blocked clipboard access");
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
          <Link href="/environments" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} /> All environments
          </Link>

          <Card className="p-5 flex flex-wrap items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-foreground/[0.06] text-foreground flex items-center justify-center">
              <KeyRound size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground">{environment.name}</h1>
              <p className="text-[12.5px] text-muted-foreground">{environment.project.name}</p>
            </div>
            <Badge tone={canWrite ? "success" : "info"} dot>
              {canWrite ? "You can edit" : "Read only"}
            </Badge>
            <Badge>{variables.length} variable{variables.length === 1 ? "" : "s"}</Badge>
          </Card>

          {canWrite && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Add variables"
                description="Values are encrypted at rest."
                action={
                  <Segmented
                    value={bulkMode ? "bulk" : "single"}
                    onChange={(v) => setBulkMode(v === "bulk")}
                    options={[
                      { value: "single", label: "Single" },
                      { value: "bulk", label: "Paste .env" },
                    ]}
                  />
                }
              />
              <form onSubmit={handleAdd} className="p-5">
                {!bulkMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-start">
                    <Input placeholder="NEXT_PUBLIC_API_URL" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="font-mono" aria-label="Variable name" />
                    <Input placeholder="Value" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="font-mono" aria-label="Variable value" />
                    <Button variant="primary" loading={isSaving} disabled={!newKey || !newValue}>
                      {!isSaving && <Save size={14} />} Save
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      placeholder={"API_KEY=your_key_here\nDATABASE_URL=postgres://..."}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      className="font-mono !min-h-[140px]"
                      aria-label=".env contents"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] text-muted-foreground">One NAME=value per line. Comments (#) and blank lines are ignored.</p>
                      <Button variant="primary" loading={isSaving} disabled={!bulkText.trim()}>
                        {!isSaving && <Save size={14} />} Import variables
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader
              title="Variables"
              description="Values are hidden until you reveal them"
              action={
                <Button size="sm" onClick={handleCopyEnv} title="Copy all as NAME=value lines">
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />} {copied ? "Copied" : "Copy .env"}
                </Button>
              }
            />
            {variables.length > 0 && (
              <div className="px-5 py-3 border-b border-surface-border">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name…" className="pl-9" aria-label="Filter variables" />
                </div>
              </div>
            )}

            {variables.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<KeyRound size={22} />} title="No variables yet" description={canWrite ? "Add your first variable above, or paste a whole .env file." : "Nobody has added variables to this environment yet."} />
              </div>
            ) : visible.length === 0 ? (
              <p className="p-8 text-center text-[13px] text-muted-foreground">No variables match “{query}”.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {visible.map((variable) => {
                  const isVisible = visibleValues.has(variable.id);
                  return (
                    <li key={variable.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-hover/60 transition-colors">
                      <code className="sm:w-[38%] font-mono text-[13px] font-semibold text-foreground truncate" title={variable.key}>
                        {variable.key}
                      </code>
                      <input
                        type={isVisible ? "text" : "password"}
                        value={variable.value}
                        readOnly
                        aria-label={`Value of ${variable.key}`}
                        className="flex-1 min-w-0 bg-transparent border-none font-mono text-[13px] text-muted-foreground focus:outline-none"
                      />
                      <div className="flex items-center gap-0.5 ml-auto">
                        <IconButton label={isVisible ? "Hide value" : "Reveal value"} onClick={() => toggleVisibility(variable.id)}>
                          {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                        </IconButton>
                        <IconButton label="Copy value" onClick={() => copyValue(variable)}>
                          <Copy size={15} />
                        </IconButton>
                        {canWrite && (
                          <IconButton label="Delete variable" onClick={() => setDeleteId(variable.id)} className="hover:!text-red-500">
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {deleteVar && (
        <Dialog
          size="sm"
          title="Delete variable?"
          description="This can’t be undone."
          onClose={() => setDeleteId(null)}
          footer={
            <>
              <Button onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button
                variant="primary"
                className="!bg-red-600 hover:!bg-red-700 !text-white"
                onClick={async () => {
                  await handleDelete(deleteVar.id);
                  setDeleteId(null);
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-muted-foreground">
            <code className="font-mono font-semibold text-foreground">{deleteVar.key}</code> will be removed from <b className="text-foreground">{environment.name}</b>.
          </p>
        </Dialog>
      )}
    </div>
  );
}
