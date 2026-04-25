import { Redis } from 'ioredis';
import { SessionError } from '../utils/errors.js';
import { ISessionStore, SessionData, SessionMessage } from './session.interfaces.js';

export class RedisSessionStore implements ISessionStore {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, { lazyConnect: true });

    this.client.on('error', (err: Error) => {
      throw new SessionError(`Redis connection error: ${err.message}`);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (err) {
      throw new SessionError(
        `Failed to connect to Redis: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  private buildKey(sessionId: string): string {
    return `liran:${sessionId}`;
  }

  async getHistory(sessionId: string, maxMessages: number): Promise<SessionMessage[]> {
    const key = this.buildKey(sessionId);

    try {
      const raw = await this.client.get(key);
      if (!raw) return [];

      const data: SessionData = JSON.parse(raw);
      return data.messages.slice(-maxMessages);
    } catch (err) {
      throw new SessionError(
        `Failed to fetch session history: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async appendMessage(
    sessionId: string,
    userId: string,
    role: string,
    message: SessionMessage,
    ttl: number,
  ): Promise<void> {
    const key = this.buildKey(sessionId);

    try {
      const raw = await this.client.get(key);

      const data: SessionData = raw
        ? JSON.parse(raw)
        : { userId, role, createdAt: Date.now(), messages: [] };

      data.messages.push(message);

      await this.client.set(key, JSON.stringify(data), 'EX', ttl);
    } catch (err) {
      throw new SessionError(
        `Failed to persist session message: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.client.del(this.buildKey(sessionId));
  }

  async getActiveSessionCount(): Promise<number> {
    const keys = await this.client.keys('liran:*');
    return keys.length;
  }
}
