import { z } from "zod";

// --- File size ---
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// --- Project ---
export const projectCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional(),
  targetCount: z.coerce.number().int().min(1).max(10000).optional(),
  surplusCount: z.coerce.number().int().min(0).max(1000).optional(),
  backupCount: z.coerce.number().int().min(0).max(1000).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  targetCount: z.coerce.number().int().min(1).max(10000).optional(),
  surplusCount: z.coerce.number().int().min(0).max(1000).optional(),
  backupCount: z.coerce.number().int().min(0).max(1000).optional(),
  status: z
    .enum(["DRAFT", "UPLOADED", "MAPPED", "SOLVED", "REVIEWING", "COMPLETED"])
    .optional(),
});

// --- User ---
export const userCreateSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().max(100).optional(),
  role: z.enum(["ADMIN", "CPM"]).optional(),
});

export const userUpdateSchema = z.object({
  password: z.string().min(8).optional(),
  name: z.string().max(100).optional(),
  role: z.enum(["ADMIN", "CPM"]).optional(),
});

// --- Requirements ---
const requirementSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["HARD", "SOFT"]),
  acceptedValues: z.array(z.string()),
  weight: z.coerce.number().min(0.1).max(10).optional(),
  description: z.string().optional(),
});

const segmentationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetPercentages: z.record(z.string(), z.number().min(0).max(100)),
  tolerance: z.coerce.number().min(0).max(50).optional(),
});

export const requirementsSaveSchema = z.object({
  requirements: z.array(requirementSchema).optional(),
  segmentations: z.array(segmentationSchema).optional(),
});

// --- Mapping ---
const mappingEntrySchema = z.object({
  surveyQuestionId: z.string().min(1),
  requirementId: z.string().optional(),
  segmentationId: z.string().optional(),
  isConfirmed: z.boolean(),
});

export const mappingSaveSchema = z.object({
  action: z.literal("save"),
  mappings: z.array(mappingEntrySchema),
});

// --- Blocklist / Golden Tickets ---
export const blocklistEntrySchema = z
  .object({
    email: z.string().email().optional(),
    username: z.string().optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => d.email || d.username, {
    message: "Either email or username is required",
  });

export const goldenTicketEntrySchema = z
  .object({
    email: z.string().email().optional(),
    username: z.string().optional(),
    priorityLevel: z.coerce.number().int().min(1).max(3).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => d.email || d.username, {
    message: "Either email or username is required",
  });
