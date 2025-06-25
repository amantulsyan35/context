import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  videos: defineTable({
    title: v.string(),
    link: v.string(),
    startTime: v.number(),
    endTime: v.number(),
  }),
});
