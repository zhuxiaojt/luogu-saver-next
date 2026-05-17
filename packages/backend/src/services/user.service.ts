import { Cacheable } from '@/decorators/cacheable';
import { CacheEvict } from '@/decorators/cache-evict';
import { User } from '@/entities/user';
import { EntityManager } from 'typeorm';
import {
    createServiceEntity,
    findOneServiceEntity,
    getServiceRepository,
    saveServiceEntity
} from '@/services/helpers/repository.helper';

export class UserService {
    /*
     * Get user by ID with caching
     *
     * Result will be cached for 10 minutes
     *
     * @param id User ID
     * @returns User object or null if not found
     */
    @Cacheable(600, id => `user:${id}`, User)
    static async getUserById(id: number, manager?: EntityManager): Promise<User | null> {
        return await findOneServiceEntity<User>(User, { where: { id } }, manager);
    }

    static async getUserByIdWithoutCache(id: number): Promise<User | null> {
        return await this.getUserById(id, User.getRepository().manager);
    }

    /*
     * Save a user
     *
     * Will evict the cache for this user ID
     *
     * @param user User object to save
     * @returns Saved user object
     */
    @CacheEvict((user: User) => `user:${user.id}`)
    static async saveUser(user: User, manager?: EntityManager): Promise<User> {
        return await saveServiceEntity<User>(User, user, manager);
    }

    static createUser(data: Partial<User>, manager?: EntityManager): User {
        return createServiceEntity<User>(User, data, manager);
    }

    @CacheEvict((data: Partial<User>) => (data.id === undefined ? [] : `user:${data.id}`))
    static async upsertLuoguUser(data: Partial<User>, manager?: EntityManager): Promise<User> {
        if (data.id === undefined) {
            throw new Error('User ID is required');
        }

        const repository = getServiceRepository<User>(User, manager);
        const user = repository.create(data);
        await repository.upsert(user, ['id']);
        return user;
    }
}
