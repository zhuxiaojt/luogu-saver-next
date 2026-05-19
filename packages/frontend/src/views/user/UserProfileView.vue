<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NAvatar, NSpin, NEmpty, NTag, NTime, NSpace, NButton, NIcon, useMessage } from 'naive-ui';
import { SyncOutline, TrophyOutline, RibbonOutline } from '@vicons/ionicons5';

import { getUserProfile, refreshUserProfile } from '@/api/user';
import socket from '@/utils/websocket';
import type { UserProfile, UserPrize } from '@/types/user';

import Card from '@/components/Card.vue';
import UserPrizeBadge from '@/components/UserPrizeBadge.vue';

const route = useRoute();
const message = useMessage();

const loading = ref(true);
const notFound = ref(false);
const profile = ref<UserProfile | null>(null);
const refreshing = ref(false);

const uid = computed(() => {
    const raw = route.params.id;
    if (typeof raw !== 'string') return null;
    if (!/^[1-9]\d*$/.test(raw)) return null;
    return Number(raw);
});

const colorClass = computed(() => `user-${profile.value?.color || 'Gray'}`);

const groupedPrizes = computed(() => {
    if (!profile.value?.prizes || profile.value.prizes.length === 0) return [];
    const groups = new Map<number, UserPrize[]>();
    for (const p of profile.value.prizes) {
        const list = groups.get(p.year) ?? [];
        list.push(p);
        groups.set(p.year, list);
    }
    return [...groups.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([year, prizes]) => ({ year, prizes }));
});

const room = computed(() => (uid.value !== null ? `user_${uid.value}` : null));
const event = computed(() => (uid.value !== null ? `user:${uid.value}:profile-updated` : null));

let listenerAttached = false;

function onProfileUpdated() {
    if (uid.value === null) return;
    // soft reload without changing layout
    void reload(/* silent */ true);
}

function attachSocket() {
    if (listenerAttached || !room.value || !event.value) return;
    socket.joinRoom(room.value);
    socket.getInstance().on(event.value, onProfileUpdated);
    listenerAttached = true;
}

function detachSocket() {
    if (!listenerAttached || !room.value || !event.value) return;
    socket.getInstance().off(event.value, onProfileUpdated);
    socket.leaveRoom(room.value);
    listenerAttached = false;
}

async function reload(silent = false) {
    if (uid.value === null) return;
    if (!silent) loading.value = true;
    notFound.value = false;
    try {
        const res = await getUserProfile(uid.value);
        if (res.code !== 200 || !res.data) {
            notFound.value = true;
            profile.value = null;
        } else {
            profile.value = res.data;
        }
    } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404) {
            notFound.value = true;
            profile.value = null;
        } else {
            message.error(e?.message || '加载用户信息失败');
        }
    } finally {
        if (!silent) loading.value = false;
    }
}

async function handleManualRefresh() {
    if (uid.value === null || refreshing.value) return;
    refreshing.value = true;
    try {
        await refreshUserProfile(uid.value);
        message.info('已请求刷新,稍后将自动更新');
    } catch (e: any) {
        message.error(e?.message || '刷新失败');
    } finally {
        refreshing.value = false;
    }
}

watch(uid, async () => {
    detachSocket();
    profile.value = null;
    if (uid.value === null) {
        notFound.value = true;
        loading.value = false;
        return;
    }
    await reload();
    attachSocket();
});

onMounted(async () => {
    if (uid.value === null) {
        notFound.value = true;
        loading.value = false;
        return;
    }
    await reload();
    attachSocket();
});

onUnmounted(() => {
    detachSocket();
});
</script>

