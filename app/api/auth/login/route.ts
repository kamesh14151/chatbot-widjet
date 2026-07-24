import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

// Credentials are read from server-side env vars — never exposed to client
const CREDENTIALS: Record<string, { password: string; email: string }> = {
	expert: {
		password: process.env.EXPERT_PASSWORD || 'expert',
		email:    process.env.EXPERT_EMAIL    || 'expert@sona.com',
	},
	admin: {
		password: process.env.ADMIN_PASSWORD || 'admin',
		email:    process.env.ADMIN_EMAIL    || 'admin@sona.com',
	},
};

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { email, password } = body as { email: string; password: string };

		if (!email || !password) {
			return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
		}

		// Find role by email
		let role: 'expert' | 'admin' | null = null;
		let creds = null;

		if (email === CREDENTIALS.admin.email) {
			role = 'admin';
			creds = CREDENTIALS.admin;
		} else if (email === CREDENTIALS.expert.email) {
			role = 'expert';
			creds = CREDENTIALS.expert;
		}

		if (!role || !creds) {
			return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
		}

		if (password === creds.password) {
			const token = await signToken({ email: creds.email, role });

			const response = NextResponse.json({ success: true, email: creds.email, role });
			
			// Set HttpOnly cookie
			response.cookies.set({
				name: 'auth_token',
				value: token,
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				path: '/',
				maxAge: 60 * 60 * 24 // 1 day
			});

			return response;
		}

		return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
	} catch {
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
