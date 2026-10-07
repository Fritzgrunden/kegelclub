import "server-only";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * E-Mail-Versand über die Resend-HTTP-API (keine zusätzliche Abhängigkeit).
 * Ohne Konfiguration: In der Entwicklung wird die Mail in der Konsole ausgegeben,
 * in Produktion nur eine Warnung ohne Inhalt geloggt (keine Tokens in Logs).
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "development") {
      console.info(`\n📧 [Entwicklung] E-Mail an ${message.to}\nBetreff: ${message.subject}\n\n${message.text}\n`);
    } else if (process.env.NODE_ENV === "production") {
      console.warn("E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY / MAIL_FROM fehlen).");
    }
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
    });
    if (!res.ok) console.error(`E-Mail-Versand fehlgeschlagen (HTTP ${res.status}).`);
    return res.ok;
  } catch {
    console.error("E-Mail-Versand fehlgeschlagen (Netzwerkfehler).");
    return false;
  }
}
