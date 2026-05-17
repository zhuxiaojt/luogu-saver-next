import { BaseEntity } from '@/entities/base';
import { DeepPartial, EntityManager, FindManyOptions, FindOneOptions, Repository } from 'typeorm';

type ActiveRecordEntity<T extends BaseEntity> = typeof BaseEntity & {
    new (): T;
    getRepository(): Repository<T>;
};

export function getServiceRepository<T extends BaseEntity>(
    entity: ActiveRecordEntity<T>,
    manager?: EntityManager
): Repository<T> {
    return manager ? manager.getRepository(entity) : entity.getRepository();
}

export function createServiceEntity<T extends BaseEntity>(
    entity: ActiveRecordEntity<T>,
    data: DeepPartial<T>,
    manager?: EntityManager
): T {
    return getServiceRepository(entity, manager).create(data);
}

export async function findOneServiceEntity<T extends BaseEntity>(
    entity: ActiveRecordEntity<T>,
    options: FindOneOptions<T>,
    manager?: EntityManager
): Promise<T | null> {
    return await getServiceRepository(entity, manager).findOne(options);
}

export async function findServiceEntities<T extends BaseEntity>(
    entity: ActiveRecordEntity<T>,
    options: FindManyOptions<T>,
    manager?: EntityManager
): Promise<T[]> {
    return await getServiceRepository(entity, manager).find(options);
}

export async function saveServiceEntity<T extends BaseEntity>(
    entity: ActiveRecordEntity<T>,
    value: T,
    manager?: EntityManager
): Promise<T> {
    return await getServiceRepository(entity, manager).save(value);
}
