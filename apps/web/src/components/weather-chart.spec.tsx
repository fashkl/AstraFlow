/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import type { WeatherRecord } from '@livecoding/shared';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ChartErrorBoundary } from './chart-error-boundary';
import { WeatherChart } from './weather-chart';

jest.mock('recharts', () => {
  const passThrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);

  return {
    CartesianGrid: passThrough,
    Legend: passThrough,
    Line: ({ name }: { name: string }) => React.createElement('div', { 'data-line': name }, name),
    LineChart: ({ children, data }: { children?: React.ReactNode; data?: unknown[] }) =>
      React.createElement('div', { 'data-points': Array.isArray(data) ? data.length : 0 }, children),
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    Tooltip: passThrough,
    XAxis: passThrough,
    YAxis: passThrough,
  };
});

const SAMPLE_RECORDS: WeatherRecord[] = [
  {
    date: '2024-01-01',
    precipitationSum: 0.5,
    temperatureMax: 27,
    temperatureMin: 19,
  },
  {
    date: '2024-01-02',
    precipitationSum: 0.2,
    temperatureMax: 28,
    temperatureMin: 20,
  },
];

describe('WeatherChart', () => {
  it('renders chart with weather points', () => {
    render(<WeatherChart records={SAMPLE_RECORDS} />);

    expect(screen.getByText('Daily Weather Trends')).toBeInTheDocument();
    expect(screen.getByTestId('weather-line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders empty state when no records are available', () => {
    render(<WeatherChart records={[]} />);

    expect(screen.getByText('No weather data available for this date range.')).toBeInTheDocument();
  });

  it('shows fallback when chart rendering throws inside error boundary', () => {
    const originalConsoleError = console.error;
    console.error = jest.fn();

    const BrokenChart = (): never => {
      throw new Error('chart exploded');
    };

    render(
      <ChartErrorBoundary>
        <BrokenChart />
      </ChartErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'We could not render the weather chart right now.',
    );

    console.error = originalConsoleError;
  });
});
