import type { WeatherResponse } from '@astraflow/shared';
import { buildWeatherUrl, fetchWeather, WeatherApiError } from './weather-client';

describe('weather-client', () => {
  it('builds a weather URL and returns typed payload on success', async () => {
    const payload: WeatherResponse = {
      data: [
        {
          date: '2024-01-01',
          precipitationSum: 1.2,
          temperatureMax: 29,
          temperatureMin: 20,
        },
      ],
      location: {
        latitude: 25.2,
        longitude: 55.3,
      },
      pagination: {
        page: 2,
        pageSize: 25,
        totalItems: 120,
        totalPages: 5,
      },
      range: {
        end: '2024-01-31',
        start: '2024-01-01',
      },
    };

    const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );

    const result = await fetchWeather(
      {
        end: '2024-01-31',
        location: '25.2,55.3',
        page: 2,
        pageSize: 25,
        start: '2024-01-01',
      },
      fetchMock,
    );

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/weather?end=2024-01-31&location=25.2%2C55.3&page=2&pageSize=25&start=2024-01-01',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('throws WeatherApiError with status and upstream details on error response', async () => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'location must be in "latitude,longitude" format',
          statusCode: 400,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        },
      ),
    );

    let thrownError: unknown = null;
    try {
      await fetchWeather(
        {
          end: '2024-01-31',
          location: 'invalid',
          start: '2024-01-01',
        },
        fetchMock,
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(WeatherApiError);
    const typedError = thrownError as WeatherApiError;
    expect(typedError.message).toContain('location must be');
    expect(typedError.status).toBe(400);
    expect(typedError.details).toEqual({
      message: 'location must be in "latitude,longitude" format',
      statusCode: 400,
    });
  });

  it('propagates network failures from fetch', async () => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(
      fetchWeather(
        {
          end: '2024-01-31',
          location: '25.2,55.3',
          start: '2024-01-01',
        },
        fetchMock,
      ),
    ).rejects.toThrow('network down');
  });

  it('uses defaults for pagination when omitted', () => {
    expect(
      buildWeatherUrl({
        end: '2024-01-31',
        location: '25.2,55.3',
        start: '2024-01-01',
      }),
    ).toBe(
      '/api/v1/weather?end=2024-01-31&location=25.2%2C55.3&page=1&pageSize=50&start=2024-01-01',
    );
  });
});
