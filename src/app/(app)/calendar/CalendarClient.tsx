"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Check } from "lucide-react";
import { Input, SectionLabel, buttonStyles } from "@/components/ui";
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

// Fixed palette (data colours) — index-aligned with BOARD_COLORS so the chips and the filter dots agree.
const BOARD_HEX = ["#3B82F6", "#A855F7", "#22C55E", "#F59E0B", "#EC4899", "#EF4444", "#06B6D4"];

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

  const prevHref = `/calendar?month=${prevMonthDate.getMonth() + 1}&year=${prevMonthDate.getFullYear()}`;
  const nextHref = `/calendar?month=${nextMonthDate.getMonth() + 1}&year=${nextMonthDate.getFullYear()}`;
  const isThisMonth = month === todayMonth && year === todayYear;
  const eventsThisMonth = calendarEvents.length;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden animate-fade-in">
      {/* Left rail: mini month + board filters */}
      <aside className="hidden lg:flex flex-col w-[264px] shrink-0 border-r border-surface-border bg-surface-base/50 p-5 overflow-y-auto custom-scrollbar gap-7">
        {boards.length > 0 && (
          <Link href={`/board/${boards[0].id}`} className={buttonStyles("primary", "md", "w-full")}>
            <Plus size={15} /> New task
          </Link>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13.5px] font-semibold text-foreground">
              {monthName} {year}
            </h3>
            <div className="flex gap-0.5">
              <Link href={prevHref} aria-label="Previous month" className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
                <ChevronLeft size={15} />
              </Link>
              <Link href={nextHref} aria-label="Next month" className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
                <ChevronRight size={15} />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-[10.5px] mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-muted-foreground/80 font-semibold py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center text-[12px]">
            {Array.from({ length: totalCells }).map((_, i) => {
              const date = i - firstDayOfMonth + 1;
              const inMonth = date > 0 && date <= daysInMonth;
              const isToday = date === todayDate && isThisMonth;
              const hasEvents = inMonth && calendarEvents.some((e) => e.date === date);
              return (
                <div
                  key={i}
                  className={`relative mx-auto w-8 h-8 flex items-center justify-center rounded-full ${
                    isToday ? "bg-primary text-primary-foreground font-semibold" : inMonth ? "text-foreground" : "text-muted-foreground/30"
                  }`}
                >
                  {inMonth ? date : date <= 0 ? new Date(year, month - 1, 0).getDate() + date : date - daysInMonth}
                  {hasEvents && !isToday && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionLabel className="mb-3">Boards</SectionLabel>
          {boards.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">No boards yet.</p>
          ) : (
            <div className="space-y-1">
              {boards.map((board, idx) => {
                const isChecked = checkedBoards[board.id];
                const hex = BOARD_HEX[idx % BOARD_HEX.length];
                return (
                  <button
                    key={board.id}
                    onClick={() => toggleBoard(board.id)}
                    aria-pressed={isChecked}
                    className="w-full flex items-center gap-3 h-8 px-2 rounded-lg text-left hover:bg-surface-hover transition-colors"
                  >
                    <span
                      className="w-4 h-4 rounded-[5px] border flex items-center justify-center transition-colors"
                      style={isChecked ? { backgroundColor: hex, borderColor: hex } : { borderColor: "hsl(var(--border))" }}
                    >
                      {isChecked && <Check size={11} strokeWidth={3.5} className="text-white" />}
                    </span>
                    <span className={`text-[13px] truncate ${isChecked ? "text-foreground font-medium" : "text-muted-foreground"}`}>{board.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-semibold text-foreground tracking-[-0.02em]">
              <span className="hidden sm:inline">{monthName} {year}</span>
              <span className="sm:hidden">{shortMonthName} {year}</span>
            </h2>
            <span className="text-[12.5px] text-muted-foreground tabular-nums">· {eventsThisMonth} due</span>
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-surface-border bg-surface-elevated p-0.5">
            <Link href="/calendar" className={`h-8 px-3 flex items-center text-[12.5px] font-semibold rounded-md transition-colors ${isThisMonth ? "text-muted-foreground" : "text-foreground hover:bg-surface-base"}`}>
              Today
            </Link>
            <span className="w-px h-4 bg-surface-border" />
            <Link href={prevHref} aria-label="Previous month" className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-hover transition-colors">
              <ChevronLeft size={16} />
            </Link>
            <Link href={nextHref} aria-label="Next month" className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-hover transition-colors">
              <ChevronRight size={16} />
            </Link>
          </div>
          <div className="relative w-full md:w-64 md:ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" className="pl-9" />
          </div>
        </header>

        <div className="flex-1 flex flex-col p-3 md:p-5 overflow-hidden">
          <div
            className="grid grid-cols-7 gap-px bg-surface-border border border-surface-border rounded-xl overflow-hidden flex-1 shadow-card"
            style={{ gridTemplateRows: `auto repeat(${gridRows}, minmax(0, 1fr))` }}
          >
            {daysOfWeek.map((day) => (
              <div key={day} className="bg-surface-elevated py-2 text-center text-[12px] font-medium text-muted-foreground">
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{day.charAt(0)}</span>
              </div>
            ))}

            {Array.from({ length: totalCells }).map((_, i) => {
              const date = i - firstDayOfMonth + 1;
              const isCurrentMonth = date > 0 && date <= daysInMonth;
              const isToday = date === todayDate && isThisMonth;
              const cellEvents = calendarEvents.filter((e) => e.date === date && isCurrentMonth);

              return (
                <div key={i} className={`p-1 md:p-2 flex flex-col overflow-hidden transition-colors ${isCurrentMonth ? "bg-surface-base hover:bg-surface-elevated/60" : "bg-surface-base/50"}`}>
                  <span
                    className={`w-6 h-6 md:w-7 md:h-7 mb-1 flex items-center justify-center rounded-full text-[11px] md:text-[12.5px] font-semibold ${
                      isToday ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/30"
                    }`}
                  >
                    {isCurrentMonth ? date : date <= 0 ? new Date(year, month - 1, 0).getDate() + date : date - daysInMonth}
                  </span>

                  <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar min-h-0">
                    {cellEvents.slice(0, 3).map((event) => (
                      <Link
                        href={`/board/${event.boardId}?ticket=${event.id}`}
                        key={event.id}
                        title={event.title}
                        className={`block px-1.5 py-1 rounded-md text-[10px] md:text-[11.5px] font-semibold truncate hover:shadow-md transition-shadow ${event.color}`}
                      >
                        {event.title}
                      </Link>
                    ))}
                  </div>

                  {cellEvents.length > 3 && <p className="mt-0.5 text-[10px] text-muted-foreground font-medium text-center">+{cellEvents.length - 3} more</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
