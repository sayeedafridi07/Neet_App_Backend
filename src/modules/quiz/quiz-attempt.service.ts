import prisma from "../../config/prisma.js";
import { getUploadUrl } from "../../config/multer.js";
import { AppError } from "../../utils/app-error.js";
import {
  QuizAnswerStatus,
  QuizAttemptStatus,
} from "../../generated/prisma/enums.js";

import type { SaveAnswerData } from "./quiz.schema.js";

// Used when a quiz has no durationMinutes set (NEET pace: ~1 min/question)
const DEFAULT_MINUTES_PER_QUESTION = 1;

// Large quizzes are split into sets of this many questions (by question order).
// The last set holds the remainder, e.g. 84 questions -> sets of 50 and 34.
export const QUESTIONS_PER_SET = 50;


type SnapshotOption = {
  id: string;
  text: string;
  imageKey: string | null;
  isCorrect: boolean;
  order: number;
};

type SnapshotQuestion = {
  id: string;
  question: string;
  explanation: string | null;
  imageKey: string | null;
  explanationImageKey: string | null;
  options: SnapshotOption[];
};

// Everything needed to score and review the attempt, frozen at start so later
// admin edits to the quiz never change a past attempt.
type AttemptSnapshot = {
  quiz: {
    id: string;
    title: string;
    durationMinutes: number;
    correctMarks: number;
    wrongMarks: number;
    skippedMarks: number;
    setNumber?: number | null;
  };
  questions: SnapshotQuestion[];
};

const COMPLETED_STATUSES: QuizAttemptStatus[] = [
  QuizAttemptStatus.SUBMITTED,
  QuizAttemptStatus.AUTO_SUBMITTED,
  QuizAttemptStatus.EXPIRED,
];

const imageUrl = (key: string | null) => (key ? getUploadUrl(key) : null);

const shuffle = <T>(items: T[]) => {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }

  return copy;
};

const getSnapshot = (attempt: { questionsSnapshot: unknown }) =>
  attempt.questionsSnapshot as AttemptSnapshot;

// Question as shown while attempting: no correct answer, no explanation
const formatPlayQuestion = (question: SnapshotQuestion) => ({
  id: question.id,
  question: question.question,
  imageUrl: imageUrl(question.imageKey),
  options: question.options.map((option) => ({
    id: option.id,
    text: option.text,
    imageUrl: imageUrl(option.imageKey),
    order: option.order,
  })),
});

const formatAnswer = (answer: {
  questionId: string;
  questionOrder: number;
  selectedOptionId: string | null;
  status: QuizAnswerStatus;
}) => ({
  questionId: answer.questionId,
  questionOrder: answer.questionOrder,
  selectedOptionId: answer.selectedOptionId,
  status: answer.status,
});

const formatAttempt = (attempt: {
  id: string;
  status: QuizAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
}) => ({
  id: attempt.id,
  status: attempt.status,
  startedAt: attempt.startedAt,
  expiresAt: attempt.expiresAt,
  remainingSeconds: Math.max(
    0,
    Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000),
  ),
});

const formatQuizInfo = (snapshot: AttemptSnapshot) => ({
  id: snapshot.quiz.id,
  title: snapshot.quiz.title,
  setNumber: snapshot.quiz.setNumber ?? null,
  durationMinutes: snapshot.quiz.durationMinutes,
  totalQuestions: snapshot.questions.length,
  totalMarks: snapshot.questions.length * snapshot.quiz.correctMarks,
  markingScheme: {
    correct: snapshot.quiz.correctMarks,
    wrong: snapshot.quiz.wrongMarks,
    skipped: snapshot.quiz.skippedMarks,
  },
});

const loadAttemptState = async (attemptId: string) => {
  const attempt = await prisma.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: { orderBy: { questionOrder: "asc" } } },
  });

  const snapshot = getSnapshot(attempt);
  const questionMap = new Map(snapshot.questions.map((q) => [q.id, q]));

  return {
    attempt: formatAttempt(attempt),
    quiz: formatQuizInfo(snapshot),
    questions: attempt.answers.map((answer) =>
      formatPlayQuestion(questionMap.get(answer.questionId)!),
    ),
    answers: attempt.answers.map(formatAnswer),
  };
};

