import { NextResponse } from 'next/server';
import { LiveChatDb } from '@/lib/live-chat-db';

export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		const sessionsObj = await LiveChatDb.getSessions();
		const sessionsList = Object.values(sessionsObj);

		// Sort by last active timestamp descending
		sessionsList.sort((a, b) => b.lastActive - a.lastActive);

		return NextResponse.json(sessionsList);
	} catch (error) {
		console.error("Error in list sessions API route:", error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
