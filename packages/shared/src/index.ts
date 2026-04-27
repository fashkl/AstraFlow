export interface HealthStatus {
  service: 'api' | 'web';
  status: 'ok';
  timestamp: string;
}

export interface WeatherRecord {
  date: string;
  precipitationSum: number | null;
  temperatureMax: number | null;
  temperatureMin: number | null;
}

export interface WeatherQuery {
  end: string;
  location: string;
  page?: number;
  pageSize?: number;
  start: string;
}

export interface WeatherResponse {
  data: WeatherRecord[];
  location: {
    latitude: number;
    longitude: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  range: {
    end: string;
    start: string;
  };
}
