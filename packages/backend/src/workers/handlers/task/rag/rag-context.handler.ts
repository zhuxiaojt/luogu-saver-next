import { Job, UnrecoverableError } from 'bullmq';
import { RagTask } from '@/shared/task';
import { ChildrenValues, TaskCommonResult, TaskHandler, WorkflowResult } from '@/workers/types';
import { ArticleService } from '@/services/article.service';
import { clampInt } from '@/utils/number';

type MergedHit = {
    id: string;
    score: number;
    keywordRank?: number;
    vectorDistance?: number;
    sources: string[];
    queries: string[];
};

type RagDocument = {
    id: string;
    title: string;
    summary: string;
    excerpt: string;
    authorName: string;
    score: number;
    sources: string[];
    queries: string[];
    vectorDistance?: number;
};

export class RagContextHandler implements TaskHandler<RagTask> {
    public taskType = 'rag:context';

    public async handle(
        task: RagTask,
        job: Job<RagTask>
    ): Promise<WorkflowResult<TaskCommonResult>> {
        const childrenValues = (await job.getChildrenValues()) as ChildrenValues;

        const question = this.extractQuestion(childrenValues, task.payload.query);
        if (!question)
            throw new UnrecoverableError(`No question found for rag context job ${job.id}`);

        const maxArticles = clampInt(task.payload.metadata?.maxArticles, 10, 1, 10);
        const maxChars = clampInt(task.payload.metadata?.maxChars, 20000, 1000, 20000);
        const forcedArticleIds = this.normalizeArticleIds(task.payload.metadata?.articleIds);
        const documents: RagDocument[] = [];
        const includedIds = new Set<string>();

        for (const articleId of forcedArticleIds) {
            if (documents.length >= maxArticles) break;
            const document = await this.loadArticleDocument(articleId, {
                score: 100,
                sources: ['knowledge-base'],
                queries: []
            });
            if (!document) continue;
            documents.push(document);
            includedIds.add(document.id);
        }

        const merged = this.mergeHits(childrenValues).filter(hit => !includedIds.has(hit.id));
        for (const hit of merged) {
            if (documents.length >= maxArticles) break;
            const article = await ArticleService.getArticleByIdWithAuthorWithoutCache(hit.id);
            if (!article || article.deleted) continue;
            documents.push({
                id: article.id,
                title: article.title,
                summary: article.summary || '',
                excerpt: this.truncate(article.content || '', 900),
                authorName: article.author?.name || '',
                score: hit.score,
                sources: hit.sources,
                queries: hit.queries,
                vectorDistance: hit.vectorDistance
            });
        }

        let text = `<question>\n${question}\n</question>\n<documents>\n`;
        for (const doc of documents) {
            const candidate = `<document id="${doc.id}" title="${this.escapeAttr(doc.title)}" source="${doc.sources.join(',')}" queries="${this.escapeAttr(doc.queries.join(' | '))}">\n<summary>${doc.summary}</summary>\n<excerpt>${doc.excerpt}</excerpt>\n</document>\n`;
            if ((text + candidate + '</documents>').length > maxChars) break;
            text += candidate;
        }
        text += '</documents>';

        return {
            skipNextStep: false,
            data: {
                text,
                documents
            }
        };
    }

    private async loadArticleDocument(
        articleId: string,
        hit: Pick<MergedHit, 'score' | 'sources' | 'queries' | 'vectorDistance'>
    ): Promise<RagDocument | null> {
        const article = await ArticleService.getArticleByIdWithAuthorWithoutCache(articleId);
        if (!article || article.deleted) return null;
        return {
            id: article.id,
            title: article.title,
            summary: article.summary || '',
            excerpt: this.truncate(article.content || '', 900),
            authorName: article.author?.name || '',
            score: hit.score,
            sources: hit.sources,
            queries: hit.queries,
            vectorDistance: hit.vectorDistance
        };
    }

    private normalizeArticleIds(value: unknown): string[] {
        if (!Array.isArray(value)) return [];
        const ids: string[] = [];
        const seen = new Set<string>();
        for (const item of value) {
            const articleId = String(item || '').trim();
            if (!articleId || seen.has(articleId)) continue;
            ids.push(articleId);
            seen.add(articleId);
            if (ids.length >= 10) break;
        }
        return ids;
    }

    private extractQuestion(childrenValues: ChildrenValues, fallback?: string): string {
        for (const value of Object.values(childrenValues)) {
            if (typeof value?.data?.text === 'string' && value.data.text.trim()) {
                return value.data.text.trim();
            }
        }
        return (fallback || '').trim();
    }

    private mergeHits(childrenValues: ChildrenValues): MergedHit[] {
        const merged = new Map<string, MergedHit>();

        for (const value of Object.values(childrenValues)) {
            const hits = value?.data?.hits;
            if (!Array.isArray(hits)) continue;

            hits.forEach((hit: any, index: number) => {
                if (!hit?.id) return;
                const current: MergedHit = merged.get(hit.id) || {
                    id: hit.id,
                    score: 0,
                    sources: [],
                    queries: []
                };
                const query = typeof hit.query === 'string' ? hit.query.trim() : '';
                if (hit.source === 'vector') {
                    const vectorScore =
                        typeof hit.score === 'number'
                            ? hit.score
                            : Math.max(0, 1 - (hit.distance || 1));
                    current.score += vectorScore;
                    current.vectorDistance = hit.distance;
                    if (!current.sources.includes('vector')) current.sources.push('vector');
                } else {
                    current.score += 1 / (index + 1);
                    current.keywordRank = index;
                    if (!current.sources.includes('keyword')) current.sources.push('keyword');
                }
                if (query && !current.queries.includes(query)) {
                    current.queries.push(query);
                }
                merged.set(hit.id, current);
            });
        }

        for (const hit of merged.values()) {
            if (hit.sources.includes('keyword') && hit.sources.includes('vector')) hit.score += 0.5;
            if (hit.queries.length > 1) hit.score += (hit.queries.length - 1) * 0.25;
        }

        return [...merged.values()].sort((a, b) => b.score - a.score);
    }

    private truncate(text: string, max: number): string {
        const chars = Array.from(text || '');
        if (chars.length <= max) return text || '';
        return `${chars.slice(0, max).join('')}...`;
    }

    private escapeAttr(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
}
