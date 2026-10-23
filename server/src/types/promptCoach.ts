import { z } from 'zod';

export const PlaybookRequiredFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  placeholder: z.string(),
  example: z.string(),
  required: z.boolean(),
  maxLength: z.number().optional(),
});

export const PlaybookObjectionSchema = z.object({
  objection: z.string(),
  response: z.string(),
});

export const PlaybookTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  description: z.string(),
  targetRole: z.string(),
  recommendedResponseStyle: z.enum(['concise', 'balanced', 'consultative']),
  goal: z.string(),
  opening: z.string(),
  discoveryQuestions: z.array(z.string()),
  qualificationCriteria: z.array(z.string()),
  objectionHandlingLibrary: z.array(PlaybookObjectionSchema),
  closingNextStep: z.string(),
  complianceRules: z.array(z.string()),
  requiredFields: z.array(PlaybookRequiredFieldSchema),
});

export const PromptCoachReviewSchema = z.object({
  score: z.number(),
  letterGrade: z.enum(['A+', 'A', 'B', 'C', 'D', 'F']),
  missingSections: z.array(z.string()),
  contradictions: z.array(z.string()),
  warnings: z.array(z.string()),
  strengths: z.array(z.string()),
  characterCount: z.number(),
  passed: z.boolean(),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const PromptCoachGenerateRequestSchema = z.object({
  playbookId: z.string().min(1),
  businessFacts: z.record(z.string()),
});

export const PromptCoachGenerateResponseSchema = z.object({
  playbookId: z.string(),
  title: z.string(),
  generatedPrompt: z.string(),
  recommendedStyle: z.enum(['concise', 'balanced', 'consultative']),
  review: PromptCoachReviewSchema,
});

export type PlaybookRequiredField = z.infer<typeof PlaybookRequiredFieldSchema>;
export type PlaybookObjection = z.infer<typeof PlaybookObjectionSchema>;
export type PlaybookTemplate = z.infer<typeof PlaybookTemplateSchema>;
export type PromptCoachReview = z.infer<typeof PromptCoachReviewSchema>;
export type PromptCoachGenerateRequest = z.infer<typeof PromptCoachGenerateRequestSchema>;
export type PromptCoachGenerateResponse = z.infer<typeof PromptCoachGenerateResponseSchema>;
