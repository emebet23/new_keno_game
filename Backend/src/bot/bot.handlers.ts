import TelegramBot = require("node-telegram-bot-api");
import path = require("path");
import fs from "fs";
import axios from "axios";
import { env } from "../config/env";
import prisma from "../config/prisma";
import { Role } from "@prisma/client";
import { PaymentService } from "../payment/services/payment.service";
import { WithdrawalService } from "../payment/services/withdrawal.service";
import {
  TransferService,
  MIN_TRANSFER_AMOUNT,
} from "../payment/services/transfer.service";
import { WalletService } from "../wallet/services/wallet.service";
import { TelebirrParser } from "../payment/utils/telebirr-parser";
import { t, type Lang } from "./translations";

type Bot = any;

const WEBAPP_URL = env.WEBAPP_URL || "https://keno-game-fawn.vercel.app";

// ─── Config ───────────────────────────────────────────────────────────
// TODO: Replace with the real support account when available.
const SUPPORT_USERNAME = "ebor77";
const SUPPORT_HANDLE = `Telegram: @${SUPPORT_USERNAME}`;

const TELEBIRR_PHONE = "0973192123";
const MIN_DEPOSIT = 20;
const MIN_WITHDRAW = 500;

// ─── Conversation state for multi-step flows ──────────────────────────
type UserState =
  | { type: "withdraw_amount" }
  | { type: "withdraw_method"; amount: number }
  | { type: "withdraw_account"; amount: number; method: "telebirr" | "cbe" }
  | { type: "transfer_recipient" }
  | { type: "transfer_amount"; recipientUsername: string }
  | { type: "referral_pending"; referrerTelegramId: string }
  | null;

const userStates = new Map<string, UserState>();

function setState(telegramId: string, state: UserState) {
  if (state) {
    userStates.set(telegramId, state);
  } else {
    userStates.delete(telegramId);
  }
}

function getState(telegramId: string): UserState {
  return userStates.get(telegramId) || null;
}

// ─── Language helper ──────────────────────────────────────────────────

/** Read the user's saved language. Defaults to Amharic. */
async function getLang(telegramId: string): Promise<Lang> {
  const lang = await TransferService.getLanguage(telegramId);
  return lang === "en" ? "en" : "am";
}

// ─── Keyboards ────────────────────────────────────────────────────────

function mainMenuKeyboard(lang: Lang): TelegramBot.InlineKeyboardMarkup {
  const T = t(lang);
  return {
    inline_keyboard: [
      [{ text: T.btnPlay, web_app: { url: WEBAPP_URL } }],
      [
        { text: T.btnBalance, callback_data: "balance" },
        { text: T.btnHistory, callback_data: "history" },
      ],
      [
        { text: T.btnDeposit, callback_data: "deposit" },
        { text: T.btnWithdraw, callback_data: "withdraw" },
      ],
      [
        { text: T.btnTransfer, callback_data: "transfer" },
        { text: T.btnSupport, callback_data: "support" },
      ],
      [
        { text: T.btnInvite, callback_data: "invite" },
        { text: T.btnConvertBonus, callback_data: "convert_bonus" },
      ],
      [
        { text: T.btnHowToPlay, callback_data: "how_to_play" },
        { text: T.btnLanguage, callback_data: "toggle_lang" },
      ],
    ],
  };
}

function cancelKeyboard(lang: Lang = "am"): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: t(lang).btnCancel, callback_data: "cancel" }]],
  };
}

function registerKeyboard(lang: Lang): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: t(lang).btnRegister, callback_data: "register" }],
    ],
  };
}

/**
 * Reply keyboard with a "Share contact" button.
 *
 * IMPORTANT: Telegram only allows `request_contact` on a REPLY keyboard
 * (the bar at the bottom of the chat), never on an inline keyboard.
 */
function shareContactKeyboard(lang: Lang): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: t(lang).btnShareContact, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function removeKeyboard(): TelegramBot.ReplyKeyboardRemove {
  return { remove_keyboard: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────

async function ensureUser(
  telegramId: string,
  from: TelegramBot.User,
  referredBy?: string,
) {
  return PaymentService.findOrCreateUser(telegramId, {
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
    referredBy,
  });
}

async function sendBalance(
  bot: Bot,
  chatId: number,
  telegramId: string,
  lang: Lang,
) {
  const { balance, playBalance, totalBalance } =
    await PaymentService.getBalance(telegramId);
  const T = t(lang);
  const mainText = lang === "am" ? "ዋና ሂሳብ" : "Main Wallet";
  const playText = lang === "am" ? "የጨዋታ ሂሳብ" : "Play Wallet";
  const totalText = lang === "am" ? "ጠቅላላ ሂሳብ" : "Total Balance";
  await bot.sendMessage(
    chatId,
    `💰 *${totalText}: ${totalBalance.toFixed(2)} ETB*\n\n` +
      `🏦 *${mainText}:* ${balance.toFixed(2)} ETB\n` +
      `🎮 *${playText}:* ${playBalance.toFixed(2)} ETB`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: T.btnDeposit, callback_data: "deposit" },
            { text: T.btnWithdraw, callback_data: "withdraw" },
          ],
          [{ text: T.btnBack, callback_data: "main_menu" }],
        ],
      },
    },
  );
}

