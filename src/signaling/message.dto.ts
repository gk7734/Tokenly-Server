export type SignalingMessage =
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | JoinRoomMessage
  | LeaveRoomMessage;

export interface OfferMessage {
  type: 'offer';
  sdp: string;
  session_id: string;
  room_id: string;
}

export interface AnswerMessage {
  type: 'answer';
  sdp: string;
  session_id: string;
  room_id: string;
}

export interface IceCandidateMessage {
  type: 'ice-candidate';
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
  session_id: string;
  room_id: string;
}

export interface JoinRoomMessage {
  type: 'join-room';
  room_id: string;
  session_id: string;
  success?: boolean;
}

export interface LeaveRoomMessage {
  type: 'leave-room';
  success?: boolean;
}
