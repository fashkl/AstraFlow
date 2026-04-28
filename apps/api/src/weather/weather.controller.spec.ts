import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import {
  HTTP_CLIENT_CONFIG,
  HTTP_CLIENT_FETCH,
  HTTP_CLIENT_SLEEP,
  type HttpClientFetch,
} from '../http-client/http-client.constants';

function buildArchiveResponse(): Response {
  return new Response(
    JSON.stringify({
      daily: {
        precipitation_sum: [0, 1.2, 3.4],
        temperature_2m_max: [26.5, 27.1, 28],
        temperature_2m_min: [19, 20.2, 20.7],
        time: ['2026-01-01', '2026-01-02', '2026-01-03'],
      },
    }),
    {
      headers: { 'content-type': 'application/json' },
      status: 200,
    },
  );
}

describe('WeatherController (integration)', () => {
  let app: INestApplication;
  let fetchFn: jest.MockedFunction<HttpClientFetch>;

  beforeEach(async () => {
    fetchFn = jest.fn();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HTTP_CLIENT_CONFIG)
      .useValue({
        failureThreshold: 2,
        resetTimeoutMs: 10_000,
        retryDelaysMs: [],
        retryJitterRatio: 0,
      })
      .overrideProvider(HTTP_CLIENT_FETCH)
      .useValue(fetchFn)
      .overrideProvider(HTTP_CLIENT_SLEEP)
      .useValue(async () => undefined)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      defaultVersion: '1',
      type: VersioningType.URI,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns paginated weather records for valid query parameters', async () => {
    fetchFn.mockResolvedValue(buildArchiveResponse());

    const response = await request(app.getHttpServer())
      .get('/api/v1/weather')
      .query({
        end: '2026-01-03',
        location: '25.2048,55.2708',
        page: '1',
        pageSize: '2',
        start: '2026-01-01',
      })
      .expect(200);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(response.body.location).toEqual({ latitude: 25.2048, longitude: 55.2708 });
    expect(response.body.range).toEqual({ end: '2026-01-03', start: '2026-01-01' });
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
    });
    expect(response.body.data).toEqual([
      {
        date: '2026-01-01',
        precipitationSum: 0,
        temperatureMax: 26.5,
        temperatureMin: 19,
      },
      {
        date: '2026-01-02',
        precipitationSum: 1.2,
        temperatureMax: 27.1,
        temperatureMin: 20.2,
      },
    ]);
  });

  it('returns 400 for DTO validation failures', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/weather')
      .query({
        end: '2026-01-03',
        location: 'invalid-location',
        start: '2026-01-01',
      })
      .expect(400);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(response.body.message).toContain('location must be in "latitude,longitude" format');
  });

  it('returns 400 for logical date-range edge cases', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/weather')
      .query({
        end: '2026-01-01',
        location: '25.2,55.3',
        start: '2026-01-03',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('start must be before or equal to end');
      });

    await request(app.getHttpServer())
      .get('/api/v1/weather')
      .query({
        end: '2026-02-30',
        location: '25.2,55.3',
        start: '2026-02-01',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('end must be a real calendar date');
      });
  });

  it('returns 503 and then circuit-open response when upstream remains unreachable', async () => {
    fetchFn.mockRejectedValue(new Error('network down'));

    const query = {
      end: '2026-01-03',
      location: '25.2,55.3',
      start: '2026-01-01',
    };

    await request(app.getHttpServer()).get('/api/v1/weather').query(query).expect(503).expect({
      code: 'WEATHER_UPSTREAM_UNAVAILABLE',
      message: 'Weather upstream is unavailable',
    });

    await request(app.getHttpServer()).get('/api/v1/weather').query(query).expect(503).expect({
      code: 'WEATHER_UPSTREAM_UNAVAILABLE',
      message: 'Weather upstream is unavailable',
    });

    await request(app.getHttpServer()).get('/api/v1/weather').query(query).expect(503).expect({
      code: 'WEATHER_UPSTREAM_CIRCUIT_OPEN',
      message: 'Weather upstream circuit is open',
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns 503 for malformed upstream payloads', async () => {
    fetchFn.mockResolvedValue(
      new Response(JSON.stringify({ unexpected: true }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/weather')
      .query({
        end: '2026-01-03',
        location: '25.2,55.3',
        start: '2026-01-01',
      })
      .expect(503)
      .expect((res) => {
        expect(res.body.code).toBe('WEATHER_UPSTREAM_INVALID_RESPONSE');
      });
  });
});
