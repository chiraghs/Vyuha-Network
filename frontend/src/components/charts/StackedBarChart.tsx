import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { baseChartOptions, useChartTokens } from './chartTheme';

export interface StackedSeries {
  label: string;
  color: string;
  values: number[];
}

interface StackedBarChartProps {
  labels: string[];
  series: StackedSeries[];
}

/** Stacked composition bars — segments separated by a 2px surface gap. */
export function StackedBarChart({ labels, series }: StackedBarChartProps) {
  const tokens = useChartTokens();

  const data = useMemo(
    () => ({
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.values,
        backgroundColor: s.color,
        hoverBackgroundColor: s.color,
        borderColor: tokens.surface,
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false as const,
        maxBarThickness: 34,
      })),
    }),
    [labels, series, tokens],
  );

  const options = useMemo(() => {
    const base = baseChartOptions(tokens);
    return {
      ...base,
      scales: {
        x: { ...base.scales.x, stacked: true },
        y: { ...base.scales.y, stacked: true },
      },
    };
  }, [tokens]);

  return <Bar data={data} options={options} />;
}
