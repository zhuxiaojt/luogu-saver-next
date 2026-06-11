import type { SaveTask } from '@/shared/task';
import { SaveTarget, TaskType } from '@/shared/task';
import { ArticleSaveLockService } from '@/services/article-save-lock.service';
import { TaskHandler, WorkflowResult } from '@/workers/types';

export class ArticleUnlockHandler implements TaskHandler<SaveTask> {
    public taskType = `${TaskType.SAVE}:${SaveTarget.ARTICLE_UNLOCK}`;

    public async handle(task: SaveTask): Promise<WorkflowResult<{ released: boolean }>> {
        const token = task.payload.metadata?.saveLockToken as string | undefined;
        const released = await ArticleSaveLockService.release(task.payload.targetId, token);

        return {
            skipNextStep: false,
            data: { released }
        };
    }
}
