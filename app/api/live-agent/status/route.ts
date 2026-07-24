import { NextResponse } from 'next/server';
import { LiveChatDb } from '@/lib/live-chat-db';

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';

		const res = await fetch(`${BACKEND_URL}/api/livechat/status`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			console.error("Backend Error in status:", text);
			return NextResponse.json({ error: 'Backend failed to update status' }, { status: res.status });
		}

		const data = await res.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error proxying status API route to backend:", error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
