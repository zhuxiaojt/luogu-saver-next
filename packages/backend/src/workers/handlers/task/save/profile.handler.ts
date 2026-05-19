import { UnrecoverableError } from 'bullmq';

import type { SaveTask } from '@/shared/task';
import { fetch } from '@/utils/fetch';
import { C3vkMode } from '@/shared/c3vk';
import type { LentilleDataResponse, UserData } from '@/types/luogu-api';
import { UserService } from '@/services/user.service';
import { logger } from '@/lib/logger';
import { emitToRoom } from '@/lib/socket';
import { TaskHandler, TaskTextResult, WorkflowResult } from '@/workers/types';
import { UserColor, UserPrize } from '@/shared/user';

export class ProfileHandler implements TaskHandler<SaveTask> {
    public taskType = 'save:profile';

    public async handle(task: SaveTask): Promise<WorkflowResult<TaskTextResult>> {
        const rawTargetId = task.payload.targetId;
        if (typeof rawTargetId !== 'string' || !/^[1-9]\d*$/.test(rawTargetId)) {
            throw new UnrecoverableError(
                `Invalid profile targetId: ${JSON.stringify(rawTargetId)}`
            );
        }
        const uid = Number(rawTargetId);

        const url = `https://www.luogu.com/user/${uid}`;
        const resp: LentilleDataResponse<UserData> = await fetch(url, C3vkMode.MODERN);

        const userData = resp?.data?.user;
        if (!userData || typeof userData !== 'object' || typeof userData.uid !== 'number') {
            throw new UnrecoverableError(`Profile response shape invalid for uid=${uid}`);
        }

        const rawPrizes = (userData as { prize?: unknown }).prize;
        const prizes: UserPrize[] = Array.isArray(rawPrizes)
            ? (rawPrizes as UserPrize[]).filter(
                  p =>
                      p &&
                      typeof p === 'object' &&
                      typeof (p as UserPrize).year === 'number' &&
                      typeof (p as UserPrize).contestName === 'string' &&
                      typeof (p as UserPrize).prize === 'string'
              )
            : [];

        await UserService.saveLuoguUserProfile({
            uid: userData.uid,
            name: userData.name,
            color: userData.color as UserColor,
            ccfLevel: userData.ccfLevel ?? 0,
            xcpcLevel: userData.xcpcLevel ?? 0,
            prizes
        });

        emitToRoom(`user_${uid}`, `user:${uid}:profile-updated`);
        logger.info({ uid, prizeCount: prizes.length }, 'Profile saved');

        return {
            skipNextStep: false,
            data: {
                text: ''
            }
        };
    }
}
