"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardChartProps {
  data: { name: string; completed: number; created: number }[];
}

export function DashboardChart({ data }: DashboardChartProps) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 0,
            left: -25,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#A5B4FC" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#A5B4FC" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94A3B8", fontSize: 12, fontWeight: 500 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94A3B8", fontSize: 12, fontWeight: 500 }} 
          />
          <Tooltip 
            contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", color: "#1E293B", fontWeight: 500 }}
          />
          <Area 
            type="monotone" 
            dataKey="created" 
            stroke="#A5B4FC" 
            strokeWidth={2}
            strokeDasharray="4 4"
            fillOpacity={1} 
            fill="url(#colorCreated)" 
          />
          <Area 
            type="monotone" 
            dataKey="completed" 
            stroke="#2563EB" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorCompleted)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
