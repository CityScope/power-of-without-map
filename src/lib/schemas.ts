import { z } from "zod";

export const geometrySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.array(z.any()),
});

export const settlementInputSchema = z.object({
  name: z.string().min(2),
  localName: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  geometry: geometrySchema,
  population: z.number().int().optional().nullable(),
  source: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
  atlasReference: z.boolean().optional().default(false),
  createdBy: z.string().optional().nullable(),
  verificationStatus: z.enum(["draft", "submitted", "reviewed", "verified", "rejected"]).default("draft"),
  answers: z.record(z.string(), z.any()).optional(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type SettlementInput = z.infer<typeof settlementInputSchema>;
