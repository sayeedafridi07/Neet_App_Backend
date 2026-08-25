import type { Request, Response, NextFunction } from "express";
import * as userService from "./user.service.js";
import { sendResponse } from "../../utils/response.js";
import { getUsersSchema } from "./user.schema.js";

// export const getUsers = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const users = await userService.getUsers();

//     return sendResponse(res, 200, true, "Users retrieved successfully", users);
//   } catch (error) {
//     next(error);
//   }
// };

// export const getUsers = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const page = Math.max(Number(req.query.page) || 1, 1);

//     const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

//     const search =
//       typeof req.query.search === "string"
//         ? req.query.search.trim()
//         : undefined;

//     const result = await userService.getUsers(page, limit, search);

//     return sendResponse(res, 200, true, "Users retrieved successfully", result);
//   } catch (error) {
//     next(error);
//   }
// };

export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search } = getUsersSchema.parse(req.query);

    const result = await userService.getUsers(page, limit, search);

    return sendResponse(res, 200, true, "Users retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      return sendResponse(res, 404, true, "User not found");
    }

    return sendResponse(res, 200, true, "User retrieved successfully", user);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await userService.createUser(req.body);

    return sendResponse(res, 201, true, "User created successfully", user);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    return sendResponse(res, 200, true, "User updated successfully", user);
  } catch (error) {
    next(error);
  }
};

export const toggleStatus = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await userService.toggleStatus(req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "User status updated successfully",
      user,
    );
  } catch (error) {
    next(error);
  }
};

export const resetDevice = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await userService.resetDevice(req.params.id);

    return sendResponse(res, 200, true, "User device reset successfully", user);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await userService.deleteUser(req.params.id);

    return sendResponse(res, 200, true, "User deleted successfully");
  } catch (error) {
    next(error);
  }
};
