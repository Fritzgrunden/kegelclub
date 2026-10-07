import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const BCRYPT_COST = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Zufälliges, URL-sicheres Token (256 Bit). */
export const generateToken = () => randomBytes(32).toString("base64url");

/** In der DB werden nur Hashes von Tokens gespeichert. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

let dummyHash: Promise<string> | undefined;
/** Dummy-Hash, damit Logins für unbekannte E-Mails gleich lange dauern (keine Konto-Erkennung über Timing). */
export const getDummyHash = () => (dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), BCRYPT_COST));
