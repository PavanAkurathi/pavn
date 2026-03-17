import { customAlphabet } from "nanoid";

const generate = customAlphabet(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    16
);

export type IdPrefix = "org" | "loc" | "shf" | "wkr" | "int" | "asg" | "avl";

export const newId = (prefix: IdPrefix) => `${prefix}_${generate()}`;
