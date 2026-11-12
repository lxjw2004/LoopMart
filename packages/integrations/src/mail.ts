import nodemailer from "nodemailer";
export type MailConfig = { url?: string; from?: string };
export function createMailSender(config: MailConfig) {
  const transport =
    config.url && config.from
      ? nodemailer.createTransport(config.url)
      : undefined;
  return async (message: {
    to: string;
    subject: string;
    text: string;
  }): Promise<void> => {
    if (!transport) throw new Error("Mail delivery is not configured");
    try {
      await transport.sendMail({ ...message, from: config.from });
    } catch {
      throw new Error("Mail delivery failed");
    }
  };
}
