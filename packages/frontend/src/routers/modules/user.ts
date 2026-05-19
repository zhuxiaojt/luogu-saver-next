import type { RouteRecordRaw } from 'vue-router';

export default [
    {
        path: '/user/:id',
        name: 'user-profile',
        component: () => import('@/views/user/UserProfileView.vue'),
        meta: {
            activeMenu: ''
        }
    }
] as RouteRecordRaw[];
