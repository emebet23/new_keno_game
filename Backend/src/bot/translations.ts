/**
 * Bot translations — Amharic (default) and English.
 *
 * Amharic uses FORMAL address (እርስዎ) throughout.
 *
 */

export type Lang = "am" | "en";

type Translation = {
  // ── Menu buttons ──
  btnPlay: string;
  playDescription: string;
  btnBalance: string;
  btnHistory: string;
  btnDeposit: string;
  btnWithdraw: string;
  btnTransfer: string;
  btnSupport: string;
  btnHowToPlay: string;
  btnLanguage: string;
  btnRegister: string;
  btnShareContact: string;
  btnCancel: string;
  btnTapToPlay: string;
  btnInvite: string;
  btnConvertBonus: string;
  btnBack: string;

  // ── Welcome / registration ──
  welcomeBack: (name: string) => string;
  registerAskPhone: string;
  registrationSuccess: (name: string, phone: string) => string;
  registrationFailed: string;
  shareOwnNumberOnly: string;
  chooseOption: string;

  // ── Balance / history ──
  yourBalance: (amount: string) => string;
  noGamesYet: string;
  historyHeader: string;
  historyLoadFailed: string;
  userNotFound: string;

  // ── Deposit ──
  depositInstructions: (phone: string, min: number) => string;
  depositVerifying: string;
  depositSubmitted: (amount: string, balance: string) => string;
  depositTooLow: (amount: string, min: number) => string;
  verificationFailed: (error: string, support: string) => string;
  screenshotProcessing: string;
  screenshotFailed: (error: string) => string;
  screenshotError: string;

  // ── Withdraw ──
  withdrawInstructions: (min: number) => string;
  withdrawInsufficient: (balance: string, min: number) => string;
  withdrawMinimum: (min: number) => string;
  withdrawPhonePrompt: string;
  withdrawCbePrompt: string;
  withdrawChooseMethod: string;
  withdrawInvalidPhone: string;
  withdrawInvalidAccount: string;
  withdrawProcessing: string;
  withdrawRequestSent: (
    amount: number,
    account: string,
    balance: string,
  ) => string;
  withdrawSuccess: (amount: number, phone: string, balance: string) => string;
  withdrawFailed: (error: string) => string;
  insufficientBalanceDetail: (balance: string, requested: string) => string;

  // ── Convert bonus ──
  convertBonus: string;

  // ── Cancel ──
  cancelDone: string;

  // ── Transfer ──
  transferInsufficient: (balance: string, min: number) => string;
  transferPrompt: (balance: string) => string;
  transferInvalidInput: string;
  transferRecipientNotFound: string;
  transferSelfTransfer: string;
  transferRecipientFound: (name: string) => string;
  transferInvalidAmount: string;
  transferMinAmount: string;
  transferRecipientGone: string;
  transferProcessing: string;
  transferSuccess: (amount: number, name: string, balance: string) => string;
  transferFailed: (error: string) => string;
  transferReceived: (amount: number, name: string, balance: string) => string;

  // ── Transfer service errors ──
  errInvalidAmount: string;
  errMinTransfer: (min: number) => string;
  errSelfTransfer: string;
  errWalletNotFound: string;
  errRecipientNotRegistered: string;
  errAccountInactive: string;
  errInsufficientBalance: (balance: string) => string;

  // ── How to play ──
  howToPlay: (
    minDeposit: number,
    minWithdraw: number,
    minTransfer: number,
    support: string,
  ) => string;

  // ── Support ──
  supportText: (support: string) => string;

  // ── Language ──
  languageChanged: string;
  chooseLanguage: string;

  // ── Generic ──
  cancelled: string;
  invalidAmount: string;
  somethingWentWrong: string;
};

// ─────────────────────────────────────────────────────────────────────
// AMHARIC (formal — እርስዎ)
// ─────────────────────────────────────────────────────────────────────

