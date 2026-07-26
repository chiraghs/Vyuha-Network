import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { baseChartOptions, useChartTokens } from './chartTheme';

interface CategoryBarChartProps {
  labels: string[];
  values: number[];
  /** One color per bar — fixed identity colors, same order as labels. */
  colors: string[];
  horizontal?: boolean;
}

/** Category magnitude bars with rounded data-ends and hover tooltips. */
export function CategoryBarChart({ labels, values, colors, horizontal = true }: CategoryBarChartProps) {
  const tokens = useChartTokens();

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          hoverBackgroundColor: colors,
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: 'start' as const,
          maxBarThickness: 18,
        },
      ],
    }),
    [labels, values, colors],
  );

  const options = useMemo(() => {
    const base = baseChartOptions(tokens);
    if (!horizontal) return base;
    return {
      ...base,
      indexAxis: 'y' as const,
      interaction: { mode: 'nearest' as const, intersect: false },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: tokens.grid, drawTicks: false },
          border: { display: false },
          ticks: { color: tokens.text3, font: { family: tokens.fontFamily, size: 11 }, precision: 0 },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: tokens.text2, font: { family: tokens.fontFamily, size: 12 } },
        },
      },
    };
  }, [tokens, horizontal]);

  return <Bar data={data} options={options} />;
}
