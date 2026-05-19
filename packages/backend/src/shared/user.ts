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
    contestName: string;
    prize: string;
}

export const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
