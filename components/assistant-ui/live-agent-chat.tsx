import React, { FC, useEffect, useRef, useState } from 'react';
import { useLiveChatStore, LiveMessage } from '@/lib/live-chat-store';
import { ArrowUpIcon, Loader2Icon, UserIcon, ArrowLeftIcon } from 'lucide-react';
import { getSocket } from '@/lib/socket';

export const LiveAgentChat: FC = () => {
	const {
		messages,
		sessionStatus,
		assignedAgent,
		sendMessage,
		fetchSessionState,
		studentName,
		setMode
	} = useLiveChatStore();

	const [inputText, setInputText] = useState('');
	const [sending, setSending] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Socket.io integration to replace polling
	useEffect(() => {
		const socket = getSocket();
		const sid = useLiveChatStore.getState().sessionId;

		if (sid) {
			socket.emit('join_session', sid);
		}

		const handleUpdate = () => {
			fetchSessionState();
		};

		socket.on('new_message', handleUpdate);
		socket.on('status_updated', handleUpdate);

		// Initial fetch just in case
		fetchSessionState();

		return () => {
			socket.off('new_message', handleUpdate);
			socket.off('status_updated', handleUpdate);
		};
	}, [fetchSessionState]);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputText.trim()) return;

		setSending(true);
		const text = inputText;
		setInputText('');
		await sendMessage(text);
		setSending(false);
	};

	const formatTime = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	return (
		<div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 font-sans">
			{/* Chat Messages Area */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
				{/* Welcome Context Banner if previous sessions exist */}
				{sessionStatus === 'resolved' && (
					<div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-center shadow-sm animate-in fade-in duration-300">
						<p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
							This conversation has been marked as resolved.
						</p>
						<button
							onClick={() => setMode('ai')}
							className="mt-2.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1 mx-auto"
						>
							<ArrowLeftIcon className="w-3.5 h-3.5" />
							Return to AI Assistant
						</button>
					</div>
				)}

				{sessionStatus === 'waiting' && (
					<div className="p-3.5 bg-[#fef8e8] dark:bg-amber-950/10 border border-[#fbebc8] dark:border-amber-900/30 rounded-xl text-center shadow-sm animate-pulse flex flex-col items-center justify-center gap-2">
						<Loader2Icon className="w-4 h-4 text-amber-600 animate-spin" />
						<div>
							<p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
								Connecting you with a Live Support Expert...
							</p>
							<p className="text-[10px] text-amber-600 dark:text-amber-400/80 mt-0.5">
								An expert will join the chat shortly.
							</p>
						</div>
					</div>
				)}

				{/* Render Chat History */}
				{messages.map((msg) => {
					if (msg.sender === 'system') {
						return (
							<div
								key={msg.id}
								className="flex flex-col items-center justify-center my-3 mx-auto max-w-[85%] animate-in fade-in duration-200"
							>
								<div className="bg-[#fff3cd] dark:bg-zinc-900 text-[#856404] dark:text-zinc-300 px-4 py-3 rounded-2xl border border-[#ffeeba] dark:border-zinc-800 text-xs text-center leading-relaxed shadow-sm font-medium">
									{msg.text}
									<div className="text-[9px] text-[#856404]/70 dark:text-zinc-500 mt-1 font-normal">
										{formatTime(msg.timestamp)}
									</div>
								</div>
							</div>
						);
					}

					const isStudent = msg.sender === 'student';

					return (
						<div
							key={msg.id}
							className={`flex items-end gap-2 ${isStudent ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
						>
							{!isStudent && (
								<div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200/50 shrink-0">
									EX
								</div>
							)}

							<div className="flex flex-col max-w-[75%]">
								<div
									className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
										isStudent
											? 'bg-[#003859] text-white rounded-br-none'
											: 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 border border-slate-100 dark:border-zinc-800 rounded-bl-none'
									}`}
								>
									{msg.text}
								</div>
								<span
									className={`text-[9px] text-slate-400 dark:text-zinc-500 mt-1 px-1 ${
										isStudent ? 'text-right' : 'text-left'
									}`}
								>
									{isStudent ? 'You' : 'Expert'} • {formatTime(msg.timestamp)}
								</span>
							</div>

							{isStudent && (
								<div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 text-xs font-bold shrink-0">
									{studentName ? studentName.charAt(0).toUpperCase() : 'S'}
								</div>
							)}
						</div>
					);
				})}
				<div ref={messagesEndRef} />
			</div>

			{/* Message Composer Area */}
			{sessionStatus !== 'resolved' && (
				<div className="p-3 bg-slate-50 dark:bg-zinc-950">
					<form
						onSubmit={handleSend}
						className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-full p-1.5 flex items-center gap-2 transition-all focus-within:shadow-[0_4px_25px_rgba(0,56,89,0.12)] focus-within:ring-1 focus-within:ring-[#003859]/10"
					>
						<input
							type="text"
							value={inputText}
							onChange={(e) => setInputText(e.target.value)}
							placeholder="Type your reply..."
							className="flex-1 bg-transparent px-4 py-2 text-[13px] text-slate-800 dark:text-zinc-100 placeholder-slate-400 font-medium focus:outline-none"
						/>
						<button
							type="submit"
							disabled={sending || !inputText.trim()}
							className="w-9 h-9 rounded-full bg-gradient-to-r from-[#003859] to-sky-600 text-white flex items-center justify-center hover:shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shrink-0"
						>
							{sending ? (
								<Loader2Icon className="w-3.5 h-3.5 animate-spin" />
							) : (
								<ArrowUpIcon className="w-4 h-4" />
							)}
						</button>
					</form>
				</div>
			)}
		</div>
	);
};
