import { TaskDefinition, WorkflowDefinition } from '@/utils/flow-validator';
import { Permission } from '@/shared/permission';

export type WorkflowTemplateBuilder = (params: any) => WorkflowDefinition;

export const WORKFLOW_TEMPLATES_PERMISSION: { [key: string]: Permission | null } = {
    'article-save-pipeline': null,
    'article-censor-pipeline': Permission.CREATE_WORKFLOW
};

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplateBuilder> = {
    'article-save-pipeline': (params: any) => {
        const { targetId } = params;
        if (!targetId) {
            throw new Error('targetId is required for article-save-pipeline');
        }

        const tasks: TaskDefinition[] = [
            {
                name: 'save',
                track: true,
                report: true,
                data: {
                    type: 'save',
                    payload: {
                        target: 'article',
                        targetId: targetId,
                        metadata: {}
                    }
                }
            },
            {
                name: 'summary',
                fathers: ['save'],
                track: true,
                data: {
                    type: 'llm',
                    payload: {
                        target: 'summary',
                        metadata: {}
                    }
                }
            },
            {
                name: 'censor',
                fathers: ['save'],
                track: true,
                data: {
                    type: 'llm',
                    payload: {
                        target: 'censor',
                        metadata: {}
                    }
                }
            },
            {
                name: 'embedding',
                fathers: ['summary'],
                data: {
                    type: 'llm',
                    payload: {
                        target: 'embedding',
                        metadata: {}
                    }
                }
            },
            {
                name: 'update-embedding',
                fathers: ['embedding'],
                data: {
                    type: 'update',
                    payload: {
                        target: 'article_embedding',
                        targetId: targetId,
                        metadata: {}
                    }
                }
            },
            {
                name: 'update-summary',
                fathers: ['summary'],
                data: {
                    type: 'update',
                    payload: {
                        target: 'article_summary',
                        targetId: targetId,
                        metadata: {}
                    }
                }
            },
            {
                name: 'update-censor',
                fathers: ['censor'],
                data: {
                    type: 'update',
                    payload: {
                        target: 'censor',
                        targetId: targetId,
                        metadata: {
                            censorTarget: 'article'
                        }
                    }
                }
            }
        ];

        return { tasks };
    },
    'article-censor-pipeline': (params: any) => {
        const { targetId } = params;
        if (!targetId) {
            throw new Error('targetId is required for article-censor-pipeline');
        }

        const tasks: TaskDefinition[] = [
            {
                name: 'censor',
                track: true,
                report: true,
                data: {
                    type: 'llm',
                    payload: {
                        target: 'censor',
                        sourceId: `article:${targetId}`,
                        metadata: {}
                    }
                }
            },
            {
                name: 'update-censor',
                fathers: ['censor'],
                data: {
                    type: 'update',
                    payload: {
                        target: 'censor',
                        targetId: targetId,
                        metadata: {
                            censorTarget: 'article'
                        }
                    }
                }
            }
        ];

        return { tasks };
    }
};
