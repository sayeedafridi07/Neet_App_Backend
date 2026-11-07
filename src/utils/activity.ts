import prisma from "../config/prisma.js";

// Dashboard day boundaries follow IST since the user base is in India.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar date (YYYY-MM-DD) in IST for the given instant. */
export const istDateString = (date: Date = new Date()) =>
  new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

// userId -> last IST date recorded, so we hit the DB at most once per user per day
// per process instead of on every request.
const recorded = new Map<string, string>();

/**
 * Fire-and-forget: marks the user active for today and bumps lastActiveAt.
 * Never throws — activity tracking must not break the request.
 */
export const trackUserActivity = (userId: string) => {
  const today = istDateString();

  if (recorded.get(userId) === today) return;
  recorded.set(userId, today);

  const date = new Date(`${today}T00:00:00.000Z`);

  Promise.all([
    prisma.userDailyActivity.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date },
      update: {},
    }),
    prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    }),
  ]).catch((error) => {
    recorded.delete(userId);
    console.error("Failed to track user activity", error);
  });
};
