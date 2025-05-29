import { z } from 'zod';

export const sendMessageSchema = z.object({
  to: z.string().min(3),
  message: z.string().min(1)
});

export const scheduleMessageSchema = z.object({
  to: z.string().min(3),
  message: z.string().min(1),
  date: z.string().min(8)
});
