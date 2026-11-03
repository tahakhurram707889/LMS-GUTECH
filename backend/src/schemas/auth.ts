import { z } from 'zod';
export const email = z.string().trim().email().max(254).transform((s) => s.toLowerCase());
export const password = z.string().min(10).max(128).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
export const username = z.string().trim().toLowerCase().min(3).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/, 'Use letters, numbers, dots, underscores or hyphens');
export const loginSchema = z.object({ username, password: z.string().min(1).max(128) }).strict();
export const forgotSchema = z.object({ email }).strict();
export const changeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict();
export const resetSchema = z.object({ tokenHash: z.string().min(10).max(2048), newPassword: password }).strict();
