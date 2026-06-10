import { apiFetch } from '@/utils/request.ts';
import type { ApiResponse } from '@/types/common';
import type { UserProfile } from '@/types/user';

export async function getUserProfile(id: number | string) {
    return (await apiFetch(`/user/query/${id}`)) as ApiResponse<UserProfile>;
}

export async function refreshUserProfile(id: number | string) {
    return (await apiFetch(`/user/${id}/refresh`, {
        method: 'POST'
    })) as ApiResponse<{ taskId: string }>;
}
