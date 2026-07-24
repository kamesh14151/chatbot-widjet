import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

// Paths that require authentication
const PROTECTED_ROUTES = ['/admin', '/expert', '/agent'];
// API paths that require authentication (to prevent devtools leaking)
const PROTECTED_APIS = ['/api/live-agent/list', '/api/admin', '/api/live-agent/delete'];

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Check if this is a protected route
	const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
	const isProtectedApi = PROTECTED_APIS.some(route => pathname.startsWith(route));

	const token = req.cookies.get('auth_token')?.value;
	let payload = null;

	if (token) {
		payload = await verifyToken(token);
	}

	// 1. If accessing login while authenticated, redirect to correct dashboard
	if (pathname === '/login' && payload) {
		if (payload.role === 'admin') {
			return NextResponse.redirect(new URL('/admin/dashboard', req.url));
		}
		return NextResponse.redirect(new URL('/expert/dashboard', req.url));
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
