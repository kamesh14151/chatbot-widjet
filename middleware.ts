import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Paths that require authentication
const PROTECTED_ROUTES = ['/admin', '/expert', '/agent'];
// API paths that require authentication (to prevent devtools leaking)
const PROTECTED_APIS = ['/api/live-agent/list', '/api/admin', '/api/live-agent/delete'];

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Check if this is a protected route
	const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
	const isProtectedApi = PROTECTED_APIS.some(route => pathname.startsWith(route));

	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || "fallback_secret_key" });
	const payload = token;

	// 1. If accessing login or root while authenticated, redirect to correct dashboard
	if ((pathname === '/login' || pathname === '/') && payload) {
		if (payload.role === 'admin') {
			return NextResponse.redirect(new URL('/admin/dashboard', req.url));
		}
		if (payload.role === 'pending') {
			return NextResponse.redirect(new URL('/waitlist', req.url));
		}
		return NextResponse.redirect(new URL('/expert/dashboard', req.url));
	}

	// 1.5. If accessing /waitlist but they are NOT pending, redirect away
	if (pathname === '/waitlist') {
		if (!payload) return NextResponse.redirect(new URL('/login', req.url));
		if (payload.role !== 'pending') return NextResponse.redirect(new URL('/', req.url));
	}

	// 2. Protect UI routes
	if (isProtectedRoute) {
		if (!payload) {
			// Not logged in -> Redirect to unified login
			return NextResponse.redirect(new URL('/login', req.url));
		}
		
		// Optional: Role-based guard
		if (pathname.startsWith('/admin') && payload.role !== 'admin') {
			return NextResponse.redirect(new URL('/expert/dashboard', req.url));
		}
		if ((pathname.startsWith('/expert') || pathname.startsWith('/agent')) && payload.role !== 'expert' && payload.role !== 'admin') {
			if (payload.role === 'pending') {
				return NextResponse.redirect(new URL('/waitlist', req.url));
			}
			return NextResponse.redirect(new URL('/login', req.url));
		}
	}

	// 3. Protect API routes (prevent manual requests without auth)
	if (isProtectedApi) {
		if (!payload) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		// Optional: Admin only APIs
		if (pathname.startsWith('/api/admin') && payload.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		'/((?!_next/static|_next/image|favicon.ico).*)',
	],
};
