'use client';

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export interface ComponentDatum {
  component_name: string;
  events: number;
}

const chartConfig = {
  events: { label: 'Events', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

export default function ComponentsChart({ data }: { data: ComponentDatum[] }) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto w-full"
      style={{ height: Math.max(200, data.length * 44) }}
    >
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 8, right: 32 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" dataKey="events" hide />
        <YAxis
          type="category"
          dataKey="component_name"
          tickLine={false}
          axisLine={false}
          width={120}
          tickMargin={8}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="events" fill="var(--color-events)" radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="events"
            position="right"
            offset={8}
            className="fill-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
