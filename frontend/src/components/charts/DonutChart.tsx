import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { baseChartOptions, useChartTokens } from './chartTheme';

interface DonutChartProps {
  labels: string[];
  values: number[];
  colors: string[];
  centerLabel?: string;
  centerValue?: string;
}

/** Part-to-whole donut with a 2px surface gap between segments. */
export function DonutChart({ labels, values, colors, centerLabel, centerValue }: DonutChartProps) {
  const tokens = useChartTokens();

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          hoverBackgroundColor: colors,
          borderColor: tokens.surface,
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [labels, values, colors, tokens],
  );

  const options = useMemo(() => {
    const base = baseChartOptions(tokens);
    return {
      ...base,
      cutout: '68%',
      interaction: { mode: 'nearest' as const, intersect: true },
      scales: {},
    };
  }, [tokens]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Doughnut data={data} options={options} />
      {centerValue && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 600,
                color: 'var(--text-1)',
                lineHeight: 1.1,
              }}
            >
              {centerValue}
            </div>
            {centerLabel && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{centerLabel}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
