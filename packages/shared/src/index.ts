export interface HealthStatus {
  service: 'api' | 'web';
  status: 'ok';
  timestamp: string;
}
