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
		const leadEmailTo = cfg.leadEmailTo;
		const subjectPrefix = cfg.subjectPrefix || "New User Lead";

		if (apiKey && leadEmailTo) {
			const { sendEmail } = await import('@/lib/email');
			
			const htmlContent = `
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
				`;

			const success = await sendEmail(
				leadEmailTo,
				"Admin",
				`${subjectPrefix}: ${name}`,
				htmlContent
			);

			if (success) {
				console.log(`Email sent via API to ${leadEmailTo} for lead: ${name}`);
			} else {
				console.warn("API Warning (Email not sent). Check credentials.");
			}
		} else {
			console.log("-----------------------------------------");
			console.log("Lead captured (No API Key or Lead Email configured):");
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
