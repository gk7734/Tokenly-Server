import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("turn-credentials")
  getTurnCredentials() {
    return {
      url: "turn:127.0.0.1:3478",
      username: "username1",
      credential: "key1"
    }
  }
}