async function sendGameHistory(
  bot: Bot,
  chatId: number,
  telegramId: string,
  lang: Lang,
) {
  const T = t(lang);
  const user = await PaymentService.findOrCreateUser(telegramId);
  if (!user) {
    await bot.sendMessage(chatId, T.userNotFound);
    return;
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: user.id, status: { in: ["WON", "LOST"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { game: true },
    });

    if (tickets.length === 0) {
      await bot.sendMessage(chatId, T.noGamesYet, { parse_mode: "Markdown" });
      return;
    }

    let text = T.historyHeader;
    tickets.forEach((ticket) => {
      const won = ticket.status === "WON";
      const icon = won ? "✅" : "❌";
      const amount = won
        ? `+${Number(ticket.payout).toFixed(2)}`
        : `-${Number(ticket.betAmount).toFixed(2)}`;
      const currency = lang === "am" ? "ብር" : "ETB";
      text += `${icon} ${ticket.createdAt.toLocaleDateString()} — Round #${ticket.game.roundNumber} — ${amount} ${currency}\n`;
    });

    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch {
    await bot.sendMessage(chatId, T.historyLoadFailed, {
      parse_mode: "Markdown",
    });
  }
}

const REFERRAL_BONUS = 1; // ETB

async function sendInviteInfo(
  bot: Bot,
  chatId: number,
  telegramId: string,
  lang: Lang,
) {
  const T = t(lang);
  try {
    const me = await bot.getMe();
    const botUsername = me.username;
    const referralLink = `https://t.me/${botUsername}?start=${telegramId}`;

    const referralCount = await prisma.user.count({
      where: { referredBy: telegramId },
    });
    const referralEarnings = referralCount * REFERRAL_BONUS;

    const inviteMsg =
      lang === "am"
        ? `👥 *ጓደኞችን ይጋብዙ*\n\n` +
          `ይህን ሊንክ ለጓደኞችዎ ያጋሩ፦\n\n` +
          `\`${referralLink}\`\n\n` +
          `🎁 እርስዎም ጓደኛዎም *${REFERRAL_BONUS} ETB* ተጨማሪ ይቀበላላችሁ!\n\n` +
          `👥 ጓደኞች: *${referralCount}*\n` +
          `💰 ጠቅላላ ጉርሻ: *${referralEarnings} ETB*`
        : `👥 *Invite Friends*\n\n` +
          `Share this link with your friends:\n\n` +
          `\`${referralLink}\`\n\n` +
          `🎁 You and your friend each get *${REFERRAL_BONUS} ETB* extra!\n\n` +
          `👥 Friends referred: *${referralCount}*\n` +
          `💰 Total earned: *${referralEarnings} ETB*`;

    await bot.sendMessage(chatId, inviteMsg, { parse_mode: "Markdown" });
  } catch {
    await bot.sendMessage(chatId, T.somethingWentWrong, {
      parse_mode: "Markdown",
    });
  }
}

/** Start the withdraw flow: check main wallet balance, then ask for an amount. */
async function startWithdrawFlow(
  bot: Bot,
  chatId: number,
  telegramId: string,
  lang: Lang,
) {
  const T = t(lang);
  const { balance } = await PaymentService.getBalance(telegramId);

  if (balance < MIN_WITHDRAW) {
    await bot.sendMessage(
      chatId,
      T.withdrawInsufficient(balance.toFixed(2), MIN_WITHDRAW),
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard(lang) },
    );
    return;
  }

  setState(telegramId, { type: "withdraw_amount" });
  await bot.sendMessage(chatId, T.withdrawInstructions(MIN_WITHDRAW), {
    parse_mode: "Markdown",
    reply_markup: cancelKeyboard(lang),
  });
}

/** Start the transfer flow: check main wallet balance, then ask the sender to enter recipient info. */
async function startTransferFlow(
  bot: Bot,
  chatId: number,
  telegramId: string,
  lang: Lang,
) {
  const T = t(lang);
  const { balance } = await PaymentService.getBalance(telegramId);

  if (balance < MIN_TRANSFER_AMOUNT) {
    await bot.sendMessage(
      chatId,
      T.transferInsufficient(balance.toFixed(2), MIN_TRANSFER_AMOUNT),
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard(lang) },
    );
    return;
  }

  setState(telegramId, { type: "transfer_recipient" });
  await bot.sendMessage(chatId, T.transferPrompt(balance.toFixed(2)), {
    parse_mode: "Markdown",
    reply_markup: cancelKeyboard(lang),
  });
}

