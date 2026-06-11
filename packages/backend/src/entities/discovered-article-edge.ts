import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from 'typeorm';
import { BaseEntity } from './base';

@Entity({ name: 'discovered_article_edge' })
@Index(
    'idx_discovered_article_edge_run_source_target',
    ['runId', 'sourceArticleId', 'targetArticleId'],
    {
        unique: true
    }
)
@Index('idx_discovered_article_edge_run_source', ['runId', 'sourceArticleId'])
export class DiscoveredArticleEdge extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'run_id' })
    runId: string;

    @Column({ name: 'source_article_id', type: 'varchar', length: 8 })
    sourceArticleId: string;

    @Column({ name: 'target_article_id', type: 'varchar', length: 8 })
    targetArticleId: string;

    @Column({ default: 0 })
    depth: number;

    @Column({ name: 'last_seen_at', type: 'datetime' })
    lastSeenAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
