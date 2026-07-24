export async function sendEmail(to: string, toName: string, subject: string, htmlContent: string) {
    try {
        const { readEmailConfigAsync } = await import('@/app/api/admin/email-config/route');
        const cfg = await readEmailConfigAsync();
        
        const apiKey = cfg.smtpPass;
        const fromName = cfg.fromName || "SCALE UWA Assistant";
        const senderEmail = cfg.smtpUser || "no-reply@sonascale.uwa";

        if (!apiKey) {
            console.warn("Email API key is not configured. Email not sent.");
            return false;
        }

        if (cfg.provider === 'resend') {
            const resendSender = cfg.smtpUser || "onboarding@resend.dev";
            const resendName = cfg.fromName || "Acme";

            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    from: `${resendName} <${resendSender}>`,
                    to: [`${toName || 'User'} <${to}>`],
                    subject,
                    html: htmlContent,
                })
            });

            if (!res.ok) {
                console.error("Resend API Error:", await res.text());
                return false;
            }
            return true;
        } else {
            // Default to Brevo
            const emailData = {
                sender: { email: senderEmail, name: fromName },
                to: [{ email: to, name: toName }],
                subject,
                htmlContent,
            };

            const res = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "api-key": apiKey
                },
                body: JSON.stringify(emailData)
            });

            if (!res.ok) {
                console.error("Brevo API Error:", await res.text());
                return false;
            }
            return true;
        }
    } catch (error) {
        console.error("Failed to send email:", error);
        return false;
    }
}
