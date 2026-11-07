import prisma from "../../config/prisma.js";
import {
  AdminRole,
  PaymentStatus,
  QuizAttemptStatus,
  QuizType,
  SubscriptionStatus,
} from "../../generated/prisma/enums.js";
import { istDateString } from "../../utils/activity.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// Timestamps are stored in UTC; shift to IST before bucketing by day/month/year.
const IST = `interval '5 hours 30 minutes'`;

/** UTC instant of 00:00 IST on the given IST date string. */
const istMidnight = (date: string) =>
  new Date(new Date(`${date}T00:00:00.000Z`).getTime() - IST_OFFSET_MS);

const istStartOfMonth = () => istMidnight(`${istDateString().slice(0, 7)}-01`);

/** Date-only value for comparing against the @db.Date activity column. */
const dateOnly = (date: string) => new Date(`${date}T00:00:00.000Z`);

const shiftDate = (date: string, days: number) =>
  new Date(dateOnly(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);

export const getOverview = async () => {
  const todayStart = istMidnight(istDateString());
  const monthStart = istStartOfMonth();

  const [
    totalUsers,
    activeUsers,
    profileCompleteUsers,
    newUsersToday,
    newUsersThisMonth,
    subjects,
    classes,
    chapters,
    audioLectures,
    activeAudioLectures,
    keywordRevisions,
    activeKeywordRevisions,
    quizzesByTypeAndStatus,
    questions,
    attemptsByStatus,
    plans,
    activePlans,
    subscriptionsByStatus,
    activeSubscribers,
    revenueTotal,
    revenueThisMonth,
    paymentsByStatus,
    totalAdmins,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { profileComplete: true } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.subject.count(),
    prisma.academicClass.count(),
    prisma.chapter.count(),
    prisma.audioLecture.count(),
    prisma.audioLecture.count({ where: { isActive: true } }),
    prisma.keywordRevision.count(),
    prisma.keywordRevision.count({ where: { isActive: true } }),
    prisma.quiz.groupBy({ by: ["type", "isActive"], _count: { _all: true } }),
    prisma.question.count({ where: { isActive: true } }),
    prisma.quizAttempt.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.subscriptionPlan.count(),
    prisma.subscriptionPlan.count({ where: { isActive: true } }),
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.subscription
      .findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        distinct: ["userId"],
        select: { userId: true },
      })
      .then((rows) => rows.length),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESS, paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.admin.count({ where: { role: AdminRole.ADMIN } }),
  ]);

  const countBy = <K extends string>(
    keys: readonly K[],
    rows: { _count: { _all: number } }[],
    pick: (row: any) => K,
  ) => {
    const result = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
    for (const row of rows) result[pick(row)] += row._count._all;
    return result;
  };

  const quizzesByType = countBy(Object.values(QuizType), quizzesByTypeAndStatus, (r) => r.type);
  const activeQuizzes = quizzesByTypeAndStatus
    .filter((r) => r.isActive)
    .reduce((sum, r) => sum + r._count._all, 0);
  const totalQuizzes = quizzesByTypeAndStatus.reduce((sum, r) => sum + r._count._all, 0);

  const attempts = countBy(Object.values(QuizAttemptStatus), attemptsByStatus, (r) => r.status);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      profileComplete: profileCompleteUsers,
      profileIncomplete: totalUsers - profileCompleteUsers,
      newToday: newUsersToday,
      newThisMonth: newUsersThisMonth,
    },
    content: {
      subjects,
      classes,
      chapters,
      audioLectures: {
        total: audioLectures,
        active: activeAudioLectures,
        inactive: audioLectures - activeAudioLectures,
      },
      keywordRevisions: {
        total: keywordRevisions,
        active: activeKeywordRevisions,
        inactive: keywordRevisions - activeKeywordRevisions,
      },
      quizzes: {
        total: totalQuizzes,
        active: activeQuizzes,
        inactive: totalQuizzes - activeQuizzes,
        byType: quizzesByType,
      },
      questions,
    },
    quizAttempts: {
      total: Object.values(attempts).reduce((a, b) => a + b, 0),
      byStatus: attempts,
    },
    subscriptions: {
      plans: { total: plans, active: activePlans },
      activeSubscribers,
      byStatus: countBy(Object.values(SubscriptionStatus), subscriptionsByStatus, (r) => r.status),
    },
    payments: {
      byStatus: countBy(Object.values(PaymentStatus), paymentsByStatus, (r) => r.status),
      // Amounts in paise
      revenueTotal: revenueTotal._sum.amount ?? 0,
      revenueThisMonth: revenueThisMonth._sum.amount ?? 0,
    },
    admins: totalAdmins,
  };
};

