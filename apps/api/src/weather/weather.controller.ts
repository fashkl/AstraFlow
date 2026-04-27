import { Controller, Get, Query } from '@nestjs/common';
import { type WeatherResponse } from '@livecoding/shared';
import { WeatherQueryDto } from './weather.dto';
import { WeatherService } from './weather.service';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  async getWeather(@Query() query: WeatherQueryDto): Promise<WeatherResponse> {
    return this.weatherService.getWeather(query);
  }
}
