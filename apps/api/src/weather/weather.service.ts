import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { type WeatherRecord, type WeatherResponse } from '@livecoding/shared';
import { CircuitOpenError, RetryExhaustedError } from '../http-client/http-client.errors';
import { HttpClientService } from '../http-client/http-client.service';
import { WeatherQueryDto } from './weather.dto';

interface OpenMeteoArchiveResponse {
  daily?: {
    precipitation_sum?: unknown[];
    temperature_2m_max?: unknown[];
    temperature_2m_min?: unknown[];
    time?: unknown[];
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_RANGE_DAYS = 366;

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(private readonly httpClientService: HttpClientService) {}

  async getWeather(query: WeatherQueryDto): Promise<WeatherResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const { latitude, longitude } = this.parseLocation(query.location);
    this.logger.log(
      `Weather request received location=${latitude},${longitude} start=${query.start} end=${query.end} page=${page} pageSize=${pageSize}`,
    );

    this.assertDateRange(query.start, query.end);
    const records = await this.fetchWeatherRecords({
      end: query.end,
      latitude,
      longitude,
      start: query.start,
    });

    const totalItems = records.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const data = records.slice(startIndex, startIndex + pageSize);
    this.logger.log(
      `Weather request completed totalItems=${totalItems} returned=${data.length} totalPages=${totalPages}`,
    );

    return {
      data,
      location: { latitude, longitude },
      pagination: { page, pageSize, totalItems, totalPages },
      range: { end: query.end, start: query.start },
    };
  }

  private assertDateRange(start: string, end: string): void {
    const startDate = this.parseStrictDate(start, 'start');
    const endDate = this.parseStrictDate(end, 'end');
    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('start must be before or equal to end');
    }

    const rangeDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`date range must be ${MAX_RANGE_DAYS} days or fewer`);
    }
  }

  private async fetchWeatherRecords(params: {
    end: string;
    latitude: number;
    longitude: number;
    start: string;
  }): Promise<WeatherRecord[]> {
    const endpoint = this.buildArchiveUrl(params);

    let payload: OpenMeteoArchiveResponse;
    try {
      this.logger.debug(`Fetching weather data from Open-Meteo endpoint=${endpoint}`);
      payload = await this.httpClientService.getJson<OpenMeteoArchiveResponse>(endpoint);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        this.logger.warn('Open-Meteo request blocked because upstream circuit is open');
        throw new ServiceUnavailableException({
          code: 'WEATHER_UPSTREAM_CIRCUIT_OPEN',
          message: 'Weather upstream circuit is open',
        });
      }
      if (error instanceof RetryExhaustedError) {
        this.logger.warn('Open-Meteo request failed after all retries were exhausted');
        throw new ServiceUnavailableException({
          code: 'WEATHER_UPSTREAM_UNAVAILABLE',
          message: 'Weather upstream is unavailable',
        });
      }
      this.logger.error(
        `Unexpected Open-Meteo failure error=${
          error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        }`,
      );
      throw error;
    }

    const daily = payload.daily;
    if (!daily || !Array.isArray(daily.time)) {
      this.logger.error('Open-Meteo response missing daily.time array');
      throw new ServiceUnavailableException({
        code: 'WEATHER_UPSTREAM_INVALID_RESPONSE',
        message: 'Weather upstream returned invalid data',
      });
    }

    const maxTemps = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
    const minTemps = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
    const precipitation = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : [];

    const records = daily.time.map((value, index) => ({
      date: String(value),
      precipitationSum: this.toNullableNumber(precipitation[index]),
      temperatureMax: this.toNullableNumber(maxTemps[index]),
      temperatureMin: this.toNullableNumber(minTemps[index]),
    }));

    this.logger.debug(`Open-Meteo payload transformed into ${records.length} daily records`);
    return records;
  }

  private buildArchiveUrl(params: {
    end: string;
    latitude: number;
    longitude: number;
    start: string;
  }): string {
    const search = new URLSearchParams({
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
      end_date: params.end,
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      start_date: params.start,
      timezone: 'UTC',
    });
    return `https://archive-api.open-meteo.com/v1/archive?${search.toString()}`;
  }

  private parseLocation(location: string): { latitude: number; longitude: number } {
    const parts = location.split(',');
    if (parts.length !== 2) {
      throw new BadRequestException('location must be in "latitude,longitude" format');
    }

    const latitude = Number(parts[0].trim());
    const longitude = Number(parts[1].trim());
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('location must contain valid numeric coordinates');
    }
    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException('latitude must be between -90 and 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException('longitude must be between -180 and 180');
    }

    return { latitude, longitude };
  }

  private parseStrictDate(value: string, fieldName: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new BadRequestException(`${fieldName} must be in YYYY-MM-DD format`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} must be a real calendar date`);
    }

    return parsed;
  }

  private toNullableNumber(value: unknown): number | null {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : null;
  }
}
