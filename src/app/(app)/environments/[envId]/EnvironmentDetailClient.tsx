"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Eye, EyeOff, Save, Trash2, KeyRound } from "lucide-react";
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
  isAdmin
}: {
  environment: any;
  variables: Variable[];
  isAdmin: boolean;
}) {
  const [variables, setVariables] = useState<Variable[]>(initialVariables);
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  
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
    if (!confirm("Delete this variable?")) return;
    try {
      await deleteEnvironmentVariable(id, environment.id);
      setVariables(prev => prev.filter(v => v.id !== id));
      toast.success("Deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete variable");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-surface-base">
      <header className="px-8 py-6 border-b border-surface-border flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-2 text-sm text-text-secondary">
            <Link href="/environments" className="hover:text-text-primary flex items-center gap-1 transition-colors">
              <ArrowLeft size={14} /> Back to Environments
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <KeyRound className="text-[#5B5FEF]" size={24} />
            {environment.name} <span className="text-muted-foreground font-normal text-lg">({environment.project.name})</span>
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Add Variable Form */}
          {isAdmin && (
            <div className="bg-surface-elevated border border-surface-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-primary">Add New Variable</h2>
                <div className="flex items-center gap-2 bg-surface-base p-1 rounded-lg border border-surface-border">
                  <button
                    type="button"
                    onClick={() => setBulkMode(false)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${!bulkMode ? 'bg-surface-elevated text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMode(true)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${bulkMode ? 'bg-surface-elevated text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Bulk (.env)
                  </button>
                </div>
              </div>

              <form onSubmit={handleAdd} className="flex flex-col gap-4">
                {!bulkMode ? (
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="e.g. NEXT_PUBLIC_API_URL"
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                        className="w-full bg-surface-base border border-surface-border rounded-lg px-4 py-2.5 text-text-primary placeholder:text-muted-foreground focus:outline-none focus:border-[#5B5FEF] transition-colors"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Value"
                        value={newValue}
                        onChange={e => setNewValue(e.target.value)}
                        className="w-full bg-surface-base border border-surface-border rounded-lg px-4 py-2.5 text-text-primary placeholder:text-muted-foreground focus:outline-none focus:border-[#5B5FEF] transition-colors font-mono text-sm"
                      />
                    </div>
                    <button
                      disabled={isSaving || !newKey || !newValue}
                      className="bg-[#5B5FEF] hover:bg-[#4B4FE0] text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save size={16} />
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <textarea
                      placeholder={"API_KEY=your_key_here\nDATABASE_URL=postgres://..."}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      className="w-full h-32 bg-surface-base border border-surface-border rounded-lg px-4 py-3 text-text-primary placeholder:text-muted-foreground focus:outline-none focus:border-[#5B5FEF] transition-colors font-mono text-sm resize-y custom-scrollbar"
                    />
                    <div className="flex justify-end">
                      <button
                        disabled={isSaving || !bulkText.trim()}
                        className="bg-[#5B5FEF] hover:bg-[#4B4FE0] text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                      >
                        <Save size={16} />
                        Import Variables
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Variables Table */}
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="font-bold text-text-primary">Environment Variables</h2>
              <span className="text-xs font-semibold bg-surface-base px-2.5 py-1 rounded-md border border-surface-border text-muted-foreground">
                {variables.length} Items
              </span>
            </div>
            
            <div className="divide-y divide-surface-border">
              {variables.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">No variables have been added yet.</div>
              ) : (
                variables.map(variable => {
                  const isVisible = visibleValues.has(variable.id);
                  return (
                    <div key={variable.id} className="flex items-center gap-4 p-4 hover:bg-surface-base/50 transition-colors group">
                      <div className="flex-1 font-mono text-sm font-semibold text-text-primary">
                        {variable.key}
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type={isVisible ? "text" : "password"}
                          value={variable.value}
                          readOnly
                          className="w-full bg-transparent border-none font-mono text-sm text-text-secondary focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleVisibility(variable.id)}
                          className="p-1.5 text-muted-foreground hover:text-text-primary rounded-md hover:bg-surface-border transition-colors"
                        >
                          {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(variable.id)}
                            className="p-1.5 text-muted-foreground hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
