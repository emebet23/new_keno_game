import { Response } from "express";

export const success = (res: Response, data: unknown, message = "Success") => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

export const error = (res: Response, message = "Error", status = 400) => {
  return res.status(status).json({
    success: false,
    message,
  });
};
