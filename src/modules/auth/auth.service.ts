import prisma from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const adminLogin = async (email: string, password: string) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: {
        email,
      },
    });

    if (!admin) {
      throw new AppError(401, "Invalid credentials");
    }

    if (!admin.isActive) {
      throw new AppError(403, "Account disabled");
    }

    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      throw new AppError(401, "Invalid credentials");
    }

    const token = jwt.sign(
      { userId: admin.id, email: admin.email, type: admin.role },
      process.env.JWT_SECRET as string,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      } as jwt.SignOptions,
    );

    await prisma.admin.update({
      where: { id: admin.id },
      data: { accessToken: token },
    });

    return {
      accessToken: token,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  } catch (error) {
    throw error;
  }
};

export const adminLogout = async (adminId: string) => {
  try {
    await prisma.admin.update({
      where: { id: adminId },
      data: { accessToken: null },
    });
  } catch (error) {
    throw error;
  }
};

export const logout = async (userId: string) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { accessToken: null },
    });
  } catch (error) {
    throw error;
  }
};

export const sendOtp = async (phone: string) => {
  try {
    if (process.env.NODE_ENV === "production") {
      // await msg91.sendOtp(phone); // MSG91 verify API — 6-digit OTP
    }
    // dev mode: no real SMS sent, frontend uses 000000
  } catch (error) {
    throw error;
  }
};

export const verifyOtp = async (
  phone: string,
  otp: string,
  deviceId: string,
) => {
  // OTP verification
  if (process.env.NODE_ENV === "production") {
    // const isValid = await msg91.verifyOtp(phone, otp);
    // if (!isValid) {
    //   throw new AppError(401, "Invalid OTP");
    // }
  } else {
    if (otp !== "000000") {
      throw new AppError(401, "Invalid OTP");
    }
  }

  let user = await prisma.user.findUnique({
    where: { phone },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        lastActiveAt: new Date(),
      },
    });
  } else {
    if (!user.isActive) {
      throw new AppError(403, "Account disabled");
    }

    if (user.deviceId && user.deviceId !== deviceId) {
      throw new AppError(
        403,
        "Device mismatch. Please log in from your registered device.",
      );
    }

    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        deviceId: user.deviceId ?? deviceId,
        lastActiveAt: new Date(),
      },
    });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      phone: user.phone,
      type: "STUDENT",
    },
    process.env.JWT_SECRET as string,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    } as jwt.SignOptions,
  );

  user = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      accessToken: token,
    },
  });

  return {
    accessToken: token,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      targetYear: user.targetYear,
      city: user.city,
      schoolName: user.schoolName,
      profileComplete: user.profileComplete,
    },
  };
};

export const register = async (
  userId: string,
  name: string,
  targetYear?: number,
  city?: string,
  schoolName?: string,
  deviceId?: string,
) => {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        targetYear,
        city,
        schoolName,
        deviceId,
        profileComplete: true,
      },
    });

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      targetYear: user.targetYear,
      city: user.city,
      schoolName: user.schoolName,
      profileComplete: user.profileComplete,
    };
  } catch (error) {
    throw error;
  }
};
