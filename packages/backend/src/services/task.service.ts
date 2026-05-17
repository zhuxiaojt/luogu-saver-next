import { Task } from '@/entities/task';
import { TaskStatus, TaskType } from '@/shared/task';
import { getQueueByType } from '@/lib/queue-factory';
import { getRandomString } from '@/utils/string';
import { retryOnDuplicateKey } from '@/utils/db-errors';
import { EntityManager } from 'typeorm';
import {
    findOneServiceEntity,
    getServiceRepository,
    saveServiceEntity
} from '@/services/helpers/repository.helper';

export class TaskService {
    static async createTask(type: TaskType, payload: any, manager?: EntityManager): Promise<Task> {
        return retryOnDuplicateKey(async () => {
            const task = getServiceRepository<Task>(Task, manager).create();

            task.id = getRandomString(8);
            task.type = type;
            task.payload = payload;
            task.status = TaskStatus.PENDING;
            await saveServiceEntity<Task>(Task, task, manager);
            return task;
        }, 5);
    }

    static async dispatchTask(taskId: string) {
        const task = await this.getTaskById(taskId);
        if (!task) throw new Error(`Task with ID ${taskId} not found.`);

        if (task.type === TaskType.SAVE) {
            const queueSave = getQueueByType(TaskType.SAVE);

            await queueSave.add(
                TaskType.SAVE,
                {
                    id: task.id,
                    type: TaskType.SAVE,
                    payload: task.payload
                },
                { jobId: task.id }
            );
        }

        if (task.type === TaskType.LLM) {
            const queueAi = getQueueByType(TaskType.LLM);
            await queueAi.add(
                TaskType.LLM,
                {
                    id: task.id,
                    type: TaskType.LLM,
                    payload: task.payload
                },
                { jobId: task.id }
            );
        }
    }

    static async updateTask(
        taskId: string,
        status: TaskStatus,
        info?: string,
        manager?: EntityManager
    ) {
        const updateData: Partial<Task> = { status };
        if (info !== undefined) {
            updateData.info = info;
        }

        await getServiceRepository<Task>(Task, manager).update(taskId, updateData);
    }

    static async getTaskById(taskId: string, manager?: EntityManager): Promise<Task | null> {
        return await findOneServiceEntity<Task>(Task, { where: { id: taskId } }, manager);
    }
}
