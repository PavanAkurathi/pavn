import { customAlphabet } from "nanoid";

// No 0/O, 1/I/L: the code gets read off a text message and typed in.
const makeInviteCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 8);

export function generateInviteCode(): string {
    return makeInviteCode();
}
