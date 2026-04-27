import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { LlmModule } from './llm/llm.module';
import { pinoHttpConfig } from './logging/pino.config';
import { WeatherModule } from './weather/weather.module';

@Module({
  imports: [LoggerModule.forRoot({ pinoHttp: pinoHttpConfig }), WeatherModule, LlmModule],
  controllers: [AppController],
})
export class AppModule {}
