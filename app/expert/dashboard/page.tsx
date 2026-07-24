"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { 
	SearchIcon, Loader2Icon, SendIcon, CheckCircleIcon, 
	DatabaseIcon, LogOutIcon, MessageSquareIcon, HeadsetIcon,
	PlusIcon, ArrowUpIcon, ImageIcon
} from 'lucide-react';
import { ChatSession, ChatMessage } from '@/lib/live-chat-db';
import { getSocket } from '@/lib/socket';

export default function ExpertDashboard() {
	const router = useRouter();
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
	const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
	const [replyText, setReplyText] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [sending, setSending] = useState(false);
	const [expertEmail, setExpertEmail] = useState('expert@sona.com');
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [dbError, setDbError] = useState<string | null>(null);

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const res = await fetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					if (data.user.role !== 'expert' && data.user.role !== 'admin') {
						router.push('/login');
					}
					setExpertEmail(data.user.email);
				} else {
					router.push('/login');
				}
			} catch (e) {
				router.push('/login');
			}
		};
		checkAuth();
	}, [router]);

	const fetchSessions = async (selectFirst = false) => {
		try {
			const res = await fetch('/api/live-agent/list');
			if (!res.ok) throw new Error('Database connection failed');
			const list: ChatSession[] = await res.json();
			setSessions(list);
			setDbError(null);
			if (selectFirst && list.length > 0 && !selectedSessionId) {
				setSelectedSessionId(list[0].id);
			}
		} catch (error) {
			console.error('Error fetching sessions list:', error);
			setDbError("Unable to connect to the database. Please check your connection.");
		}
	};

	useEffect(() => {
		fetchSessions(true);
		const socket = getSocket();
		socket.emit('join_admin');
		const handleUpdate = () => fetchSessions();
		socket.on('session_updated', handleUpdate);
		return () => { socket.off('session_updated', handleUpdate); };
	}, [selectedSessionId]);

	const fetchActiveSessionDetail = async () => {
		if (!selectedSessionId) {
			setActiveSession(null);
			return;
		}
		try {
			const res = await fetch(`/api/live-agent/messages?sessionId=${selectedSessionId}`);
			if (!res.ok) throw new Error('Failed to fetch session messages');
			const data = await res.json();
			const meta = sessions.find(s => s.id === selectedSessionId);
			if (meta) {
				setActiveSession({ ...meta, messages: data.messages, status: data.status, assignedAgent: data.assignedAgent });
			} else {
				setActiveSession({
					id: selectedSessionId,
					userName: data.userName || selectedSessionId,
					userEmail: '',
					userPhone: '',
					status: data.status,
					assignedAgent: data.assignedAgent,
					messages: data.messages,
					createdAt: Date.now(),
					lastActive: Date.now(),
				});
			}
		} catch (error) {
			console.error('Error loading active session details:', error);
		}
	};

	useEffect(() => {
		if (!selectedSessionId) return;
		fetchActiveSessionDetail();
		const socket = getSocket();
		socket.emit('join_session', selectedSessionId);
		const handleNewMessage = (data: any) => {
			if (data?.sessionId === selectedSessionId) fetchActiveSessionDetail();
		};
		socket.on('new_message', handleNewMessage);
		socket.on('status_updated', handleNewMessage);
		return () => {
			socket.off('new_message', handleNewMessage);
			socket.off('status_updated', handleNewMessage);
		};
	}, [selectedSessionId]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [activeSession?.messages]);

	const handleSendReply = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedSessionId || !replyText.trim() || !activeSession) return;
		if (activeSession.assignedAgent !== expertEmail) await handleAssign();
		setSending(true);
		const text = replyText;
		setReplyText('');
		try {
			await fetch('/api/live-agent/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId: selectedSessionId, sender: 'agent', senderName: 'Expert', text }),
			});
			await fetchActiveSessionDetail();
		} catch (error) {
			console.error('Error sending reply:', error);
		} finally {
			setSending(false);
		}
	};

	const handleAssign = async () => {
		if (!selectedSessionId) return;
		await fetch('/api/live-agent/assign', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionId: selectedSessionId, agentEmail: expertEmail }),
		});
		fetchSessions();
	};

	const handleMarkResolved = async () => {
		if (!selectedSessionId) return;
		await fetch('/api/live-agent/status', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionId: selectedSessionId, status: 'resolved' }),
		});
		fetchSessions();
		setSelectedSessionId(null);
		setActiveSession(null);
	};

	const handleLogout = () => signOut({ callbackUrl: '/login' });

	const filteredSessions = sessions.filter(s => {
		const q = searchQuery.toLowerCase();
		return s.id.toLowerCase().includes(q) || s.userName.toLowerCase().includes(q) || s.userEmail.toLowerCase().includes(q);
	});

	const formatTime = (ts: number) => {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
	};

	return (
		<div className="h-screen w-full flex flex-col font-sans bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800 overflow-hidden">
			
			{/* DB Error Toast */}
			{dbError && (
				<div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-2xl shadow-xl backdrop-blur-md text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 bg-rose-600/90 text-white">
					<DatabaseIcon className="w-4 h-4 shrink-0" />
					{dbError}
					<button onClick={() => setDbError(null)} className="ml-2 bg-rose-700/50 hover:bg-rose-700 p-1.5 rounded-full transition-colors">
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
					</button>
				</div>
			)}

			{/* Global Header (Matching Admin Dashboard) */}
			<header className="bg-white/70 backdrop-blur-2xl border-b border-white/40 px-8 py-5 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
				<div className="flex items-center gap-4">
					<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003859] to-sky-600 text-white flex items-center justify-center shadow-lg shadow-[#003859]/20 border border-white/20">
						<HeadsetIcon className="w-5 h-5" />
					</div>
					<div>
						<h1 className="text-lg font-black tracking-tight text-[#003859]">Expert Dashboard</h1>
						<p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">SCALE UWA • Live Support</p>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-3 mr-4 border-r border-slate-200/60 pr-8 py-1">
						<div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shadow-sm border border-white">
							{expertEmail.charAt(0).toUpperCase()}
						</div>
						<div className="flex flex-col">
							<span className="text-sm font-bold text-slate-700 line-clamp-1 max-w-[150px]">{expertEmail}</span>
							<span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Online</span>
						</div>
					</div>
					<button
						onClick={handleLogout}
						className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-full transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
					>
						<LogOutIcon className="w-3.5 h-3.5" /> Logout
					</button>
				</div>
			</header>

			{/* Main Workspace */}
			<div className="flex-1 p-4 md:p-8 overflow-hidden flex flex-col max-w-[1920px] mx-auto w-full">
				
				{/* The Premium Glassmorphism Container */}
				<div className="flex-1 w-full bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden flex flex-col md:flex-row">
					
					{/* LEFT PANE (Chat List) */}
					<aside className="w-full md:w-[320px] lg:w-[380px] flex flex-col bg-slate-50/50 border-r border-slate-200/60 shrink-0">
						
						{/* Search Bar */}
						<div className="p-5 border-b border-slate-200/60 shrink-0">
							<div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl h-11 flex items-center px-4 gap-3 border border-slate-200/60 shadow-sm focus-within:ring-2 focus-within:ring-[#003859]/20 focus-within:border-[#003859] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]">
								<SearchIcon className="w-4 h-4 text-slate-400" />
								<input 
									type="text" 
									value={searchQuery}
									onChange={e => setSearchQuery(e.target.value)}
									placeholder="Search student chats..." 
									className="flex-1 bg-transparent border-none focus:outline-none text-[13px] text-slate-800 placeholder-slate-400 w-full font-medium"
								/>
							</div>
						</div>

						{/* Conversations List */}
						<div className="flex-1 overflow-y-auto bg-transparent p-3 flex flex-col gap-2">
							{filteredSessions.length === 0 ? (
								<div className="text-center text-sm font-medium text-slate-400 p-8 mt-4">No active chats found.</div>
							) : filteredSessions.map(session => {
								const isSelected = session.id === selectedSessionId;
								const lastMsg = session.messages?.length ? session.messages[session.messages.length - 1] : null;
								const lastMessageText = lastMsg ? lastMsg.text : 'New connection...';
								const time = lastMsg ? formatTime(lastMsg.timestamp) : formatTime(session.createdAt);
								const isWaiting = session.status === 'waiting';

								return (
									<button
										key={session.id}
										onClick={() => setSelectedSessionId(session.id)}
										className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-center gap-4 cursor-pointer group ${
											isSelected 
												? 'bg-white shadow-sm border border-slate-200/60 ring-1 ring-slate-200/50' 
												: 'hover:bg-white/60 bg-transparent border border-transparent'
										}`}
									>
										{/* Avatar */}
										<div className="relative shrink-0">
											<div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border ${
												isSelected 
													? 'bg-gradient-to-br from-[#003859] to-sky-600 text-white shadow-md shadow-[#003859]/20 border-white/20' 
													: 'bg-white text-slate-600 border-slate-200/60'
											}`}>
												{(session.userName || 'S').charAt(0).toUpperCase()}
											</div>
											<div className={`absolute -bottom-1 -right-1 w-4 h-4 border-[3px] border-white rounded-full ${session.status === 'active' ? 'bg-emerald-500' : session.status === 'waiting' ? 'bg-amber-400' : 'bg-slate-300'}`}></div>
										</div>

										{/* Content */}
										<div className="flex-1 min-w-0 flex flex-col gap-1">
											<div className="flex items-center justify-between">
												<span className="text-[14px] font-black tracking-tight text-slate-900 truncate">{session.userName || session.id}</span>
												<span className={`text-[10px] font-bold tracking-wider shrink-0 ml-2 ${isSelected ? 'text-[#003859]' : 'text-slate-400'}`}>{time}</span>
											</div>
											<div className="flex items-center justify-between gap-2">
												<p className={`text-[12px] truncate ${isSelected ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
													{lastMessageText}
												</p>
												{isWaiting && (
													<span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">1</span>
												)}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</aside>

					{/* RIGHT PANE (Chat Area) */}
					<main className="flex-1 flex flex-col relative bg-white/40 overflow-hidden">
						{activeSession ? (
							<>
								{/* Right Header */}
								<header className="px-8 py-5 bg-white/60 backdrop-blur-sm flex items-center justify-between shrink-0 relative z-20 border-b border-slate-200/60">
									<div className="flex items-center gap-4">
										<div className="w-12 h-12 rounded-xl bg-white border border-slate-200/60 text-slate-700 flex items-center justify-center font-bold text-lg shadow-sm">
											{(activeSession.userName || 'S').charAt(0).toUpperCase()}
										</div>
										<div className="flex flex-col">
											<span className="text-[15px] font-black tracking-tight text-slate-900">{activeSession.userName || activeSession.id}</span>
											<span className="text-[12px] font-bold text-slate-500 flex items-center gap-1.5 mt-0.5">
												<span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active Student
											</span>
										</div>
									</div>
									
									<div className="flex items-center gap-4">
										{activeSession.status !== 'resolved' && (
											<button 
												onClick={handleMarkResolved} 
												className="px-5 py-2.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-emerald-100 transition-all border border-emerald-200 shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0"
												title="Resolve Chat"
											>
												<CheckCircleIcon className="w-4 h-4 text-emerald-500" /> Resolve Session
											</button>
										)}
									</div>
								</header>

								{/* Chat History */}
								<div className="flex-1 overflow-y-auto px-6 md:px-10 py-8 relative z-10 flex flex-col gap-3 pb-28">
									<div className="flex justify-center my-4 sticky top-0 z-20">
										<span className="bg-white/80 backdrop-blur-md text-slate-500 text-[10px] px-4 py-1.5 rounded-full shadow-sm font-bold uppercase tracking-widest border border-slate-200/60">
											Today
										</span>
									</div>

									{activeSession.messages?.length ? activeSession.messages.map((msg: ChatMessage, index: number) => {
										if (msg.sender === 'system') {
											return (
												<div key={msg.id} className="flex justify-center my-4">
													<div className="bg-slate-100 text-slate-500 px-5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-sm border border-slate-200/60">
														{msg.text}
													</div>
												</div>
											);
										}
										
										const isAgent = msg.sender === 'agent';
										const showTail = index === 0 || activeSession.messages[index - 1]?.sender !== msg.sender;
										
										return (
											<div key={msg.id} className={`flex w-full ${isAgent ? 'justify-end' : 'justify-start'} ${showTail ? 'mt-4' : 'mt-1'}`}>
												<div className={`relative max-w-[80%] md:max-w-[70%] px-5 py-3.5 text-[14px] leading-relaxed shadow-sm flex flex-col gap-1.5 ${
													isAgent 
														? 'bg-gradient-to-br from-[#003859] to-sky-700 text-white rounded-2xl ' + (showTail ? 'rounded-tr-sm' : '')
														: 'bg-white text-slate-800 rounded-2xl border border-slate-200/60 ' + (showTail ? 'rounded-tl-sm' : '')
												}`}>
													<span className="font-medium">{msg.text}</span>
													<div className={`flex items-center gap-1.5 self-end text-[10px] font-bold uppercase tracking-wider ${isAgent ? 'text-sky-200' : 'text-slate-400'}`}>
														{formatTime(msg.timestamp)}
													</div>
												</div>
											</div>
										);
									}) : (
										<div className="text-center text-sm font-bold text-slate-400 py-12">No messages in this chat yet.</div>
									)}
									<div ref={messagesEndRef} />
								</div>

								{/* Floating Chat Composer */}
								{activeSession.status !== 'resolved' ? (
									<div className="absolute bottom-6 left-6 right-6 z-30">
										<form 
											onSubmit={handleSendReply} 
											className="bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-full p-2 flex items-center gap-3 max-w-4xl mx-auto transition-all focus-within:shadow-[0_8px_40px_rgba(0,56,89,0.12)] focus-within:ring-1 focus-within:ring-[#003859]/10"
										>
											<input 
												type="text" 
												value={replyText}
												onChange={e => setReplyText(e.target.value)}
												placeholder="Type your reply..." 
												className="flex-1 bg-transparent px-5 py-3 text-[14px] text-slate-800 placeholder-slate-400 font-medium focus:outline-none"
											/>
											<button 
												type="submit" 
												disabled={sending || !replyText.trim()}
												className="w-11 h-11 rounded-full bg-gradient-to-r from-[#003859] to-sky-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shrink-0"
											>
												{sending ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <ArrowUpIcon className="w-5 h-5" />}
											</button>
										</form>
									</div>
								) : (
									<div className="absolute bottom-6 left-6 right-6 z-30 max-w-4xl mx-auto">
										<div className="p-4 bg-[#202022]/90 backdrop-blur-md border border-white/5 rounded-full text-center text-xs text-zinc-400 font-bold shadow-lg uppercase tracking-widest">
											This conversation has been resolved.
										</div>
									</div>
								)}
							</>
						) : (
							/* Modern Empty State */
							<div className="flex-1 flex flex-col items-center justify-center relative z-10">
								<div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl shadow-[#003859]/5 flex items-center justify-center mb-8 border border-slate-100 rotate-6 hover:rotate-0 transition-transform duration-500">
									<MessageSquareIcon className="w-10 h-10 text-[#003859]" />
								</div>
								<h1 className="text-2xl font-black text-[#003859] tracking-tight">Expert Support Area</h1>
								<p className="text-slate-500 text-[13px] mt-3 text-center max-w-xs font-medium leading-relaxed">
									Your secure portal for student communication. Select a conversation to begin assisting.
								</p>
							</div>
						)}
					</main>
				</div>
			</div>
		</div>
	);
}
