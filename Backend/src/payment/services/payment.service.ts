import axios from "axios";
import FormData from "form-data";
import crypto from "crypto";
import prisma from "../../config/prisma";
import {
  TransactionStatus,
  TransactionType,
  DepositStatus,
  WalletSource,
} from "@prisma/client";
import { getIO } from "../../socket/socket";
import { SOCKET_EVENTS } from "../../socket/events";
import { userRoom } from "../../socket/rooms";
import { TelebirrParser } from "../utils/telebirr-parser";

type VerifiedTelebirrDetails = {
  receiptNo?: string;
  transactionStatus?: string;
  settledAmount?: string;
  totalPaidAmount?: string;
  payerName?: string;
  payerTelebirrNo?: string;
  creditedPartyName?: string;
  creditedPartyAccountNo?: string;
  paymentDate?: string;
};

type PaymentResult = {
  success: boolean;
  error?: string;
  amount?: number;
  transactionId?: string;
  balance?: number;
  newBalance?: number;
  status?: string;
  telegramId?: string;
  depositRequestId?: string;
};

export class PaymentService {
  private static get verifyApiBaseUrl(): string {
    return (
      process.env.VERIFY_API_BASE_URL || "https://verifyapi.leulzenebe.pro"
    );
  }

  private static get verifyHeaders() {
    return { "x-api-key": process.env.LEUL_API_KEY || "" };
  }

  private static emitWalletUpdate(userId: string, balance: number, playBalance: number) {
    try {
      getIO()
        .to(userRoom(userId))
        .emit(SOCKET_EVENTS.WALLET_UPDATED, { balance, playBalance });
    } catch {}
  }

  private static emitNewDeposit(deposit: Record<string, unknown>) {
    try {
      getIO().to("admin_room").emit(SOCKET_EVENTS.NEW_DEPOSIT, deposit);
    } catch {}
  }

