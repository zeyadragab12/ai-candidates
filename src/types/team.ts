import { z } from "zod";

import { ROLES } from "@/lib/auth/roleDefinitions";

export const teamCreateSchema = z.object({
  name: z.string().trim().min(1, "Team name is required."),
  managerId: z.string().uuid().nullable().optional(),
});

export const teamUpdateSchema = z.object({
  name: z.string().trim().min(1, "Team name is required.").optional(),
  managerId: z.string().uuid().nullable().optional(),
});

export const profileUpdateSchema = z.object({
  role: z.enum(ROLES).optional(),
  teamId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