const am: Translation = {
  // ── Menu buttons ──
  btnPlay: "🎮 ይጫወቱ",
  playDescription:
    "🎱 ኬኖ ይጫወቱ!\n\n" +
    "ትክክለኛ ቁጥሮችዎን ይምረጡ፣ ከተወሰዱት ጋር ያስማሩ፣ ብዙ ያሸንፉ!\n\n" +
    "ከታች ያለውን ቁልፍ ተጭነው ጨዋታውን ይጀምሩ።",
  btnBalance: "💰 ቀሪ ሂሳብ   ",
  btnHistory: "📊 ታሪክ",
  btnDeposit: "📥 ገንዘብ ማስገባት",
  btnWithdraw: "📤 ገንዘብ ማውጣት",
  btnTransfer: "🎁 ማስተላለፍ    ",
  btnSupport: "📞 ድጋፍ",
  btnHowToPlay: "📖 አጨዋወት     ",
  btnLanguage: "🌐 English  ",
  btnRegister: "📝 ይመዝገቡ",
  btnShareContact: "📞 ስልክ ቁጥርዎን ያጋሩ",
  btnCancel: "❌ ይቅር",
  btnTapToPlay: "🎮 ለመጫወት ይጫኑ",
  btnInvite: "👥 ጓደኞችን ይጋብዙ",
  btnConvertBonus: "🔄 ቦነስ ቀይር",
  btnBack: "◀️ ተመለስ",

  // ── Welcome / registration ──
  welcomeBack: (name) =>
    `🎉 *እንኳን ደህና መጡ፣ ${name}* 👋 ለመጀመር ከታች ካሉት አማራጮች ይምረጡ።`,

  registerAskPhone:
    `📝 *መለያዎን ይመዝገቡ*\n\n` +
    `ምዝገባዎን ለማጠናቀቅ እባክዎ ስልክ ቁጥርዎን ያጋሩ።\n\n` +
    `👇 ከታች ያለውን ቁልፍ ይጫኑ — ቴሌግራም በራሱ ይልከዋል።\n\n` +
    `_ስልክ ቁጥርዎ መለያዎን ለመጠበቅና ክፍያ ለመፈጸም ያገለግላል።_`,

  registrationSuccess: (name, phone) =>
    `✅ *ምዝገባው ተሳክቷል!*\n\n` +
    `እንኳን ደህና መጡ *${name}* 🎉\n\n` +
    `📱 ስልክ፦ \`${phone}\`\n` +
    `💰 ዋሌትዎ ተከፍቷል።\n\n` +
    `ለመጫወትና ዋሌትዎን ለማስተዳደር ከታች ያሉትን ቁልፎች ይጠቀሙ።`,

  registrationFailed: "❌ ምዝገባው አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  shareOwnNumberOnly:
    "❌ እባክዎ *የራስዎን* ስልክ ቁጥር ያጋሩ፣ የሌላ ሰው አይደለም።",

  chooseOption: "👇 አማራጭ ይምረጡ፦",

  // ── Balance / history ──
  yourBalance: (amount) => `💰 *የእርስዎ ቀሪ ሂሳብ*\n\n${amount} ብር`,

  noGamesYet: "📊 *የጨዋታ ታሪክ*\n\nእስካሁን ጨዋታ አልተጫወቱም። ለመጀመር ይጫወቱ የሚለውን ይጫኑ!",
  historyHeader: "📊 *የመጨረሻዎቹ 10 ጨዋታዎችዎ*\n\n",
  historyLoadFailed: "❌ የጨዋታ ታሪክን መጫን አልተቻለም።",
  userNotFound: "❌ ተጠቃሚው አልተገኘም። እባክዎ መጀመሪያ ይመዝገቡ።",

  // ── Deposit ──
  depositInstructions: (phone, min) =>
    "📥 *በቴሌብር ገንዘብ ማስገባት*\n\n" +
    "ገንዘብ ወደዚህ ይላኩ፦\n" +
    `📱 \`${phone}\`\n\n` +
    `ዝቅተኛ መጠን፦ *${min} ብር*\n\n` +
    "ከላኩ በኋላ ወደዚህ ተመልሰው፦\n" +
    "1️⃣ የቴሌብር *ማመሳከሪያ ቁጥር* ይለጥፉ፣ ወይም\n" +
    "2️⃣ ሙሉውን የቴሌብር *መልእክት* ይለጥፉ፣ ወይም\n" +
    "3️⃣ የክፍያ ደረሰኝ *ፎቶ* ይላኩ\n\n" +
    "ዋሌትዎ ተመርምሮ በአስተዳዳሪ ገንዘብ ይገባልዎታል።",

  depositVerifying: "⏳ ክፍያዎ እየተረጋገጠ ነው፣ እባክዎ ይጠብቁ...",

  depositSubmitted: (amount, balance) =>
    `✅ *Deposit Confirmed!*\n\nYour deposit of *${amount} ETB* has been verified and credited.\n\n💰 Play Balance: *${balance} ETB*`,

  depositTooLow: (amount, min) =>
    `❌ *ዝቅተኛ መጠን*\n\nዝቅተኛው የማስገቢያ መጠን *${min} ብር* ነው።\n\nየላኩት ${amount} ብር በጣም ትንሽ ነው። እባክዎ ቢያንስ ${min} ብር ያስገቡ።`,

  verificationFailed: (error, support) =>
    `❌ *ማረጋገጥ አልተሳካም*\n\n${error}\n\n` +
    `📱 *ሌላ አማራጭ ይሞክሩ:*\n` +
    `• የቴሌብር ማመሳከሪያ ቁጥሩን ይለጥፉ\n` +
    `• ወይም የክፍያ ደረሰኝ ፎቶ ይላኩ\n\n` +
    `እባክዎ እንደገና ይሞክሩ ወይም ${support} ያግኙ።`,

  screenshotProcessing: "⏳ የክፍያ ፎቶዎ እየተመረመረ ነው...",

  screenshotFailed: (error) =>
    `❌ *የፎቶ ማረጋገጫ አልተሳካም*\n\n${error}\n\n📱 *ሌላ አማራጭ ይሞክሩ:*\n• የቴሌብር ማመሳከሪያ ቁጥሩን ይለጥፉ\n• ወይም ሙሉውን የቴሌብር መልእክት ይለጥፉ`,

  screenshotError:
    "❌ ፎቶውን መመርመር አልተቻለም። እባክዎ እንደገና ይሞክሩ።\n\n📱 *ሌላ አማራጭ ይሞክሩ:*\n• የቴሌብር ማመሳከሪያ ቁጥሩን ይለጥፉ\n• ወይም ሙሉውን የቴሌብር መልእክት ይለጥፉ",

  // ── Withdraw ──
  withdrawInstructions: (min) =>
    "📤 *ገንዘብ ማውጣት*\n\n" +
    "ማውጣት የሚፈልጉትን መጠን ያስገቡ።\n\n" +
    `⚠️ *ዝቅተኛ የማውጫ መጠን፦* ${min} ብር\n` +
    "⚠️ በቂ ቀሪ ሂሳብ እንዳለዎት ያረጋግጡ።\n\n" +
    "መጠኑን ከታች ይጻፉ (ለምሳሌ `100`)፦",

  withdrawInsufficient: (balance, min) =>
    `❌ ገንዘብ ለማውጣት በቂ ቀሪ ሂሳብ የለዎትም።\n\n` +
    `💰 አሁን ያለዎት፦ *${balance} ብር*\n` +
    `⚠️ ዝቅተኛ የማውጫ መጠን፦ *${min} ብር*`,

  withdrawMinimum: (min) => `❌ ዝቅተኛው የማውጫ መጠን *${min} ብር* ነው።`,

  withdrawPhonePrompt: "📱 ስልክ ቁጥርዎን ያስገቡ ለማውጣት፦",

  withdrawCbePrompt: "🏦 የሲቢኢ (CBE) አካውንት ቁጥርዎን ያስገቡ ለማውጣት፦",

  withdrawChooseMethod: "📤 *ገንዘብ ማውጫ ዘዴ ይምረጡ*\n\nገንዘቡን ለማግኘት የሚፈልጉትን ዘዴ ይምረጡ፦",

  withdrawInvalidAccount: "❌ ትክክል ያልሆነ የሲቢኢ አካውንት ቁጥር። እባክዎ ትክክለኛውን ያስገቡ።",

  withdrawInvalidPhone:
    "❌ ትክክል አይደለም። እባክዎ ትክክለኛ የቴሌብር ስልክ ቁጥር ከ09 የሚጀመር 10 አሃዝ ያስገቡ።",

  withdrawProcessing: "⏳ የገንዘብ ማውጫ ጥያቄዎ እየተሰራ ነው...",

  withdrawRequestSent: (amount, account, balance) =>
    `✅ *ጥያቄዎ ተልኳል!*\n\n` +
    `የ ${amount} ብር የወጪ ጥያቄዎ ለአስተዳዳሪ ተልኳል።\n` +
    `📱 ሂሳብ፦ ${account}\n` +
    `💰 ቀሪ ሂሳብ፦ ${balance} ብር\n\n` +
    `እባክዎ የአስተዳዳሪውን ማረጋገጫ ይጠብቁ።`,

  withdrawSuccess: (amount, phone, balance) =>
    `✅ *ማውጣት ተሳክቷል!*\n\n` +
    `📤 መጠን፦ *${amount} ብር*\n` +
    `📱 ስልክ፦ \`${phone}\`\n` +
    `💰 ቀሪ ሂሳብ፦ *${balance} ብር*\n\n` +
    `ገንዘቡ በፍጥነት ይላልክ ዘንድ ተልከዋል።`,

  withdrawFailed: (error) => `❌ *ማውጣት አልተሳካም*\n\n${error}`,

  insufficientBalanceDetail: (balance, requested) =>
    `💰 ቀሪ ሂሳብ፦ *${balance} ብር*\n` +
    `📤 የመረጧት፦ *${requested} ብር*\n\n` +
    `በቂ ቀሪ ሂሳብ የለዎትም።`,

  // ── Convert bonus ──
  convertBonus:
    `🔄 *ቦነስ መቀየር*\n\n` +
    `ወደ ቀሪ ሂሳብ የሚቀየር ቦነስ የለዎትም።\n\n` +
    `ቦነስ በጨዋታ በሚያሸንፉ ጊዜ ይሰጣል። ይጫወቱ!`,

  // ── Cancel ──
  cancelDone: "✅ ተሰርቷል።",

  // ── Transfer ──
  transferInsufficient: (balance, min) =>
    `❌ ገንዘብ ለማስተላለፍ በቂ ቀሪ ሂሳብ የለዎትም።\n\n` +
    `💰 አሁን ያለዎት፦ *${balance} ብር*\n` +
    `⚠️ ዝቅተኛ የማስተላለፊያ መጠን፦ *${min} ብር*`,

  transferPrompt: (balance) =>
    `🎁 *ገንዘብ ማስተላለፍ*\n\n` +
    `💰 ቀሪ ሂሳብዎ፦ *${balance} ብር*\n\n` +
    `እባክዎ ገንዘብ ለማስተላለፍ የተቀባዩን *username*፣ *ስልክ ቁጥር* ወይም *telegram id* ያስገቡ።\n\n` +
    `👤 *username:* ለምሳሌ \`@john\`\n` +
    `🆔 *Telegram id:* ለምሳሌ \`123456789\`\n` +
    `📱 *ስልክ ቁጥር:* ለምሳሌ \`+251911234567\`\n` +
    `_(በ 0 አይጀምሩ)_`,

  transferInvalidInput: "❌ ትክክል ያልሆነ መጠን። እባክዎ ቁጥር ያስገቡ።",

  transferRecipientNotFound: "❌ ተቀባዩ አልተገኘም። እባክዎ ሌላ ሰው ይምረጡ።",

  transferSelfTransfer: "❌ ወደ ራስዎ ማስተላለፍ አይችሉም።",

  transferRecipientFound: (name) =>
    `👤 *ተቀባይ፦* ${name}\n\n` + `መላክ የሚፈልጉትን መጠን ይጻፉ (ለምሳሌ \`50\`)፦`,

  transferInvalidAmount: "❌ ትክክል ያልሆነ መጠን። እባክዎ ቁጥር ያስገቡ።",

  transferMinAmount: "❌ ዝቅተኛው የማስተላለፊያ መጠን 10 ብር ነው።",

  transferRecipientGone: "❌ ተቀባዩ አልተገኘም። እባክዎ እንደገና ይሞክሩ።",

  transferProcessing: "⏳ ማስተላለፉ እየተሰራ ነው...",

  transferSuccess: (amount, name, balance) =>
    `✅ *ማስተላለፉ ተሳክቷል*\n\n` +
    `የተላከ፦ *${amount} ብር*\n` +
    `ለ፦ *${name}*\n` +
    `አዲስ ቀሪ ሂሳብ፦ *${balance} ብር*`,

  transferFailed: (error) => `❌ *ማስተላለፍ አልተሳካም*\n\n${error}`,

  transferReceived: (amount, name, balance) =>
    `🎁 *ገንዘብ ደርሶዎታል!*\n\n` +
    `መጠን፦ *${amount} ብር*\n` +
    `ከ፦ *${name}*\n` +
    `ቀሪ ሂሳብ፦ *${balance} ብር*`,

  // ── Transfer service errors ──
  errInvalidAmount: "ትክክል ያልሆነ መጠን።",
  errMinTransfer: (min) => `ዝቅተኛው የማስተላለፊያ መጠን ${min} ብር ነው።`,
  errSelfTransfer: "ወደ ራስዎ ማስተላለፍ አይችሉም።",
  errWalletNotFound: "ዋሌትዎ አልተገኘም። እባክዎ መጀመሪያ ይመዝገቡ።",
  errRecipientNotRegistered:
    "ይህ ሰው እስካሁን በኬኖ ላይ አልተመዘገበም። መጀመሪያ ቦቱን ከፍቶ እንዲመዝገብ ይንገሩት።",
  errAccountInactive: "ይህ መለያ አገልግሎት ላይ አይደለም።",
  errInsufficientBalance: (balance) =>
    `በቂ ቀሪ ሂሳብ የለዎትም። ያለዎት ${balance} ብር ነው።`,

  // ── How to play ──
  howToPlay: (minDeposit, minWithdraw, minTransfer, support) =>
    "📖 *ኬኖ እንዴት እንደሚጫወቱ*\n\n" +
    "🎱 *ኬኖ* ቁጥሮችን ለመምረጥ እና የተዘረፉ ቁጥሮች ከእርስዎ ጋር እንዲገናኙ ተስፋ ማድረግ የሚችሉበት ፍትሃዊ ጨዋታ ነው።\n\n" +
    "🎮 *አጨዋወት፦*\n" +
    "1️⃣ ጨዋታውን ለመክፈት *ይጫወቱ* የሚለውን ይጫኑ\n" +
    "2️⃣ የውርርድ መጠንዎን ያስገቡ (ቢያንስ 10 ብር)\n" +
    "3️⃣ ከ1 እስከ 10 ቁጥሮች ይምረጡ (ከሰሌዳው ላይ)\n" +
    "4️⃣ ጨዋታውን ይጀምሩ — ቡድኑ 20 ቁጥሮችን ያወጣል\n" +
    "5️⃣ የምረጡት ቁጥሮች ከተወሰዱት ጋር ከሚስማሩ ሽልማት ያገኛሉ\n" +
    "6️⃣ ቁጥሮቹን በተጨማሪ መረጡ — ቁጥር ብዙ ስለሆነ ሽልማቱ ይጨምራል\n\n" +
    "💰 *ሽልማት፦*\n" +
    "• ቁጥር ብዙ መምረጥ = ትልቅ ሽልማት\n" +
    "• ከተወሰዱት ቁጥሮች ውስጥ ምን ያህል እንደሚስማሩ ይወሰናል\n" +
    "• በፍጥነት ቆይተው ማውጣት ወይም ዕድልዎን ማጋልጥ ይችላሉ!\n\n" +
    "📥 *ማስገባት፦* ገንዘብ ለመጨመር የማስገቢያ ቁልፉን ይጠቀሙ\n" +
    "📤 *ማውጣት፦* ያሸነፉትን ለመውሰድ የማውጫ ቁልፉን ይጠቀሙ\n" +
    "🎁 *ማስተላለፍ፦* ለሌላ ተጫዋች ገንዘብ ይላኩ\n\n" +
    `⚠️ *ዝቅተኛ ማስገቢያ፦* ${minDeposit} ብር\n` +
    `⚠️ *ዝቅተኛ ማውጫ፦* ${minWithdraw} ብር\n` +
    `⚠️ *ዝቅተኛ ማስተላለፊያ፦* ${minTransfer} ብር\n\n` +
    `❓ እርዳታ ይፈልጋሉ? ድጋፍ ያግኙ፦ ${support}`,

  // ── Support ──
  supportText: (support) =>
    `📞 *ድጋፍ ያግኙ*\n\n` + `እርዳታ ይፈልጋሉ? የድጋፍ ቡድናችንን ያግኙ፦\n\n` + `${support}`,

  // ── Language ──
  languageChanged: "✅ ቋንቋው ወደ አማርኛ ተቀይሯል።",
  chooseLanguage: "🌐 ቋንቋ ይምረጡ፦",

  // ── Generic ──
  cancelled: "ተሰርዟል።",
  invalidAmount: "❌ ትክክል ያልሆነ መጠን። እባክዎ ቁጥር ያስገቡ።",
  somethingWentWrong: "❌ የሆነ ችግር ተፈጥሯል። እባክዎ ቆይተው ይሞክሩ።",
};

