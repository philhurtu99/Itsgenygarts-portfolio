import nodemailer from "nodemailer";
import { newsletterUnsubscribeUrl } from "../utils/newsletterUnsubscribe.js";
import { isEnglish, normalizeLanguage } from "../utils/language.js";

function normalizePort(value) {
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? port : 587;
}

function extractEmailAddress(value) {
  const str = String(value || "").trim();
  const match = str.match(/<([^>]+)>/);
  return (match ? match[1] : str).trim();
}

function isEmailLike(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value || "").trim());
}

function formatAddress(name, email) {
  const safeName = String(name || "").replace(/"/g, "").trim();
  return safeName ? `"${safeName}" <${email}>` : email;
}

const EMAIL_PROFILES = {
  system: 'system',
  business: 'business',
};
const DEFAULT_NOTIFICATIONS_EMAIL = 'notifications@example.test';

function resolveProfile(profile = EMAIL_PROFILES.system) {
  return profile === EMAIL_PROFILES.business ? EMAIL_PROFILES.business : EMAIL_PROFILES.system;
}

function resolveFromAddress(profile) {
  if (resolveProfile(profile) === EMAIL_PROFILES.business) {
    const configuredBusinessFrom = process.env.BUSINESS_SMTP_FROM || process.env.BUSINESS_FROM;
    const businessFromEmail = extractEmailAddress(configuredBusinessFrom);
    if (configuredBusinessFrom && isEmailLike(businessFromEmail)) return configuredBusinessFrom;

    const businessEmail = extractEmailAddress(process.env.BUSINESS_EMAIL);
    if (isEmailLike(businessEmail)) {
      return formatAddress(process.env.BUSINESS_NAME || "Itsgenygarts", businessEmail);
    }
  }

  const smtpUser = process.env.SMTP_USER;
  const configuredFrom = process.env.NOTIFICATIONS_SMTP_FROM
    || process.env.NOTIFICATIONS_FROM;
  const fromEmail = extractEmailAddress(configuredFrom);

  if (configuredFrom && isEmailLike(fromEmail)) return configuredFrom;
  const notificationsEmail = extractEmailAddress(
    process.env.NOTIFICATIONS_EMAIL || process.env.SYSTEM_EMAIL || DEFAULT_NOTIFICATIONS_EMAIL,
  );
  if (isEmailLike(notificationsEmail)) {
    return formatAddress(process.env.BUSINESS_NAME || "Itsgenygarts", notificationsEmail);
  }
  const configuredSystemFrom = process.env.SYSTEM_SMTP_FROM
    || process.env.SYSTEM_FROM
    || process.env.SMTP_FROM;
  const systemFromEmail = extractEmailAddress(configuredSystemFrom);
  if (configuredSystemFrom && isEmailLike(systemFromEmail)) return configuredSystemFrom;
  return formatAddress(process.env.BUSINESS_NAME || "Itsgenygarts", smtpUser);
}

function resolveReplyTo(profile) {
  const candidates = resolveProfile(profile) === EMAIL_PROFILES.business
    ? [process.env.BUSINESS_REPLY_TO, process.env.BUSINESS_EMAIL, process.env.SMTP_REPLY_TO]
    : [
        process.env.NOTIFICATIONS_REPLY_TO,
        process.env.NOTIFICATIONS_EMAIL,
        process.env.SYSTEM_REPLY_TO,
        process.env.SYSTEM_EMAIL,
        process.env.SMTP_REPLY_TO,
        process.env.BUSINESS_EMAIL,
      ];
  const replyTo = candidates.map(extractEmailAddress).find(isEmailLike);
  return replyTo || undefined;
}

function normalizeRecipients(to) {
  const recipients = Array.isArray(to) ? to : String(to || "").split(",");
  const cleaned = recipients.map((email) => String(email).trim()).filter(Boolean);
  const invalid = cleaned.filter((email) => !isEmailLike(extractEmailAddress(email)));
  if (!cleaned.length || invalid.length) {
    throw new Error(`Adresse courriel destinataire invalide: ${invalid[0] || to || ""}`);
  }
  return cleaned.join(", ");
}

function resolveDkim() {
  const { DKIM_DOMAIN, DKIM_SELECTOR, DKIM_PRIVATE_KEY } = process.env;
  if (!DKIM_DOMAIN || !DKIM_SELECTOR || !DKIM_PRIVATE_KEY) return undefined;
  return {
    domainName: DKIM_DOMAIN,
    keySelector: DKIM_SELECTOR,
    privateKey: DKIM_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
}

function resolveTransportConfig(profile) {
  const resolvedProfile = resolveProfile(profile);
  const useBusinessTransport = resolvedProfile === EMAIL_PROFILES.business
    && process.env.BUSINESS_SMTP_USER
    && process.env.BUSINESS_SMTP_PASS;
  const useNotificationsTransport = resolvedProfile === EMAIL_PROFILES.system
    && process.env.NOTIFICATIONS_SMTP_USER
    && process.env.NOTIFICATIONS_SMTP_PASS;

  return {
    host: useBusinessTransport
      ? (process.env.BUSINESS_SMTP_HOST || process.env.SMTP_HOST)
      : useNotificationsTransport
        ? (process.env.NOTIFICATIONS_SMTP_HOST || process.env.SMTP_HOST)
        : process.env.SMTP_HOST,
    port: useBusinessTransport
      ? (process.env.BUSINESS_SMTP_PORT || process.env.SMTP_PORT)
      : useNotificationsTransport
        ? (process.env.NOTIFICATIONS_SMTP_PORT || process.env.SMTP_PORT)
        : process.env.SMTP_PORT,
    user: useBusinessTransport
      ? process.env.BUSINESS_SMTP_USER
      : useNotificationsTransport
        ? process.env.NOTIFICATIONS_SMTP_USER
        : process.env.SMTP_USER,
    pass: useBusinessTransport
      ? process.env.BUSINESS_SMTP_PASS
      : useNotificationsTransport
        ? process.env.NOTIFICATIONS_SMTP_PASS
        : process.env.SMTP_PASS,
  };
}

function createTransporter(profile) {
  const { host, port: portValue, user, pass } = resolveTransportConfig(profile);

  if (!host || !user || !pass) {
    throw new Error(
      "Configuration SMTP manquante. Ajoutez SMTP_HOST, SMTP_USER et SMTP_PASS dans le fichier .env",
    );
  }

  const port = normalizePort(portValue);
  const dkim = resolveDkim();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
    auth: {
      user,
      pass,
    },
    ...(dkim ? { dkim } : {}),
  });
}

