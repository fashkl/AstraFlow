import { Module } from '@nestjs/common';
import {
  DEFAULT_HTTP_CLIENT_CONFIG,
  HTTP_CLIENT_CONFIG,
  HTTP_CLIENT_FETCH,
  HTTP_CLIENT_SLEEP,
} from './http-client.constants';
import { HttpClientService } from './http-client.service';

@Module({
  providers: [
    HttpClientService,
    {
      provide: HTTP_CLIENT_CONFIG,
      useValue: DEFAULT_HTTP_CLIENT_CONFIG,
    },
    {
      provide: HTTP_CLIENT_FETCH,
      useValue: (input: string, init?: RequestInit) => fetch(input, init),
    },
    {
      provide: HTTP_CLIENT_SLEEP,
      useValue: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    },
  ],
  exports: [HttpClientService],
})
export class HttpClientModule {
}
