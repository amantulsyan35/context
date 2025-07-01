import { query } from './_generated/server';
import { ConvexError, v } from 'convex/values';

export const getVideos = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('videos').collect();
  },
});

export const getVideoById = query({
  args: { id: v.id('videos') },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.id);
    return video;
  },
});

export const getVideosCount = query(async ({ db }) => {
  return (await db.query('videos').collect()).length;
});
