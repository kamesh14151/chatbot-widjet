import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || "fallback_secret_key" });
	
	if (!token) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	return NextResponse.json({ authenticated: true, user: token });
}
