import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';

Chart.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Legend,
  Tooltip,
);

export interface ChartTokens {
  text1: string;
  text2: string;
  text3: string;
  grid: string;
  axis: string;
  surface: string;
  border: string;
  accent: string;
  series: string[];
  seq: string[];
  fontFamily: string;
}

function readToken(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

/**
 * Resolves the CSS design tokens into concrete values for canvas rendering.
 * Recomputed whenever the theme flips so charts restyle in place.
 */
export function useChartTokens(): ChartTokens {
  const { theme } = useTheme();
  return useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      text1: readToken(styles, '--text-1'),
      text2: readToken(styles, '--text-2'),
      text3: readToken(styles, '--text-3'),
      grid: readToken(styles, '--grid-line'),
      axis: readToken(styles, '--axis-line'),
      surface: readToken(styles, '--bg-surface'),
      border: readToken(styles, '--border-strong'),
      accent: readToken(styles, '--accent'),
      series: Array.from({ length: 8 }, (_, i) => readToken(styles, `--series-${i + 1}`)),
      seq: [100, 200, 300, 400, 500, 600, 700].map((step) => readToken(styles, `--seq-${step}`)),
      fontFamily: readToken(styles, '--font-ui') || 'Inter, system-ui, sans-serif',
    };
    // theme is the trigger for re-reading computed styles
  }, [theme]);
}

/** Shared scale/tooltip/legend options derived from the current tokens. */
export function baseChartOptions(tokens: ChartTokens) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    font: { family: tokens.fontFamily },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tokens.surface,
        titleColor: tokens.text1,
        bodyColor: tokens.text2,
        borderColor: tokens.border,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: tokens.fontFamily, weight: 600 as const, size: 12 },
        bodyFont: { family: tokens.fontFamily, size: 12 },
        boxPadding: 4,
        usePointStyle: true,
        caretSize: 5,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: tokens.axis },
        ticks: {
          color: tokens.text3,
          font: { family: tokens.fontFamily, size: 11 },
          maxRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: tokens.grid, drawTicks: false },
        border: { display: false },
        ticks: {
          color: tokens.text3,
          font: { family: tokens.fontFamily, size: 11 },
          precision: 0,
          padding: 6,
        },
      },
    },
  };
}
