import { PrismaClient, Prisma } from "@prisma/client";

export type PrismaTransaction =
  Prisma.TransactionClient;

export const prisma = new PrismaClient();