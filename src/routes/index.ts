import { Router } from "express";

import userRoutes from "../modules/user/user.route.js";
import authRoutes from "../modules/auth/auth.route.js";
import adminRoutes from "../modules/admin/admin.route.js";
import subjectRoutes from "../modules/subject/subject.route.js";
import classRoutes from "../modules/class/class.route.js";
import chapterRoutes from "../modules/chapter/chapter.route.js";
import audioLectureRoutes from "../modules/audio-lecture/audio-lecture.route.js";
import keywordRevisionRoutes from "../modules/keyword-revision/keyword-revision.route.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/admins", adminRoutes);
router.use("/subjects", subjectRoutes);
router.use("/classes", classRoutes);
router.use("/chapters", chapterRoutes);
router.use("/audio-lectures", audioLectureRoutes);
router.use("/keyword-revisions", keywordRevisionRoutes);

export default router;
