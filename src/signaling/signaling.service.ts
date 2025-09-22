import { Injectable } from '@nestjs/common';
import * as WebSocket from 'ws';

export interface Room {
  id: string;
  clients: Set<string>;
}

export interface ClientInfo {
  id: string;
  room_id?: string;
  ws?: WebSocket;
}

@Injectable()
export class SignalingService {
  private rooms = new Map<string, Room>();
  private clients = new Map<string, ClientInfo>();

  createRoom(room_id: string): Room | undefined {
    if (!this.rooms.has(room_id)) {
      const room: Room = {
        id: room_id,
        clients: new Set(),
      };

      this.rooms.set(room_id, room);
      return room;
    }
    return this.rooms.get(room_id);
  }

  joinRoom(clientId: string, room_id: string, ws: WebSocket): boolean {
    const room = this.createRoom(room_id);

    if (!room) return false;
    if (room.clients.size >= 2) {
      return false;
    }

    room.clients.add(clientId);
    const client = this.clients.get(clientId) || { id: clientId };
    client.room_id = room_id;
    client.ws = ws;
    this.clients.set(clientId, client);

    return true;
  }

  leaveRoom(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || !client.room_id) return;

    const room = this.rooms.get(client.room_id);
    if (room) {
      room.clients.delete(clientId);
      if (room.clients.size === 0) {
        this.rooms.delete(client.room_id);
      }
    }

    client.room_id = undefined;
  }

  removeClient(clientId: string): void {
    this.leaveRoom(clientId);
    this.clients.delete(clientId);
  }

  sendToRoom(senderId: string, message: any): void {
    const sender = this.clients.get(senderId);
    if (!sender || !sender.room_id) return;

    const room = this.rooms.get(sender.room_id);
    if (!room) return;

    room.clients.forEach((clientId) => {
      if (clientId !== senderId) {
        const client = this.clients.get(clientId);
        if (client && client.ws) {
          client.ws.send(JSON.stringify(message));
        }
      }
    });
  }

  getRoom(room_id: string): Room | undefined {
    return this.rooms.get(room_id);
  }

  getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }
}
