import { NextResponse } from 'next/server';
import { LiveChatDb } from '@/lib/live-chat-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const sessionId = searchParams.get('sessionId');

	if (!sessionId) {
		return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
	}

	const session = await LiveChatDb.getSession(sessionId);
	if (!session) {
		return NextResponse.json({ error: 'Session not found' }, { status: 404 });
	}

	return NextResponse.json({
		messages: session.messages,
		status: session.status,
		assignedAgent: session.assignedAgent,
		userName: session.userName
	});
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
		
		const res = await fetch(`${BACKEND_URL}/api/livechat/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			console.error("Backend Error in messages:", text);
			return NextResponse.json({ error: 'Backend failed to add message' }, { status: res.status });
		}

		const data = await res.json();
		return NextResponse.json(data.message || data);
	} catch (error) {
		console.error("Error proxying messages API route to backend:", error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
