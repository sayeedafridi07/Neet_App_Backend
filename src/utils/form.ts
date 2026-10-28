import { z } from "zod";

// Multipart bodies carry every value as a string, so accept "true"/"false"
// alongside real booleans from JSON bodies.
export const formBoolean = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : value),
  z.boolean(),
);

// Arrays and objects sent through multipart arrive JSON encoded.
export const formJson = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, schema);
