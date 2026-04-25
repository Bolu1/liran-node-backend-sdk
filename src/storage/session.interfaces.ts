export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionData {
  userId: string;
  role: string;
  createdAt: number;
  messages: SessionMessage[];
}

export interface ISessionStore {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getHistory(sessionId: string, maxMessages: number): Promise<SessionMessage[]>;
  appendMessage(
    sessionId: string,
    userId: string,
    role: string,
    message: SessionMessage,
    ttl: number,
  ): Promise<void>;
  clearSession(sessionId: string): Promise<void>;
  getActiveSessionCount(): Promise<number>;
}