export const getUserTrends = async (year: number) => {
  const [yearly, monthly, monthlyActive, usersBeforeYear] = await Promise.all([
    prisma.$queryRawUnsafe<{ year: number; count: number }[]>(`
      SELECT EXTRACT(YEAR FROM "createdAt" + ${IST})::int AS year, COUNT(*)::int AS count
      FROM "User"
      GROUP BY 1
      ORDER BY 1
    `),
    prisma.$queryRawUnsafe<{ month: number; count: number }[]>(
      `
      SELECT EXTRACT(MONTH FROM "createdAt" + ${IST})::int AS month, COUNT(*)::int AS count
      FROM "User"
      WHERE EXTRACT(YEAR FROM "createdAt" + ${IST}) = $1
      GROUP BY 1
    `,
      year,
    ),
    prisma.$queryRawUnsafe<{ month: number; count: number }[]>(
      `
      SELECT EXTRACT(MONTH FROM "date")::int AS month, COUNT(DISTINCT "userId")::int AS count
      FROM "UserDailyActivity"
      WHERE EXTRACT(YEAR FROM "date") = $1
      GROUP BY 1
    `,
      year,
    ),
    prisma.user.count({
      where: { createdAt: { lt: istMidnight(`${year}-01-01`) } },
    }),
  ]);

  const newByMonth = new Map(monthly.map((r) => [r.month, r.count]));
  const activeByMonth = new Map(monthlyActive.map((r) => [r.month, r.count]));

  let cumulative = usersBeforeYear;
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const newUsers = newByMonth.get(month) ?? 0;
    cumulative += newUsers;
    return {
      month,
      label: new Date(Date.UTC(year, i, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      newUsers,
      totalUsers: cumulative,
      activeUsers: activeByMonth.get(month) ?? 0,
    };
  });

  let yearlyCumulative = 0;
  const years = yearly.map((r) => {
    yearlyCumulative += r.count;
    return { year: r.year, newUsers: r.count, totalUsers: yearlyCumulative };
  });

  return {
    year,
    availableYears: years.map((y) => y.year),
    summary: {
      newUsers: months.reduce((sum, m) => sum + m.newUsers, 0),
      totalUsersAtYearEnd: cumulative,
    },
    months,
    years,
  };
};

export const getActiveUsers = async (days: number, inactiveAfterDays: number) => {
  const today = istDateString();
  const seriesStart = shiftDate(today, -(days - 1));
  const inactiveCutoff = new Date(Date.now() - inactiveAfterDays * DAY_MS);

  const distinctActiveSince = (from: string) =>
    prisma.userDailyActivity
      .findMany({
        where: { date: { gte: dateOnly(from) } },
        distinct: ["userId"],
        select: { userId: true },
      })
      .then((rows) => rows.length);

  const [dau, wau, mau, series, totalUsers, enabledUsers, engaged, neverActive] =
    await Promise.all([
      prisma.userDailyActivity.count({ where: { date: dateOnly(today) } }),
      distinctActiveSince(shiftDate(today, -6)),
      distinctActiveSince(shiftDate(today, -29)),
      prisma.userDailyActivity.groupBy({
        by: ["date"],
        where: { date: { gte: dateOnly(seriesStart) } },
        _count: { _all: true },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { lastActiveAt: { gte: inactiveCutoff } } }),
      prisma.user.count({ where: { lastActiveAt: null } }),
    ]);

  const byDate = new Map(
    series.map((r) => [r.date.toISOString().slice(0, 10), r._count._all]),
  );

  const daily = Array.from({ length: days }, (_, i) => {
    const date = shiftDate(seriesStart, i);
    return { date, activeUsers: byDate.get(date) ?? 0 };
  });

  return {
    today,
    dau,
    wau,
    mau,
    // DAU/MAU — share of monthly users who come back daily
    stickiness: mau ? Number((dau / mau).toFixed(4)) : 0,
    // Account status (isActive flag, i.e. enabled/disabled by admin)
    accountStatus: {
      total: totalUsers,
      active: enabledUsers,
      inactive: totalUsers - enabledUsers,
    },
    // Usage-based: seen within `inactiveAfterDays` vs not
    engagement: {
      inactiveAfterDays,
      active: engaged,
      inactive: totalUsers - engaged,
      neverActive,
    },
    daily,
  };
};
