import type { WeatherQuery, WeatherResponse } from '@livecoding/shared';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

function getErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const candidate = (payload as { message?: unknown }).message;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return `Weather request failed with status ${status}`;
}

export class WeatherApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'WeatherApiError';
  }
}

export function buildWeatherUrl(query: WeatherQuery): string {
  const search = new URLSearchParams({
    end: query.end,
    location: query.location,
    page: String(query.page ?? DEFAULT_PAGE),
    pageSize: String(query.pageSize ?? DEFAULT_PAGE_SIZE),
    start: query.start,
  });

  return `/api/weather?${search.toString()}`;
}

export async function fetchWeather(
  query: WeatherQuery,
  fetchFn: typeof fetch = fetch,
): Promise<WeatherResponse> {
  const response = await fetchFn(buildWeatherUrl(query), {
    headers: { Accept: 'application/json' },
  });

  const raw = await response.text();
  const parsed = raw.length > 0 ? parsePayload(raw) : null;

  if (!response.ok) {
    throw new WeatherApiError(getErrorMessage(parsed, response.status), response.status, parsed);
  }

  return parsed as WeatherResponse;
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
}
