import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@livecoding/shared';

@Controller()
export class AppController {
  @Get()
  index(): { service: 'api'; status: 'ok'; message: string; healthEndpoint: string } {
    return {
      service: 'api',
      status: 'ok',
      message: 'Welcome to the Livecoding API',
      healthEndpoint: '/health',
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