// ─── Contact handler (phone registration) ─────────────────────────────

async function handleContactMessage(bot: Bot, msg: TelegramBot.Message) {
  if (!msg.from || !msg.contact) return;

  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const contact = msg.contact;
  const lang = await getLang(telegramId);
  const T = t(lang);

  // Security: only accept the user's OWN contact, not a forwarded one.
  // Telegram sets contact.user_id to the owner of the shared contact card.
  if (String(contact.user_id) !== telegramId) {
    await bot.sendMessage(chatId, T.shareOwnNumberOnly, {
      parse_mode: "Markdown",
      reply_markup: shareContactKeyboard(lang),
    });
    return;
  }

  try {
    const state = getState(telegramId);
    const referrerTelegramId =
      state?.type === "referral_pending" ? state.referrerTelegramId : undefined;

    await ensureUser(telegramId, msg.from, referrerTelegramId);
    await TransferService.savePhoneNumber(telegramId, contact.phone_number);

    // Credit referral bonus to both inviter and invited
    if (referrerTelegramId && referrerTelegramId !== telegramId) {
      try {
        const walletService = new WalletService();
        await walletService.referralCredit(
          telegramId,
          REFERRAL_BONUS,
          "Referral welcome bonus",
        );
        await walletService.referralCredit(
          referrerTelegramId,
          REFERRAL_BONUS,
          "Referral bonus — friend registered",
        );
      } catch (e: any) {
        console.error("Referral credit error:", e?.message || e);
      }
    }
    setState(telegramId, null);

    await bot.sendMessage(
      chatId,
      T.registrationSuccess(msg.from.first_name || "", contact.phone_number),
      { parse_mode: "Markdown", reply_markup: removeKeyboard() },
    );

    await bot.sendMessage(chatId, T.chooseOption, {
      reply_markup: mainMenuKeyboard(lang),
    });
  } catch (error: any) {
    console.error("Phone registration error:", error?.message || error);
    await bot.sendMessage(chatId, T.registrationFailed, {
      reply_markup: removeKeyboard(),
    });
  }
}

// ─── Text message handler ─────────────────────────────────────────────

