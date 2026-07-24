"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { 
	SearchIcon, Loader2Icon, SendIcon, CheckCircleIcon, 
	ArrowRightIcon, MessageSquareIcon, RefreshCwIcon, LogOutIcon, HeadsetIcon,
	PlusIcon, ArrowUpIcon, ImageIcon, DatabaseIcon, ShieldIcon, PowerIcon, UsersIcon
} from 'lucide-react';
import { ChatSession, ChatMessage } from '@/lib/live-chat-db';
import { getSocket } from '@/lib/socket';

interface DbStatus {
	connected: boolean;
	status: 'ready' | 'no_tables' | 'misconfigured' | 'error' | 'checking';
	message: string;
	latencyMs: number | null;
	checkedAt: string;
}

export default function AgentDashboard() {
	const router = useRouter();
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
	const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
	const [replyText, setReplyText] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [lastSyncTime, setLastSyncTime] = useState('');
	const [sending, setSending] = useState(false);
	const [agentEmail, setAgentEmail] = useState('agent@sona.com');
	const [agentRole, setAgentRole] = useState('agent');
	const [dbError, setDbError] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const res = await fetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					if (data.user.role !== 'expert' && data.user.role !== 'admin') {
						router.push('/login');
					}
					setAgentEmail(data.user.email);
					setAgentRole(data.user.role);
				} else {
					router.push('/login');
				}
			} catch (e) {
				router.push('/login');
			}
		};
		checkAuth();
	}, [router]);

	// Fetch sessions list from API
	const fetchSessions = async (selectFirst = false) => {
		try {
			const res = await fetch('/api/live-agent/list');
			if (!res.ok) throw new Error('DB connection failed');
			const list: ChatSession[] = await res.json();
			setSessions(list);
			setDbError(null);
			setLastSyncTime(new Date().toLocaleString());

			if (list.length > 0) {
				const isValid = selectedSessionId && list.some(s => s.id === selectedSessionId);
				if (!isValid && (selectFirst || !selectedSessionId)) {
					setSelectedSessionId(list[0].id);
				}
			} else {
				setSelectedSessionId(null);
				setActiveSession(null);
			}
		} catch (error) {
			console.error('Error fetching sessions list:', error);
			setDbError("Unable to connect to the database. Please check your connection.");
		}
	};

	// Real-time Socket.io updates for sessions
	useEffect(() => {
		fetchSessions(true);
		const socket = getSocket();
		socket.emit('join_admin');

		const handleUpdate = () => {
			fetchSessions();
		};

		socket.on('session_updated', handleUpdate);
		
		return () => {
			socket.off('session_updated', handleUpdate);
		};
	}, [selectedSessionId]);

	// Fetch selected session detail
	const fetchActiveSessionDetail = async () => {
		if (!selectedSessionId) {
			setActiveSession(null);
			return;
		}

		try {
			const res = await fetch(`/api/live-agent/messages?sessionId=${selectedSessionId}`);
			if (!res.ok) {
				if (res.status === 404) {
					setActiveSession(null);
					if (sessions.length > 0 && sessions[0].id !== selectedSessionId) {
						setSelectedSessionId(sessions[0].id);
					}
				}
				return;
			}
			const data = await res.json();

			// Find session details in general list to get metadata
			const meta = sessions.find(s => s.id === selectedSessionId);
			if (meta) {
				setActiveSession({
					...meta,
					messages: data.messages || [],
					status: data.status || 'waiting',
					assignedAgent: data.assignedAgent || null
				});
			} else {
				setActiveSession({
					id: selectedSessionId,
					userName: data.userName || selectedSessionId,
					userEmail: '',
					userPhone: '',
					status: data.status || 'waiting',
					assignedAgent: data.assignedAgent || null,
					messages: data.messages || [],
					createdAt: Date.now(),
					lastActive: Date.now()
				});
			}
		} catch (error) {
			// Silent error catch
		}
	};

	// Fetch initial messages and listen for updates via socket
	useEffect(() => {
		if (!selectedSessionId) return;
		
		fetchActiveSessionDetail();
		
		const socket = getSocket();
		// Also join the specific session room to get targeted messages
		socket.emit('join_session', selectedSessionId);

		const handleNewMessage = (data: any) => {
			if (data?.sessionId === selectedSessionId) {
				fetchActiveSessionDetail();
			}
		};

		socket.on('new_message', handleNewMessage);
		socket.on('status_updated', handleNewMessage);
		
		return () => {
			socket.off('new_message', handleNewMessage);
			socket.off('status_updated', handleNewMessage);
		};
	}, [selectedSessionId]);

	// Scroll to bottom of conversation window ONLY when new messages arrive
	const prevMsgLengthRef = useRef(0);
	useEffect(() => {
		const currentLength = activeSession?.messages?.length || 0;
		if (currentLength > prevMsgLengthRef.current) {
			messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
		}
		prevMsgLengthRef.current = currentLength;
	}, [activeSession?.messages?.length]);

	const handleSendReply = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedSessionId || !replyText.trim() || !activeSession) return;

		// Join chat automatically if not already assigned
		if (activeSession.assignedAgent !== agentEmail) {
			await handleAssign();
		}

		setSending(true);
		const text = replyText;
		setReplyText('');

		try {
			const res = await fetch('/api/live-agent/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: selectedSessionId,
					sender: 'agent',
					senderName: 'Agent agent',
					text
				})
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				console.warn("Failed to send message:", err.error || res.statusText);
				return;
			}
			await fetchActiveSessionDetail();
		} catch (error) {
			console.error("Error sending reply:", error);
		} finally {
			setSending(false);
		}
	};

	const handleAssign = async () => {
		if (!selectedSessionId) return;

		try {
			const res = await fetch('/api/live-agent/assign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: selectedSessionId,
					agentEmail
				})
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				console.warn("Failed to assign agent:", err.error || res.statusText);
				return;
			}
			fetchSessions();
		} catch (error) {
			console.error("Error assigning chat:", error);
		}
	};

	const handleMarkResolved = async () => {
		if (!selectedSessionId) return;

		try {
			const res = await fetch('/api/live-agent/status', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: selectedSessionId,
					status: 'resolved'
				})
			});

			if (!res.ok) throw new Error("Failed to resolve session");
			fetchSessions();
			setSelectedSessionId(null);
			setActiveSession(null);
		} catch (error) {
			console.error("Error resolving chat:", error);
		}
	};

	const handleLogout = () => signOut({ callbackUrl: '/login' });

	// Filters
	const filteredSessions = sessions.filter(s => {
		const query = searchQuery.toLowerCase();
		return (
			s.id.toLowerCase().includes(query) ||
			s.userName.toLowerCase().includes(query) ||
			s.userEmail.toLowerCase().includes(query) ||
			(s.messages && s.messages.some(m => m.text.toLowerCase().includes(query)))
		);
	});

	// Calculations for Metrics Cards
	const waitingQueueCount = sessions.filter(s => s.status === 'waiting').length;
	const activeQueueCount = sessions.filter(s => s.status === 'active').length;
	const totalQueueCount = waitingQueueCount + activeQueueCount;

	const formatMessageTime = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const formatSessionDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	};

	const getWaitTime = (session: ChatSession) => {
		const durationMs = Date.now() - session.createdAt;
		const minutes = Math.floor(durationMs / 60000);
		return `${minutes}m`;
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-950 dark:to-zinc-900 flex flex-col font-sans text-slate-800 dark:text-zinc-100">
			
			{/* DB Error Banner */}
			{dbError && (
				<div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-rose-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
					<DatabaseIcon className="w-5 h-5" />
					<span className="text-sm font-bold">{dbError}</span>
					<button onClick={() => setDbError(null)} className="ml-2 bg-rose-600 rounded-full p-1 hover:bg-rose-700">
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
					</button>
				</div>
			)}

			{/* Grid workspace */}
			<div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-[1920px] mx-auto w-full">
				
				{/* Left Sidebar Pane - Glassmorphism */}
				<aside className="w-full md:w-[380px] bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl border-r border-white/40 dark:border-zinc-800/50 flex flex-col shrink-0 overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
					
					{/* Sidebar Header */}
					<div className="px-6 py-7 flex flex-col gap-5 border-b border-slate-200/50 dark:border-zinc-800/50">
						<div className="flex items-start justify-between">
							<div>
								<div className="flex items-center gap-2 mb-1.5">
									<div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
									<span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-[0.2em]">
										Live Support Console
									</span>
								</div>
								<h2 className="text-2xl font-black text-[#003859] dark:text-zinc-100 tracking-tight leading-none">
									SCALE UWA
								</h2>
							</div>

							{/* Actions: Admin, Status, Logout */}
							<div className="flex items-center gap-2 shrink-0">
								<button
									onClick={() => router.push('/admin/dashboard')}
									className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700 rounded-full hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all shadow-sm hover:shadow-md cursor-pointer group"
									title="Admin panel"
								>
									<ShieldIcon className="w-4 h-4 group-hover:text-[#003859] dark:group-hover:text-sky-400 transition-colors" />
								</button>
								<button
									onClick={handleLogout}
									className="w-8 h-8 flex items-center justify-center text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all shadow-sm hover:shadow-md cursor-pointer"
									title="Sign out"
								>
									<PowerIcon className="w-4 h-4" />
								</button>
							</div>
						</div>

						{/* Metrics row */}
						<div className="grid grid-cols-2 gap-3 mt-2">
							{/* QUEUE CARD */}
							<div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border border-slate-200/60 dark:border-zinc-700/60 p-3.5 rounded-2xl text-left shadow-sm hover:shadow-md transition-shadow">
								<div className="flex items-center gap-2 mb-2">
									<UsersIcon className="w-3.5 h-3.5 text-sky-500" />
									<div className="text-[9px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
										Active Queue
									</div>
								</div>
								<div className="text-2xl font-black text-slate-800 dark:text-zinc-100 leading-none">
									{totalQueueCount}
								</div>
							</div>
						</div>

						{/* Search box */}
						<div className="relative mt-2">
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search conversations..."
								className="w-full bg-white/70 dark:bg-zinc-800/70 border border-slate-200/60 dark:border-zinc-700/60 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003859]/20 focus:border-[#003859] dark:focus:ring-sky-500/20 dark:focus:border-sky-500 transition-all shadow-sm"
							/>
							<SearchIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
						</div>
					</div>

					{/* Chat Sessions list scroll */}
					<div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-700">
						{filteredSessions.length === 0 ? (
							<div className="flex flex-col items-center justify-center p-8 text-center mt-10 opacity-60">
								<MessageSquareIcon className="w-10 h-10 text-slate-300 dark:text-zinc-600 mb-3" />
								<p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">No active conversations</p>
							</div>
						) : (
							filteredSessions.map((session) => {
								const isSelected = session.id === selectedSessionId;
								const lastMessage = session.messages && session.messages.length > 0
									? session.messages[session.messages.length - 1].text
									: "No messages yet.";

								return (
									<button
										key={session.id}
										onClick={() => setSelectedSessionId(session.id)}
										className={`w-full text-left p-4 rounded-2xl transition-all duration-200 flex flex-col gap-2 cursor-pointer relative group ${
											isSelected 
												? 'bg-white dark:bg-zinc-800 shadow-md border border-slate-200/80 dark:border-zinc-700 ring-1 ring-[#003859]/10 dark:ring-sky-500/20 translate-x-1' 
												: 'bg-transparent border border-transparent hover:bg-white/50 dark:hover:bg-zinc-800/40 hover:border-slate-200/40 dark:hover:border-zinc-700/50'
										}`}
									>
										<div className="flex items-center justify-between">
											<span className={`text-[13px] font-bold ${isSelected ? 'text-[#003859] dark:text-sky-400' : 'text-slate-700 dark:text-zinc-300'}`}>
												{session.userName || session.id.substring(0,8)}
											</span>

											{/* Status badge */}
											<span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm ${
												session.status === 'waiting'
													? 'bg-amber-100 text-amber-700 border border-amber-200/60 dark:bg-amber-900/30 dark:text-amber-400'
													: session.status === 'active'
														? 'bg-emerald-100 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-400'
														: 'bg-slate-100 text-slate-500 border border-slate-200/60 dark:bg-zinc-800 dark:text-zinc-400'
											}`}>
												{session.status}
											</span>
										</div>

										<p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 leading-relaxed">
											{lastMessage}
										</p>

										<div className="flex items-center justify-between text-[9px] font-medium text-slate-400 dark:text-zinc-500 pt-1 mt-1 border-t border-slate-100 dark:border-zinc-800/50">
											<span>{formatSessionDate(session.createdAt)}</span>
											<span className="flex items-center gap-1">
												Wait: {getWaitTime(session)}
											</span>
										</div>
									</button>
								);
							})
						)}
					</div>
					
					<div className="p-4 border-t border-slate-200/50 dark:border-zinc-800/50 text-[10px] text-slate-400 text-center flex flex-col gap-2">
						<div className="flex justify-between items-center">
							<span>v2.0 • {lastSyncTime ? `Last sync: ${lastSyncTime.split(',')[1]}` : 'Syncing...'}</span>
							<button onClick={() => fetchSessions(false)} className="hover:text-[#003859] transition-colors flex items-center gap-1">
								<RefreshCwIcon className="w-3 h-3" /> Refresh
							</button>
						</div>
						<a href="/api/live-agent/report" download className="hover:text-[#003859] transition-colors flex items-center gap-1 justify-center">
							Export CSV <ArrowRightIcon className="w-3 h-3" />
						</a>
					</div>
				</aside>

				{/* Right Conversational Window */}
				<main className="flex-1 bg-white/40 dark:bg-zinc-950/40 flex flex-col relative">
					{activeSession ? (
						<div className="flex-1 flex flex-col h-full absolute inset-0">
							{/* Selected Session Header */}
							<div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-zinc-800/50 px-8 py-5 flex items-center justify-between shrink-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
								<div className="flex items-center gap-4">
									<div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#003859] to-sky-600 text-white flex items-center justify-center text-lg font-black shadow-lg shadow-sky-900/20 border-2 border-white dark:border-zinc-800">
										{activeSession.userName ? activeSession.userName.charAt(0).toUpperCase() : 'S'}
									</div>
									<div>
										<h2 className="text-lg font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
											{activeSession.userName || activeSession.id}
											{activeSession.status === 'active' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
										</h2>
										<div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-3">
											<span className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-zinc-300">
												<ShieldIcon className="w-3 h-3" /> {activeSession.assignedAgent || 'Unassigned'}
											</span>
											<span>Wait time: {getWaitTime(activeSession)}</span>
										</div>
									</div>
								</div>

								{/* Header controls: Mark Resolved */}
								<div className="flex items-center gap-3">
									<button
										onClick={handleMarkResolved}
										className="bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white px-5 py-2.5 rounded-full text-[11px] font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
									>
										<CheckCircleIcon className="w-4 h-4" />
										Mark Resolved
									</button>
								</div>
							</div>

							{/* Chat Messages */}
							<div className="flex-1 overflow-y-auto p-6 relative z-10 flex flex-col gap-2 pb-28">
								{activeSession.messages && activeSession.messages.length > 0 ? (
									activeSession.messages.map((msg, idx) => {
										const isAgent = msg.sender === 'agent';
										const isSystem = msg.sender === 'system';
										const showAvatar = idx === 0 || activeSession.messages[idx - 1].sender !== msg.sender;

										if (isSystem) {
											return (
												<div key={msg.id} className="flex flex-col items-center justify-center my-6">
													<div className="bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-sm text-slate-500 dark:text-zinc-400 px-5 py-2 border border-slate-200/50 dark:border-zinc-700/50 rounded-full text-[10px] font-medium shadow-sm">
														{msg.text} • {formatMessageTime(msg.timestamp)}
													</div>
												</div>
											);
										}

										return (
											<div
												key={msg.id}
												className={`flex items-end gap-3 ${isAgent ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
											>
												{!isAgent && (
													<div className={`w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center text-xs font-bold border border-white dark:border-zinc-700 shadow-sm shrink-0 ${!showAvatar && 'opacity-0'}`}>
														{activeSession.userName ? activeSession.userName.charAt(0).toUpperCase() : 'S'}
													</div>
												)}

												<div className={`flex flex-col max-w-[65%] ${isAgent ? 'items-end' : 'items-start'}`}>
													{showAvatar && (
														<span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 mb-1 ml-1">
															{isAgent ? 'You' : msg.senderName}
														</span>
													)}
													<div
														className={`px-5 py-3.5 text-[13px] leading-relaxed shadow-sm relative ${
															isAgent
																? 'bg-gradient-to-br from-[#003859] to-[#002b45] dark:from-sky-600 dark:to-sky-800 text-white rounded-3xl rounded-br-sm'
																: 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-100 dark:border-zinc-700 rounded-3xl rounded-bl-sm'
														}`}
													>
														{msg.text}
													</div>
													<span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-1.5 px-1 font-medium">
														{formatMessageTime(msg.timestamp)}
													</span>
												</div>

												{isAgent && (
													<div className={`w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 dark:from-sky-900 dark:to-indigo-900 text-sky-700 dark:text-sky-300 flex items-center justify-center text-[10px] font-bold border border-white dark:border-zinc-800 shadow-sm shrink-0 ${!showAvatar && 'opacity-0'}`}>
														AG
													</div>
												)}
											</div>
										);
									})
								) : (
									<div className="flex flex-col items-center justify-center h-full opacity-50">
										<MessageSquareIcon className="w-16 h-16 text-slate-300 dark:text-zinc-600 mb-4" />
										<p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Waiting for user response...</p>
									</div>
								)}
								<div ref={messagesEndRef} className="h-4" />
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
						</div>
					) : (
						<div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-5 animate-in fade-in duration-500">
							<div className="w-24 h-24 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center border border-slate-200/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
								<UsersIcon className="w-10 h-10 text-slate-300 dark:text-zinc-600" />
							</div>
							<div>
								<h3 className="text-xl font-black text-slate-700 dark:text-zinc-200 tracking-tight">
									Select a Conversation
								</h3>
								<p className="text-sm text-slate-400 dark:text-zinc-500 mt-2 max-w-sm mx-auto leading-relaxed">
									Choose a student session from the left sidebar to start responding to live support inquiries and assist in real-time.
								</p>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
