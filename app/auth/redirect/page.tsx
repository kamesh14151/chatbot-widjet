"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page reads the role from the NextAuth token via a lightweight API call
// and redirects accordingly. No useSession needed.
export default function AuthRedirectPage() {
	const router = useRouter();

	useEffect(() => {
		fetch("/api/auth/me")
			.then(res => res.json())
			.then(data => {
				const role = data?.user?.role;
				if (role === "admin") {
					router.replace("/admin/dashboard");
				} else if (role === "pending") {
					router.replace("/waitlist");
				} else if (role === "expert") {
					router.replace("/expert/dashboard");
				} else {
					router.replace("/login");
				}
			})
			.catch(() => router.replace("/login"));
	}, [router]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-950 dark:to-zinc-900">
			<div className="flex flex-col items-center gap-4">
				<div className="w-10 h-10 border-4 border-[#003859]/20 border-t-[#003859] rounded-full animate-spin" />
				<p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Redirecting to your dashboard…</p>
			</div>
		</div>
	);
}
