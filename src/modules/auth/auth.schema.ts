import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export const mobileSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid mobile number"),
});

export const otpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid mobile number"),
  otp: z
    .string()
    .length(6, { error: "OTP must be 6 digits" })
    .regex(/^\d{6}$/, { error: "OTP must contain only digits" }),
});

export const registerSchema = z.object({
  name: z.string().min(2, { error: "Name must be at least 2 characters" }),
  targetYear: z
    .number()
    .int()
    .min(new Date().getFullYear(), { error: "Invalid target year" })
    .optional(),
  city: z.string().optional(),
  schoolName: z.string().optional(),
});