// Scores every answer, stores per-answer marks and closes the attempt.
// Guarded on IN_PROGRESS so concurrent submits only score once.
const finalizeAttempt = async (
  attemptId: string,
  status: QuizAttemptStatus,
) => {
  const attempt = await prisma.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true },
  });

  if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
    return attempt;
  }

  const snapshot = getSnapshot(attempt);
  const { correctMarks, wrongMarks, skippedMarks } = snapshot.quiz;
  const questionMap = new Map(snapshot.questions.map((q) => [q.id, q]));

  let score = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  const graded = attempt.answers.map((answer) => {
    const question = questionMap.get(answer.questionId);
    const option = question?.options.find(
      (o) => o.id === answer.selectedOptionId,
    );

    let isCorrect: boolean | null = null;
    let marks = skippedMarks;

    if (!option) {
      skipped++;
    } else if (option.isCorrect) {
      isCorrect = true;
      marks = correctMarks;
      correct++;
    } else {
      isCorrect = false;
      marks = wrongMarks;
      wrong++;
    }

    score += marks;

    return { id: answer.id, isCorrect, marks };
  });

  const submittedAt =
    status === QuizAttemptStatus.SUBMITTED ? new Date() : attempt.expiresAt;

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.quizAttempt.updateMany({
      where: { id: attemptId, status: QuizAttemptStatus.IN_PROGRESS },
      data: {
        status,
        submittedAt,
        score,
        correctAnswers: correct,
        wrongAnswers: wrong,
        skippedAnswers: skipped,
      },
    });

    // Someone else finalized it in the meantime
    if (count === 0) {
      return tx.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    }

    await Promise.all(
      graded.map(({ id, isCorrect, marks }) =>
        tx.quizAttemptAnswer.update({
          where: { id },
          data: { isCorrect, marks },
        }),
      ),
    );

    return tx.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  });
};

const isExpired = (attempt: { expiresAt: Date }) =>
  attempt.expiresAt.getTime() <= Date.now();

const getOwnAttempt = async (attemptId: string, userId: string) => {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId },
  });

  if (!attempt) {
    throw new AppError(404, "Quiz attempt not found");
  }

  return attempt;
};

/* -------------------------------------------------------------------------- */
/* START / RESUME                                                             */
/* -------------------------------------------------------------------------- */

const getTotalSets = (totalQuestions: number) =>
  Math.ceil(totalQuestions / QUESTIONS_PER_SET);

const getSetQuestions = <T>(questions: T[], setNumber: number) =>
  questions.slice(
    (setNumber - 1) * QUESTIONS_PER_SET,
    setNumber * QUESTIONS_PER_SET,
  );

const percentage = (part: number, total: number) =>
  total === 0 ? 0 : Math.round((part / total) * 100);

// Current progress round per quiz (highest round the user has an attempt in)
const getCurrentRounds = async (quizIds: string[], userId: string) => {
  const rounds = await prisma.quizAttempt.groupBy({
    by: ["quizId"],
    where: { userId, quizId: { in: quizIds } },
    _max: { round: true },
  });

  return new Map(rounds.map((r) => [r.quizId, r._max.round ?? 1]));
};

// Questions (per quiz) the user has covered in their current round: every
// question that was part of a finished set (submitted / auto-submitted /
// expired), answered or skipped. Tracked per question so newly added
// questions show up as not done yet.
const getCompletedQuestionIds = async (quizIds: string[], userId: string) => {
  const rounds = await getCurrentRounds(quizIds, userId);

  const rows = await prisma.quizAttemptAnswer.findMany({
    where: {
      attempt: {
        userId,
        quizId: { in: quizIds },
        status: { in: COMPLETED_STATUSES },
      },
    },
    select: { questionId: true, attempt: { select: { quizId: true, round: true } } },
  });

  return new Set(
    rows
      .filter((row) => row.attempt.round === (rounds.get(row.attempt.quizId) ?? 1))
      .map((row) => row.questionId),
  );
};

// First set that still has questions not covered in this round; null = 100%
const pickNextSet = (questionIds: string[], completedIds: Set<string>) => {
  const totalSets = getTotalSets(questionIds.length);

  for (let setNumber = 1; setNumber <= totalSets; setNumber++) {
    const ids = getSetQuestions(questionIds, setNumber);

    if (ids.some((id) => !completedIds.has(id))) return setNumber;
  }

  return null;
};

/* -------------------------------------------------------------------------- */
/* START                                                                      */
/* -------------------------------------------------------------------------- */