async function handleTextMessage(bot: Bot, msg: TelegramBot.Message) {
  const text = msg.text?.trim();
  if (!text || !msg.from) return;

  // Skip commands entirely — they're handled by their own bot.onText()
  // listeners (/start, /play, /balance, etc). Without this, every command
  // also falls through this generic text handler and triggers the
  // "I didn't understand" fallback + duplicate main menu underneath it.
  if (text.startsWith("/")) return;

  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const lang = await getLang(telegramId);
  const T = t(lang);

  const state = getState(telegramId);

  // ── Cancel any active flow ──
  if (
    text === t("am").btnCancel ||
    text === t("en").btnCancel ||
    text.toLowerCase() === "/cancel"
  ) {
    setState(telegramId, null);
    await bot.sendMessage(chatId, T.cancelled, {
      reply_markup: removeKeyboard(),
    });
    await bot.sendMessage(chatId, T.chooseOption, {
      reply_markup: mainMenuKeyboard(lang),
    });
    return;
  }

  // ── Withdrawal amount input ──
  if (state?.type === "withdraw_amount") {
    const amount = Number(text.replace(/[^0-9.]/g, ""));
    if (!amount || amount <= 0) {
      await bot.sendMessage(chatId, T.invalidAmount, {
        reply_markup: cancelKeyboard(lang),
      });
      return;
    }

    if (amount < MIN_WITHDRAW) {
      await bot.sendMessage(chatId, T.withdrawMinimum(MIN_WITHDRAW), {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(lang),
      });
      return;
    }

    const { balance } = await PaymentService.getBalance(telegramId);
    if (amount > balance) {
      setState(telegramId, null);
      await bot.sendMessage(
        chatId,
        T.insufficientBalanceDetail(balance.toFixed(2), String(amount)),
        { parse_mode: "Markdown" },
      );
      return;
    }

    setState(telegramId, { type: "withdraw_method", amount });
    const T2 = t(lang);
    await bot.sendMessage(chatId, T2.withdrawChooseMethod, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📱 Telebirr", callback_data: `w_method_telebirr` },
            { text: "🏦 CBE", callback_data: `w_method_cbe` },
          ],
        ],
      },
    });
    return;
  }

  // ── Withdrawal account input (after method selection) ──
  if (state?.type === "withdraw_account") {
    const account = text.replace(/[^0-9+]/g, "");
    if (state.method === "telebirr") {
      if (!/^09\d{8}$/.test(account)) {
        await bot.sendMessage(chatId, T.withdrawInvalidPhone, {
          parse_mode: "Markdown",
          reply_markup: cancelKeyboard(lang),
        });
        return;
      }
    } else if (!account || account.length < 6) {
      await bot.sendMessage(chatId, T.withdrawInvalidAccount, {
        parse_mode: "Markdown",
        reply_markup: cancelKeyboard(lang),
      });
      return;
    }
    setState(telegramId, null);

    const amount = state.amount;
    const method = state.method;
    const processing = await bot.sendMessage(chatId, T.withdrawProcessing);

    try {
      const result = await WithdrawalService.requestWithdrawal(
        telegramId,
        amount,
        method === "telebirr" ? `telebirr:${account}` : `cbe:${account}`,
      );

      if (result.success) {
        await bot.editMessageText(
          T.withdrawRequestSent(
            amount,
            method === "telebirr" ? account : `CBE ${account}`,
            Number(result.balance).toFixed(2),
          ),
          {
            chat_id: chatId,
            message_id: processing.message_id,
            parse_mode: "Markdown",
          },
        );
      } else {
        await bot.editMessageText(
          T.withdrawFailed(result.error || T.somethingWentWrong),
          {
            chat_id: chatId,
            message_id: processing.message_id,
            parse_mode: "Markdown",
          },
        );
      }
    } catch (error: any) {
      console.error("Withdrawal error:", error?.message || error);
      await bot.editMessageText(T.somethingWentWrong, {
        chat_id: chatId,
        message_id: processing.message_id,
        parse_mode: "Markdown",
      });
    }
    return;
  }

  // ── Transfer recipient input (text-based) ──
  if (state?.type === "transfer_recipient") {
    const isTelegramId = /^\d+$/.test(text);
    const isPhone = /^\+?\d{10,15}$/.test(text.replace(/[\s\-()]/g, ""));
    let recipient: any = null;
    let recipientLabel: string = "";

    if (isTelegramId) {
      recipient = await PaymentService.findUser(text);
      recipientLabel = text;
    } else if (isPhone) {
      const phone = text.replace(/[^0-9+]/g, "");
      recipient = await PaymentService.findUserByPhone(phone);
      recipientLabel = phone;
    } else {
      const username = text.replace(/^@/, "").trim();
      if (!username || username.length < 2) {
        await bot.sendMessage(chatId, T.transferInvalidInput, {
          parse_mode: "Markdown",
          reply_markup: cancelKeyboard(lang),
        });
        return;
      }
      recipient = await PaymentService.findUserByUsername(username);
      recipientLabel = `@${username}`;
    }

    if (!recipient) {
      await bot.sendMessage(chatId, T.transferRecipientNotFound, {
        parse_mode: "Markdown",
        reply_markup: cancelKeyboard(lang),
      });
      return;
    }

    if (recipient.telegramId === telegramId) {
      await bot.sendMessage(chatId, T.transferSelfTransfer, {
        parse_mode: "Markdown",
        reply_markup: cancelKeyboard(lang),
      });
      return;
    }

    setState(telegramId, {
      type: "transfer_amount",
      recipientUsername: recipientLabel,
    });
    const displayName = `@${recipient.username || recipient.firstName || recipientLabel}`;
    await bot.sendMessage(chatId, T.transferRecipientFound(displayName), {
      parse_mode: "Markdown",
      reply_markup: cancelKeyboard(lang),
    });
    return;
  }

  // ── Transfer amount input (text-based) ──
  if (state?.type === "transfer_amount" && "recipientUsername" in state) {
    const amount = Number(text.replace(/[^0-9.]/g, ""));
    if (!amount || amount <= 0) {
      await bot.sendMessage(chatId, T.transferInvalidAmount, {
        parse_mode: "Markdown",
        reply_markup: cancelKeyboard(lang),
      });
      return;
    }

    if (amount < 1) {
      await bot.sendMessage(chatId, T.transferMinAmount, {
        parse_mode: "Markdown",
        reply_markup: cancelKeyboard(lang),
      });
      return;
    }

    const { balance } = await PaymentService.getBalance(telegramId);
    if (amount > balance) {
      setState(telegramId, null);
      await bot.sendMessage(
        chatId,
        T.insufficientBalanceDetail(balance.toFixed(2), String(amount)),
        { parse_mode: "Markdown" },
      );
      return;
    }

    const isTelegramId = /^\d+$/.test(state.recipientUsername);
    const isPhone = /^\+?\d{10,15}$/.test(state.recipientUsername);
    let recipient: any = null;
    if (isTelegramId) {
      recipient = await PaymentService.findUser(state.recipientUsername);
    } else if (isPhone) {
      recipient = await PaymentService.findUserByPhone(state.recipientUsername);
    } else {
      recipient = await PaymentService.findUserByUsername(
        state.recipientUsername.replace(/^@/, ""),
      );
    }
    if (!recipient) {
      setState(telegramId, null);
      await bot.sendMessage(chatId, T.transferRecipientGone, {
        reply_markup: mainMenuKeyboard(lang),
      });
      return;
    }

    const senderUser = await PaymentService.findUser(telegramId);
    if (!senderUser) {
      setState(telegramId, null);
      return;
    }

    setState(telegramId, null);
    const processing = await bot.sendMessage(chatId, T.transferProcessing);

    try {
      const walletService = new WalletService();
      const result = await walletService.transfer(
        senderUser.id,
        recipient.id,
        amount,
      );

      if (result.success) {
        const recipientName =
          recipient.username || recipient.firstName || "User";
        await bot.editMessageText(
          T.transferSuccess(
            amount,
            recipientName,
            Number(result.senderBalance).toFixed(2),
          ),
          {
            chat_id: chatId,
            message_id: processing.message_id,
            parse_mode: "Markdown",
          },
        );

        try {
          const recipientTelegramId = String(recipient.telegramId);
          const senderName = `@${senderUser.username || senderUser.firstName || "User"}`;
          await bot.sendMessage(
            recipientTelegramId,
            T.transferReceived(
              amount,
              senderName,
              Number(result.recipientBalance).toFixed(2),
            ),
            { parse_mode: "Markdown" },
          );
        } catch (err: any) {
          console.error("Failed to notify recipient:", err?.message || err);
        }
      }
    } catch (error: any) {
      console.error("Transfer error:", error?.message || error);
      await bot.editMessageText(
        T.transferFailed(error?.message || T.somethingWentWrong),
        { chat_id: chatId, message_id: processing.message_id },
      );
    }
    return;
  }

  // ── Deposit verification (Telebirr reference / SMS) ──
  if (TelebirrParser.isTelebirrMessage(text)) {
    const processing = await bot.sendMessage(chatId, T.depositVerifying);

    try {
      let result;
      if (text.length <= 15 && /^[A-Z0-9-]+$/i.test(text)) {
        result = await PaymentService.verifyAndProcessPaymentByReference(
          telegramId,
          text,
        );
      } else {
        result = await PaymentService.claimTransaction(telegramId, text);
      }

      if (result.success) {
        if (result.amount && result.amount < MIN_DEPOSIT) {
          await bot.editMessageText(
            T.depositTooLow(String(result.amount), MIN_DEPOSIT),
            {
              chat_id: chatId,
              message_id: processing.message_id,
              parse_mode: "Markdown",
            },
          );
          return;
        }

        await bot.editMessageText(
          T.depositSubmitted(
            String(result.amount),
            String(result.balance ?? result.newBalance),
          ),
          {
            chat_id: chatId,
            message_id: processing.message_id,
            parse_mode: "Markdown",
            reply_markup: mainMenuKeyboard(lang),
          },
        );
      } else {
        await bot.editMessageText(
          T.verificationFailed(
            result.error || T.somethingWentWrong,
            SUPPORT_HANDLE,
          ),
          {
            chat_id: chatId,
            message_id: processing.message_id,
            parse_mode: "Markdown",
          },
        );
      }
    } catch (error: any) {
      console.error("Payment verification error:", error?.message || error);
      const msg = axios.isAxiosError(error)
        ? `❌ Verification API error: ${error.code || error.message}`
        : T.somethingWentWrong;
      await bot.editMessageText(msg, {
        chat_id: chatId,
        message_id: processing.message_id,
        parse_mode: "Markdown",
      });
    }
    return;
  }

  if (!state) {
    await bot.sendMessage(
      chatId,
      lang === "am"
        ? `ይቅርታ፣ የላኩትን ትእዛዝ መረዳት አልቻልኩም። እባክዎ ከታች ካሉት አማራጮች ይምረጡ፤`
        : `I didn't understand that. Please choose an option below.`,
      { reply_markup: mainMenuKeyboard(lang) },
    );
  }
}

