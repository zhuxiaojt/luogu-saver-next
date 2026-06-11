import type { SaveTask, CrawlMetadata } from '@/shared/task';
import { SaveTarget, TaskType } from '@/shared/task';
import { Article } from '@/entities/article';
import { DiscoveredArticleSource } from '@/entities/discovered-article';
import { DiscoveryService } from '@/services/discovery.service';
import { findOneServiceEntity } from '@/services/helpers/repository.helper';
import { ChildrenValues, TaskHandler, WorkflowResult } from '@/workers/types';
import { shouldSkip } from '@/workers/helpers/common.helper';
import { logger } from '@/lib/logger';
import { Job } from 'bullmq';

const ARTICLE_LINK_RE =
    /(?:https?:\/\/(?:www\.)?luogu\.com(?:\.cn)?|)?\/article\/([A-Za-z0-9]{1,8})(?=[^A-Za-z0-9]|$)/g;

function normalizeCrawl(metadata?: CrawlMetadata): Required<CrawlMetadata> | null {
    if (!metadata?.enabled || !metadata.runId) return null;
    return {
        enabled: true,
        runId: metadata.runId,
        depth: Math.max(0, Math.trunc(Number(metadata.depth) || 0)),
        maxDepth: Math.max(0, Math.trunc(Number(metadata.maxDepth) || 0)),
        maxChildrenPerArticle: Math.max(0, Math.trunc(Number(metadata.maxChildrenPerArticle) || 0)),
        sourceArticleId: metadata.sourceArticleId ?? null,
        forceUpdate: metadata.forceUpdate === true
    };
}

function extractLinkedArticleIds(content: string, selfId: string, limit: number) {
    const ids: string[] = [];
    const seen = new Set<string>([selfId]);
    for (const match of content.matchAll(ARTICLE_LINK_RE)) {
        const id = match[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
        if (ids.length >= limit) break;
    }
    return ids;
}

export class ArticleLinksHandler implements TaskHandler<SaveTask> {
    public taskType = `${TaskType.SAVE}:${SaveTarget.ARTICLE_LINKS}`;

    public async handle(
        task: SaveTask,
        job: Job<SaveTask>
    ): Promise<WorkflowResult<{ text: string; articleIds: string[] }>> {
        const childrenValues = (await job.getChildrenValues()) as ChildrenValues;
        if (shouldSkip(childrenValues)) {
            return {
                skipNextStep: true,
                data: { text: '', articleIds: [] }
            };
        }

        const crawl = normalizeCrawl(task.payload.metadata?.crawl);
        const articleId = task.payload.targetId;

        if (!crawl || crawl.depth >= crawl.maxDepth || crawl.maxChildrenPerArticle <= 0) {
            return {
                skipNextStep: false,
                data: { text: '', articleIds: [] }
            };
        }

        const article = await findOneServiceEntity<Article>(Article, { where: { id: articleId } });
        if (!article?.content) {
            return {
                skipNextStep: false,
                data: { text: '', articleIds: [] }
            };
        }

        const linkedIds = extractLinkedArticleIds(
            article.content,
            articleId,
            crawl.maxChildrenPerArticle
        );

        for (const linkedId of linkedIds) {
            const edgeClaimed = await DiscoveryService.claimArticleEdge(
                crawl.runId,
                articleId,
                linkedId,
                crawl.depth + 1
            );
            if (!edgeClaimed) continue;

            await DiscoveryService.discoverArticle({
                runId: crawl.runId,
                articleId: linkedId,
                source: DiscoveredArticleSource.ARTICLE_LINK,
                sourceArticleId: articleId,
                depth: crawl.depth + 1,
                maxDepth: crawl.maxDepth,
                maxChildrenPerArticle: crawl.maxChildrenPerArticle,
                recursive: true,
                forceUpdate: crawl.forceUpdate
            });
        }

        logger.info(
            { runId: crawl.runId, articleId, depth: crawl.depth, linkedCount: linkedIds.length },
            'Article links discovered from saved content'
        );

        return {
            skipNextStep: false,
            data: {
                text: '',
                articleIds: linkedIds
            }
        };
    }
}
