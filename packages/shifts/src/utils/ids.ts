// packages/shifts/src/utils/ids.ts

import { customAlphabet } from 'nanoid';

// Alphanumeric alphabet, 16 chars + 4 char prefix = 20 chars (standard length)
const generate = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 16);

export type IdPrefix = 'org' | 'loc' | 'shf' | 'wkr' | 'int' | 'asg';

/**
 * Generates a focused, prefixed ID.
 * @param prefix The entity prefix (e.g., 'shf' for shift)
 * @returns format: prefix_randomString (e.g., shf_abc1234567890xyz)
 */
export const newId = (prefix: IdPrefix) => {
    return `${prefix}_${generate()}`;
};
