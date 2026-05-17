import { createHash } from 'crypto';
import { DeepPartial, EntityManager, EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';

type HashedContentEntity = ObjectLiteral & {
    id: string;
    content: string;
    contentHash?: string;
};

type SaveHashedContentOptions<TEntity extends HashedContentEntity> = {
    manager: EntityManager;
    entity: EntityTarget<TEntity>;
    id: string;
    content: string;
    forceUpdate?: boolean;
    incomingData: DeepPartial<TEntity>;
    defaults?: DeepPartial<TEntity>;
    isUnchanged?: (entity: TEntity, hash: string) => boolean;
};

export async function saveHashedContent<TEntity extends HashedContentEntity>(
    options: SaveHashedContentOptions<TEntity>
): Promise<{ skipped: boolean; entity: TEntity | null }> {
    const repository = options.manager.getRepository<TEntity>(options.entity);
    const hash = createHash('sha256').update(options.content).digest('hex');
    let entity = await repository.findOne({
        where: { id: options.id } as FindOptionsWhere<TEntity>,
        lock: { mode: 'pessimistic_write' }
    });

    const isUnchanged = options.isUnchanged || ((item: TEntity) => item.contentHash === hash);
    if (!options.forceUpdate && entity && isUnchanged(entity, hash)) {
        return { skipped: true, entity };
    }

    const data = {
        ...(entity ? {} : options.defaults),
        ...options.incomingData,
        id: options.id,
        content: options.content,
        contentHash: hash
    } as DeepPartial<TEntity>;

    if (entity) {
        repository.merge(entity, data);
    } else {
        entity = repository.create(data);
    }

    await repository.save(entity);
    return { skipped: false, entity };
}