// ─── Photo message handler (screenshot verification) ──────────────────

async function handlePhotoMessage(bot: Bot, msg: TelegramBot.Message) {
  if (!msg.from || !msg.photo?.length) return;

  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const lang = await getLang(telegramId);
  const T = t(lang);
  const photo = msg.photo[msg.photo.length - 1];

  const processing = await bot.sendMessage(chatId, T.screenshotProcessing);

  try {
    const file = await bot.getFile(photo.file_id);
    if (!file.file_path) {
      throw new Error("Could not download image");
    }

    const fileUrl = `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`;
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(response.data);

    const result = await PaymentService.verifyAndProcessPayment(
      telegramId,
      imageBuffer,
    );

    if (result.success) {
      if (result.amount && result.amount < MIN_DEPOSIT) {
        await bot.editMessageText(
          T.depositTooLow(String(result.amount), MIN_DEPOSIT),
          {
            chat_id: chatId,
            message_id: processing.message_id,
            parse_mode: "Markdown",
          },
        );
        return;
      }

      await bot.editMessageText(
        T.depositSubmitted(
          String(result.amount),
          String(result.balance ?? result.newBalance),
        ),
        {
          chat_id: chatId,
          message_id: processing.message_id,
          parse_mode: "Markdown",
          reply_markup: mainMenuKeyboard(lang),
        },
      );
    } else {
      await bot.editMessageText(
        T.screenshotFailed(result.error || T.somethingWentWrong),
        {
          chat_id: chatId,
          message_id: processing.message_id,
          parse_mode: "Markdown",
        },
      );
    }
  } catch (error: any) {
    console.error("Screenshot processing error:", error?.message || error);
    await bot.editMessageText(T.screenshotError, {
      chat_id: chatId,
      message_id: processing.message_id,
      parse_mode: "Markdown",
    });
  }
}

