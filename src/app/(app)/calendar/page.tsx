import { prisma } from "@/lib/prisma";
import CalendarClient from "./CalendarClient";

export const metadata = {
  title: "Calendar — IFlow",
  description: "Manage your team's schedule and deadlines.",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string, year?: string }> }) {
  const params = await searchParams;
  const today = new Date();

  // Validate + clamp query params so ?month=abc can never produce Invalid Date
  const rawMonth = params.month ? parseInt(params.month, 10) : today.getMonth() + 1;
  const rawYear = params.year ? parseInt(params.year, 10) : today.getFullYear();
  const month = Number.isNaN(rawMonth) ? today.getMonth() + 1 : Math.min(12, Math.max(1, rawMonth));
  const year = Number.isNaN(rawYear) ? today.getFullYear() : Math.min(2100, Math.max(2000, rawYear));
  
  const currentMonthDate = new Date(year, month - 1, 1);
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = currentMonthDate.getDay();
  
  const monthName = currentMonthDate.toLocaleString('default', { month: 'long' });
  const shortMonthName = currentMonthDate.toLocaleString('default', { month: 'short' });
  
  // Fetch all boards the user can see (currently fetching all for this workspace)
  const boards = await prisma.board.findMany({
    select: {
      id: true,
      name: true,
    }
  });

  // Fetch tickets for this month across all boards
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
      boardId: true,
    }
  });

  return (
    <CalendarClient 
      boards={boards}
      tickets={tickets}
      month={month}
      year={year}
      monthName={monthName}
      shortMonthName={shortMonthName}
      firstDayOfMonth={firstDayOfMonth}
      daysInMonth={daysInMonth}
      todayDate={today.getDate()}
      todayMonth={today.getMonth() + 1}
      todayYear={today.getFullYear()}
    />
  );
}
