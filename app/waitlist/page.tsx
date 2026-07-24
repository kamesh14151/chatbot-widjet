import React from 'react';
import Link from 'next/link';
import { ClockIcon, HomeIcon } from 'lucide-react';

export default function WaitlistPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center p-4 font-sans">
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl p-10 max-w-lg w-full rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/60 dark:border-zinc-700/50 text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30 mb-8 border-4 border-white dark:border-zinc-800">
                    <ClockIcon className="w-10 h-10 text-white" />
                </div>
                
                <h1 className="text-3xl font-black text-slate-800 dark:text-zinc-100 tracking-tight mb-3">You're on the waitlist!</h1>
                
                <p className="text-[15px] font-medium text-slate-500 dark:text-zinc-400 leading-relaxed mb-8">
                    Your account has been created successfully, but it requires administrator approval before you can access the dashboard. We've sent you an email with more details. 
                    We will notify you once your account is ready!
                </p>
                
                <Link href="/" className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl font-bold transition-all cursor-pointer shadow-sm">
                    <HomeIcon className="w-4 h-4" /> Return to Home
                </Link>
            </div>
        </div>
    );
}
