import { Job, UnrecoverableError } from 'bullmq';
import { RagTask } from '@/shared/task';
import { ChildrenValues, TaskCommonResult, TaskHandler, WorkflowResult } from '@/workers/types';
import { shouldSkip } from '@/workers/helpers/common.helper';
import { llm } from '@/lib/llm';

export class RagAnswerHandler implements TaskHandler<RagTask> {
    public taskType = 'rag:answer';

    public async handle(
        _task: RagTask,
        job: Job<RagTask>
    ): Promise<WorkflowResult<TaskCommonResult>> {
        const childrenValues = (await job.getChildrenValues()) as ChildrenValues;
        if (shouldSkip(childrenValues))
            return { skipNextStep: true, data: { text: '', documents: [] } };

        const context = Object.values(childrenValues).find(
            value => typeof value?.data?.text === 'string'
        )?.data;
        if (!context?.text) throw new UnrecoverableError(`No RAG context found for job ${job.id}`);

        const prompt = `
<prompt>
You are a retrieval-augmented question answering assistant.
Answer in Chinese.
Use only the provided documents.
Answer the user's question directly. Do not write prefaces such as "下面根据已有材料" or "需要说明".
If the documents only cover part of the question, answer the covered part without listing unrelated missing fields.
If the answer cannot be determined from the documents at all, write exactly: "现有材料无法确定。"
Do not invite the user to ask follow-up questions. There is no multi-turn conversation.
Use Markdown.
All inline math MUST be enclosed as $formula$.
All display math MUST be enclosed as $$formula$$.
Do not use backslash-parenthesis math delimiters, backslash-bracket math delimiters, or bare LaTeX environments.
At the end, list cited article titles and IDs from the documents you used.
</prompt>
<context>
${context.text}
</context>
        `;

        const result = await llm.chat(
            [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            'chat'
        );

        return {
            skipNextStep: false,
            data: {
                text: result.content || '',
                documents: context.documents || []
            }
        };
    }
}
