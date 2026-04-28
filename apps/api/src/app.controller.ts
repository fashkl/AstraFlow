import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@astraflow/shared';

@Controller()
export class AppController {
  @Get()
  index(): { service: 'api'; status: 'ok'; message: string; healthEndpoint: string } {
    return {
      service: 'api',
      status: 'ok',
      message: 'Welcome to the AstraFlow API',
      healthEndpoint: '/api/v1/health',
    };
  }

  @Get('health')
  health(): HealthStatus {
    return {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
