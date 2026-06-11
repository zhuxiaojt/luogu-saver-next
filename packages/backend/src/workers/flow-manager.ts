import { Workflow } from '@/entities/workflow';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/shared/constants';
import { Job, QueueEvents } from 'bullmq';
import { getQueueByName } from '@/lib/queue-factory';
import { config } from '@/config';
import { WorkflowStatusStore } from '@/services/helpers/workflow-status-store.helper';
import { ArticleSaveLockService } from '@/services/article-save-lock.service';

export class FlowManager {
    private static queueEvents: Map<string, QueueEvents> = new Map();

    static async updateWorkflowResult(workflowId: string, taskName: string, result: any) {
        try {
            await Workflow.transaction(async transactionalEntityManager => {
                const workflow = await transactionalEntityManager.findOne(Workflow, {
                    where: { id: workflowId },
                    lock: { mode: 'pessimistic_write' }
                });
                if (workflow) {
                    const currentResult = workflow.result
                        ? JSON.parse(JSON.stringify(workflow.result))
                        : {};
                    currentResult[taskName] = {
                        result: result.__result,
                        name: result.__name
                    };
                    workflow.result = currentResult;
                    logger.debug({ workflowId, taskName, result }, 'Updating workflow result');
                    await transactionalEntityManager.save(workflow);
                }
            });
        } catch (err) {
            logger.error({ err, workflowId, taskName }, 'Failed to update workflow result');
            throw err;
        }
    }

    static async updateWorkflowStatus(workflowId: string, status: string, reason?: string) {
        try {
            const storedStatus = await WorkflowStatusStore.updateById(workflowId, status);

            if (storedStatus === status) {
                logger.info({ workflowId, status, reason }, 'Workflow status updated');
            }
        } catch (err) {
            logger.error({ err, workflowId }, 'Failed to update workflow status');
        }
    }

    static setupQueueEvents() {
        if (this.queueEvents.size > 0) return;

        Object.values(QUEUE_NAMES).forEach(queueName => {
            const events = new QueueEvents(queueName, {
                connection: {
                    host: config.redis.host,
                    port: config.redis.port,
                    password: config.redis.password
                },
                prefix: config.redis.keyPrefix
            });

            events.on('completed', async ({ jobId, returnvalue }) => {
                const queueWrapper = getQueueByName(queueName);
                if (queueWrapper) {
                    const job = await Job.fromId(queueWrapper.queue, jobId);
                    if (job?.data?.workflowId && job.data.track) {
                        try {
                            await this.updateWorkflowResult(
                                job.data.workflowId,
                                job.data.taskName,
                                returnvalue
                            );
                        } catch (err) {
                            logger.error({ err, jobId }, 'Failed to update workflow result');
                        }
                    }

                    if (job?.data?.workflowId && this.isRootWorkflowJob(job)) {
                        await this.updateWorkflowStatus(job.data.workflowId, 'completed');
                        await this.releaseArticleSaveLockForWorkflow(job.data.workflowId);
                    }
                }
            });

            events.on('failed', async ({ jobId, failedReason }) => {
                const queueWrapper = getQueueByName(queueName);
                if (!queueWrapper) return;

                const job = await Job.fromId(queueWrapper.queue, jobId);
                if (job?.data?.workflowId) {
                    await this.updateWorkflowStatus(job.data.workflowId, 'failed', failedReason);
                    await this.releaseArticleSaveLockForWorkflow(job.data.workflowId);
                }
            });

            this.queueEvents.set(queueName, events);
        });
    }

    static async closeQueueEvents() {
        const events = [...this.queueEvents.values()];
        this.queueEvents.clear();
        await Promise.all(events.map(event => event.close()));
    }

    private static isRootWorkflowJob(job: Job<any>): boolean {
        return job.data.__isRoot === true;
    }

    private static async releaseArticleSaveLockForWorkflow(workflowId: string) {
        try {
            const workflow = await Workflow.findOne({
                where: { id: workflowId },
                select: ['id', 'definition']
            });
            const tasks = workflow?.definition?.tasks;
            if (!Array.isArray(tasks)) return;

            const unlockTask = tasks.find(task => task?.data?.payload?.target === 'article_unlock');
            const articleId = unlockTask?.data?.payload?.targetId;
            const token = unlockTask?.data?.payload?.metadata?.saveLockToken;
            if (typeof articleId !== 'string' || typeof token !== 'string') return;

            const released = await ArticleSaveLockService.release(articleId, token);
            logger.debug({ workflowId, articleId, released }, 'Article save lock terminal release');
        } catch (err) {
            logger.warn({ err, workflowId }, 'Failed to release article save lock');
        }
    }
}
