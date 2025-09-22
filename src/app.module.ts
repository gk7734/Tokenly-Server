import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SignalingGateway } from './signaling/signaling.gateway';
import { SignalingService } from './signaling/signaling.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, SignalingGateway, SignalingService],
})
export class AppModule {}
