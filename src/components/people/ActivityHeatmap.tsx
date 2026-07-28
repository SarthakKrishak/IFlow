"use client";

import { useMemo } from "react";

interface ActivityHeatmapProps {
  data: Record<string, number>; // "YYYY-MM-DD" -> count
}

const DAYS = ["", "Mon", "", "Wed",  "", "Fri", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getColor(count: number): string {
  if (count === 0) return "#1A1F2B";
  if (count === 1) return "#2D3A6B";
  if (count <= 3) return "#3D52B0";
  if (count <= 6) return "#5B5FEF";
  return "#8B8FF5";
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const weeks = useMemo(() => {
    const keys = Object.keys(data);
    const maxDate = keys.length > 0 
      ? new Date(keys.reduce((a, b) => (a > b ? a : b))) 
      : new Date();
      
    const today = maxDate;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const allWeeks: Array<Array<{ date: string; count: number }>> = [];
    let current = new Date(startDate);

    while (current <= today) {
      const week: Array<{ date: string; count: number }> = [];
      for (let d = 0; d < 7; d++) {
        if (current > today) {
          break;
        }
        const dateStr = current.toISOString().split("T")[0];
        week.push({
          date: dateStr,
          count: data[dateStr] ?? 0,
        });
        current.setDate(current.getDate() + 1);
      }
      if (week.length > 0) {
        allWeeks.push(week);
      }
    }

    return allWeeks;
  }, [data]);

  const monthLabels = useMemo(() => {
    const labels: { label: string; weekIndex: number }[] = [];
    let prevMonth = -1;
    weeks.forEach((week, i) => {
      const firstDate = week.find((d) => d.date)?.date;
      if (firstDate) {
        const month = new Date(firstDate).getMonth();
        if (month !== prevMonth) {
          labels.push({ label: MONTHS[month], weekIndex: i });
          prevMonth = month;
        }
      }
    });
    return labels;
  }, [weeks]);

  const cellSize = 11;
  const gap = 2;
  const totalW = weeks.length * (cellSize + gap);

  return (
    <div className="overflow-x-auto">
      <div className="w-fit mx-auto" style={{ minWidth: totalW + 30 }}>
        {/* Month labels */}
        <div className="relative mb-1 ml-8 h-4">
          {monthLabels.map(({ label, weekIndex }, i) => (
            <span
              key={i}
              className="text-[10px] text-muted-foreground absolute font-mono"
              style={{ left: `${weekIndex * (cellSize + gap)}px` }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-[2px] mr-1">
            {DAYS.map((day, i) => (
              <div
                key={i}
                className="text-[10px] text-muted-foreground font-mono flex items-center"
                style={{ height: cellSize }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[2px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((cell, di) => (
                  <div
                    key={di}
                    title={cell.date ? `${cell.date}: ${cell.count} action${cell.count !== 1 ? "s" : ""}` : undefined}
                    className="rounded-sm"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: cell.count === -1 ? "transparent" : getColor(cell.count),
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 justify-end">
          <span className="text-[10px] text-muted-foreground font-mono">Less</span>
          {[0, 1, 3, 5, 7].map((count) => (
            <div
              key={count}
              className="rounded-sm"
              style={{ width: cellSize, height: cellSize, background: getColor(count) }}
            />
          ))}
          <span className="text-[10px] text-muted-foreground font-mono">More</span>
        </div>
      </div>
    </div>
  );
}
