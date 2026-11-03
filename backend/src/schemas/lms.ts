import { z } from 'zod';
import { email, password, username } from './auth.js';
const title = z.string().trim().min(1).max(180);
const text = z.string().trim().min(1).max(20_000);
export const id = z.string().uuid();
export const empty = z.object({}).strict();
export const profileSchema = z.object({ fullName: z.string().trim().min(1).max(120) }).strict();
export const userSchema = z.object({ fullName: z.string().trim().min(1).max(120), username, email, role: z.enum(['admin','teacher','student']), tempPassword: password, rollNo: z.string().max(50).nullable().optional() }).strict();
export const userPatch = userSchema.pick({ fullName: true, username: true, role: true, rollNo: true }).partial().extend({ isActive: z.boolean().optional() }).strict().refine((v) => Object.keys(v).length > 0);
export const departmentSchema = z.object({code:z.string().trim().min(1).max(30),name:z.string().trim().min(1).max(120)}).strict();
export const courseSchema = z.object({ code: z.string().trim().min(1).max(30), title, description: z.string().max(5000).default(''), isArchived: z.boolean().default(false), departmentId:id.nullable().optional() }).strict();
export const teachersSchema = z.object({ teacherIds: z.array(id).max(100).refine((v) => new Set(v).size===v.length) }).strict();
export const enrollmentSchema = z.object({ studentIds: z.array(id).min(1).max(100) }).strict();
export const csvSchema = z.object({ csv: z.string().min(1).max(100_000), preview: z.boolean().default(true) }).strict();
export const resourceSchema = z.object({ title, description: z.string().max(5000).default('') }).strict();
export const assignmentSchema = z.object({ title, instructions: text, maxMarks: z.coerce.number().positive().max(9999), dueAt: z.string().datetime({ offset: true }), allowLate: z.boolean().default(false), attachmentPath: z.string().max(1024).nullable().optional() }).strict();
export const submissionSchema = z.object({ textAnswer: z.string().max(50_000).optional(), filePath: z.string().max(1024).optional() }).strict().refine((v) => v.textAnswer?.trim() || v.filePath, 'Provide text or a file');
export const gradeSchema = z.object({ marks: z.number().min(0).max(9999), feedback: z.string().max(10_000).default('') }).strict();
const optionSchema = z.object({ id: z.string().min(1).max(30), text: z.string().min(1).max(2000) }).strict();
const question = z.object({ position: z.number().int().nonnegative(), type: z.enum(['mcq_single','mcq_multi','true_false']), prompt: text,
  options: z.array(optionSchema).min(2).max(12), correctOptionIds: z.array(z.string()).min(1).max(12), marks: z.number().positive().max(999) }).strict()
  .refine((v) => new Set(v.options.map((o) => o.id)).size===v.options.length && new Set(v.correctOptionIds).size===v.correctOptionIds.length && v.correctOptionIds.every((k) => v.options.some((o) => o.id===k)) && (v.type==='mcq_multi' || v.correctOptionIds.length===1) && (v.type!=='true_false' || v.options.length===2), 'Invalid options or correct answers');
export const quizSchema = z.object({ title, description: z.string().max(5000).default(''), timeLimitMinutes: z.number().int().min(1).max(1440), opensAt: z.string().datetime({ offset: true }), closesAt: z.string().datetime({ offset: true }), isPublished: z.boolean().default(false), questions: z.array(question).min(1).max(100) }).strict()
  .refine((v) => new Date(v.closesAt)>new Date(v.opensAt), 'Closing time must follow opening time')
  .refine((v) => new Set(v.questions.map((q) => q.position)).size===v.questions.length, 'Question positions must be unique');
export const answersSchema = z.object({ answers: z.record(z.string().uuid(),z.array(z.string().max(30)).max(12)) }).strict();
export const announcementSchema = z.object({ courseId: id.nullable().optional(), title, body: text, isPinned: z.boolean().default(false) }).strict();
export const readSchema = z.object({ before: z.string().datetime({ offset: true }) }).strict();
export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
export const complaintSchema = z.object({ courseId: id.nullable().optional(), category: z.enum(['academic','technical','facility','conduct','other']), subject: title, description: text }).strict();
export const reviewSchema = z.object({ status: z.enum(['in_review','resolved','rejected']), adminResponse: z.string().trim().max(10_000).default('') }).strict()
  .refine((v) => v.status==='in_review' || v.adminResponse.length>0, 'A response is required');
