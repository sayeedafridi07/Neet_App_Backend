import { z } from "zod";

export const userTrendsQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(() => new Date().getFullYear()),
});

export const activeUsersQuerySchema = z.object({
  // Length of the DAU series, ending today (IST)
  days: z.coerce.number().int().min(1).max(365).default(30),
  // A user is "engaged" if seen within this many days
  inactiveAfterDays: z.coerce.number().int().min(1).max(365).default(30),
});
