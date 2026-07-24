import { NextResponse, NextRequest } from 'next/server';
import { LiveChatDb } from '@/lib/live-chat-db';

// ─────────────────────────────────────────────────────────
// Feature #3: In-memory rate limiter
// Limits: max 3 session creations per IP per 10 minutes
// (Works for single-instance deployments; for multi-instance
//  production, use Redis / Upstash instead)
// ─────────────────────────────────────────────────────────
const RATE_WINDOW_MS  = 10 * 60 * 1000; // 10 minutes
const RATE_MAX        = 3;              // max sessions per window per IP
const rateMap         = new Map<string, { count: number; windowStart: number }>();

function getClientIp(req: NextRequest): string {
	return (
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		req.headers.get('x-real-ip') ||
		'unknown'
	);
}

function isRateLimited(ip: string): boolean {
	if (process.env.NODE_ENV === 'development' || ip === '127.0.0.1' || ip === '::1' || ip === 'unknown' || ip === 'localhost') {
		return false;
	}

	const now    = Date.now();
	const record = rateMap.get(ip);

	if (!record || now - record.windowStart > RATE_WINDOW_MS) {
		rateMap.set(ip, { count: 1, windowStart: now });
		return false;
	}

	if (record.count >= RATE_MAX) return true;

	record.count++;
	return false;
}
// ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const sessionId = searchParams.get('sessionId');

	if (!sessionId) {
		return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
	}

	const session = await LiveChatDb.getSession(sessionId);
	if (!session) {
		return NextResponse.json({ error: 'Session not found' }, { status: 404 });
	}

	return NextResponse.json(session);
}

export async function POST(request: NextRequest) {
	try {
		// ── Rate limit check ──────────────────────────────────
		const ip = getClientIp(request);
		if (isRateLimited(ip)) {
			return NextResponse.json(
				{ error: 'Too many sessions created from your network. Please wait 10 minutes.' },
				{
					status: 429,
					headers: {
						'Retry-After': '600',
						'X-RateLimit-Limit': String(RATE_MAX),
						'X-RateLimit-Window': '600',
					},
				}
			);
		}
		// ─────────────────────────────────────────────────────

		const body = await request.json();
		const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';

		const res = await fetch(`${BACKEND_URL}/api/livechat/session`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			console.error("Backend Error in session init:", text);
			return NextResponse.json({ error: 'Backend failed to create session' }, { status: res.status });
		}

		const data = await res.json();
		return NextResponse.json(data.data || data);
	} catch (error) {
		console.error('Error proxying session API route to backend:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
