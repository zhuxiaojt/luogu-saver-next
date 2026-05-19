export enum UserColor {
    GRAY = 'Gray',
    BLUE = 'Blue',
    GREEN = 'Green',
    ORANGE = 'Orange',
    RED = 'Red',
    PURPLE = 'Purple',
    CHEATER = 'Cheater'
}

export interface UserPrize {
    year: number;
    contest: string;
    event: string | null;
    prize: string;
    score?: number;
    rank?: number;
}

export const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
