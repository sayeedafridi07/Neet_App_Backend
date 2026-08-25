import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";

const createSuperAdmin = async () => {
  try {
    const email = "superadmin@gmail.com";
    const password = "admin123";

    const existing = await prisma.admin.findUnique({
      where: { email },
    });

    if (existing) {
      console.log("Super Admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name: "Super Admin",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    console.log("Super Admin created successfully");
  } catch (error) {
    console.error("Failed to create Super Admin:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

createSuperAdmin();