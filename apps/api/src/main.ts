import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller()
class RootController {
  @Get()
  index(): { service: 'api'; status: 'ok'; message: string; healthEndpoint: string } {
    return {
      service: 'api',
      status: 'ok',
      message: 'Welcome to the Livecoding API',
      healthEndpoint: '/health',
    };
  }
}

@Controller('health')
class HealthController {
  @Get()
  health(): { service: 'api'; status: 'ok'; timestamp: string } {
    return {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [RootController, HealthController],
})
class AppModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(port, host);
  console.log(`API ready on http://${host}:${port}`);
}

void bootstrap();
