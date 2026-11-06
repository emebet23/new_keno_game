export interface TelebirrParsedDetails {
  amount: number | null;
  transactionId: string;
  date?: string | null;
  sender?: string;
  partial?: boolean;
}

export class TelebirrParser {
  static parseConfirmation(text: string): TelebirrParsedDetails | null {
    if (!text) return null;

    const amountMatch = text.match(/transferred\s+ETB\s+([\d,.]+)/i);
    const idMatch =
      text.match(
        /(?:transaction\s+number\s+is\s+|Trans\.ID\s+|ID[:\s]+)([A-Z0-9]{8,15})/i,
      ) || text.match(/\b([A-Z0-9]{10})\b/);
    const dateMatch = text.match(
      /on\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
    );

    if (amountMatch && idMatch) {
      return {
        amount: parseFloat(amountMatch[1].replace(",", "")),
        transactionId: idMatch[1].toUpperCase(),
        date: dateMatch ? dateMatch[1] : null,
      };
    }

    if (idMatch && !amountMatch) {
      return {
        transactionId: idMatch[1].toUpperCase(),
        amount: null,
        partial: true,
      };
    }

    const receivedMatch = text.match(
      /received\s+ETB\s+([\d,.]+)\s+from\s+([^.]+)/i,
    );
    if (receivedMatch && idMatch) {
      return {
        amount: parseFloat(receivedMatch[1].replace(",", "")),
        transactionId: idMatch[1].toUpperCase(),
        sender: receivedMatch[2].trim(),
      };
    }

    return null;
  }

  static isTelebirrMessage(text: string): boolean {
    if (!text) return false;
    const cleanText = text.trim();

    const keywords = ["telebirr", "transferred", "ETB", "transaction number"];
    const isFullMessage =
      keywords.every((k) => cleanText.toLowerCase().includes(k.toLowerCase())) ||
      (cleanText.includes("ETB") && cleanText.includes("transaction number"));

    const isStandaloneCode = /^[A-Z0-9-]{10,15}$/i.test(cleanText);
    const isManualRef = /^YB-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(cleanText);

    return isFullMessage || isStandaloneCode || isManualRef;
  }

  static extractReferenceFromSMS(smsText: string): string | null {
    if (!smsText) return null;

    const txPattern = /transaction number is ([A-Z0-9]+)/i;
    const txMatch = smsText.match(txPattern);
    if (txMatch) return txMatch[1].toUpperCase();

    const urlPattern = /receipt\/([A-Z0-9]+)/i;
    const urlMatch = smsText.match(urlPattern);
    if (urlMatch) return urlMatch[1].toUpperCase();

    const idPattern = /(?:Trans\.ID|ID[:\s]+)([A-Z0-9]{8,15})/i;
    const idMatch = smsText.match(idPattern);
    if (idMatch) return idMatch[1].toUpperCase();

    return null;
  }
}
