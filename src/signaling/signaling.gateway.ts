import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import {Server, Socket} from "socket.io";

@WebSocketGateway({ cors: { origin: "*" } })
export class SignalingGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms: Map<string, Set<string>> = new Map();

  @SubscribeMessage("join")
  handleJoin(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Set());
    this.rooms.get(roomId)!.add(client.id);
    client.join(roomId);
    client.emit("joined", roomId);
  }

  @SubscribeMessage("signal")
  handleSignal(@MessageBody() payload: { roomId: string, data: any }, @ConnectedSocket() client: Socket) {
    client.to(payload.roomId).emit("signal", {
      from: client.id,
      data: payload.data
    });
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.rooms.forEach((set) => set.delete(client.id))
  }
}
