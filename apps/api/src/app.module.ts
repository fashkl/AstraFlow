import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LlmModule } from './llm/llm.module';
import { WeatherModule } from './weather/weather.module';

@Module({
  imports: [WeatherModule, LlmModule],
  controllers: [AppController],
})
export class AppModule {}
