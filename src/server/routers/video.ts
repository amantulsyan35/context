import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../utils/prisma';

export const videoRouter = router({
  getVideoDetails: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { id } = input;
      const data = await prisma.youtubeVideoDetails.findUnique({
        where: {
          id,
        },
      });
      return data;
    }),
  saveVideoDetails: publicProcedure
    .input(
      z.object({
        youtubeLink: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        canvasState: z
          .object({
            excalidrawState: z.record(z.any()).array(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(input);
      const dataBaseId = uuidv4();
      await prisma.youtubeVideoDetails.create({
        data: { id: dataBaseId, ...input },
      });
      return dataBaseId;
    }),
  getAllVideos: publicProcedure.query(async () => {
    const data = await prisma.youtubeVideoDetails?.findMany();
    return data;
  }),
});
