'use client';

import * as React from 'react';
import { Label, Pie, PieChart } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export interface BreakdownDatum {
  event_type: string;
  count: number;
}

const chartConfig = {
  count: { label: 'Events' },
  click: { label: 'Click', color: 'hsl(var(--chart-2))' },
  view: { label: 'View', color: 'hsl(var(--chart-1))' },
  state_change: { label: 'State change', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;

export default function BreakdownChart({ data }: { data: BreakdownDatum[] }) {
  const chartData = React.useMemo(
    () =>
      data.map((d) => ({
        ...d,
        fill: `var(--color-${d.event_type})`,
      })),
    [data]
  );

  const total = React.useMemo(
    () => data.reduce((acc, d) => acc + d.count, 0),
    [data]
  );

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[260px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent nameKey="event_type" hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="event_type"
          innerRadius={60}
          strokeWidth={4}
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {total.toLocaleString()}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 22}
                      className="fill-muted-foreground text-xs"
                    >
                      Events
                    </tspan>
                  </text>
                );
              }
              return null;
            }}
          />
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="event_type" />}
          className="-translate-y-1 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
        />
      </PieChart>
    </ChartContainer>
  );
}
