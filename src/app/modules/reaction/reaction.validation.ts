import { z } from 'zod';

export const ReactionValidations = {
  toggleReaction: z.object({
    messageId: z.string(),
  }),
  getReactionListByMessage: z.object({
    messageId: z.string(),
  }),
};
