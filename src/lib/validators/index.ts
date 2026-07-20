import { z } from "zod";
import { Priority, Department, Role } from "@prisma/client";

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers, and underscores");

export const displayNameSchema = z
  .string()
  .min(1, "Display name is required")
  .max(50, "Display name must be at most 50 characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const ticketTitleSchema = z
  .string()
  .min(1, "Title is required")
  .max(200, "Title must be at most 200 characters");

export const ticketDescriptionSchema = z
  .string()
  .max(5000, "Description must be at most 5000 characters")
  .optional();

export const commentBodySchema = z
  .string()
  .min(1, "Comment cannot be empty")
  .max(2000, "Comment must be at most 2000 characters");

// --- User schemas ---

export const createUserSchema = z.object({
  username: usernameSchema,
  tempPassword: passwordSchema,
  displayName: displayNameSchema,
  department: z.nativeEnum(Department),
  role: z.nativeEnum(Role),
});

export const updateOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const resetPasswordSchema = z.object({
  userId: z.string().cuid(),
  newTempPassword: passwordSchema,
});

export const deactivateUserSchema = z.object({
  userId: z.string().cuid(),
});

// --- Ticket schemas ---

export const createTicketSchema = z.object({
  boardId: z.string().cuid(),
  columnId: z.string().cuid(),
  title: ticketTitleSchema,
});

export const updateTicketSchema = z.object({
  ticketId: z.string().cuid(),
  changes: z.object({
    title: ticketTitleSchema.optional(),
    description: ticketDescriptionSchema,
    priority: z.nativeEnum(Priority).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    department: z.nativeEnum(Department).optional(),
  }),
});

export const moveTicketSchema = z.object({
  ticketId: z.string().cuid(),
  toColumnId: z.string().cuid(),
  toOrder: z.number().int().min(0),
});

export const assignTicketSchema = z.object({
  ticketId: z.string().cuid(),
  assigneeId: z.string().cuid().nullable(),
});

export const labelTicketSchema = z.object({
  ticketId: z.string().cuid(),
  labelId: z.string().cuid(),
});

export const deleteTicketSchema = z.object({
  ticketId: z.string().cuid(),
});

// --- Board schemas ---

export const createBoardSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  name: z.string().min(1, "Name is required").max(50),
  department: z.enum(["DEV", "DESIGN", "MARKETING", "GENERAL"]),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const createColumnSchema = z.object({
  boardId: z.string().cuid(),
  name: z.string().min(1, "Column name is required").max(50),
  wipLimit: z.number().int().min(1).optional(),
});

export const reorderColumnSchema = z.object({
  columnId: z.string().cuid(),
  toOrder: z.number().int().min(0),
});

// --- Comment schemas ---

export const addCommentSchema = z.object({
  ticketId: z.string().cuid(),
  body: commentBodySchema,
});

// --- Login schema ---

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
