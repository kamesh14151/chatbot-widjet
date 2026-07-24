import { type NextRequest, NextResponse } from "next/server";
import { validateName, validateEmail, validatePhone } from "@/lib/contact-validator";

export async function POST(req: NextRequest) {
	try {
		const { name, email, phone } = await req.json();
		console.log("Received lead details:", { name, email, phone });
		if (!name || !email || !phone) {
			return NextResponse.json(
				{ error: "Name, email, and phone are required." },
				{ status: 400 }
			);
		}

		const nameVal = validateName(name);
		if (!nameVal.valid) {
			return NextResponse.json({ error: nameVal.error }, { status: 400 });
		}

		const emailVal = validateEmail(email);
		if (!emailVal.valid) {
			return NextResponse.json({ error: emailVal.error }, { status: 400 });
		}

		const phoneVal = validatePhone(phone);
		if (!phoneVal.valid) {
			return NextResponse.json({ error: phoneVal.error }, { status: 400 });
		}

		// 1. Get Client IP Address
		let ip =
			req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
			req.headers.get("x-real-ip")?.trim() ||
			"";

		// Handle local/loopback IPs for testing
		if (!ip || ip === "::1" || ip === "127.0.0.1") {
			// Try to fetch a public IP for testing, or default
			try {
				const publicIpRes = await fetch("https://api.ipify.org?format=json");
				const data = await publicIpRes.json();
				ip = data.ip || ip;
			} catch (e) {
				console.warn("Could not fetch public IP for loopback fallback", e);
			}
		}

		// 2. Query IP-based Location
		let locationInfo = "Unknown Location";
		try {
			if (ip && ip !== "::1" && ip !== "127.0.0.1") {
				const locRes = await fetch(`http://ip-api.com/json/${ip}`);
				const locData = await locRes.json();
				if (locData.status === "success") {
					locationInfo = `${locData.city}, ${locData.regionName}, ${locData.country} (${locData.zip || "No ZIP"}) [ISP: ${locData.isp}]`;
				}
			}
		} catch (e) {
			console.error("Failed to fetch geolocation for IP:", ip, e);
		}

		// 3. Load email config (permanently stored in MongoDB with local/env fallbacks)
		const { readEmailConfigAsync } = await import('@/app/api/admin/email-config/route');
		const cfg = await readEmailConfigAsync();

		const apiKey = cfg.smtpPass; // The API key is stored in the smtpPass field
		const fromName = cfg.fromName || "SCALE UWA Assistant";
		const leadEmailTo = cfg.leadEmailTo;
		const subjectPrefix = cfg.subjectPrefix || "New User Lead";

		if (apiKey && apiKey.startsWith('xkeysib') || apiKey.startsWith('xsmtpsib')) {
			const emailData = {
				sender: { email: cfg.smtpUser || "no-reply@sonascale.uwa", name: fromName },
				to: [{ email: leadEmailTo, name: "Admin" }],
				subject: `${subjectPrefix}: ${name}`,
				htmlContent: `
					<div style="font-family: Arial, sans-serif; padding: 20px;">
						<h2>New Lead captured in SCALE UWA Chatbot</h2>
						<p><strong>Name:</strong> ${name}</p>
						<p><strong>Email:</strong> ${email}</p>
						<p><strong>Phone:</strong> ${phone}</p>
						<hr />
						<p><strong>User IP Address:</strong> ${ip}</p>
						<p><strong>IP-Based Location:</strong> ${locationInfo}</p>
						<br/>
						<p style="font-size: 12px; color: #555;">SCALE UWA Live Support System</p>
					</div>
				`,
			};

			const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
				method: "POST",
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/json",
					"api-key": apiKey
				},
				body: JSON.stringify(emailData)
			});

			if (!brevoRes.ok) {
				const errText = await brevoRes.text();
				console.warn("Brevo API Warning (Email not sent):", errText);
				// We don't throw an error here, so the student can still connect to the live agent even if admin notifications fail.
			} else {
				console.log(`Email sent via Brevo API to ${leadEmailTo} for lead: ${name}`);
			}
		} else {
			console.log("-----------------------------------------");
			console.log("Lead captured (No Brevo API Key configured):");
			console.log(`Name: ${name}, Email: ${email}, Phone: ${phone}`);
			console.log(`IP: ${ip}, Location: ${locationInfo}`);
			console.log("Configure email in Admin Panel → Email Settings.");
			console.log("-----------------------------------------");
		}

		return NextResponse.json({ success: true, location: locationInfo, ip });
	} catch (error: any) {
		console.error("Error in send-details API:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to process lead details" },
			{ status: 500 }
		);
	}
}
