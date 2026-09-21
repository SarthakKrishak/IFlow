"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Calendar as CalendarIcon, CheckSquare, MoreHorizontal } from "lucide-react";
import Link from "next/link";

interface Board {
  id: string;
  name: string;
}

interface Ticket {
  id: string;
  title: string;
  boardId: string;
  dueDate: Date | null;
}

interface CalendarClientProps {
  boards: Board[];
  tickets: Ticket[];
  month: number;
  year: number;
  monthName: string;
  shortMonthName: string;
  firstDayOfMonth: number;
  daysInMonth: number;
  todayDate: number;
  todayMonth: number;
  todayYear: number;
}

const BOARD_COLORS = [
  "bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20",
  "bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20",
  "bg-green-500/10 text-green-500 dark:text-green-400 border border-green-500/20",
  "bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20",
  "bg-pink-500/10 text-pink-500 dark:text-pink-400 border border-pink-500/20",
  "bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20",
  "bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border border-cyan-500/20",
];

export default function CalendarClient({
  boards,
  tickets,
  month,
  year,
  monthName,
  shortMonthName,
  firstDayOfMonth,
  daysInMonth,
  todayDate,
  todayMonth,
  todayYear
}: CalendarClientProps) {
  
  // Initialize all boards as checked
  const [checkedBoards, setCheckedBoards] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    boards.forEach(b => initial[b.id] = true);
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Keep the filter in sync if the board list changes (new board → visible)
  useEffect(() => {
    setCheckedBoards((prev) => {
      const next = { ...prev };
      let changed = false;
      boards.forEach((b) => {
        if (!(b.id in next)) {
          next[b.id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [boards]);

  const toggleBoard = (boardId: string) => {
    setCheckedBoards(prev => ({ ...prev, [boardId]: !prev[boardId] }));
  };

  const currentMonthDate = new Date(year, month - 1, 1);
  const nextMonthDate = new Date(year, month, 1);
  const prevMonthDate = new Date(year, month - 2, 1);
  
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  // Assign a stable color to each board based on index
  const boardColorMap: Record<string, string> = {};
  boards.forEach((board, index) => {
    boardColorMap[board.id] = BOARD_COLORS[index % BOARD_COLORS.length];
  });
  
  // Map tickets to calendar events, filtering out unchecked boards + search
  const q = searchQuery.trim().toLowerCase();
  const calendarEvents = tickets
    .filter(t => t.dueDate && checkedBoards[t.boardId])
    .filter(t => q === "" || t.title.toLowerCase().includes(q))
    .map(ticket => {
      const date = new Date(ticket.dueDate!);
      return {
        id: ticket.id,
        title: ticket.title,
        date: date.getDate(),
        color: boardColorMap[ticket.boardId] || "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border border-zinc-500/20",
        boardId: ticket.boardId
      }
    });

  // Grid needs 5 or 6 rows depending on the month (e.g. 31-day month starting Sat)
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;
  const gridRows = totalCells / 7;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-surface-base overflow-hidden text-sm animate-fade-in">
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col w-[280px] border-r border-surface-border bg-surface-base p-6 overflow-y-auto">
        {boards.length > 0 ? (
          <Link
            href={`/board/${boards[0].id}`}
            className="w-full bg-[#5B5FEF] hover:bg-[#4B4FE0] text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors mb-8 shadow-[0_0_20px_rgba(91,95,239,0.25)]"
          >
            <Plus size={18} />
            New Event
          </Link>
        ) : (
          <button disabled className="w-full bg-surface-elevated text-muted-foreground rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-medium mb-8 opacity-60 cursor-not-allowed">
            <Plus size={18} />
            New Event
          </button>
        )}
        
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-text-primary font-semibold text-base">{monthName} {year}</h3>
            <div className="flex gap-1">
              <Link href={`/calendar?month=${prevMonthDate.getMonth() + 1}&year=${prevMonthDate.getFullYear()}`} className="p-1.5 hover:bg-surface-elevated rounded-lg text-muted-foreground hover:text-text-primary transition-colors"><ChevronLeft size={16} /></Link>
              <Link href={`/calendar?month=${nextMonthDate.getMonth() + 1}&year=${nextMonthDate.getFullYear()}`} className="p-1.5 hover:bg-surface-elevated rounded-lg text-muted-foreground hover:text-text-primary transition-colors"><ChevronRight size={16} /></Link>
            </div>
          </div>
          {/* Mini Calendar */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} className="text-muted-foreground font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({length: totalCells}).map((_, i) => {
              const date = i - firstDayOfMonth + 1;
              const isCurrentMonth = date > 0 && date <= daysInMonth;
              const isToday = date === todayDate && month === todayMonth && year === todayYear;
              return (
                <div key={i} className={`p-1.5 rounded-full flex items-center justify-center w-8 h-8 mx-auto ${
                  isToday 
                    ? 'bg-[#5B5FEF] text-white font-bold shadow-sm' 
                    : isCurrentMonth 
                      ? 'text-text-primary hover:bg-surface-elevated cursor-pointer transition-colors' 
                      : 'text-muted-foreground/40'
                }`}>
                  {isCurrentMonth ? date : (date <= 0 ? new Date(year, month - 1, 0).getDate() + date : date - daysInMonth)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Calendars</h4>
              <button className="text-muted-foreground hover:text-text-primary transition-colors"><Plus size={14}/></button>
            </div>
            <div className="space-y-3">
              {boards.map((board) => {
                const isChecked = checkedBoards[board.id];
                const colorClass = boardColorMap[board.id].split(" ")[1]; // extract e.g. text-blue-500
                const hexColor = colorClass.includes('blue') ? '#3B82F6' : colorClass.includes('purple') ? '#A855F7' : colorClass.includes('green') ? '#22C55E' : colorClass.includes('amber') ? '#F59E0B' : colorClass.includes('pink') ? '#EC4899' : colorClass.includes('red') ? '#EF4444' : '#06B6D4';
                
                return (
                <label key={board.id} className="flex items-center gap-3 cursor-pointer group select-none" onClick={() => toggleBoard(board.id)}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors group-hover:border-opacity-100 ${isChecked ? '' : 'bg-transparent border-surface-border'}`} style={isChecked ? { backgroundColor: `${hexColor}33`, borderColor: `${hexColor}80` } : {}}>
                    {isChecked && <CheckSquare size={12} style={{ color: hexColor }} />}
                  </div>
                  <span className={`transition-colors truncate max-w-[200px] ${isChecked ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>{board.name}</span>
                </label>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-base">
        {/* Header */}
        <header className="h-auto md:h-[72px] py-4 md:py-0 border-b border-surface-border flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-8 shrink-0 bg-surface-base gap-4 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6">
            <h1 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2 shrink-0">
              <CalendarIcon size={24} className="text-[#5B5FEF]" />
              <span className="hidden sm:inline">{monthName} {year}</span>
              <span className="sm:hidden">{shortMonthName} '{year.toString().slice(2)}</span>
            </h1>
            <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-surface-border shadow-sm shrink-0">
              <Link href={`/calendar`} className="px-2 md:px-3 py-1.5 text-text-secondary hover:text-text-primary font-medium rounded-md hover:bg-surface-base transition-colors text-xs md:text-sm">Today</Link>
              <div className="w-px h-4 bg-surface-border mx-1" />
              <Link href={`/calendar?month=${prevMonthDate.getMonth() + 1}&year=${prevMonthDate.getFullYear()}`} className="p-1.5 text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-base transition-colors"><ChevronLeft className="w-4 h-4 md:w-5 md:h-5" /></Link>
              <Link href={`/calendar?month=${nextMonthDate.getMonth() + 1}&year=${nextMonthDate.getFullYear()}`} className="p-1.5 text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-base transition-colors"><ChevronRight className="w-4 h-4 md:w-5 md:h-5" /></Link>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-auto">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                aria-label="Search events"
                className="w-full md:w-64 bg-surface-elevated border border-surface-border rounded-xl pl-9 pr-4 py-2 text-text-primary placeholder-muted-foreground focus:outline-none focus:border-[#5B5FEF] transition-colors shadow-sm text-sm"
              />
            </div>
          </div>
        </header>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col p-2 md:p-6 overflow-hidden bg-surface-base/50">
          <div className="grid grid-cols-7 gap-[1px] bg-surface-border border border-surface-border rounded-xl md:rounded-2xl overflow-hidden flex-1 shadow-lg relative" style={{ gridTemplateRows: `auto repeat(${gridRows}, minmax(0, 1fr))` }}>
            
            {/* Days header */}
            {daysOfWeek.map((day) => (
              <div key={day} className="bg-surface-elevated py-2 md:py-3 text-center text-[10px] md:text-xs font-bold tracking-wider text-muted-foreground uppercase">
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{day.charAt(0)}</span>
              </div>
            ))}
            
            {/* Grid Cells */}
            {Array.from({ length: totalCells }).map((_, i) => {
              const date = i - firstDayOfMonth + 1;
              const isCurrentMonth = date > 0 && date <= daysInMonth;
              const isToday = date === todayDate && month === todayMonth && year === todayYear;
              const cellEvents = calendarEvents.filter(e => e.date === date && isCurrentMonth);

              return (
                <div key={i} className={`bg-surface-base p-1 md:p-2.5 flex flex-col hover:bg-surface-elevated/50 transition-colors group relative overflow-hidden ${!isCurrentMonth ? 'bg-surface-base/50 text-muted-foreground/30' : 'text-text-secondary'}`}>
                  <div className="flex justify-between items-start mb-1 md:mb-2">
                    <span className={`w-5 h-5 md:w-7 md:h-7 flex items-center justify-center rounded-full text-[10px] md:text-sm font-semibold transition-all ${
                      isToday
                        ? 'bg-[#5B5FEF] text-white shadow-[0_0_12px_rgba(91,95,239,0.6)]'
                        : isCurrentMonth
                          ? 'group-hover:text-text-primary'
                          : ''
                    }`}>
                      {isCurrentMonth ? date : (date <= 0 ? new Date(year, month - 1, 0).getDate() + date : date - daysInMonth)}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1 md:space-y-1.5 pr-0 md:pr-1 custom-scrollbar">
                    {cellEvents.slice(0, 4).map(event => (
                      <Link
                        href={`/board/${event.boardId}?ticket=${event.id}`}
                        key={event.id} 
                        className={`block px-1.5 py-1 md:px-2 md:py-1.5 rounded-md md:rounded-lg text-[9px] md:text-xs font-medium cursor-pointer hover:shadow-md transition-all flex flex-col gap-0.5 relative overflow-hidden group/event ${event.color}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate pr-0 font-semibold leading-tight">{event.title}</span>
                        </div>
                        
                        {/* Hover Actions */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/event:opacity-100 transition-opacity bg-inherit pl-1 hidden md:block">
                          <MoreHorizontal size={14} className="opacity-70 hover:opacity-100" />
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {cellEvents.length > 4 && (
                    <div className="mt-0.5 md:mt-1 text-[8px] md:text-[10px] text-muted-foreground font-medium text-center hover:text-text-primary cursor-pointer transition-colors">
                      +{cellEvents.length - 4} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
