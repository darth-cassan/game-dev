import { EmailMessage } from "cloudflare:email";

function safeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function shouldSkipAutoReply(message, replyFromDomain) {
  const from = String(message.from || "").toLowerCase();
  if (!from) return true;

  // Avoid obvious loops and self-replies.
  if (from.includes(`<${replyFromDomain}>`) || from.endsWith(`@${replyFromDomain.split("@")[1]}`)) {
    return true;
  }

  const autoSubmitted = String(message.headers.get("Auto-Submitted") || "").toLowerCase();
  const precedence = String(message.headers.get("Precedence") || "").toLowerCase();
  const listId = String(message.headers.get("List-Id") || "").toLowerCase();

  if (autoSubmitted && autoSubmitted !== "no") return true;
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") return true;
  if (listId) return true;

  return false;
}

function buildReplyRaw(message, replyFrom) {
  const subject = safeHeader(message.headers.get("Subject") || "your message");
  const messageId = safeHeader(message.headers.get("Message-ID"));

  const lines = [
    `From: Game Dev Team <${replyFrom}>`,
    `To: ${safeHeader(message.from)}`,
    `Subject: Re: ${subject}`,
    ...(messageId ? [`In-Reply-To: ${messageId}`, `References: ${messageId}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Auto-Submitted: auto-replied",
    "",
    "Thanks for contacting us.",
    "We will get back to you soon.",
    "",
    "- darthcassan.com",
  ];

  return lines.join("\r\n");
}

export default {
  async fetch(request, env) {
    // Keep serving the static website through Workers Assets.
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "Missing ASSETS binding. Configure Workers Assets for this Worker deployment.",
      { status: 500 }
    );
  },

  async email(message, env) {
    const replyFrom = env.REPLY_FROM || "games@darthcassan.com";

    // No forwarding: only auto-reply (or drop).
    if (shouldSkipAutoReply(message, replyFrom)) {
      return;
    }

    const rawReply = buildReplyRaw(message, replyFrom);

    try {
      const reply = new EmailMessage(replyFrom, message.from, rawReply);
      await message.reply(reply);
    } catch (error) {
      // Forwarding already succeeded; don't fail the email handler on reply errors.
      console.log("Auto-reply failed:", error);
    }
  },
};