<template>
    <div class="user-profile-view">
        <n-spin :show="loading">
            <Card v-if="!loading && notFound">
                <n-empty description="未找到该用户" />
            </Card>

            <template v-else-if="profile">
                <Card>
                    <div class="profile-header">
                        <n-avatar
                            round
                            :size="72"
                            :src="`https://cdn.luogu.com.cn/upload/usericon/${profile.id}.png`"
                        />
                        <div class="profile-header-main">
                            <div class="profile-name-row">
                                <span class="profile-name user-name" :class="colorClass">
                                    {{ profile.name }}
                                </span>
                                <UserPrizeBadge
                                    v-if="profile.ccfLevel > 0 || profile.xcpcLevel > 0"
                                    :ccf-level="profile.ccfLevel"
                                    :xcpc-level="profile.xcpcLevel"
                                    :size="18"
                                />
                            </div>
                            <div class="profile-meta">
                                <span>UID {{ profile.id }}</span>
                                <span v-if="profile.ccfLevel > 0">
                                    OI 等级 {{ profile.ccfLevel }}
                                </span>
                                <span v-if="profile.xcpcLevel > 0">
                                    XCPC 等级 {{ profile.xcpcLevel }}
                                </span>
                            </div>
                            <div class="profile-meta-faint">
                                <template v-if="profile.profileFetchedAt">
                                    数据更新于
                                    <n-time
                                        :time="new Date(profile.profileFetchedAt)"
                                        type="relative"
                                    />
                                </template>
                                <template v-else> 尚未拉取完整资料 </template>
                                <template v-if="profile.profileStale"> · 后台正在刷新中 </template>
                            </div>
                        </div>
                        <n-button secondary :loading="refreshing" @click="handleManualRefresh">
                            <template #icon>
                                <n-icon><SyncOutline /></n-icon>
                            </template>
                            刷新
                        </n-button>
                    </div>
                </Card>

                <Card style="margin-top: 16px">
                    <template #title>
                        <n-space align="center" :size="8">
                            <n-icon size="20"><TrophyOutline /></n-icon>
                            <span>获奖历史</span>
                        </n-space>
                    </template>

                    <n-empty
                        v-if="!profile.prizes || profile.prizes.length === 0"
                        :description="
                            profile.profileFetchedAt
                                ? '该用户暂无可见的获奖记录'
                                : '正在拉取数据,请稍候...'
                        "
                    />

                    <div v-else class="prize-groups">
                        <div v-for="group in groupedPrizes" :key="group.year" class="prize-group">
                            <div class="prize-year">{{ group.year }}</div>
                            <div class="prize-list">
                                <div
                                    v-for="(prize, idx) in group.prizes"
                                    :key="idx"
                                    class="prize-item"
                                >
                                    <n-icon size="16" class="prize-item-icon">
                                        <RibbonOutline />
                                    </n-icon>
                                    <span class="prize-item-contest">
                                        {{ prize.contestName }}
                                    </span>
                                    <n-tag size="small" type="success" :bordered="false">
                                        {{ prize.prize }}
                                    </n-tag>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </template>
        </n-spin>
    </div>
</template>

<style scoped>
.user-profile-view {
    max-width: 960px;
    margin: 0 auto;
}
.profile-header {
    display: flex;
    align-items: center;
    gap: 20px;
}
.profile-header-main {
    flex: 1;
    min-width: 0;
}
.profile-name-row {
    display: flex;
    align-items: center;
    gap: 4px;
}
.profile-name {
    font-size: 24px;
    font-weight: 700;
}
.profile-meta {
    display: flex;
    gap: 14px;
    margin-top: 6px;
    color: var(--n-text-color-2, #666);
    font-size: 14px;
    flex-wrap: wrap;
}
.profile-meta-faint {
    margin-top: 4px;
    color: var(--n-text-color-3, #999);
    font-size: 12px;
}
.prize-groups {
    display: flex;
    flex-direction: column;
    gap: 18px;
}
.prize-group {
    display: flex;
    gap: 18px;
    align-items: flex-start;
}
.prize-year {
    flex: 0 0 64px;
    font-size: 18px;
    font-weight: 700;
    color: var(--n-text-color-1, #333);
    padding-top: 2px;
}
.prize-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.prize-item {
    display: flex;
    align-items: center;
    gap: 8px;
}
.prize-item-icon {
    color: #d4af37;
    flex-shrink: 0;
}
.prize-item-contest {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
