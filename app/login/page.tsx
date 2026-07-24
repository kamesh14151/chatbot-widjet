"use client";

import React, { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { signIn } from 'next-auth/react';

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPass, setShowPass] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		const urlError = searchParams.get('error');
		if (urlError === 'OAuthSignin' || urlError === 'OAuthCallback') {
			setError('Microsoft Login failed. Please check your Azure AD configuration.');
		} else if (urlError === 'CredentialsSignin') {
			setError('Invalid email or password.');
		} else if (urlError) {
			setError('An error occurred during sign in.');
		}
	}, [searchParams]);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		try {
			const res = await signIn('credentials', {
				redirect: false,
				email,
				password,
			});

			if (res?.error) {
				setError(res.error);
				setLoading(false);
			} else {
				// We don't get the role directly back from signIn credentials result in client side easily, 
				// so we just refresh the page or route to a common dashboard index which redirects, 
				// or use router.push to the generic dashboard loader.
				// For now, let's just refresh to let middleware handle the redirection based on role, 
				// or route to the root and let middleware do it.
				window.location.href = '/'; 
			}
		} catch {
			setError('Network error. Please try again.');
			setLoading(false);
		}
	};

	const handleMicrosoftLogin = async () => {
		await signIn('azure-ad', { callbackUrl: '/' });
	};

	return (
		<div className="h-screen w-full overflow-hidden flex items-center justify-center p-4 lg:p-8 font-sans relative bg-zinc-200">
			
			{/* Main Card (Floating with border and space) */}
			<div className="relative z-10 w-full max-w-[1100px] h-auto max-h-[85vh] aspect-[16/10] bg-white rounded-[2.5rem] shadow-2xl flex overflow-hidden ring-1 ring-white/10 md:ring-8 md:ring-white/5">
				
				{/* Left Side (Image with slanted edge) - Hidden on Mobile */}
				<div 
					className="hidden lg:block w-[50%] xl:w-[55%] relative h-full pointer-events-none"
					style={{
						clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0 100%)'
					}}
				>
					{/* Image */}
					<div 
						className="absolute inset-0 bg-cover bg-center"
						style={{ backgroundImage: `url('/Gemini_Generated_Image_ewigp1ewigp1ewig.png')` }}
					/>
				</div>

				{/* Right Side (Form) */}
				<div className="flex-1 flex flex-col relative px-6 py-6 lg:px-16 justify-center bg-white h-full overflow-hidden">
					
					{/* Header inside right side */}
					<div className="absolute top-6 left-6 right-6 lg:left-10 lg:right-10 flex justify-between items-center">
						<div className="font-black text-lg tracking-tight text-slate-900 uppercase">
							SONA SCALE
						</div>
					</div>

					<div className="w-full max-w-[360px] mx-auto mt-6">
						<h1 className="text-[32px] sm:text-[38px] font-bold text-slate-900 mb-1 leading-tight tracking-tight">
							Welcome Back
						</h1>
						<p className="text-slate-500 mb-6 font-medium text-sm">
							Welcome to SONA SCALE Secure Portal
						</p>

						{error && (
							<div className="mb-4 p-2.5 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">
								{error}
							</div>
						)}

						<form onSubmit={handleLogin} className="space-y-4">
							{/* Email */}
							<div>
								<input
									type="email"
									required
									value={email}
									onChange={e => setEmail(e.target.value)}
									placeholder="Email"
									className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-shadow bg-white font-medium text-sm"
								/>
							</div>

							{/* Password */}
							<div className="relative">
								<input
									type={showPass ? 'text' : 'password'}
									required
									value={password}
									onChange={e => setPassword(e.target.value)}
									placeholder="Password"
									className="w-full border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-shadow bg-white font-medium text-sm"
								/>
								<button
									type="button"
									onClick={() => setShowPass(!showPass)}
									className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
								>
									{showPass ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
								</button>
							</div>

							<div className="flex justify-end pt-0.5">
								<a href="#" className="text-xs font-semibold text-red-500 hover:text-red-600 hover:underline">
									Forgot password ?
								</a>
							</div>

							{/* Divider */}
							<div className="flex items-center justify-center space-x-4 py-2">
								<div className="h-px bg-slate-200 flex-1"></div>
								<span className="text-xs font-bold text-slate-400 uppercase">or</span>
								<div className="h-px bg-slate-200 flex-1"></div>
							</div>

							{/* Microsoft Login */}
							<button
								type="button"
								onClick={handleMicrosoftLogin}
								className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-3 text-sm cursor-pointer"
							>
								{/* Microsoft Icon */}
								<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21">
									<rect x="1" y="1" width="9" height="9" fill="#f25022"/>
									<rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
									<rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
									<rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
								</svg>
								Login with Microsoft
							</button>

							{/* Submit Login */}
							<button
								type="submit"
								disabled={loading || !email || !password}
								className="w-full bg-[#EA4335] hover:bg-[#D93025] text-white font-bold py-3.5 rounded-full transition-all flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-red-500/30 mt-4"
							>
								{loading ? (
									<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								) : (
									'Login'
								)}
							</button>
						</form>

					</div>
				</div>
			</div>
		</div>
	);
}

export default function UnifiedLogin() {
	return (
		<Suspense fallback={
			<div className="min-h-screen bg-slate-50 flex items-center justify-center">
				<div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
			</div>
		}>
			<LoginForm />
		</Suspense>
	);
}
