import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpClientService } from '../http-client/http-client.service';
import { WeatherService } from './weather.service';

interface OpenMeteoMockPayload {
  daily: {
    precipitation_sum?: unknown[];
    temperature_2m_max?: unknown[];
    temperature_2m_min?: unknown[];
    time: unknown[];
  };
}

function buildPayload(payload?: Partial<OpenMeteoMockPayload['daily']>): OpenMeteoMockPayload {
  return {
    daily: {
      precipitation_sum: [0],
      temperature_2m_max: [20],
      temperature_2m_min: [10],
      time: ['2026-01-01'],
      ...payload,
    },
  };
}

async function buildServiceWithHttpMock() {
  const getJson = jest.fn();
  const moduleRef = await Test.createTestingModule({
    providers: [
      WeatherService,
      {
        provide: HttpClientService,
        useValue: { getJson },
      },
    ],
  }).compile();

  return {
    getJson,
    service: moduleRef.get(WeatherService),
  };
}

describe('WeatherService', () => {
  it('throws 400 when latitude is out of range (> 90)', async () => {
    const { getJson, service } = await buildServiceWithHttpMock();

    await expect(
      service.getWeather({
        end: '2026-01-01',
        location: '91,55',
        start: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(getJson).not.toHaveBeenCalled();
  });

  it('throws 400 when longitude is out of range (< -180)', async () => {
    const { getJson, service } = await buildServiceWithHttpMock();

    await expect(
      service.getWeather({
        end: '2026-01-01',
        location: '25,-181',
        start: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(getJson).not.toHaveBeenCalled();
  });

  it('accepts start===end as a valid single-day range', async () => {
    const { getJson, service } = await buildServiceWithHttpMock();
    getJson.mockResolvedValue(buildPayload());

    const response = await service.getWeather({
      end: '2026-01-01',
      location: '25.2048,55.2708',
      start: '2026-01-01',
    });

    expect(getJson).toHaveBeenCalledTimes(1);
    expect(response.pagination.totalItems).toBe(1);
    expect(response.pagination.totalPages).toBe(1);
    expect(response.data[0]).toEqual({
      date: '2026-01-01',
      precipitationSum: 0,
      temperatureMax: 20,
      temperatureMin: 10,
    });
  });

  it('accepts date range exactly MAX_RANGE_DAYS (366 days)', async () => {
    const { getJson, service } = await buildServiceWithHttpMock();
    getJson.mockResolvedValue(buildPayload());

    await expect(
      service.getWeather({
        end: '2024-12-31',
        location: '25.2048,55.2708',
        start: '2024-01-01',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects date range longer than MAX_RANGE_DAYS (367 days)', async () => {
    const { getJson, service } = await buildServiceWithHttpMock();

    await expect(
      service.getWeather({
        end: '2025-01-01',
        location: '25.2048,55.2708',
        start: '2024-01-01',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(getJson).not.toHaveBeenCalled();
  });

  it('rejects Feb 29 on non-leap year', async () => {
    const { getJson, service } = await buildServiceWithHttpMock();

    await expect(
      service.getWeather({
        end: '2023-03-01',
        location: '25.2048,55.2708',
        start: '2023-02-29',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(getJson).not.toHaveBeenCalled();
  });

  it('maps mismatched upstream arrays to nullable numeric fields', async () => {
    const { service, getJson } = await buildServiceWithHttpMock();
    getJson.mockResolvedValue(
      buildPayload({
        precipitation_sum: [1.5],
        temperature_2m_max: [30],
        temperature_2m_min: [],
        time: ['2026-01-01', '2026-01-02'],
      }),
    );

    const response = await service.getWeather({
      end: '2026-01-02',
      location: '25.2048,55.2708',
      pageSize: 5,
      start: '2026-01-01',
    });

    expect(response.data).toEqual([
      {
        date: '2026-01-01',
        precipitationSum: 1.5,
        temperatureMax: 30,
        temperatureMin: null,
      },
      {
        date: '2026-01-02',
        precipitationSum: null,
        temperatureMax: null,
        temperatureMin: null,
      },
    ]);
  });
});