// Serves the quiz one set (QUESTIONS_PER_SET questions) at a time: resumes the
// running attempt, otherwise starts the next set the student hasn't finished.
export const startQuiz = async (quizId: string, userId: string) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!quiz || !quiz.isActive) {
    throw new AppError(404, "Quiz not found or not active");
  }

  // Resume the running attempt if there is one; close it if its time ran out
  const active = await prisma.quizAttempt.findFirst({
    where: { userId, quizId, status: QuizAttemptStatus.IN_PROGRESS },
    orderBy: { startedAt: "desc" },
  });

  if (active) {
    if (!isExpired(active)) {
      return { resumed: true, ...(await loadAttemptState(active.id)) };
    }

    await finalizeAttempt(active.id, QuizAttemptStatus.AUTO_SUBMITTED);
  }

  if (quiz.questions.length === 0) {
    throw new AppError(400, "Quiz has no active questions");
  }

  const totalSets = getTotalSets(quiz.questions.length);
  const [completedIds, rounds] = await Promise.all([
    getCompletedQuestionIds([quizId], userId),
    getCurrentRounds([quizId], userId),
  ]);

  let round = rounds.get(quizId) ?? 1;
  let setNumber = pickNextSet(
    quiz.questions.map((q) => q.id),
    completedIds,
  );

  // Everything covered (100%): reset progress by starting a new round at set 1
  if (setNumber === null) {
    round += 1;
    setNumber = 1;
  }

  const questions = getSetQuestions(quiz.questions, setNumber);

  // A quiz-level duration only fits when the whole quiz is a single set
  const durationMinutes =
    totalSets === 1 && quiz.durationMinutes
      ? quiz.durationMinutes
      : questions.length * DEFAULT_MINUTES_PER_QUESTION;

  const snapshot: AttemptSnapshot = {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      durationMinutes,
      correctMarks: quiz.correctMarks,
      wrongMarks: quiz.wrongMarks,
      skippedMarks: quiz.skippedMarks,
      setNumber,
    },
    questions: questions.map((q) => ({
      id: q.id,
      question: q.question,
      explanation: q.explanation,
      imageKey: q.imageKey,
      explanationImageKey: q.explanationImageKey,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        imageKey: o.imageKey,
        isCorrect: o.isCorrect,
        order: o.order,
      })),
    })),
  };

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
  const shuffled = shuffle(questions);

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId,
      userId,
      startedAt,
      expiresAt,
      setNumber,
      round,
      questionsSnapshot: snapshot,
      answers: {
        create: shuffled.map((q, index) => ({
          questionId: q.id,
          questionOrder: index + 1,
        })),
      },
    },
  });

  return { resumed: false, ...(await loadAttemptState(attempt.id)) };
};

/* -------------------------------------------------------------------------- */
/* PROGRESS                                                                   */
/* -------------------------------------------------------------------------- */

export type QuizProgress = {
  totalQuestions: number;
  completedQuestions: number;
  completionPercentage: number;
  totalSets: number;
  completedSets: number;
};

// Completion for many quizzes at once (used by the student quiz list):
// covered questions / total active questions
export const getQuizzesProgress = async (quizIds: string[], userId: string) => {
  const progress = new Map<string, QuizProgress>();
  if (quizIds.length === 0) return progress;

  const [questions, completedIds] = await Promise.all([
    prisma.question.findMany({
      where: { quizId: { in: quizIds }, isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, quizId: true },
    }),
    getCompletedQuestionIds(quizIds, userId),
  ]);

  const byQuiz = new Map<string, string[]>(quizIds.map((id) => [id, []]));
  for (const q of questions) byQuiz.get(q.quizId)!.push(q.id);

  for (const [quizId, ids] of byQuiz) {
    const totalSets = getTotalSets(ids.length);
    const completedQuestions = ids.filter((id) => completedIds.has(id)).length;
    let completedSets = 0;

    for (let setNumber = 1; setNumber <= totalSets; setNumber++) {
      const setIds = getSetQuestions(ids, setNumber);
      if (setIds.every((id) => completedIds.has(id))) completedSets++;
    }

    progress.set(quizId, {
      totalQuestions: ids.length,
      completedQuestions,
      completionPercentage: percentage(completedQuestions, ids.length),
      totalSets,
      completedSets,
    });
  }

  return progress;
};

/* -------------------------------------------------------------------------- */
/* SAVE ANSWER                                                                */
/* -------------------------------------------------------------------------- */

export const saveAnswer = async (
  attemptId: string,
  userId: string,
  data: SaveAnswerData,
) => {
  const attempt = await getOwnAttempt(attemptId, userId);

  if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
    throw new AppError(400, "Quiz attempt is already submitted");
  }

  if (isExpired(attempt)) {
    await finalizeAttempt(attemptId, QuizAttemptStatus.AUTO_SUBMITTED);
    throw new AppError(400, "Quiz attempt has expired");
  }

  const question = getSnapshot(attempt).questions.find(
    (q) => q.id === data.questionId,
  );

  if (!question) {
    throw new AppError(404, "Question is not part of this attempt");
  }

  const selectedOptionId = data.selectedOptionId ?? null;

  if (
    selectedOptionId &&
    !question.options.some((o) => o.id === selectedOptionId)
  ) {
    throw new AppError(400, "Option does not belong to this question");
  }

  // Derive the status from the selection unless the client marks for review
  const status = data.markedForReview
    ? selectedOptionId
      ? QuizAnswerStatus.MARKED_AND_ANSWERED
      : QuizAnswerStatus.MARKED
    : selectedOptionId
      ? QuizAnswerStatus.ANSWERED
      : QuizAnswerStatus.NOT_ANSWERED;

  const answer = await prisma.quizAttemptAnswer.update({
    where: {
      attemptId_questionId: { attemptId, questionId: data.questionId },
    },
    data: { selectedOptionId, status },
  });

  return formatAnswer(answer);
};

