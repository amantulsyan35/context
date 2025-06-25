import { mutation } from '../_generated/server';
import { v } from 'convex/values';

export const createVideo = mutation({
  args: {
    title: v.string(),
    link: v.string(),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const newTaskId = await ctx.db.insert('videos', {
      title: args.title,
      link: args.link,
      startTime: args.startTime,
      endTime: args.endTime,
    });
    return newTaskId;
  },
});
