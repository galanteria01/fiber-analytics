'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface BreakdownDatum {
  event_type: string;
  count: number;
}

const COLORS: Record<string, string> = {
  click: '#34d399',
  view: '#60a5fa',
  state_change: '#fbbf24',
};

export default function BreakdownChart({ data }: { data: BreakdownDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="event_type" innerRadius={50} outerRadius={85}>
          {data.map((entry) => (
            <Cell key={entry.event_type} fill={COLORS[entry.event_type] ?? '#a78bfa'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#0b1020', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
