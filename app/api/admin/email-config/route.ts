import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getMongoDb } from '@/lib/mongodb';

const CONFIG_FILE = path.join(process.cwd(), 'email-config.json');

export interface EmailConfig {
	provider: 'brevo' | 'resend';
	smtpHost: string;
	smtpPort: string;
	smtpUser: string;   // Gmail address or SMTP username
	smtpPass: string;   // Gmail App Password or SMTP password
	fromName: string;   // Display name shown in From field
	// Recipient for lead notifications
	leadEmailTo: string;
	// Recipient for waitlist notifications
	waitlistEmailTo: string;
	// Email subject prefix
	subjectPrefix: string;
}

const DEFAULT_CONFIG: EmailConfig = {
	provider:      'brevo',
	smtpHost:      process.env.SMTP_HOST      || 'smtp-relay.brevo.com',
	smtpPort:      process.env.SMTP_PORT      || '587',
	smtpUser:      process.env.SMTP_USER      || '',
	smtpPass:      process.env.SMTP_PASS      || '',
	fromName:      process.env.EMAIL_FROM_NAME || 'SCALE UWA Assistant',
	leadEmailTo:   process.env.LEAD_EMAIL_TO  || 'kamesh6592@gmail.com',
	waitlistEmailTo: process.env.WAITLIST_EMAIL_TO || process.env.LEAD_EMAIL_TO || 'kamesh6592@gmail.com',
	subjectPrefix: process.env.EMAIL_SUBJECT_PREFIX || 'New User Lead',
};

// Synchronous fallback read (from local file or env defaults)
export function readEmailConfig(): EmailConfig {
	try {
		if (fs.existsSync(CONFIG_FILE)) {
			const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
			const saved = JSON.parse(raw) as Partial<EmailConfig>;
			return { ...DEFAULT_CONFIG, ...saved };
		}
	} catch (e) {
		console.error('Error reading local email config file:', e);
	}
	return DEFAULT_CONFIG;
}

// Asynchronous read (tries MongoDB first for production persistence across Vercel deployments, then local file)
export async function readEmailConfigAsync(): Promise<EmailConfig> {
	try {
		const db = await getMongoDb();
		if (db) {
			const collection = db.collection('email_configs');
			const doc = await collection.findOne({ key: 'main_email_config' });
			if (doc && doc.config) {
				return { ...DEFAULT_CONFIG, ...(doc.config as Partial<EmailConfig>) };
			}
		}
	} catch (e) {
		console.warn('Could not read email config from MongoDB, falling back to local storage:', e);
	}
	return readEmailConfig();
}

// Asynchronous write (saves to local JSON file AND MongoDB for production persistence)
export async function writeEmailConfigAsync(config: EmailConfig): Promise<void> {
	// 1. Save locally
	try {
		fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
	} catch (e) {
		console.error('Error writing local email config file:', e);
	}

	// 2. Persist to MongoDB if configured
	try {
		const db = await getMongoDb();
		if (db) {
			const collection = db.collection('email_configs');
			await collection.updateOne(
				{ key: 'main_email_config' },
				{ $set: { key: 'main_email_config', config, updatedAt: new Date() } },
				{ upsert: true }
			);
			console.log('Email configuration successfully persisted to MongoDB database.');
		}
	} catch (e) {
		console.error('Error writing email config to MongoDB:', e);
	}
}

export async function GET() {
	const config = await readEmailConfigAsync();
	return NextResponse.json(config);
}

export async function POST(request: Request) {
	try {
		const body = await request.json() as Partial<EmailConfig>;
		const current = await readEmailConfigAsync();

		const updated: EmailConfig = {
			provider:      body.provider      ?? current.provider ?? 'brevo',
			smtpHost:      body.smtpHost      ?? current.smtpHost,
			smtpPort:      body.smtpPort      ?? current.smtpPort,
			smtpUser:      body.smtpUser      ?? current.smtpUser,
			smtpPass:      body.smtpPass      ?? current.smtpPass,
			fromName:      body.fromName      ?? current.fromName,
			leadEmailTo:   body.leadEmailTo   ?? current.leadEmailTo,
			waitlistEmailTo: body.waitlistEmailTo ?? current.waitlistEmailTo,
			subjectPrefix: body.subjectPrefix ?? current.subjectPrefix,
		};

		await writeEmailConfigAsync(updated);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error saving email config:', error);
		return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
	}
}
