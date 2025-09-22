import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import * as WebSocket from 'ws';
import { Logger } from '@nestjs/common';
import { SignalingService } from './signaling.service';
import type { SignalingMessage } from './message.dto';

@WebSocketGateway({
  path: '/signaling',
  transports: ['websocket'],
})
export class SignalingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: WebSocket.Server;
  private logger: Logger = new Logger('SignalingGateway');

  constructor(private readonly signalingService: SignalingService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(server: WebSocket.Server) {
    this.logger.log('WebSocket server initialized');
  }

  handleConnection(client: WebSocket) {
    const clientId: string = this.generateClientId();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (client as any).clientId = clientId;

    this.logger.log(`Client connected: ${clientId}`);

    client.send(
      JSON.stringify({
        type: 'connected',
        session_id: clientId,
        timestamp: Date.now(),
      }),
    );
  }

  handleDisconnect(client: WebSocket): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    const clientId: string = (client as any).clientId;
    if (clientId) {
      this.logger.log(`Client disconnected: ${clientId}`);
      this.signalingService.removeClient(clientId);
    }
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: SignalingMessage,
    @ConnectedSocket() client: WebSocket,
  ) {
    if (data.type === 'offer') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const clientId: string = (client as any).clientId;
      const { type, sdp, session_id, room_id } = data;
      this.logger.log(`Received offer from ${session_id} in room ${room_id}`);

      this.signalingService.sendToRoom(clientId, {
        type,
        sdp,
        session_id,
        room_id,
      });
    } else if (data.type === 'answer') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const clientId: string = (client as any).clientId;
      const { type, sdp, session_id, room_id } = data;
      this.logger.log(`Received answer from ${session_id} in room ${room_id}`);

      this.signalingService.sendToRoom(clientId, {
        type,
        sdp,
        session_id,
        room_id,
      });
    } else if (data.type === 'ice-candidate') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const clientId: string = (client as any).clientId;
      const { type, candidate, sdpMid, sdpMLineIndex, session_id, room_id } =
        data;

      this.signalingService.sendToRoom(clientId, {
        type,
        candidate,
        sdpMid,
        sdpMLineIndex,
        session_id,
        room_id,
      });
    } else if (data.type === 'join-room') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const clientId: string = (client as any).clientId;
      const { type, session_id, room_id } = data;

      const success = this.signalingService.joinRoom(clientId, room_id, client);
      if (success) {
        this.logger.log(`Client ${session_id} joined room ${room_id}`);

        client.send(
          JSON.stringify({
            type,
            session_id,
            room_id,
            success: true,
          }),
        );

        this.signalingService.sendToRoom(clientId, {
          type: 'user-joined',
          clientId: clientId,
        });
      } else {
        this.logger.log(`Client ${clientId} failed to join room ${room_id}`);

        client.send(
          JSON.stringify({
            type,
            session_id,
            room_id,
            success: false,
          }),
        );
      }
    } else if (data.type === 'leave-room') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const clientId: string = (client as any).clientId;
      const clientInfo = this.signalingService.getClient(clientId);
      const { type } = data;

      if (clientInfo && clientInfo.room_id) {
        this.logger.log(
          `Client ${clientId} leaving room ${clientInfo.room_id}`,
        );

        this.signalingService.sendToRoom(clientId, {
          type: 'user-left',
          session_id: clientId,
        });

        this.signalingService.leaveRoom(clientId);

        client.send(
          JSON.stringify({
            type,
            success: true,
          }),
        );
      }
    }
  }

  private generateClientId(): string {
    return 'client_' + Math.random().toString(36).substring(2, 15);
  }
}
