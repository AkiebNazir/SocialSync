'use server';

/**
 * @fileOverview Smart reply suggestions AI agent.
 *
 * - generateSmartReplies - A function that generates smart reply suggestions for a given message.
 * - SmartReplyInput - The input type for the generateSmartReplies function.
 * - SmartReplyOutput - The return type for the generateSmartReplies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartReplyInputSchema = z.object({
  message: z.string().describe('The content of the incoming message.'),
  context: z.string().optional().describe('Additional context about the conversation or user.'),
});
export type SmartReplyInput = z.infer<typeof SmartReplyInputSchema>;

const SmartReplyOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of suggested replies.'),
});
export type SmartReplyOutput = z.infer<typeof SmartReplyOutputSchema>;

export async function generateSmartReplies(input: SmartReplyInput): Promise<SmartReplyOutput> {
  return smartReplyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartReplyPrompt',
  input: {schema: SmartReplyInputSchema},
  output: {schema: SmartReplyOutputSchema},
  prompt: `You are an AI assistant that provides smart reply suggestions for incoming messages.

  Message: {{{message}}}
  Context: {{{context}}}

  Generate 3 distinct reply suggestions that are short and relevant to the message.
  Format your response as a JSON array of strings.`, config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const smartReplyFlow = ai.defineFlow(
  {
    name: 'smartReplyFlow',
    inputSchema: SmartReplyInputSchema,
    outputSchema: SmartReplyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