  private static async creditWallet(
    userId: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<PaymentResult> {
    const existing = await prisma.transaction.findFirst({
      where: { referenceId, type: TransactionType.DEPOSIT },
    });

    if (existing) {
      return {
        success: false,
        error: "ይህ የደረሰኝ ቁጥር ቀደም ብሎ ጥቅም ላይ ውሏል (Already Used).",
      };
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const balanceBefore = wallet.playBalance;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { playBalance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          amount,
          type: TransactionType.DEPOSIT,
          walletSource: WalletSource.PLAY,
          status: TransactionStatus.SUCCESS,
          referenceId,
          description,
          balanceBefore,
          balanceAfter: updatedWallet.playBalance,
        },
      });

      return updatedWallet;
    });

    const mainBalance = Number(result.mainBalance);
    const playBalance = Number(result.playBalance);
    this.emitWalletUpdate(userId, mainBalance, playBalance);

    return { success: true, amount, balance: playBalance, newBalance: playBalance };
  }

  // ─── User Management ────────────────────────────────────────────────

  static async findUser(telegramId: string) {
    return prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: { wallet: true },
    });
  }

  static async findUserByUsername(username: string) {
    const clean = username.replace(/^@/, "").trim();
    return prisma.user.findFirst({
      where: { username: { equals: clean, mode: "insensitive" } },
      include: { wallet: true },
    });
  }

  static async findUserByPhone(phone: string) {
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      digits = "251" + digits.substring(1);
    }
    if (!digits.startsWith("251")) {
      digits = "251" + digits;
    }
    return prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: digits },
          { phoneNumber: `+${digits}` },
        ],
      },
      include: { wallet: true },
    });
  }

  static async findOrCreateUser(
    telegramId: string,
    profile?: {
      username?: string;
      firstName?: string;
      lastName?: string;
      referredBy?: string;
    },
  ) {
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: { wallet: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(telegramId),
          username: profile?.username,
          firstName: profile?.firstName,
          lastName: profile?.lastName,
          referredBy: profile?.referredBy || null,
          wallet: { create: { mainBalance: 0, playBalance: 20 } },
        },
        include: { wallet: true },
      });
    }

    return user;
  }

  static async getBalance(telegramId: string) {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: { wallet: true },
    });

    if (!user?.wallet) {
      return { balance: 0, playBalance: 0, totalBalance: 0 };
    }

    const balance = Number(user.wallet.mainBalance);
    const playBalance = Number(user.wallet.playBalance);

    return { balance, playBalance, totalBalance: balance + playBalance };
  }

  // ─── Deposit Request Creation (Pending Flow) ────────────────────────

  static async createDepositRequest({
    userId,
    amount,
    referenceId,
    paymentMethod,
    verifiedData,
  }: {
    userId: string;
    amount: number;
    referenceId: string;
    paymentMethod?: string;
    verifiedData?: VerifiedTelebirrDetails;
  }): Promise<PaymentResult> {
    const duplicate = await prisma.depositRequest.findUnique({
      where: { referenceId },
    });

    if (duplicate) {
      return {
        success: false,
        error: "ይህ የደረሰኝ ቁጥር ቀደም ብሎ ተመዝግቧል (Already submitted).",
      };
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    const existingTx = await prisma.transaction.findFirst({
      where: { referenceId, type: TransactionType.DEPOSIT },
    });

    if (existingTx) {
      return {
        success: false,
        error: "ይህ የደረሰኝ ቁጥር ቀደም ብሎ ጥቅም ላይ ውሏል (Already Used).",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const balanceBefore = wallet.playBalance;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { playBalance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          amount,
          type: TransactionType.DEPOSIT,
          walletSource: WalletSource.PLAY,
          status: TransactionStatus.SUCCESS,
          referenceId,
          description: `Deposit - ${referenceId}`,
          balanceBefore,
          balanceAfter: updatedWallet.playBalance,
        },
      });

      await tx.depositRequest.create({
        data: {
          userId,
          amount,
          referenceId,
          paymentMethod: paymentMethod || "telebirr",
          status: DepositStatus.APPROVED,
          verifiedData: verifiedData || undefined,
          reviewedAt: new Date(),
        },
      });

      return updatedWallet;
    });

    const mainBalance = Number(result.mainBalance);
    const playBalance = Number(result.playBalance);
    this.emitWalletUpdate(userId, mainBalance, playBalance);

    return {
      success: true,
      amount,
      balance: playBalance,
      newBalance: playBalance,
      status: "APPROVED",
    };
  }

  // ─── Admin: List Deposits ────────────────────────────────────────────

  static async getAllDeposits(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [deposits, total] = await Promise.all([
      prisma.depositRequest.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              firstName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.depositRequest.count(),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      deposits,
    };
  }

  // ─── Manual Deposit (YB code) ──────────────────────────────────────

  static async createManualDepositRequest(telegramId: string, amount: number) {
    const user = await this.findOrCreateUser(telegramId);
    const randomStr = crypto.randomBytes(2).toString("hex").toUpperCase();
    const userIdPart = user.id.split("-")[0].substring(0, 4).toUpperCase();
    const refCode = `YB-${userIdPart}-${randomStr}`;

    const result = await this.createDepositRequest({
      userId: user.id,
      amount,
      referenceId: refCode,
      paymentMethod: "manual",
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      refCode,
      amount,
      message: "Manual deposit request created. Please follow instructions.",
    };
  }

  // ─── Verification Pipelines ─────────────────────────────────────────

  private static get merchantPhone(): string {
    return (process.env.MERCHANT_PHONE || "").replace(/\s|-/g, "");
  }

  private static normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      digits = "251" + digits.substring(1);
    }
    if (!digits.startsWith("251")) {
      digits = "251" + digits;
    }
    return digits;
  }

  private static validateTelebirrDetails(
    details: VerifiedTelebirrDetails,
    expectedAmount?: number,
  ): {
    valid: boolean;
    amount?: number;
    transactionId?: string;
    error?: string;
  } {
    if (
      details.transactionStatus &&
      details.transactionStatus !== "Completed"
    ) {
      return {
        valid: false,
        error: `Transaction not completed: ${details.transactionStatus}`,
      };
    }

    const rawAmount = details.settledAmount || details.totalPaidAmount || "0";
    const amount = Number(
      rawAmount.replace(/Birr/gi, "").replace(/,/g, "").trim(),
    );

    if (!amount || amount <= 0) {
      return { valid: false, error: "Invalid amount" };
    }

    const transactionId = details.receiptNo;
    if (!transactionId) {
      return { valid: false, error: "Missing transaction reference" };
    }

    if (expectedAmount && amount < expectedAmount) {
      return {
        valid: false,
        error: `የተጠበቀው ${expectedAmount} ETB, የተላከው፡ ${amount} ETB`,
      };
    }

    const merchantPhone = this.merchantPhone;
    if (merchantPhone) {
      const expected = this.normalizePhone(merchantPhone);
      const rawCandidate = details.creditedPartyAccountNo || "";

      console.log(
        `[VERIFY] Phone validation - merchant: "${merchantPhone}" → "${expected}"`,
      );
      console.log(
        `[VERIFY] API returned creditedPartyAccountNo: "${rawCandidate}"`,
      );

      if (rawCandidate) {
        const hasMask = rawCandidate.includes("*");
        if (hasMask) {
          const cleanReceived = rawCandidate.replace(/[*\s-]/g, "");
          const receivedDigits = cleanReceived.replace(/\D/g, "");
          const expectedDigits = expected.replace(/\D/g, "");
          const prefixLen = 4;
          const suffixLen = 4;
          const prefixMatch = receivedDigits.substring(0, prefixLen) === expectedDigits.substring(0, prefixLen);
          const suffixMatch = receivedDigits.slice(-suffixLen) === expectedDigits.slice(-suffixLen);

          console.log(
            `[VERIFY] Masked number: "${rawCandidate}" → digits: "${receivedDigits}"`,
          );
          console.log(
            `[VERIFY] Prefix (${prefixLen}): "${receivedDigits.substring(0, prefixLen)}" vs "${expectedDigits.substring(0, prefixLen)}" → ${prefixMatch}`,
          );
          console.log(
            `[VERIFY] Suffix (${suffixLen}): "${receivedDigits.slice(-suffixLen)}" vs "${expectedDigits.slice(-suffixLen)}" → ${suffixMatch}`,
          );

          if (!prefixMatch || !suffixMatch) {
            console.error(
              `[VERIFY] CRITICAL: Masked phone mismatch! Expected: "${expected}", Got: "${rawCandidate}"`,
            );
            return {
              valid: false,
              error: `ይህ የተላከው ገንዘብ የተሳሳተ ቁጥር ላይ ቀርቧል። እባክዎን ወደ ${merchantPhone} ብቻ ይላኩ`,
            };
          }
          console.log(`[VERIFY] Masked phone MATCH ✓`);
        } else {
          const received = this.normalizePhone(rawCandidate);
          if (received !== expected) {
            console.error(
              `[VERIFY] CRITICAL: Phone mismatch! Expected: "${expected}", Got: "${received}"`,
            );
            return {
              valid: false,
              error: `ይህ የተላከው ገንዘብ የተሳሳተ ቁጥር ላይ ቀርቧል። እባክዎን ወደ ${merchantPhone} ብቻ ይላኩ`,
            };
          }
          console.log(`[VERIFY] Phone MATCH ✓`);
        }
      }
    }

    return { valid: true, amount, transactionId };
  }

  static async verifyAndProcessPaymentByReference(
    telegramId: string,
    reference: string,
    expectedAmount?: number,
  ): Promise<PaymentResult> {
    const user = await this.findOrCreateUser(telegramId);

    let cleanRef = reference
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9]/g, "");
    const candidates = new Set<string>([cleanRef]);

    if (cleanRef.length === 11) {
      candidates.add(cleanRef.replace("11I", "1I"));
      candidates.add(cleanRef.replace("1I1", "1I"));
      candidates.add(cleanRef.replace("II1", "1I"));
    }

    const basePool = [...candidates];
    for (const variant of basePool) {
      if (variant.includes("G")) {
        candidates.add(variant.replace(/G/g, "6"));
        candidates.add(variant.replace(/G/g, "C"));
      }
      if (variant.includes("6")) candidates.add(variant.replace(/6/g, "G"));
      if (variant.includes("C")) candidates.add(variant.replace(/C/g, "G"));
      if (variant.includes("T")) candidates.add(variant.replace(/T/g, "7"));
      if (variant.includes("7")) candidates.add(variant.replace(/7/g, "T"));
      if (variant.includes("V")) candidates.add(variant.replace(/V/g, "U"));
      if (variant.includes("U")) candidates.add(variant.replace(/U/g, "V"));
      if (variant.includes("Z")) candidates.add(variant.replace(/Z/g, "2"));
      if (variant.includes("2")) candidates.add(variant.replace(/2/g, "Z"));
      if (variant.length === 10) {
        candidates.add(variant.replace(/1/g, "I"));
        candidates.add(variant.replace(/I/g, "1"));
      }
    }

    if (cleanRef.length === 9) {
      candidates.add(`${cleanRef}1`);
    }

    const tryVerify = async (code: string) => {
      const verifyResponse = await axios.post(
        `${this.verifyApiBaseUrl}/verify-telebirr`,
        { reference: code },
        {
          headers: {
            "Content-Type": "application/json",
            ...this.verifyHeaders,
          },
          timeout: 8000,
        },
      );

      if (verifyResponse.data?.success && verifyResponse.data?.data) {
        return verifyResponse.data.data;
      }
      return null;
    };

    // Try exact reference first (fast path)
    try {
      const exactResult = await tryVerify(cleanRef);
      if (exactResult) {
        console.log(`[VERIFY] Exact ref "${cleanRef}" matched`);
        const validation = this.validateTelebirrDetails(exactResult, expectedAmount);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
        return this.createDepositRequest({
          userId: user.id,
          amount: validation.amount!,
          referenceId: validation.transactionId!,
          paymentMethod: "telebirr",
          verifiedData: exactResult,
        });
      }
    } catch (apiError: unknown) {
      console.error(`[VERIFY] API error for exact ref "${cleanRef}":`, axios.isAxiosError(apiError) ? apiError.message : apiError);
    }

    // Try remaining variants in parallel
    const variants = [...candidates].filter((c) => c !== cleanRef);
    if (variants.length > 0) {
      const results = await Promise.allSettled(
        variants.map(async (code) => {
          try {
            return await tryVerify(code);
          } catch {
            return null;
          }
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          console.log(`[VERIFY] Variant matched`);
          const validation = this.validateTelebirrDetails(r.value, expectedAmount);
          if (!validation.valid) {
            return { success: false, error: validation.error };
          }
          return this.createDepositRequest({
            userId: user.id,
            amount: validation.amount!,
            referenceId: validation.transactionId!,
            paymentMethod: "telebirr",
            verifiedData: r.value,
          });
        }
      }
    }

    return { success: false, error: "Telebirr verification failed" };
  }

  static async verifyAndProcessPayment(
    telegramId: string,
    imageBuffer: Buffer,
    expectedAmount?: number,
  ): Promise<PaymentResult> {
    const user = await this.findOrCreateUser(telegramId);
    const form = new FormData();
    form.append("file", imageBuffer, {
      filename: "payment.jpg",
      contentType: "image/jpeg",
    });

    const ocrResponse = await axios.post(
      `${this.verifyApiBaseUrl}/verify-image`,
      form,
      {
        headers: { ...form.getHeaders(), ...this.verifyHeaders },
        timeout: 25000,
      },
    );

    let rawRef =
      ocrResponse.data.reference?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
    if (!rawRef) {
      return { success: false, error: "No code found in image" };
    }

    const candidates = new Set<string>([rawRef]);
    const swapAll = (str: string, a: string, b: string) =>
      str.split(a).join("__TMP__").split(b).join(a).split("__TMP__").join(b);

    candidates.add(swapAll(rawRef, "1", "I"));

    if (rawRef.length >= 9 && rawRef.length <= 11) {
      candidates.add(rawRef.replace(/111/g, "1I1"));
      candidates.add(rawRef.replace(/11/g, "1I1"));
      candidates.add(rawRef.replace(/1I1/g, "111"));
      for (let i = 1; i < rawRef.length - 1; i++) {
        const arr = rawRef.split("");
        if (arr[i] === "1") {
          arr[i] = "I";
          candidates.add(arr.join(""));
        }
      }
      if (rawRef.startsWith("DEM59LZ")) {
        candidates.add("DEM59LZ1I1");
      }
    }

    const finalCandidates = [...candidates].map((x) => x.trim());

    // Try exact OCR reference first
    const exactCode = finalCandidates[0];
    try {
      const res = await axios.post(
        `${this.verifyApiBaseUrl}/verify-telebirr`,
        { reference: exactCode },
        {
          headers: {
            "Content-Type": "application/json",
            ...this.verifyHeaders,
          },
          timeout: 8000,
        },
      );

      if (res.data?.success) {
        const details = res.data.data;
        console.log(`[VERIFY-OCR] Exact ref "${exactCode}" matched`);
        const validation = this.validateTelebirrDetails(details, expectedAmount);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
        return this.createDepositRequest({
          userId: user.id,
          amount: validation.amount!,
          referenceId: validation.transactionId!,
          paymentMethod: "screenshot",
          verifiedData: details,
        });
      }
    } catch {
      // Fall through to variants
    }

    // Try remaining OCR variants in parallel
    const ocrVariants = finalCandidates.slice(1);
    if (ocrVariants.length > 0) {
      const results = await Promise.allSettled(
        ocrVariants.map(async (code) => {
          try {
            const res = await axios.post(
              `${this.verifyApiBaseUrl}/verify-telebirr`,
              { reference: code },
              {
                headers: {
                  "Content-Type": "application/json",
                  ...this.verifyHeaders,
                },
                timeout: 8000,
              },
            );
            if (res.data?.success) {
              return res.data.data;
            }
            return null;
          } catch {
            return null;
          }
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          console.log(`[VERIFY-OCR] Variant matched`);
          const validation = this.validateTelebirrDetails(r.value, expectedAmount);
          if (!validation.valid) {
            return { success: false, error: validation.error };
          }
          return this.createDepositRequest({
            userId: user.id,
            amount: validation.amount!,
            referenceId: validation.transactionId!,
            paymentMethod: "screenshot",
            verifiedData: r.value,
          });
        }
      }
    }

    return { success: false, error: "Verification failed (no match found)" };
  }

  // ─── Claim Transaction (pasted SMS) ─────────────────────────────────

  static async claimTransaction(
    telegramId: string,
    pastedMessage: string,
  ): Promise<PaymentResult> {
    const user = await this.findOrCreateUser(telegramId);
    const details = TelebirrParser.parseConfirmation(pastedMessage);

    if (!details) {
      return {
        success: false,
        error:
          "Could not find transaction details. Please copy the full Telebirr message or send the reference code.",
      };
    }

    if (details.partial || !details.amount) {
      return this.verifyAndProcessPaymentByReference(
        telegramId,
        details.transactionId,
      );
    }

    const existingDeposit = await prisma.depositRequest.findUnique({
      where: { referenceId: details.transactionId },
    });

    if (existingDeposit) {
      return {
        success: false,
        error: "🚫 This transaction has already been submitted.",
      };
    }

    const existingTx = await prisma.transaction.findFirst({
      where: {
        referenceId: details.transactionId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.SUCCESS,
      },
    });

    if (existingTx) {
      return {
        success: false,
        error: "🚫 This transaction has already been used and credited.",
      };
    }

    return this.createDepositRequest({
      userId: user.id,
      amount: details.amount,
      referenceId: details.transactionId,
      paymentMethod: "telebirr",
    });
  }

  // ─── SMS Webhook (trusted source) ───────────────────────────────────

  static async recordIncomingSms(messageText: string): Promise<{
    success: boolean;
    transaction?: {
      transactionId: string;
      amount: number | null;
      claimedBy?: string;
    };
    error?: string;
  }> {
    const details = TelebirrParser.parseConfirmation(messageText);
    if (!details) {
      return { success: false, error: "Invalid Telebirr format" };
    }

    const existingTx = await prisma.transaction.findFirst({
      where: {
        referenceId: details.transactionId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.SUCCESS,
      },
      include: { wallet: { include: { user: true } } },
    });

    if (existingTx) {
      return {
        success: true,
        transaction: {
          transactionId: details.transactionId,
          amount: details.amount,
          claimedBy: existingTx.wallet?.user?.telegramId?.toString(),
        },
      };
    }

    return {
      success: true,
      transaction: {
        transactionId: details.transactionId,
        amount: details.amount,
      },
    };
  }

  // ─── Telebirr Webhook Callback ──────────────────────────────────────

  static async processTelebirrCallback(body: {
    outTradeNo?: string;
    transactionId?: string;
    status?: string;
  }): Promise<PaymentResult> {
    const { outTradeNo, status } = body;
    if (!outTradeNo) throw new Error("Missing outTradeNo");

    const deposit = await prisma.depositRequest.findFirst({
      where: { referenceId: outTradeNo },
    });

    if (!deposit) throw new Error(`Payment request ${outTradeNo} not found`);

    if (deposit.status !== DepositStatus.PENDING) {
      return { success: true, status: "already_processed" };
    }

    if (
      status === "success" ||
      status === "completed" ||
      status === "PAY_SUCCESS"
    ) {
      const result = await this.creditWallet(
        deposit.userId,
        Number(deposit.amount),
        outTradeNo,
        `Telebirr Callback Deposit - ${outTradeNo}`,
      );

      if (result.success) {
        await prisma.depositRequest.update({
          where: { id: deposit.id },
          data: {
            status: DepositStatus.APPROVED,
            reviewedBy: "TELEBIRR_WEBHOOK",
            reviewedAt: new Date(),
          },
        });
      }

      return result;
    }

    await prisma.depositRequest.update({
      where: { id: deposit.id },
      data: {
        status: DepositStatus.REJECTED,
        rejectionReason: "Payment failed via webhook",
      },
    });

    return { success: false, status: "payment_failed" };
  }
}
