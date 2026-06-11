import { randomUUID } from 'node:crypto';
import { redisClient } from '@/lib/redis';

const LOCK_TTL_SECONDS = 30 * 60;

export class ArticleSaveAlreadyInProgressError extends Error {
    constructor(articleId: string) {
        super(`Article save already in progress: ${articleId}`);
    }
}

export class ArticleSaveLockService {
    private static key(articleId: string) {
        return `article:save:inflight:${articleId}`;
    }

    static async acquire(articleId: string) {
        const token = randomUUID();
        const result = await redisClient.set(
            this.key(articleId),
            token,
            'EX',
            LOCK_TTL_SECONDS,
            'NX'
        );
        if (result !== 'OK') return null;
        return token;
    }

    static async release(articleId: string, token?: string | null) {
        if (!token) return false;
        const key = this.key(articleId);
        const current = await redisClient.get(key);
        if (current !== token) return false;
        await redisClient.del(key);
        return true;
    }
}