/**
 * Send an email.
 * @param {{ to: string, subject: string, text: string, html?: string, attachments?: Array, profile?: 'system'|'business' }} options
 */
export async function sendEmail({ to, subject, text, html, attachments, profile = EMAIL_PROFILES.system, lang = 'en' }) {
  const resolvedProfile = resolveProfile(profile);
  const emailLang = normalizeLanguage(lang);
  const transporter = createTransporter(resolvedProfile);
  const from = resolveFromAddress(resolvedProfile);
  const fromEmail = extractEmailAddress(from);
  const replyTo = resolveReplyTo(resolvedProfile);
  const normalizedTo = normalizeRecipients(to);
  const envelopeRecipients = normalizedTo.split(",").map((email) => extractEmailAddress(email.trim()));
  const { user } = resolveTransportConfig(resolvedProfile);
  const unsubscribeUrl = newsletterUnsubscribeUrl(envelopeRecipients[0]);
  const unsubscribeText = isEnglish(emailLang)
    ? [
        "Unsubscribe from newsletters:",
        unsubscribeUrl,
        "Order, quote, and payment emails will continue to be sent.",
      ].join("\n")
    : [
        "Se désabonner des infolettres:",
        unsubscribeUrl,
        "Les courriels liés à vos commandes, devis et paiements continueront d'être envoyés.",
      ].join("\n");
  const textWithUnsubscribe = `${text || ""}\n\n---\n${unsubscribeText}`;

  const info = await transporter.sendMail({
    from,
    sender: fromEmail,
    replyTo,
    to: normalizedTo,
    subject,
    text: textWithUnsubscribe,
    html: html || textWithUnsubscribe.replace(/\n/g, "<br>"),
    envelope: {
      from: user,
      to: envelopeRecipients,
    },
    headers: {
      "X-Auto-Response-Suppress": "All",
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    ...(attachments ? { attachments } : {}),
  });

  return info;
}
