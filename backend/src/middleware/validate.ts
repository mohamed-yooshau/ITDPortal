import { Request, Response, NextFunction } from "express";

type AllowedKeys = string[];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const blockUnexpectedBodyKeys = (allowed: AllowedKeys) => {
  const allowedSet = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isPlainObject(req.body)) {
      next();
      return;
    }
    const keys = Object.keys(req.body);
    const extra = keys.filter((key) => !allowedSet.has(key));
    if (extra.length) {
      console.warn("Blocked unexpected body keys", {
        path: req.path,
        method: req.method,
        extra
      });
      res.status(400).json({ error: "Unexpected fields in request." });
      return;
    }
    next();
  };
};
