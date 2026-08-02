import { ChevronLeft, ChevronRight, Plus, Search, Calendar as CalendarIcon, CheckSquare, Clock, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Calendar — IFlow",
  description: "Manage your team's schedule and deadlines.",
};

const departmentColors: Record<string, string> = {
  ENGINEERING: "bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20",
  DESIGN: "bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20",
  MARKETING: "bg-green-500/10 text-green-500 dark:text-green-400 border border-green-500/20",
  PRODUCT: "bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20",
  SALES: "bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20",
  HR: "bg-pink-500/10 text-pink-500 dark:text-pink-400 border border-pink-500/20",
  LEGAL: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border border-zinc-500/20",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string, year?: string }> }) {
  const params = await searchParams;
  const today = new Date();
  
  const month = params.month ? parseInt(params.month) : today.getMonth() + 1;
  const year = params.year ? parseInt(params.year) : today.getFullYear();
  
  const currentMonthDate = new Date(year, month - 1, 1);
  const nextMonthDate = new Date(year, month, 1);
  const prevMonthDate = new Date(year, month - 2, 1);
  
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = currentMonthDate.getDay();
  
  const monthName = currentMonthDate.toLocaleString('default', { month: 'long' });
  const shortMonthName = currentMonthDate.toLocaleString('default', { month: 'short' });
  
  // Fetch tickets for this month
  const tickets = await prisma.ticket.findMany({
    where: {
      dueDate: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      }
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      department: true,
    }
  });

  const calendarEvents = tickets.map(ticket => {
    const date = ticket.dueDate!;
    return {
      id: ticket.id,
      title: ticket.title,
      date: date.getDate(),
      color: departmentColors[ticket.department] || departmentColors.LEGAL,
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: ""
    }
  });
  
  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-surface-base overflow-hidden text-sm animate-fade-in">
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col w-[280px] border-r border-surface-border bg-surface-base p-6 overflow-y-auto">
        <button className="w-full bg-[#5B5FEF] hover:bg-[#4B4FE0] text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors mb-8 shadow-[0_0_20px_rgba(91,95,239,0.25)]">
          <Plus size={18} />
          New Event
        </button>
        
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
            {Array.from({length: 35}).map((_, i) => {
              const date = i - firstDayOfMonth + 1;
              const isCurrentMonth = date > 0 && date <= daysInMonth;
              const isToday = date === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
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
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="w-4 h-4 rounded border border-[#5B5FEF]/50 bg-[#5B5FEF]/20 flex items-center justify-center transition-colors group-hover:border-[#5B5FEF]">
                  <CheckSquare size={12} className="text-[#5B5FEF]" />
                </div>
                <span className="text-text-secondary group-hover:text-text-primary transition-colors">Development</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="w-4 h-4 rounded border border-purple-500/50 bg-purple-500/20 flex items-center justify-center transition-colors group-hover:border-purple-500">
                  <CheckSquare size={12} className="text-purple-500" />
                </div>
                <span className="text-text-secondary group-hover:text-text-primary transition-colors">Design Team</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="w-4 h-4 rounded border border-green-500/50 bg-green-500/20 flex items-center justify-center transition-colors group-hover:border-green-500">
                  <CheckSquare size={12} className="text-green-500" />
                </div>
                <span className="text-text-secondary group-hover:text-text-primary transition-colors">Marketing</span>
              </label>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Upcoming Schedule</h4>
            <div className="space-y-4">
              {calendarEvents.slice(0, 3).map(event => (
                <div key={event.id} className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-elevated transition-colors border border-transparent hover:border-surface-border cursor-pointer -mx-3">
                  <div className={`w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 shadow-sm ${event.color.split(' ')[0].replace('/10', '')}`} />
                  <div>
                    <div className="text-text-primary font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Clock size={12}/> {event.date} {shortMonthName}, {event.time}
                    </div>
                  </div>
                </div>
              ))}
              {calendarEvents.length === 0 && (
                <div className="text-sm text-muted-foreground py-2">No upcoming tickets this month.</div>
              )}
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
            <button className="relative overflow-hidden group bg-surface-elevated border border-surface-border hover:border-[#5B5FEF]/50 rounded-xl pr-4 pl-1.5 py-1.5 flex items-center gap-2.5 transition-all shadow-sm hover:shadow-md hidden md:flex h-[38px]">
              <div className="bg-white w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100 z-10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-text-primary group-hover:text-[#5B5FEF] transition-colors z-10 whitespace-nowrap">Connect Google Calendar</span>
            </button>
            <div className="relative w-full md:w-auto">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search events..." 
                className="w-full md:w-64 bg-surface-elevated border border-surface-border rounded-xl pl-9 pr-4 py-2 text-text-primary placeholder-muted-foreground focus:outline-none focus:border-[#5B5FEF] transition-colors shadow-sm text-sm" 
              />
            </div>
          </div>
        </header>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col p-2 md:p-6 overflow-hidden bg-surface-base/50">
          <div className="grid grid-cols-7 gap-[1px] bg-surface-border border border-surface-border rounded-xl md:rounded-2xl overflow-hidden flex-1 shadow-lg relative" style={{ gridTemplateRows: 'auto repeat(5, minmax(0, 1fr))' }}>
            
            {/* Days header */}
            {daysOfWeek.map((day) => (
              <div key={day} className="bg-surface-elevated py-2 md:py-3 text-center text-[10px] md:text-xs font-bold tracking-wider text-muted-foreground uppercase">
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{day.charAt(0)}</span>
              </div>
            ))}
            
            {/* Grid Cells */}
            {Array.from({ length: 35 }).map((_, i) => {
              const date = i - firstDayOfMonth + 1;
              const isCurrentMonth = date > 0 && date <= daysInMonth;
              const isToday = date === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
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
                    {isCurrentMonth && (
                      <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-text-primary transition-all p-0.5 md:p-1 hover:bg-surface-border rounded-md hidden md:block">
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1 md:space-y-1.5 pr-0 md:pr-1 custom-scrollbar">
                    {cellEvents.slice(0, 3).map(event => (
                      <Link 
                        href={`/board/all?ticket=${event.id}`}
                        key={event.id} 
                        className={`block px-1.5 py-1 md:px-2 md:py-1.5 roundedmd md:rounded-lg text-[9px] md:text-xs font-medium cursor-pointer hover:shadow-md transition-all flex flex-col gap-0.5 relative overflow-hidden group/event ${event.color}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate pr-0 md:pr-2 font-semibold">{event.title}</span>
                        </div>
                        <div className="text-[8px] md:text-[10.5px] opacity-80 font-medium flex items-center gap-1 hidden md:flex">
                          {event.time} 
                        </div>
                        
                        {/* Hover Actions */}
                        <div className="absolute right-1 top-1.5 opacity-0 group-hover/event:opacity-100 transition-opacity bg-inherit pl-1 hidden md:block">
                          <MoreHorizontal size={14} className="opacity-70 hover:opacity-100" />
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {cellEvents.length > 3 && (
                    <div className="mt-0.5 md:mt-1 text-[8px] md:text-[10px] text-muted-foreground font-medium text-center hover:text-text-primary cursor-pointer transition-colors">
                      +{cellEvents.length - 3} more
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