// ─────────────────────────────────────────────────────────────────────
// ENGLISH
// ─────────────────────────────────────────────────────────────────────

const en: Translation = {
  // ── Menu buttons ──
  btnPlay: "🎮 Play",
  playDescription:
    "🎱 Play Keno & Win Big!\n\n" +
    "Pick your lucky numbers, match the draws, and win exciting prizes.\n\n" +
    "Tap the button below to start playing.",
  btnBalance: "💰 Balance",
  btnHistory: "📊 History",
  btnDeposit: "📥 Deposit",
  btnWithdraw: "📤 Withdraw",
  btnTransfer: "🎁 Transfer    ",
  btnSupport: "📞 Contact Support",
  btnHowToPlay: "📖 How to Play  ",
  btnLanguage: "🌐 አማርኛ  ",
  btnRegister: "📝 Register",
  btnShareContact: "📞 Share My Phone Number",
  btnCancel: "❌ Cancel",
  btnTapToPlay: "🎮 Tap to Play",
  btnInvite: "👥 Invite Friends",
  btnConvertBonus: "🔄 Convert Bonus",
  btnBack: "◀️ Back",

  // ── Welcome / registration ──
  welcomeBack: (name) =>
    `🎉 *Welcome back, ${name}* 👋\n\n` +
    `🎱 Play Keno and win big!\n\n` +
    `Choose an option below to get started.`,

  registerAskPhone:
    `📝 *Register Your Account*\n\n` +
    `To complete registration, please share your phone number.\n\n` +
    `👇 Tap the button below — Telegram will send it automatically.\n\n` +
    `_Your number is used to secure your account and process payouts._`,

  registrationSuccess: (name, phone) =>
    `✅ *Registration Successful!*\n\n` +
    `Welcome *${name}* 🎉\n\n` +
    `📱 Phone: \`${phone}\`\n` +
    `💰 Your wallet has been created.\n\n` +
    `Use the buttons below to play and manage your wallet.`,

  registrationFailed: "❌ Registration failed. Please try again.",
  shareOwnNumberOnly:
    "❌ Please share *your own* phone number, not someone else's.",

  chooseOption: "👇 Choose an option:",

  // ── Balance / history ──
  yourBalance: (amount) => `💰 *Your Balance*\n\n${amount} ETB`,

  noGamesYet: "📊 *Game History*\n\nNo games played yet. Tap Play to start!",
  historyHeader: "📊 *Your Last 10 Games*\n\n",
  historyLoadFailed: "❌ Failed to load game history.",
  userNotFound: "❌ User not found. Please register first.",

  // ── Deposit ──
  depositInstructions: (phone, min) =>
    "📥 *Deposit via Telebirr*\n\n" +
    "Send money to:\n" +
    `📱 \`${phone}\`\n\n` +
    `Minimum amount: *${min} ETB*\n\n` +
    "After sending, come back here and:\n" +
    "1️⃣ Paste your *Telebirr reference code*, or\n" +
    "2️⃣ Paste the full *Telebirr SMS*, or\n" +
    "3️⃣ Send a *screenshot* of your payment receipt\n\n" +
    "Your wallet will be reviewed and credited by admin.",

  depositVerifying: "⏳ Verifying your payment, please wait...",

  depositSubmitted: (amount, balance) =>
    `✅ *Deposit Confirmed!*\n\nYour deposit of *${amount} ETB* has been verified and credited.\n\n💰 Play Balance: *${balance} ETB*`,

  depositTooLow: (amount, min) =>
    `❌ *Minimum Deposit*\n\nThe minimum deposit amount is *${min} ETB*.\n\nYour payment of ${amount} ETB is too low. Please deposit at least ${min} ETB.`,

  verificationFailed: (error, support) =>
    `❌ *Verification Failed*\n\n${error}\n\n` +
    `📱 *Try another option:*\n` +
    `• Paste your Telebirr reference code\n` +
    `• Or send a payment screenshot\n\n` +
    `Please try again or contact ${support}.`,

  screenshotProcessing: "⏳ Processing your payment screenshot...",

  screenshotFailed: (error) =>
    `❌ *Screenshot Verification Failed*\n\n${error}\n\n📱 *Try another option:*\n• Paste your Telebirr reference code\n• Or paste the full Telebirr SMS`,

  screenshotError:
    "❌ Failed to process screenshot. Please try again.\n\n📱 *Try another option:*\n• Paste your Telebirr reference code\n• Or paste the full Telebirr SMS",

  // ── Withdraw ──
  withdrawInstructions: (min) =>
    "📤 *Withdraw Funds*\n\n" +
    "Enter the amount you want to withdraw.\n\n" +
    `⚠️ *Minimum withdrawal:* ${min} ETB\n` +
    "⚠️ Make sure you have sufficient balance.\n\n" +
    "Type the amount below (e.g. `100`):",

  withdrawInsufficient: (balance, min) =>
    `❌ Insufficient balance for withdrawal.\n\n` +
    `💰 Current Balance: *${balance} ETB*\n` +
    `⚠️ Minimum withdrawal: *${min} ETB*`,

  withdrawMinimum: (min) => `❌ Minimum withdrawal amount is *${min} ETB*.`,

  withdrawPhonePrompt: "📱 Enter your phone number to withdraw:",

  withdrawCbePrompt: "🏦 Enter your CBE account number to withdraw:",

  withdrawChooseMethod:
    "📤 *Choose Withdrawal Method*\n\nSelect how you want to receive your money:",

  withdrawInvalidAccount:
    "❌ Invalid CBE account number. Please enter a valid account number.",

  withdrawInvalidPhone:
    "❌ Invalid Telebirr phone. Please enter a 10-digit number starting with 09.",

  withdrawProcessing: "⏳ Processing your withdrawal request...",

  withdrawRequestSent: (amount, account, balance) =>
    `✅ *Request Submitted!*\n\n` +
    `Your withdrawal request of *${amount} ETB* has been sent to admin.\n` +
    `📱 Account: ${account}\n` +
    `💰 Remaining: ${balance} ETB\n\n` +
    `Please wait for admin approval.`,

  withdrawSuccess: (amount, phone, balance) =>
    `✅ *Withdrawal Successful!*\n\n` +
    `📤 Amount: *${amount} ETB*\n` +
    `📱 Phone: \`${phone}\`\n` +
    `💰 Remaining Balance: *${balance} ETB*\n\n` +
    `Your money has been sent to your phone.`,

  withdrawFailed: (error) => `❌ *Withdrawal Failed*\n\n${error}`,

  insufficientBalanceDetail: (balance, requested) =>
    `💰 Balance: *${balance} ETB*\n` +
    `📤 Requested: *${requested} ETB*\n\n` +
    `You don't have enough balance.`,

  // ── Convert bonus ──
  convertBonus:
    `🔄 *Convert Bonus*\n\n` +
    `You don't have any bonus to convert to your balance.\n\n` +
    `Bonuses are earned by winning games. Play to earn!`,

  // ── Cancel ──
  cancelDone: "✅ Cancelled.",

  // ── Transfer ──
  transferInsufficient: (balance, min) =>
    `❌ Insufficient balance for transfer.\n\n` +
    `💰 Current Balance: *${balance} ETB*\n` +
    `⚠️ Minimum transfer: *${min} ETB*`,

  transferPrompt: (balance) =>
    `🎁 *Transfer Funds*\n\n` +
    `💰 Your Balance: *${balance} ETB*\n\n` +
    `Please enter the recipient's *username*, *phone number*, or *Telegram ID* to transfer to.\n\n` +
    `👤 *Username:* e.g. \`@john\`\n` +
    `🆔 *Telegram ID:* e.g. \`123456789\`\n` +
    `📱 *Phone number:* e.g. \`+251911234567\`\n` +
    `_(Do not start with 0)_`,

  transferInvalidInput: "❌ Invalid amount. Please enter a number.",

  transferRecipientNotFound:
    "❌ Recipient not found. Please choose someone else.",

  transferSelfTransfer: "❌ You cannot transfer to yourself.",

  transferRecipientFound: (name) =>
    `👤 *Recipient:* ${name}\n\n` +
    `Type the amount you want to send (e.g. \`50\`) below:`,

  transferInvalidAmount: "❌ Invalid amount. Please enter a number.",

  transferMinAmount: "❌ Minimum transfer amount is 10 ETB.",

  transferRecipientGone: "❌ Recipient not found. Please try again.",

  transferProcessing: "⏳ Processing your transfer...",

  transferSuccess: (amount, name, balance) =>
    `✅ *Transfer Successful*\n\n` +
    `Sent: *${amount} ETB*\n` +
    `To: *@${name}*\n` +
    `New Balance: *${balance} ETB*`,

  transferFailed: (error) => `❌ *Transfer Failed*\n\n${error}`,

  transferReceived: (amount, name, balance) =>
    `🎁 *You received a transfer!*\n\n` +
    `Amount: *${amount} ETB*\n` +
    `From: *${name}*\n` +
    `Balance: *${balance} ETB*`,

  // ── Transfer service errors ──
  errInvalidAmount: "Invalid amount.",
  errMinTransfer: (min) => `Minimum transfer amount is ${min} ETB.`,
  errSelfTransfer: "You cannot transfer to yourself.",
  errWalletNotFound: "Your wallet was not found. Please register first.",
  errRecipientNotRegistered:
    "That user has not registered on Keno yet. Ask them to open the bot and press Register first.",
  errAccountInactive: "That account is not active.",
  errInsufficientBalance: (balance) =>
    `Insufficient balance. You have ${balance} ETB.`,

  // ── How to play ──
  howToPlay: (minDeposit, minWithdraw, minTransfer, support) =>
    "📖 *How to Play Keno*\n\n" +
    "🎱 *Keno* is a lottery-style game where you pick numbers and hope the drawn ones match yours.\n\n" +
    "🎮 *Gameplay:*\n" +
    "1️⃣ Tap *Play* to open the game\n" +
    "2️⃣ Enter your bet amount (min 10 ETB)\n" +
    "3️⃣ Pick 1 to 10 numbers from the board\n" +
    "4️⃣ Start the game — the system draws 20 random numbers\n" +
    "5️⃣ You win based on how many of your numbers match the drawn ones\n" +
    "6️⃣ The more numbers you match, the bigger your payout\n\n" +
    "💰 *Payouts:*\n" +
    "• Pick more numbers for bigger potential wins\n" +
    "• Payout depends on how many of your picks match the draw\n" +
    "• Cash out early for safer wins, or push your luck!\n\n" +
    "📥 *Deposit:* Use the Deposit button to add funds\n" +
    "📤 *Withdraw:* Use the Withdraw button to cash out your winnings\n" +
    "🎁 *Transfer:* Send funds to another Keno player\n\n" +
    `⚠️ *Minimum deposit:* ${minDeposit} ETB\n` +
    `⚠️ *Minimum withdrawal:* ${minWithdraw} ETB\n` +
    `⚠️ *Minimum transfer:* ${minTransfer} ETB\n\n` +
    `❓ Need help? Contact support: ${support}`,

  // ── Support ──
  supportText: (support) =>
    `📞 *Contact Support*\n\n` +
    `Need help? Reach our support team:\n\n` +
    `${support}`,

  // ── Language ──
  languageChanged: "✅ Language changed to English.",
  chooseLanguage: "🌐 Choose language:",

  // ── Generic ──
  cancelled: "Cancelled.",
  invalidAmount: "❌ Invalid amount. Please enter a number.",
  somethingWentWrong: "❌ Something went wrong. Please try again later.",
};

// ─────────────────────────────────────────────────────────────────────

const translations: Record<Lang, Translation> = { am, en };

/** Get the translation object for a language, falling back to Amharic. */
export function t(lang: Lang | string | null | undefined): Translation {
  if (lang === "en") return en;
  return am; // Amharic is the default for everything else
}

export default translations;
