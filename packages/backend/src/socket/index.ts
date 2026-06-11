import { Socket } from 'socket.io';
import { handleTaskRoomJoin } from './handlers/task.handler';
import { socketHasPermission, type SocketJoinResult } from '@/lib/socket';
import { logger } from '@/lib/logger';
import {
    QueueStatsBroadcaster,
    QUEUE_STATS_ROOM
} from '@/services/queue-stats-broadcaster.service';
import {
    ARTICLE_DISCOVERY_RUNS_ROOM,
    ArticleDiscoveryBroadcaster
} from '@/services/article-discovery-broadcaster.service';
import { Permission } from '@/shared/permission';

export async function socketJoinHandler(socket: Socket, room: string): Promise<SocketJoinResult> {
    if (room === QUEUE_STATS_ROOM) {
        return { afterJoin: () => QueueStatsBroadcaster.handleJoin(socket) };
    }

    if (room === ARTICLE_DISCOVERY_RUNS_ROOM) {
        if (!socketHasPermission(socket, Permission.MANAGE_DISCOVERY)) {
            return { allowed: false, error: 'Permission denied' };
        }
        return { afterJoin: () => ArticleDiscoveryBroadcaster.emitCurrentRunsToSocket(socket) };
    }

    const [type, id] = room.split(':');

    if (!type || !id) return {};

    switch (type) {
        case 'task':
            return { afterJoin: () => handleTaskRoomJoin(socket, id) };
        default:
            logger.debug({ room }, 'No specialized handler for this room type');
            return {};
    }
}
