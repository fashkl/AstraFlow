import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { HttpClientModule } from './http-client/http-client.module';

@Module({
  imports: [HttpClientModule],
  controllers: [AppController],
})
export class AppModule {}
