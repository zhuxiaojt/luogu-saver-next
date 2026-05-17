import { Censorship } from '@/entities/censorship';
import { CensorTarget } from '@/shared/task';
import { EntityManager } from 'typeorm';
import {
    createServiceEntity,
    findServiceEntities,
    saveServiceEntity
} from '@/services/helpers/repository.helper';

export class CensorshipService {
    static createCensorship(data: Partial<Censorship>, manager?: EntityManager): Censorship {
        return createServiceEntity<Censorship>(Censorship, data, manager);
    }

    static async saveCensorship(censorship: Censorship, manager?: EntityManager) {
        return await saveServiceEntity<Censorship>(Censorship, censorship, manager);
    }

    static async getCensorshipsByTypeAndId(
        type: CensorTarget,
        targetId: string,
        manager?: EntityManager
    ): Promise<Censorship[] | null> {
        return await findServiceEntities<Censorship>(
            Censorship,
            { where: { type, targetId }, order: { createdAt: 'DESC' } },
            manager
        );
    }
}
