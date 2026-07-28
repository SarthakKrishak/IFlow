"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Briefcase, Circle, Clock, CheckCircle2, AlertCircle, 
  Search, ChevronLeft, ChevronRight, Calendar,
  Code, Pencil, Folder, MessageSquare, LayoutTemplate, 
  Bug, Box, Square, CheckSquare
} from "lucide-react";
import { PriorityChip } from "@/components/shared";
import Link from "next/link";

interface MyTasksClientProps {
  initialTickets: any[];
}

export function MyTasksClient({ initialTickets }: MyTasksClientProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [boardFilter, setBoardFilter] = useState("All Boards");
  const [priorityFilter, setPriorityFilter] = useState("Priority");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1); // reset to page 1 on search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Derive unique boards and statuses for filters
  const uniqueBoards = Array.from(new Set(initialTickets.map(t => t.board.name)));
  const uniqueStatuses = Array.from(new Set(initialTickets.map(t => t.column.name)));
  const uniquePriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return initialTickets.filter(t => {
      const matchSearch = t.title.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchStatus = statusFilter === "All Status" || t.column.name === statusFilter;
      const matchBoard = boardFilter === "All Boards" || t.board.name === boardFilter;
      const matchPriority = priorityFilter === "Priority" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchBoard && matchPriority;
    });
  }, [initialTickets, debouncedSearch, statusFilter, boardFilter, priorityFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage) || 1;
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleTask = (id: string) => {
    const next = new Set(selectedTasks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTasks(next);
  };

  // Stats calculation
  const stats = useMemo(() => {
    let todo = 0, inProgress = 0, inReview = 0, completed = 0, overdue = 0;
    
    initialTickets.forEach(t => {
      const status = t.column.name.toLowerCase();
      if (status.includes("done") || status.includes("complet")) completed++;
      else if (status.includes("review")) inReview++;
      else if (status.includes("progress")) inProgress++;
      else todo++;

      if (t.dueDate && new Date(t.dueDate) < new Date() && !status.includes("done")) {
        overdue++;
      }
    });

    return {
      total: initialTickets.length,
      todo,
      inProgress,
      inReview,
      completed,
      overdue
    };
  }, [initialTickets]);

  const getRelativeTime = (dateStr: Date | string | null) => {
    if (!dateStr) return "No due date";
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(d);
    target.setHours(0,0,0,0);
    
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 1) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  };

  const getTaskIcon = (title: string, index: number) => {
    const t = title.toLowerCase();
    const colors = ["bg-indigo-500", "bg-emerald-500", "bg-orange-500", "bg-blue-500", "bg-cyan-500", "bg-purple-500", "bg-pink-500"];
    const color = colors[index % colors.length];

    let Icon = Box;
    if (t.includes("chat") || t.includes("message")) Icon = MessageSquare;
    else if (t.includes("ui") || t.includes("landing") || t.includes("design")) Icon = Pencil;
    else if (t.includes("api") || t.includes("integration") || t.includes("backend")) Icon = Code;
    else if (t.includes("bug") || t.includes("fix") || t.includes("issue")) Icon = Bug;
    else if (t.includes("flow") || t.includes("onboard")) Icon = LayoutTemplate;

    return (
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${color}`}>
        <Icon size={14} />
      </div>
    );
  };

  const getStatusDisplay = (columnName: string) => {
    const name = columnName.toLowerCase();
    let color = "bg-gray-500";
    let textColor = "text-gray-400";
    let Icon: any = Circle;

    if (name.includes("done") || name.includes("complet")) {
      color = "bg-emerald-500";
      textColor = "text-emerald-500";
      Icon = CheckCircle2;
    } else if (name.includes("progress")) {
      color = "bg-blue-500";
      textColor = "text-blue-500";
      Icon = () => <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>;
    } else if (name.includes("review")) {
      color = "bg-orange-500";
      textColor = "text-orange-500";
      Icon = () => <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>;
    } else {
      Icon = () => <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-400"></div>;
    }

    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-surface-border bg-surface-elevated w-fit">
        <Icon size={12} className={textColor} />
        <span className="text-[11px] font-bold text-foreground">{columnName}</span>
      </div>
    );
  };

  const getBoardDisplay = (boardName: string) => {
    const isDesign = boardName.toLowerCase().includes("design");
    return (
      <div className="flex items-center gap-1.5 px-2 py-1">
        {isDesign ? <Pencil size={12} className="text-purple-500" /> : <Code size={12} className="text-indigo-500" />}
        <span className="text-[12px] font-medium text-muted-foreground">{boardName}</span>
      </div>
    );
  };

  const getProjectDisplay = (projectName: string) => {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 w-fit">
        <Folder size={12} />
        <span className="text-[11px] font-bold">{projectName}</span>
      </div>
    );
  };

  return (
    <div className="p-8 pb-24 max-w-[1500px] mx-auto space-y-8 animate-fade-in">
      
      {/* Filters Only (Headers removed as per request) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-end gap-6 pt-2">
        <div className="flex items-center gap-3 flex-wrap">
          <select 
            value={statusFilter} 
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-bold text-foreground outline-none cursor-pointer"
          >
            <option value="All Status">All Status</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select 
            value={boardFilter} 
            onChange={e => { setBoardFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-bold text-foreground outline-none cursor-pointer"
          >
            <option value="All Boards">All Boards</option>
            {uniqueBoards.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select 
            value={priorityFilter} 
            onChange={e => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-bold text-foreground outline-none cursor-pointer"
          >
            <option value="Priority">Priority</option>
            {uniquePriorities.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 pr-3 py-2 w-48 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-medium text-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 flex-shrink-0">
             <Briefcase size={20} />
           </div>
           <div>
             <p className="text-[11px] font-bold text-muted-foreground">Total Tasks</p>
             <p className="text-2xl font-bold text-foreground leading-none mt-1">{stats.total}</p>
             <p className="text-[10px] text-muted-foreground mt-1">Assigned to you</p>
           </div>
        </div>
        
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
           <div className="w-12 h-12 rounded-2xl bg-surface-base border border-surface-border flex items-center justify-center text-muted-foreground flex-shrink-0">
             <Circle size={20} />
           </div>
           <div>
             <p className="text-[11px] font-bold text-muted-foreground">To Do</p>
             <p className="text-2xl font-bold text-foreground leading-none mt-1">{stats.todo}</p>
           </div>
        </div>

        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
           <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
               <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
             </svg>
           </div>
           <div>
             <p className="text-[11px] font-bold text-muted-foreground">In Progress</p>
             <p className="text-2xl font-bold text-foreground leading-none mt-1">{stats.inProgress}</p>
           </div>
        </div>

        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
           <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 flex-shrink-0">
             <AlertCircle size={20} />
           </div>
           <div>
             <p className="text-[11px] font-bold text-muted-foreground">In Review</p>
             <p className="text-2xl font-bold text-foreground leading-none mt-1">{stats.inReview}</p>
           </div>
        </div>

        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
           <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
             <CheckCircle2 size={20} />
           </div>
           <div>
             <p className="text-[11px] font-bold text-muted-foreground">Completed</p>
             <p className="text-2xl font-bold text-foreground leading-none mt-1">{stats.completed}</p>
           </div>
        </div>

        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
           <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
             <Clock size={20} />
           </div>
           <div>
             <p className="text-[11px] font-bold text-muted-foreground">Overdue</p>
             <p className="text-2xl font-bold text-foreground leading-none mt-1">{stats.overdue}</p>
           </div>
        </div>
      </div>

      {/* Task Table */}
      <div className="bg-surface-elevated border border-surface-border rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[28%]">Task</th>
                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[15%]">Project</th>
                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[15%]">Status</th>
                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[15%]">Board</th>
                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[12%]">Priority</th>
                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground">
                    <CheckCircle2 size={40} className="mx-auto mb-4 text-emerald-500/50" />
                    <p className="text-sm font-medium">No tasks found</p>
                    <p className="text-xs mt-1 opacity-70">Try adjusting your filters or search query.</p>
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((t, i) => {
                  return (
                    <tr key={t.id} className="hover:bg-surface-base transition-colors group">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                           {getTaskIcon(t.title, i)}
                           <div className="flex flex-col min-w-0">
                             <Link href={`/board/${t.boardId}`} className="text-[13px] font-bold text-foreground hover:text-primary transition-colors truncate">
                               {t.title}
                             </Link>
                             <span className="text-[11px] text-muted-foreground truncate">{t.description || "No description provided"}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getProjectDisplay(t.board.project.name)}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusDisplay(t.column.name)}
                      </td>
                      <td className="px-4 py-3">
                        {getBoardDisplay(t.board.name)}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityChip priority={t.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                           <Calendar size={14} className="text-muted-foreground" />
                           <div className="flex flex-col">
                             <span className="text-[13px] font-bold text-foreground">
                               {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "No Date"}
                             </span>
                             <span className="text-[11px] text-muted-foreground font-medium">
                               {getRelativeTime(t.dueDate)}
                             </span>
                           </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border bg-surface-base">
          <p className="text-[12px] font-medium text-muted-foreground">
            Showing {filteredTasks.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length} tasks
          </p>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-bold transition-colors ${
                    currentPage === page 
                      ? 'bg-primary text-white border border-primary' 
                      : 'border border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <select 
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // reset to page 1 on size change
              }}
              className="px-3 py-1.5 rounded-xl border border-surface-border bg-surface-elevated text-[12px] font-bold text-foreground outline-none cursor-pointer"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      </div>
      
    </div>
  );
}
