export interface User {
    id: number;
    name?: string;
    color?: string;
    ccfLevel?: number;
    xcpcLevel?: number;
    createdAt: number;
    updatedAt: number;
}

export interface UserPrize {
    year: number;
    contestName: string;
    prize: string;
}

export interface UserProfile {
    id: number;
    name: string;
    color: string;
    ccfLevel: number;
    xcpcLevel: number;
    prizes: UserPrize[] | null;
    profileFetchedAt: string | null;
    profileStale: boolean;
    createdAt: string;
    updatedAt: string;
}
