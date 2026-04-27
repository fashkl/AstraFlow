import { Module } from '@nestjs/common';
import { HttpClientModule } from '../http-client/http-client.module';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';

@Module({
  controllers: [WeatherController],
  imports: [HttpClientModule],
  providers: [WeatherService],
})
export class WeatherModule {
}
