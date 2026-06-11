import { Socket } from 'socket.io';
import { emitToRoom } from '@/lib/socket';
import { logger } from '@/lib/logger';
import { DiscoveryRun } from '@/entities/discovery-run';
import { getServiceRepository } from '@/services/helpers/repository.helper';

export const ARTICLE_DISCOVERY_RUNS_ROOM = 'discovery:runs';
export const ARTICLE_DISCOVERY_RUNS_EVENT = 'discovery:runs:update';

export class ArticleDiscoveryBroadcaster {
    private static readonly debounceMs = 500;
    private static timer: NodeJS.Timeout | null = null;

    static scheduleRunsUpdate() {
        if (this.timer) return;

        this.timer = setTimeout(() => {
            void this.flush();
        }, this.debounceMs);
        this.timer.unref?.();
    }

    static async emitCurrentRunsToSocket(socket: Socket) {
        socket.emit(ARTICLE_DISCOVERY_RUNS_EVENT, await this.getPayload());
    }

    private static async flush() {
        this.timer = null;

        try {
            emitToRoom(
                ARTICLE_DISCOVERY_RUNS_ROOM,
                ARTICLE_DISCOVERY_RUNS_EVENT,
                await this.getPayload()
            );
        } catch (error) {
            logger.error({ error }, 'Failed to broadcast article discovery update');
        }
    }

    private static async getPayload() {
        const runs = await getServiceRepository<DiscoveryRun>(DiscoveryRun).find({
            order: { createdAt: 'DESC' },
            take: 20
        });
        return { runs };
    }
}