// ─── Register all handlers ────────────────────────────────────────────

export function registerBotHandlers(bot: Bot): void {
  // /start (with optional referral deep link payload)
  bot.onText(
    /\/start(?:\s+(.+))?/,
    async (msg: TelegramBot.Message, match: RegExpMatchArray | null) => {
      if (!msg.from) return;

      const telegramId = String(msg.from.id);
      const name = msg.from.first_name || "Player";
      const referrerTelegramId = match?.[1]?.trim() || null;

      const existing = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        include: { wallet: true },
      });

      const lang: Lang = existing?.language === "en" ? "en" : "am";
      const T = t(lang);

      const welcomeImage = fs.createReadStream(
        path.join(__dirname, "../assets/profileLogo.png"),
      );

      // Already registered (has wallet AND phone) → straight to main menu
      if (existing?.wallet && existing.phoneNumber) {
        await bot.sendPhoto(msg.chat.id, welcomeImage, {
          caption: T.welcomeBack(name),
          parse_mode: "Markdown",
          reply_markup: mainMenuKeyboard(lang),
        });
        return;
      }

      // New user, or registered before phone was required → ask to register
      if (referrerTelegramId && referrerTelegramId !== telegramId) {
        setState(telegramId, { type: "referral_pending", referrerTelegramId });
      }
      await bot.sendPhoto(msg.chat.id, welcomeImage, {
        caption:
          `🎉 *እንኳን ወደ ኬኖ (Keno) ጨዋታ በደህና መጡ! / Welcome to Keno!*\n\n` +
          `ሰላም *${name}* 👋\n\n` +
          `🎰 በቴሌግራም ላይ እጅግ አስደሳች የሆነውን የኬኖ (Keno) ጨዋታ ይጫወቱ፤؛\n` +
          `🎰 Play the exciting Keno lottery game on Telegram.\n\n` +
          `✨ *ልዩ ባህሪያት / Features:* \n` +
          `• ፈጣን ገቢ (Instant Deposits)\n` +
          `• ፈጣን ገንዘብ ማውጣት (Fast Withdrawals)\n` +
          `• ታማኝ እና አስተማማኝ ጨዋታ (Provably Fair)\n` +
          `• ደህንነቱ የተጠበቀ አካውንት (Secure Wallet)\n\n` +
          (referrerTelegramId && referrerTelegramId !== telegramId
            ? `🎁 ጓደኛዎ እርስዎን ጋብዞዎታል! የስጦታ ቦነስዎን ይቀበሉ፤؛\n🎁 Your friend invited you! Claim your welcome bonus!\n\n`
            : "") +
          `አካውንት ለመክፈት ከታች ያለውን *ይመዝገቡ (Register)* የሚለውን ቁልፍ ይጫኑ፤؛\n` +
          `Press *Register* below to create your account.`,
        parse_mode: "Markdown",
        reply_markup: registerKeyboard(lang),
      });
    },
  );

  // /help
  bot.onText(/\/help/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const lang = await getLang(String(msg.from.id));
    await bot.sendMessage(
      msg.chat.id,
      t(lang).howToPlay(
        MIN_DEPOSIT,
        MIN_WITHDRAW,
        MIN_TRANSFER_AMOUNT,
        SUPPORT_HANDLE,
      ),
      { parse_mode: "Markdown" },
    );
  });

  // /balance
  bot.onText(/\/balance/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const telegramId = String(msg.from.id);
    const lang = await getLang(telegramId);
    await sendBalance(bot, msg.chat.id, telegramId, lang);
  });

  // /support
  bot.onText(/\/support/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const lang = await getLang(String(msg.from.id));
    const T = t(lang);
    await bot.sendMessage(msg.chat.id, T.supportText(SUPPORT_HANDLE), {
      parse_mode: "Markdown",
    });
  });

  // /transfer
  bot.onText(/\/transfer/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const telegramId = String(msg.from.id);
    const lang = await getLang(telegramId);
    await startTransferFlow(bot, msg.chat.id, telegramId, lang);
  });

  // /withdraw
  bot.onText(/\/withdraw/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const telegramId = String(msg.from.id);
    const lang = await getLang(telegramId);
    await startWithdrawFlow(bot, msg.chat.id, telegramId, lang);
  });

  // /deposit
  bot.onText(/\/deposit/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const lang = await getLang(String(msg.from.id));
    await bot.sendMessage(
      msg.chat.id,
      t(lang).depositInstructions(TELEBIRR_PHONE, MIN_DEPOSIT),
      { parse_mode: "Markdown" },
    );
  });

  // /play
  bot.onText(/\/play/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const lang = await getLang(String(msg.from.id));
    await bot.sendMessage(msg.chat.id, t(lang).playDescription, {
      reply_markup: {
        inline_keyboard: [
          [{ text: t(lang).btnTapToPlay, web_app: { url: WEBAPP_URL } }],
        ],
      },
    });
  });

  // /language
  bot.onText(/\/language/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const telegramId = String(msg.from.id);
    const lang = await getLang(telegramId);
    await bot.sendMessage(msg.chat.id, t(lang).chooseLanguage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇪🇹 አማርኛ", callback_data: "set_lang_am" },
            { text: "🇬🇧 English", callback_data: "set_lang_en" },
          ],
        ],
      },
    });
  });

  // /invite
  bot.onText(/\/invite/, async (msg: TelegramBot.Message) => {
    if (!msg.from) return;
    const telegramId = String(msg.from.id);
    const lang = await getLang(telegramId);
    await sendInviteInfo(bot, msg.chat.id, telegramId, lang);
  });

  // Callback queries
  bot.on("callback_query", async (query: TelegramBot.CallbackQuery) => {
    if (!query.message || !query.from) return;

    const chatId = query.message.chat.id;
    const telegramId = String(query.from.id);
    let lang = await getLang(telegramId);
    let T = t(lang);

    // ── Admin approval: approve or reject a withdrawal ──
    if (
      query.data?.startsWith("approve_wd:") ||
      query.data?.startsWith("reject_wd:")
    ) {
      const isApprove = query.data.startsWith("approve_wd:");
      const withdrawalId = query.data.split(":")[1];

      try {
        const adminUser = await prisma.user.findUnique({
          where: { telegramId: BigInt(telegramId) },
          select: { role: true },
        });
        if (!adminUser || adminUser.role !== Role.ADMIN) {
          await bot.answerCallbackQuery(query.id, { text: "⛔ Unauthorized" });
          return;
        }

        const transaction = await prisma.transaction.findUnique({
          where: { id: withdrawalId },
          include: { wallet: { include: { user: true } } },
        });

        if (!transaction) {
          await bot.answerCallbackQuery(query.id, {
            text: "Transaction not found",
          });
          return;
        }

        const user = transaction.wallet?.user;
        const amount = Math.abs(Number(transaction.amount));
        const userName = user?.firstName || user?.username || "Unknown";
        const userUsername = user?.username || "—";

        const desc = transaction.description || "";
        let method = "—";
        let account = "—";
        const payload = desc.replace(/^Withdrawal to\s*/i, "").trim();
        const colonIndex = payload.indexOf(":");
        if (colonIndex !== -1) {
          const rawMethod = payload.slice(0, colonIndex).toLowerCase();
          account = payload.slice(colonIndex + 1);
          method =
            rawMethod === "telebirr"
              ? "📱 Telebirr"
              : rawMethod === "cbe"
                ? "🏦 CBE"
                : rawMethod || "—";
        }

        if (isApprove) {
          const result = await WithdrawalService.approveWithdrawal(
            withdrawalId,
            telegramId,
          );
          if (result.success) {
            const wallet = await prisma.wallet.findUnique({
              where: { id: transaction.walletId! },
            });
            const balance = Number(wallet?.mainBalance ?? 0);
            await bot.editMessageText(
              `✅ Withdrawal *Approved*\n\n` +
                `👤 *User Details*\n` +
                `Name: ${userName}\n` +
                `Username: @${userUsername}\n` +
                `Telegram ID: \`${user?.telegramId || "—"}\`\n\n` +
                `💰 *Withdrawal Details*\n` +
                `Amount: ${amount.toFixed(2)} ETB\n` +
                `Method: ${method}\n` +
                `Account: ${account}\n\n` +
                `💼 *Wallet*\n` +
                `Balance after withdrawal: ${balance.toFixed(2)} ETB`,
              {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: "Markdown",
              },
            );
          } else {
            await bot.answerCallbackQuery(query.id, {
              text: result.error || "Failed",
            });
          }
        } else {
          const result = await WithdrawalService.rejectWithdrawal(
            withdrawalId,
            telegramId,
          );
          if (result.success) {
            const wallet = await prisma.wallet.findUnique({
              where: { id: transaction.walletId! },
            });
            const balance = Number(wallet?.mainBalance ?? 0);
            await bot.editMessageText(
              `❌ Withdrawal *Rejected*\n\n` +
                `👤 *User Details*\n` +
                `Name: ${userName}\n` +
                `Username: @${userUsername}\n` +
                `Telegram ID: \`${user?.telegramId || "—"}\`\n\n` +
                `💰 *Withdrawal Details*\n` +
                `Amount: ${amount.toFixed(2)} ETB\n` +
                `Method: ${method}\n` +
                `Account: ${account}\n\n` +
                `💼 *Refund*\n` +
                `Balance refunded: ${balance.toFixed(2)} ETB`,
              {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: "Markdown",
              },
            );
          } else {
            await bot.answerCallbackQuery(query.id, {
              text: result.error || "Failed",
            });
          }
        }
      } catch (err: any) {
        await bot.answerCallbackQuery(query.id, {
          text: err.message || "Error",
        });
      }
      return;
    }

    switch (query.data) {
      // ── Withdrawal method selection ──
      case "w_method_telebirr":
      case "w_method_cbe": {
        const wState = getState(telegramId);
        if (wState?.type !== "withdraw_method") {
          await bot.answerCallbackQuery(query.id, {
            text: "Please start withdrawal first",
          });
          return;
        }
        const method =
          query.data === "w_method_telebirr"
            ? ("telebirr" as const)
            : ("cbe" as const);
        setState(telegramId, {
          type: "withdraw_account",
          amount: wState.amount,
          method,
        });
        const promptKey =
          method === "telebirr" ? "withdrawPhonePrompt" : "withdrawCbePrompt";
        await bot.editMessageText(T[promptKey], {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: T.btnCancel, callback_data: "cancel" }]],
          },
        });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // ── Language ──
      case "toggle_lang":
      case "set_lang_am":
      case "set_lang_en": {
        let newLang: Lang;
        if (query.data === "toggle_lang") {
          newLang = lang === "am" ? "en" : "am";
        } else {
          newLang = query.data === "set_lang_en" ? "en" : "am";
        }

        // The user row may not exist yet (unregistered) — create it first.
        await ensureUser(telegramId, query.from);
        await TransferService.saveLanguage(telegramId, newLang);

        lang = newLang;
        T = t(lang);

        const mainMenuImage = fs.createReadStream(
          path.join(__dirname, "../assets/profileLogo.png"),
        );
        await bot.sendPhoto(chatId, mainMenuImage, {
          caption: T.languageChanged,
          reply_markup: mainMenuKeyboard(lang),
        });
        break;
      }

      case "register": {
        await bot.sendMessage(chatId, T.registerAskPhone, {
          parse_mode: "Markdown",
          reply_markup: shareContactKeyboard(lang),
        });
        break;
      }

      case "main_menu": {
        const mainMenuImage = fs.createReadStream(
          path.join(__dirname, "../assets/profileLogo.png"),
        );
        await bot.sendPhoto(chatId, mainMenuImage, {
          caption: T.chooseOption,
          reply_markup: mainMenuKeyboard(lang),
        });
        break;
      }

      case "balance":
        await sendBalance(bot, chatId, telegramId, lang);
        break;

      case "history":
        await sendGameHistory(bot, chatId, telegramId, lang);
        break;

      case "deposit":
        await bot.sendMessage(
          chatId,
          T.depositInstructions(TELEBIRR_PHONE, MIN_DEPOSIT),
          { parse_mode: "Markdown" },
        );
        break;

      case "withdraw":
        await startWithdrawFlow(bot, chatId, telegramId, lang);
        break;

      case "transfer":
        await startTransferFlow(bot, chatId, telegramId, lang);
        break;

      case "how_to_play":
        await bot.sendMessage(
          chatId,
          T.howToPlay(
            MIN_DEPOSIT,
            MIN_WITHDRAW,
            MIN_TRANSFER_AMOUNT,
            SUPPORT_HANDLE,
          ),
          { parse_mode: "Markdown" },
        );
        break;

      case "convert_bonus":
        await bot.sendMessage(chatId, T.convertBonus, {
          parse_mode: "Markdown",
        });
        break;

      case "support":
        await bot.sendMessage(chatId, T.supportText(SUPPORT_HANDLE), {
          parse_mode: "Markdown",
        });
        break;

      case "invite":
        await sendInviteInfo(bot, chatId, telegramId, lang);
        break;

      case "cancel": {
        const state = getState(telegramId);
        if (state) {
          setState(telegramId, null);
          await bot
            .deleteMessage(chatId, query.message.message_id)
            .catch(() => {});
          await bot.sendMessage(chatId, T.cancelDone, {
            reply_markup: mainMenuKeyboard(lang),
          });
        } else {
          await bot.answerCallbackQuery(query.id, {
            text: "Nothing to cancel.",
          });
          return;
        }
        break;
      }
    }

    await bot.answerCallbackQuery(query.id);
  });

  // Contact shared (phone registration)
  bot.on("contact", (msg: TelegramBot.Message) =>
    handleContactMessage(bot, msg),
  );

  // Text messages (deposit verification + withdraw/transfer amount input)
  bot.on("text", (msg: TelegramBot.Message) => handleTextMessage(bot, msg));

  // Photo messages (screenshot deposit verification)
  bot.on("photo", (msg: TelegramBot.Message) => handlePhotoMessage(bot, msg));
}
