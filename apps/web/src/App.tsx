import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { WeatherQuery } from '@astraflow/shared';
import { type FormEvent, useMemo, useState } from 'react';
import { fetchWeather, WeatherApiError } from './api/weather-client';
import { ChartErrorBoundary } from './components/chart-error-boundary';
import { ChartSkeleton } from './components/chart-skeleton';
import { StreamingChat } from './components/streaming-chat';
import { WeatherChart } from './components/weather-chart';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

const DEFAULT_QUERY: WeatherQuery = {
  end: '2024-01-31',
  location: '25.2048,55.2708',
  page: 1,
  pageSize: 50,
  start: '2024-01-01',
};

export default function App() {
  const [draft, setDraft] = useState<WeatherQuery>(DEFAULT_QUERY);
  const [query, setQuery] = useState<WeatherQuery>(DEFAULT_QUERY);

  const weatherQuery = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => fetchWeather(query),
    queryKey: ['weather', query],
  });

  const pageLabel = useMemo(() => {
    const totalPages = weatherQuery.data?.pagination.totalPages ?? 0;
    const currentPage = weatherQuery.data?.pagination.page ?? query.page ?? 1;
    return `${currentPage} / ${totalPages || 1}`;
  }, [query.page, weatherQuery.data]);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setQuery({ ...draft, page: 1 });
  };

  const totalPages = weatherQuery.data?.pagination.totalPages ?? 0;
  const currentPage = weatherQuery.data?.pagination.page ?? query.page ?? 1;

  const goToPage = (page: number): void => {
    if (page < 1 || (totalPages > 0 && page > totalPages)) {
      return;
    }
    setQuery((previous) => ({ ...previous, page }));
  };

  const errorMessage =
    weatherQuery.error instanceof WeatherApiError
      ? `${weatherQuery.error.message} (HTTP ${weatherQuery.error.status})`
      : weatherQuery.error instanceof Error
      ? weatherQuery.error.message
      : 'Unexpected error while loading weather data.';

  return (
    <main className="app-shell">
      <header className="page-header">
        <h1>Weather Data Explorer</h1>
        <p>React Query API layer wired to the NestJS weather endpoint.</p>
      </header>

      <section className="query-panel">
        <form className="query-form" onSubmit={submit}>
          <label>
            Location (lat,long)
            <input
              name="location"
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, location: event.target.value }))
              }
              type="text"
              value={draft.location}
            />
          </label>
          <label>
            Start date
            <input
              name="start"
              onChange={(event) => setDraft((previous) => ({ ...previous, start: event.target.value }))}
              type="date"
              value={draft.start}
            />
          </label>
          <label>
            End date
            <input
              name="end"
              onChange={(event) => setDraft((previous) => ({ ...previous, end: event.target.value }))}
              type="date"
              value={draft.end}
            />
          </label>
          <label>
            Page size
            <select
              name="pageSize"
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, pageSize: Number(event.target.value) }))
              }
              value={draft.pageSize}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Load weather data</button>
        </form>
      </section>

      {weatherQuery.isPending ? <ChartSkeleton /> : null}
      {weatherQuery.isError ? <p className="status status-error">{errorMessage}</p> : null}

      {weatherQuery.data ? (
        <section className="result-panel">
          <div className="result-meta">
            <p>
              Coordinates: {weatherQuery.data.location.latitude}, {weatherQuery.data.location.longitude}
            </p>
            <p>
              Range: {weatherQuery.data.range.start} to {weatherQuery.data.range.end}
            </p>
            <p>Total records: {weatherQuery.data.pagination.totalItems}</p>
          </div>

          <ChartErrorBoundary>
            <WeatherChart records={weatherQuery.data.data} />
          </ChartErrorBoundary>

          {weatherQuery.isFetching ? <p className="status">Refreshing data...</p> : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Max Temp (°C)</th>
                  <th>Min Temp (°C)</th>
                  <th>Precip (mm)</th>
                </tr>
              </thead>
              <tbody>
                {weatherQuery.data.data.length > 0 ? (
                  weatherQuery.data.data.map((record) => (
                    <tr key={record.date}>
                      <td>{record.date}</td>
                      <td>{record.temperatureMax ?? '-'}</td>
                      <td>{record.temperatureMin ?? '-'}</td>
                      <td>{record.precipitationSum ?? '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No records for the selected range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              disabled={currentPage <= 1 || weatherQuery.isFetching}
              onClick={() => goToPage(currentPage - 1)}
              type="button"
            >
              Previous
            </button>
            <span>Page {pageLabel}</span>
            <button
              disabled={totalPages === 0 || currentPage >= totalPages || weatherQuery.isFetching}
              onClick={() => goToPage(currentPage + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </section>
      ) : null}
      <StreamingChat />
    </main>
  );
}