/* -------------------------------------------------------------------------- */
/* SUBMIT                                                                     */
/* -------------------------------------------------------------------------- */

const formatSummary = (attempt: {
  id: string;
  status: QuizAttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  score: unknown;
  correctAnswers: number;
  wrongAnswers: number;
  skippedAnswers: number;
  questionsSnapshot: unknown;
}) => {
  const snapshot = getSnapshot(attempt);

  return {
    attemptId: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeTakenSeconds: attempt.submittedAt
      ? Math.floor(
          (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000,
        )
      : null,
    score: attempt.score === null ? null : Number(attempt.score),
    correctCount: attempt.correctAnswers,
    wrongCount: attempt.wrongAnswers,
    skippedCount: attempt.skippedAnswers,
    quiz: formatQuizInfo(snapshot),
  };
};

export const submitQuiz = async (attemptId: string, userId: string) => {
  const attempt = await getOwnAttempt(attemptId, userId);

  if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
    throw new AppError(400, "Quiz attempt is already submitted");
  }

  // Past expiry the attempt is closed at expiresAt, ignoring late answers' timing
  const finalized = await finalizeAttempt(
    attemptId,
    isExpired(attempt)
      ? QuizAttemptStatus.AUTO_SUBMITTED
      : QuizAttemptStatus.SUBMITTED,
  );

  return formatSummary(finalized);
};

/* -------------------------------------------------------------------------- */
/* RESULT REVIEW                                                              */
/* -------------------------------------------------------------------------- */

export const getQuizResult = async (attemptId: string, userId: string) => {
  let attempt = await getOwnAttempt(attemptId, userId);

  // Lazily close attempts whose timer ran out without a submit
  if (attempt.status === QuizAttemptStatus.IN_PROGRESS) {
    if (!isExpired(attempt)) {
      throw new AppError(
        400,
        "Quiz is still in progress. Submit it first to see the result",
      );
    }

    attempt = await finalizeAttempt(
      attemptId,
      QuizAttemptStatus.AUTO_SUBMITTED,
    );
  }

  if (!COMPLETED_STATUSES.includes(attempt.status)) {
    throw new AppError(400, "Result is not available for this attempt");
  }

  const answers = await prisma.quizAttemptAnswer.findMany({
    where: { attemptId },
    orderBy: { questionOrder: "asc" },
  });

  const snapshot = getSnapshot(attempt);
  const questionMap = new Map(snapshot.questions.map((q) => [q.id, q]));

  const questions = answers.map((answer) => {
    const question = questionMap.get(answer.questionId)!;
    const correctOption = question.options.find((o) => o.isCorrect);

    return {
      id: question.id,
      questionOrder: answer.questionOrder,
      question: question.question,
      imageUrl: imageUrl(question.imageKey),
      explanation: question.explanation,
      explanationImageUrl: imageUrl(question.explanationImageKey),
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        imageUrl: imageUrl(option.imageKey),
        order: option.order,
        isCorrect: option.isCorrect,
        isSelected: option.id === answer.selectedOptionId,
      })),
      selectedOptionId: answer.selectedOptionId,
      correctOptionId: correctOption?.id ?? null,
      answerStatus: answer.status,
      result:
        answer.isCorrect === null
          ? "SKIPPED"
          : answer.isCorrect
            ? "CORRECT"
            : "WRONG",
      marks: answer.marks === null ? 0 : Number(answer.marks),
    };
  });

  return {
    result: formatSummary(attempt),
    questions,
  };
};

/* -------------------------------------------------------------------------- */
/* HISTORY                                                                    */
/* -------------------------------------------------------------------------- */

export const getMyAttempts = async (quizId: string, userId: string) => {
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId, userId },
    orderBy: { startedAt: "desc" },
  });

  return attempts.map((attempt, index) => ({
    ...formatSummary(attempt),
    attemptNumber: attempts.length - index,
    setNumber: attempt.setNumber,
    expiresAt: attempt.expiresAt,
  }));
};
