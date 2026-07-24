import { NextResponse } from 'next/server';
import { LiveChatDb } from '@/lib/live-chat-db';

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';

		const res = await fetch(`${BACKEND_URL}/api/livechat/assign`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			console.error("Backend Error in assign:", text);
			return NextResponse.json({ error: 'Backend failed to assign agent' }, { status: res.status });
		}

		const data = await res.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error proxying assign API route to backend:", error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
