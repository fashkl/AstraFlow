import type { WeatherRecord } from '@astraflow/shared';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface WeatherChartProps {
  records: WeatherRecord[];
}

interface WeatherChartPoint {
  date: string;
  precipitationSum: number | null;
  temperatureMax: number | null;
  temperatureMin: number | null;
}

export function WeatherChart({ records }: WeatherChartProps) {
  if (records.length === 0) {
    return <div className="chart-empty">No weather data available for this date range.</div>;
  }

  const chartData: WeatherChartPoint[] = records.map((record) => ({
    date: formatChartDate(record.date),
    precipitationSum: record.precipitationSum,
    temperatureMax: record.temperatureMax,
    temperatureMin: record.temperatureMin,
  }));

  return (
    <section className="chart-panel" data-testid="weather-line-chart">
      <h2>Daily Weather Trends</h2>
      <div className="chart-container">
        <ResponsiveContainer height={320} width="100%">
          <LineChart data={chartData} margin={{ bottom: 8, left: 8, right: 16, top: 12 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
            <XAxis dataKey="date" minTickGap={24} stroke="#64748b" />
            <YAxis stroke="#64748b" yAxisId="temp" />
            <YAxis orientation="right" stroke="#64748b" yAxisId="precip" />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Line
              dataKey="temperatureMax"
              dot={false}
              name="Max Temp (°C)"
              stroke="#ef4444"
              strokeWidth={2}
              type="monotone"
              yAxisId="temp"
            />
            <Line
              dataKey="temperatureMin"
              dot={false}
              name="Min Temp (°C)"
              stroke="#3b82f6"
              strokeWidth={2}
              type="monotone"
              yAxisId="temp"
            />
            <Line
              dataKey="precipitationSum"
              dot={false}
              name="Precipitation (mm)"
              stroke="#0f766e"
              strokeWidth={2}
              type="monotone"
              yAxisId="precip"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function formatChartDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }

  return `${month}/${day}`;
}
