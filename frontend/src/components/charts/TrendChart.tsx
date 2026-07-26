import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { baseChartOptions, useChartTokens } from './chartTheme';

export interface TrendSeries {
  label: string;
  color: string;
  points: number[];
}

interface TrendChartProps {
  labels: string[];
  series: TrendSeries[];
}

/** Multi-series incident trend line with a shared crosshair tooltip. */
export function TrendChart({ labels, series }: TrendChartProps) {
  const tokens = useChartTokens();

  const data = useMemo(
    () => ({
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.points,
        borderColor: s.color,
        backgroundColor: s.color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: s.color,
        pointHoverBorderColor: tokens.surface,
        pointHoverBorderWidth: 2,
        tension: 0.25,
      })),
    }),
    [labels, series, tokens],
  );

  const options = useMemo(() => baseChartOptions(tokens), [tokens]);

  return <Line data={data} options={options} />;
}
