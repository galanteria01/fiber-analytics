'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ComponentDatum {
  component_name: string;
  events: number;
}

export default function ComponentsChart({ data }: { data: ComponentDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="component_name"
          stroke="#9ca3af"
          fontSize={12}
          width={110}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{ background: '#0b1020', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        <Bar dataKey="events" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
