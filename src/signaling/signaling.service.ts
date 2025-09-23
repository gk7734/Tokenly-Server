import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import WebSocket from 'ws';

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
export class SignalingService implements OnModuleInit, OnModuleDestroy {
  private rooms = new Map<string, Room>();
  private clients = new Map<string, ClientInfo>();
  private axumWebSocket: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.connectToAxumServer();
  }

  onModuleDestroy() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    if (this.axumWebSocket) {
      this.axumWebSocket.close();
    }
  }

  private connectToAxumServer() {
    try {
      this.axumWebSocket = new WebSocket('ws://127.0.0.1:3002/rtc');

      this.axumWebSocket.on('open', () => {
        console.log('Connected to Axum RTC server');
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      });

      this.axumWebSocket.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleAxumMessage(message);
        } catch (error) {
          console.error('Failed to parse Axum message:', error);
        }
      });

      this.axumWebSocket.on('close', () => {
        console.log('Disconnected from Axum RTC server, attempting reconnect...');
        this.axumWebSocket = null;
        if (!this.reconnectInterval) {
          this.reconnectInterval = setInterval(() => {
            this.connectToAxumServer();
          }, 5000);
        }
      });

      this.axumWebSocket.on('error', (error) => {
        console.error('Axum WebSocket error:', error);
      });
    } catch (error) {
      console.error('Failed to connect to Axum server:', error);
      if (!this.reconnectInterval) {
        this.reconnectInterval = setInterval(() => {
          this.connectToAxumServer();
        }, 5000);
      }
    }
  }

  private handleAxumMessage(message: any) {
    console.log('Received from Axum:', message);

    switch (message.type) {
      case 'peer-created':
        this.handlePeerCreated(message);
        break;
      case 'peer-destroyed':
        this.handlePeerDestroyed(message);
        break;
      case 'ice-candidate-generated':
        this.handleIceCandidateGenerated(message);
        break;
      case 'connection-state':
        this.handleConnectionState(message);
        break;
      case 'answer':
        this.handleAnswerFromAxum(message);
        break;
      default:
        console.log('Unhandled Axum message type:', message.type);
    }
  }

  private handlePeerCreated(message: any) {
    console.log(`Peer created: ${message.session_id}, success: ${message.success}`);
  }

  private handlePeerDestroyed(message: any) {
    console.log(`Peer destroyed: ${message.session_id}`);
  }

  private handleIceCandidateGenerated(message: any) {
    const { session_id, room_id, candidate, sdp_mid, sdp_mline_index } = message;

    // Send ICE candidate to other clients in the same room
    const room = this.rooms.get(room_id);
    if (room) {
      room.clients.forEach((clientId) => {
        if (clientId !== session_id) {
          const client = this.clients.get(clientId);
          if (client && client.ws) {
            client.ws.send(JSON.stringify({
              type: 'ice-candidate',
              candidate,
              sdpMid: sdp_mid,
              sdpMLineIndex: sdp_mline_index,
              session_id,
              room_id
            }));
          }
        }
      });
    }
  }

  private handleConnectionState(message: any) {
    console.log(`Connection state changed: ${message.session_id} -> ${message.state}`);
  }

  private handleAnswerFromAxum(message: any) {
    const { session_id, room_id, sdp } = message;

    const room = this.rooms.get(room_id);
    if (room) {
      room.clients.forEach((clientId) => {
        if (clientId !== session_id) {
          const client = this.clients.get(clientId);
          if (client && client.ws) {
            client.ws.send(JSON.stringify({
              type: 'answer',
              sdp,
              session_id,
              room_id
            }));
          }
        }
      });
    }
  }

  private sendToAxum(message: any) {
    if (this.axumWebSocket && this.axumWebSocket.readyState === WebSocket.OPEN) {
      this.axumWebSocket.send(JSON.stringify(message));
    } else {
      console.error('Axum WebSocket is not connected');
    }
  }

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

    this.sendToAxum({
      type: 'create-peer',
      session_id: clientId,
      room_id: room_id
    });

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
    this.sendToAxum({
      type: 'destroy-peer',
      session_id: clientId
    });

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

  getRoomParticipants(room_id: string) {
    const room = this.rooms.get(room_id);
    if (!room) return [];

    return Array.from(room.clients);
  }

  getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  sendOfferToAxum(session_id: string, room_id: string, sdp: string) {
    console.log(`Browser offer for session ${session_id} - Axum only provides TURN server, P2P direct`);
  }

  sendAnswerToAxum(session_id: string, room_id: string, sdp: string) {
    console.log(`Browser answer for session ${session_id} - Axum only provides TURN server, P2P direct`);
  }

  sendIceCandidateToAxum(session_id: string, room_id: string, candidate: string, sdp_mid?: string, sdp_mline_index?: number) {
    console.log(`Browser ICE candidate for session ${session_id} - Axum only provides TURN server, P2P direct`);
  }
}
