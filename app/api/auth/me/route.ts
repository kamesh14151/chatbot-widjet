import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
	const token = req.cookies.get('auth_token')?.value;
	if (!token) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	const payload = await verifyToken(token);
	if (!payload) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	return NextResponse.json({ authenticated: true, user: payload });
}
