"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
	DownloadIcon,
	Trash2Icon,
	RefreshCwIcon,
	UsersIcon,
	CheckCircleIcon,
	ClockIcon,
	BarChart3Icon,
	DatabaseIcon,
	ShieldIcon,
	AlertCircleIcon,
	ChevronDownIcon,
	MailIcon,
	SaveIcon,
	SendIcon,
	EyeIcon,
	EyeOffIcon,
	PowerIcon,
	SearchIcon,
} from 'lucide-react';
import { ChatSession } from '@/lib/live-chat-db';

interface DbStatus {
	connected: boolean;
	status: 'ready' | 'no_tables' | 'misconfigured' | 'error' | 'checking';
	message: string;
	latencyMs: number | null;
	checkedAt: string;
}

interface EmailConfig {
	provider: 'brevo' | 'resend';
	smtpHost: string;
	smtpPort: string;
	smtpUser: string;
	smtpPass: string;
	fromName: string;
	leadEmailTo: string;
	waitlistEmailTo: string;
	subjectPrefix: string;
}

type FilterType = 'all' | 'waiting' | 'active' | 'resolved';
type ActiveTab = 'sessions' | 'email' | 'users';

export interface User {
	_id: string;
	name: string;
	email: string;
	role: 'admin' | 'expert' | 'pending';
	authProvider: 'credentials' | 'azure-ad';
	createdAt: string;
}

export default function AdminPanel() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<ActiveTab>('sessions');

	// ── Sessions state ──────────────────────────────────────────
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [filter, setFilter] = useState<FilterType>('all');
	const [deleting, setDeleting] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState(false);

	// ── Users state ─────────────────────────────────────────────
	const [users, setUsers] = useState<User[]>([]);
	const [usersLoading, setUsersLoading] = useState(false);
	const [approving, setApproving] = useState<string | null>(null);
	const [deletingUser, setDeletingUser] = useState<string | null>(null);

	// ── Email config state ───────────────────────────────────────
	const [emailConfig, setEmailConfig] = useState<EmailConfig>({
		provider: 'brevo',
		smtpHost: 'smtp.gmail.com',
		smtpPort: '465',
		smtpUser: '',
		smtpPass: '',
		fromName: 'SCALE UWA Assistant',
		leadEmailTo: '',
		waitlistEmailTo: '',
		subjectPrefix: 'New User Lead',
	});
	const [emailSaving, setEmailSaving] = useState(false);
	const [emailTesting, setEmailTesting] = useState(false);
	const [showPass, setShowPass] = useState(false);

	// ── Shared state ─────────────────────────────────────────────
	const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
	const [agentRole, setAgentRole] = useState('expert');
	const [dbStatus, setDbStatus] = useState<DbStatus>({
		connected: false,
		status: 'checking',
		message: 'Checking connection…',
		latencyMs: null,
		checkedAt: '',
	});

	// Auth guard — now handled by middleware, but we fetch user data here
	useEffect(() => {
		const checkAuth = async () => {
			try {
				const res = await fetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					setAgentRole(data.user.role);
				}
			} catch (e) {
				// Ignore, middleware handles redirects
			}
		};
		checkAuth();
	}, [router]);

	const showToast = (type: 'success' | 'error', message: string) => {
		setToast({ type, message });
		setTimeout(() => setToast(null), 3500);
	};

	const fetchDbStatus = useCallback(async () => {
		try {
			const res = await fetch('/api/db-status');
			if (!res.ok) throw new Error();
			setDbStatus(await res.json());
		} catch {
			setDbStatus(prev => ({ ...prev, connected: false, status: 'error', message: 'Could not reach status endpoint.', checkedAt: new Date().toISOString() }));
		}
	}, []);

	const fetchSessions = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/live-agent/list');
			if (!res.ok) throw new Error();
			setSessions(await res.json());
		} catch {
			showToast('error', 'Failed to load sessions from server.');
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchEmailConfig = useCallback(async () => {
		try {
			const res = await fetch('/api/admin/email-config');
			if (!res.ok) throw new Error();
			setEmailConfig(await res.json());
		} catch {
			showToast('error', 'Failed to load email config.');
		}
	}, []);

	const fetchUsers = useCallback(async () => {
		setUsersLoading(true);
		try {
			const res = await fetch('/api/admin/users');
			if (!res.ok) throw new Error();
			setUsers(await res.json());
		} catch {
			showToast('error', 'Failed to load users.');
		} finally {
			setUsersLoading(false);
		}
	}, []);

	const handleApprove = async (userId: string, role: 'admin' | 'expert') => {
		setApproving(userId);
		try {
			const res = await fetch('/api/admin/users/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, role }),
			});
			if (!res.ok) throw new Error();
			showToast('success', `User approved as ${role}!`);
			fetchUsers();
		} catch {
			showToast('error', 'Failed to approve user.');
		} finally {
			setApproving(null);
		}
	};

	const handleDeleteUser = async (userId: string) => {
		if (!confirm("Are you sure you want to permanently delete this user?")) return;
		setDeletingUser(userId);
		try {
			const res = await fetch('/api/admin/users/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId }),
			});
			if (!res.ok) throw new Error();
			showToast('success', 'User deleted successfully.');
			fetchUsers();
		} catch {
			showToast('error', 'Failed to delete user.');
		} finally {
			setDeletingUser(null);
		}
	};

	useEffect(() => {
		fetchSessions();
		fetchDbStatus();
		fetchEmailConfig();
		fetchUsers();
	}, [fetchSessions, fetchDbStatus, fetchEmailConfig, fetchUsers]);

	// Stats
	const totalSessions = sessions.length;
	const waitingCount = sessions.filter(s => s.status === 'waiting').length;
	const activeCount = sessions.filter(s => s.status === 'active').length;
	const resolvedCount = sessions.filter(s => s.status === 'resolved').length;
	const filteredSessions = sessions.filter(s => filter === 'all' || s.status === filter);

	const toggleSelect = (id: string) => {
		setSelectedIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};
	const toggleSelectAll = () => {
		if (selectedIds.size === filteredSessions.length) setSelectedIds(new Set());
		else setSelectedIds(new Set(filteredSessions.map(s => s.id)));
	};

	const handleDelete = async () => {
		if (selectedIds.size === 0) return;
		setDeleting(true);
		try {
			const res = await fetch('/api/live-agent/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionIds: Array.from(selectedIds) }),
			});
			if (!res.ok) throw new Error();
			const { deleted } = await res.json();
			showToast('success', `${deleted} session${deleted !== 1 ? 's' : ''} deleted.`);
			setSelectedIds(new Set());
			setDeleteConfirm(false);
			fetchSessions();
		} catch {
			showToast('error', 'Failed to delete sessions.');
		} finally {
			setDeleting(false);
		}
	};

	const handleSaveEmailConfig = async () => {
		setEmailSaving(true);
		try {
			const res = await fetch('/api/admin/email-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(emailConfig),
			});
			if (!res.ok) throw new Error();
			showToast('success', 'Email settings saved successfully.');
			fetchEmailConfig(); // reload to get masked password
		} catch {
			showToast('error', 'Failed to save email settings.');
		} finally {
			setEmailSaving(false);
		}
	};

	const handleTestEmail = async () => {
		setEmailTesting(true);
		try {
			const res = await fetch('/api/send-details', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'System Admin', email: emailConfig.smtpUser, phone: '+919988776655' }),
			});
			if (!res.ok) throw new Error();
			showToast('success', `Test email sent to ${emailConfig.leadEmailTo}`);
		} catch {
			showToast('error', 'Test email failed. Check SMTP credentials.');
		} finally {
			setEmailTesting(false);
		}
	};

	const formatDate = (ts: number) => new Date(ts).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	const statusColors: Record<string, string> = {
		waiting: 'bg-amber-100/80 text-amber-800 border border-amber-200/60 dark:bg-amber-900/30 dark:text-amber-400',
		active: 'bg-emerald-100/80 text-emerald-800 border border-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-400',
		resolved: 'bg-slate-100 text-slate-600 border border-slate-200/60 dark:bg-zinc-800 dark:text-zinc-400',
	};

	const inputCls = "w-full bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm border border-slate-200/60 dark:border-zinc-700/60 rounded-xl px-4 py-3 text-[13px] text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003859]/20 focus:border-[#003859] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]";
	const labelCls = "block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1";

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-950 dark:to-zinc-900 font-sans text-slate-800 dark:text-zinc-100 flex flex-col">

			{/* Toast */}
			{toast && (
				<div className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-xl backdrop-blur-md text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${toast.type === 'success' ? 'bg-emerald-600/90 text-white' : 'bg-rose-600/90 text-white'}`}>
					{toast.type === 'success' ? <CheckCircleIcon className="w-4 h-4 shrink-0" /> : <AlertCircleIcon className="w-4 h-4 shrink-0" />}
					{toast.message}
				</div>
			)}

			{/* Delete Modal */}
			{deleteConfirm && (
				<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-sm w-full border border-white/20 dark:border-zinc-700/50 scale-in-center">
						<div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-5 border border-rose-200/50">
							<Trash2Icon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
						</div>
						<h3 className="text-lg font-black text-center text-slate-800 dark:text-zinc-100">Delete {selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''}?</h3>
						<p className="text-[13px] text-center text-slate-500 dark:text-zinc-400 mt-2 mb-6 leading-relaxed">This action is permanent and cannot be undone.</p>
						<div className="flex gap-3">
							<button onClick={() => setDeleteConfirm(false)} className="flex-1 py-3 text-xs font-bold border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer">Cancel</button>
							<button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
								{deleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Trash2Icon className="w-4 h-4" /> Delete</>}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Header */}
			<header className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl border-b border-white/40 dark:border-zinc-800/50 px-8 py-5 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
				<div className="flex items-center gap-4">
					<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003859] to-sky-600 text-white flex items-center justify-center shadow-lg shadow-[#003859]/20 border border-white/20">
						<ShieldIcon className="w-5 h-5" />
					</div>
					<div>
						<h1 className="text-lg font-black tracking-tight text-[#003859] dark:text-zinc-100">Admin Dashboard</h1>
						<p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mt-0.5">SCALE UWA • System Settings</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<button onClick={() => { fetchSessions(); fetchDbStatus(); }} className="flex items-center justify-center w-9 h-9 text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700 rounded-full hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all shadow-sm hover:shadow-md cursor-pointer group" title="Refresh Data">
						<RefreshCwIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
					</button>
					<a href="/api/live-agent/report" download className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#003859] to-sky-700 hover:from-[#002b45] hover:to-sky-800 rounded-full transition-all cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">
						<DownloadIcon className="w-3.5 h-3.5" /> Export CSV
					</a>
					<button
						onClick={async () => { 
							await fetch('/api/auth/logout', { method: 'POST' }); 
							router.push('/login'); 
						}}
						className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-full transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
					>
						<PowerIcon className="w-3.5 h-3.5" /> Logout
					</button>
				</div>
			</header>

			<div className="flex-1 p-8 space-y-6 max-w-[1920px] mx-auto w-full">

				{/* Stats Cards */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-5">
					{[
						{ label: 'Total Sessions', value: totalSessions, icon: BarChart3Icon, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-white/80 dark:bg-zinc-800/80' },
						{ label: 'Waiting', value: waitingCount, icon: ClockIcon, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/80 dark:bg-amber-950/40' },
						{ label: 'Active', value: activeCount, icon: UsersIcon, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/80 dark:bg-emerald-950/40' },
						{ label: 'Resolved', value: resolvedCount, icon: CheckCircleIcon, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50/80 dark:bg-sky-950/40' },
					].map(({ label, value, icon: Icon, color, bg }) => (
						<div key={label} className={`${bg} backdrop-blur-xl rounded-3xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-700/50 hover:shadow-lg transition-all hover:-translate-y-1`}>
							<div className="flex items-start justify-between">
								<div>
									<p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">{label}</p>
									<p className={`text-4xl font-black mt-2 tracking-tight ${color}`}>{value}</p>
								</div>
								<div className={`p-2.5 rounded-2xl bg-white/60 dark:bg-zinc-800/60 shadow-sm border border-white/20 dark:border-zinc-700/30`}>
									<Icon className={`w-6 h-6 ${color}`} />
								</div>
							</div>
						</div>
					))}
				</div>

				{/* DB Status */}
				<div className={`backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-white/40 flex items-center justify-between gap-4 transition-colors ${
					dbStatus.status === 'checking' ? 'bg-white/60 dark:bg-zinc-800/60 dark:border-zinc-700/50' :
					dbStatus.connected && dbStatus.status === 'ready' ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/30' :
					dbStatus.connected && dbStatus.status === 'no_tables' ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/30' :
					'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/50 dark:border-rose-800/30'
				}`}>
					<div className="flex items-center gap-4">
						<div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 shadow-sm border border-white/20 ${dbStatus.status === 'checking' ? 'text-slate-400' : dbStatus.connected ? dbStatus.status === 'no_tables' ? 'text-amber-500' : 'text-emerald-500' : 'text-rose-500'}`}>
							<DatabaseIcon className="w-5 h-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Database Storage</p>
								{dbStatus.connected && <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dbStatus.status === 'no_tables' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>}
							</div>
							<p className={`text-sm font-black mt-0.5 ${dbStatus.status === 'checking' ? 'text-slate-600' : dbStatus.connected ? dbStatus.status === 'no_tables' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
								{dbStatus.status === 'checking' && 'Checking connection...'}
								{dbStatus.status === 'ready' && 'MongoDB Connected & Ready'}
								{dbStatus.status === 'no_tables' && 'MongoDB Connected (Awaiting First Chat)'}
								{dbStatus.status === 'misconfigured' && 'Environment Not Configured'}
								{dbStatus.status === 'error' && 'MongoDB Disconnected'}
							</p>
							<p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-1">{dbStatus.message}</p>
						</div>
					</div>
					<div className="flex flex-col items-end gap-1.5 shrink-0">
						{dbStatus.latencyMs !== null && <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 font-bold bg-white/50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md">{dbStatus.latencyMs}ms ping</span>}
						<button onClick={fetchDbStatus} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-1">
							Recheck Connection
						</button>
					</div>
				</div>

				{/* Segmented Tab Bar */}
				<div className="flex justify-center mb-2">
					<div className="flex gap-1 p-1.5 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-full shadow-inner border border-slate-200/50 dark:border-zinc-800/50 w-fit">
						<button
							onClick={() => setActiveTab('sessions')}
							className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeTab === 'sessions' ? 'bg-white dark:bg-zinc-800 text-[#003859] dark:text-sky-400 shadow-[0_2px_12px_rgba(0,0,0,0.06)]' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'}`}
						>
							<UsersIcon className="w-4 h-4" /> Live Sessions
						</button>
						<button
							onClick={() => setActiveTab('email')}
							className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeTab === 'email' ? 'bg-white dark:bg-zinc-800 text-[#003859] dark:text-sky-400 shadow-[0_2px_12px_rgba(0,0,0,0.06)]' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'}`}
						>
							<MailIcon className="w-4 h-4" /> Lead Email Setup
						</button>
						<button
							onClick={() => setActiveTab('users')}
							className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeTab === 'users' ? 'bg-white dark:bg-zinc-800 text-[#003859] dark:text-sky-400 shadow-[0_2px_12px_rgba(0,0,0,0.06)]' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'}`}
						>
							<ShieldIcon className="w-4 h-4" /> Users DB
						</button>
					</div>
				</div>

				{/* ── SESSIONS TAB ── */}
				{activeTab === 'sessions' && (
					<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
						{agentRole !== 'admin' && (
							<div className="flex items-center gap-3 bg-amber-50/80 dark:bg-amber-950/20 backdrop-blur-sm border border-amber-200/60 dark:border-amber-800/50 rounded-2xl p-4 mb-4 shadow-sm">
								<ShieldIcon className="w-5 h-5 text-amber-600 shrink-0" />
								<p className="text-[13px] text-amber-800 dark:text-amber-300 font-medium">
									You are logged in as <strong>expert</strong>. Only admins can delete sessions.
								</p>
							</div>
						)}

						<div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-700/50 overflow-hidden">
							<div className="px-6 py-5 border-b border-slate-200/50 dark:border-zinc-800/50 flex items-center justify-between gap-4 flex-wrap bg-white/40 dark:bg-zinc-800/40">
								<div>
									<h2 className="text-base font-black text-slate-800 dark:text-zinc-100">Live Chat History</h2>
									<p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5">{filteredSessions.length} total sessions{selectedIds.size > 0 && <span className="text-[#003859] font-bold"> • {selectedIds.size} selected</span>}</p>
								</div>
								<div className="flex items-center gap-3">
									<div className="relative">
										<select value={filter} onChange={e => { setFilter(e.target.value as FilterType); setSelectedIds(new Set()); }} className="appearance-none text-[11px] font-bold bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-full pl-4 pr-9 py-2 text-slate-700 dark:text-zinc-300 outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-[#003859]/20 transition-all">
											<option value="all">View All Statuses</option>
											<option value="waiting">View Waiting</option>
											<option value="active">View Active</option>
											<option value="resolved">View Resolved</option>
										</select>
										<ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
									</div>
									{agentRole === 'admin' && selectedIds.size > 0 && (
										<button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-full transition-all cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5">
											<Trash2Icon className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.size})
										</button>
									)}
								</div>
							</div>

							{loading ? (
								<div className="p-16 text-center">
									<div className="w-8 h-8 border-4 border-[#003859]/20 border-t-[#003859] dark:border-sky-500/20 dark:border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
									<p className="text-[13px] font-medium text-slate-400">Fetching live sessions…</p>
								</div>
							) : filteredSessions.length === 0 ? (
								<div className="p-16 text-center text-slate-400 flex flex-col items-center">
									<div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
										<SearchIcon className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
									</div>
									<p className="text-sm font-semibold">No sessions found</p>
									<p className="text-[11px] mt-1">Try changing your filter settings.</p>
								</div>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse">
										<thead className="bg-slate-50/50 dark:bg-zinc-800/50 border-b border-slate-200/60 dark:border-zinc-700/60 backdrop-blur-sm">
											<tr>
												{agentRole === 'admin' && <th className="px-5 py-4 w-12"><input type="checkbox" checked={selectedIds.size === filteredSessions.length && filteredSessions.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-[#003859] focus:ring-[#003859] cursor-pointer" /></th>}
												<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Session ID</th>
												<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Student Contact</th>
												<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
												<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Expert Assigned</th>
												<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Msg Count</th>
												<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Timeline</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
											{filteredSessions.map(session => (
												<tr key={session.id} className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors ${selectedIds.has(session.id) ? 'bg-sky-50/80 dark:bg-sky-950/20' : ''}`}>
													{agentRole === 'admin' && <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.has(session.id)} onChange={() => toggleSelect(session.id)} className="w-4 h-4 rounded border-slate-300 text-[#003859] focus:ring-[#003859] cursor-pointer" /></td>}
													<td className="px-5 py-4 text-[11px] font-mono font-medium text-slate-500 bg-slate-50/50 dark:bg-zinc-900/50 rounded-lg m-2 inline-block px-2 py-1">{session.id}</td>
													<td className="px-5 py-4">
														<div className="text-[13px] font-bold text-slate-800 dark:text-zinc-200">{session.userName}</div>
														<div className="text-[11px] text-slate-500 mt-0.5">{session.userEmail}</div>
													</td>
													<td className="px-5 py-4"><span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm ${statusColors[session.status]}`}>{session.status}</span></td>
													<td className="px-5 py-4 text-[11px] font-medium text-slate-600 dark:text-zinc-300">{session.assignedAgent || <span className="text-slate-300 italic">Pending...</span>}</td>
													<td className="px-5 py-4 text-[12px] font-black text-slate-600 dark:text-zinc-300 text-center"><div className="bg-slate-100 dark:bg-zinc-800 w-8 h-8 rounded-full flex items-center justify-center mx-auto">{session.messages?.length ?? 0}</div></td>
													<td className="px-5 py-4 text-[11px] font-medium text-slate-500">
														<div>Created: {formatDate(session.createdAt)}</div>
														<div className="mt-0.5 text-slate-400">Active: {formatDate(session.lastActive)}</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
				)}

				{/* ── EMAIL SETTINGS TAB ── */}
				{activeTab === 'email' && (
					<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex justify-center">
						<div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-700/50 overflow-hidden max-w-4xl w-full">
							<div className="px-8 py-6 border-b border-slate-200/50 dark:border-zinc-800/50 flex items-center justify-between bg-white/40 dark:bg-zinc-800/40">
								<div className="flex items-center gap-4">
									<div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg border border-white/20">
										<MailIcon className="w-5 h-5" />
									</div>
									<div>
										<h2 className="text-base font-black text-slate-800 dark:text-zinc-100">Lead Email Forwarding</h2>
										<p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5">Configure automated notifications for new student leads.</p>
									</div>
								</div>
							</div>

							<div className="p-8 space-y-8">
								{/* Provider Selection */}
								<div className="bg-slate-50/50 dark:bg-zinc-800/30 rounded-2xl p-6 border border-slate-100 dark:border-zinc-800/50">
									<h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 mb-5 flex items-center gap-3">
										<span className="w-6 h-6 rounded-full bg-[#003859] text-white flex items-center justify-center text-[10px] font-black shadow-md">1</span>
										Service Provider
									</h3>
									
									<div className="flex bg-slate-200/50 dark:bg-zinc-800 p-1.5 rounded-xl w-full max-w-sm">
										<button 
											onClick={() => setEmailConfig(p => ({ ...p, provider: 'brevo' }))}
											className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
												emailConfig.provider === 'brevo' 
													? 'bg-white dark:bg-zinc-700 text-[#003859] dark:text-white shadow-sm' 
													: 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
											}`}
										>
											Brevo
										</button>
										<button 
											onClick={() => setEmailConfig(p => ({ ...p, provider: 'resend' }))}
											className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
												emailConfig.provider === 'resend' 
													? 'bg-white dark:bg-zinc-700 text-[#003859] dark:text-white shadow-sm' 
													: 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
											}`}
										>
											Resend
										</button>
									</div>
								</div>

								{/* Recipient Rules */}
								<div className="bg-slate-50/50 dark:bg-zinc-800/30 rounded-2xl p-6 border border-slate-100 dark:border-zinc-800/50">
									<h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 mb-5 flex items-center gap-3">
										<span className="w-6 h-6 rounded-full bg-[#003859] text-white flex items-center justify-center text-[10px] font-black shadow-md">2</span>
										Recipient Rules
									</h3>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div>
											<label className={labelCls}>Chatbot Lead Alerts Email</label>
											<input
												type="email"
												value={emailConfig.leadEmailTo}
												onChange={e => setEmailConfig(p => ({ ...p, leadEmailTo: e.target.value }))}
												placeholder="admissions@sona.com"
												className={inputCls}
											/>
											<p className="text-[10px] text-slate-400 font-medium mt-1.5 pl-1">Where to send student chat widget leads.</p>
										</div>
										<div>
											<label className={labelCls}>New Waitlist Alerts Email</label>
											<input
												type="email"
												value={emailConfig.waitlistEmailTo}
												onChange={e => setEmailConfig(p => ({ ...p, waitlistEmailTo: e.target.value }))}
												placeholder="admin@sona.com"
												className={inputCls}
											/>
											<p className="text-[10px] text-slate-400 font-medium mt-1.5 pl-1">Where to send new Microsoft waitlist sign-up alerts.</p>
										</div>
										<div className="md:col-span-2">
											<label className={labelCls}>Subject Line Prefix</label>
											<input
												type="text"
												value={emailConfig.subjectPrefix}
												onChange={e => setEmailConfig(p => ({ ...p, subjectPrefix: e.target.value }))}
												placeholder="New Lead"
												className={inputCls}
											/>
											<p className="text-[10px] text-slate-400 font-medium mt-1.5 pl-1">e.g. "New Lead" appears as: "New Lead: John Doe"</p>
										</div>
									</div>
								</div>

								{/* Sender Settings according to provider */}
								<div className="bg-slate-50/50 dark:bg-zinc-800/30 rounded-2xl p-6 border border-slate-100 dark:border-zinc-800/50">
									<h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 mb-5 flex items-center gap-3">
										<span className="w-6 h-6 rounded-full bg-[#003859] text-white flex items-center justify-center text-[10px] font-black shadow-md">3</span>
										{emailConfig.provider === 'brevo' ? 'Brevo Authentication' : 'Resend Authentication'}
									</h3>

									<div className="space-y-6">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div className="md:col-span-2">
												<label className={labelCls}>{emailConfig.provider === 'brevo' ? 'Brevo API Key (v3)' : 'Resend API Key'}</label>
												<div className="relative">
													<input
														type={showPass ? 'text' : 'password'}
														value={emailConfig.smtpPass}
														onChange={e => setEmailConfig(p => ({ ...p, smtpPass: e.target.value }))}
														placeholder="xkeysib-..."
														className={`${inputCls} pr-12 font-mono tracking-widest`}
													/>
													<button
														type="button"
														onClick={() => setShowPass(p => !p)}
														className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-white dark:bg-zinc-800 p-1 rounded-md cursor-pointer transition-colors"
														title={showPass ? "Hide key" : "Show key"}
													>
														{showPass ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
													</button>
												</div>
												<p className="text-[10px] text-slate-400 font-medium mt-1.5 pl-1">Enter your {emailConfig.provider === 'brevo' ? 'Brevo v3 API Key (starts with `xkeysib-`)' : 'Resend API Key (starts with `re_`)'}</p>
											</div>
											
											<div>
												<label className={labelCls}>Verified Sender Address</label>
												<input
													type="email"
													value={emailConfig.smtpUser}
													onChange={e => setEmailConfig(p => ({ ...p, smtpUser: e.target.value }))}
													placeholder="no-reply@ajstudioz.co.in"
													className={inputCls}
												/>
											</div>
											<div>
												<label className={labelCls}>From Display Name</label>
												<input
													type="text"
													value={emailConfig.fromName}
													onChange={e => setEmailConfig(p => ({ ...p, fromName: e.target.value }))}
													placeholder="SCALE UWA Assistant"
													className={inputCls}
												/>
											</div>
										</div>
									</div>
								</div>

								{/* Action Buttons */}
								<div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-zinc-800/50">
									<p className="text-[11px] font-medium text-slate-400">
										Config is saved to MongoDB. Environment variables are used as fallbacks.
									</p>
									<div className="flex items-center gap-3">
										<button
											onClick={handleTestEmail}
											disabled={emailTesting || !emailConfig.smtpUser || !emailConfig.leadEmailTo}
											className="flex items-center gap-2 px-6 py-3 text-[11px] font-black text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200/80 dark:border-zinc-700 rounded-full transition-all cursor-pointer shadow-sm disabled:opacity-50 hover:shadow-md"
										>
											{emailTesting ? <span className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" /> : <SendIcon className="w-4 h-4 text-[#003859] dark:text-sky-400" />}
											Send Test Pulse
										</button>
										<button
											onClick={handleSaveEmailConfig}
											disabled={emailSaving}
											className="flex items-center gap-2 px-6 py-3 text-[11px] font-black text-white bg-gradient-to-r from-[#003859] to-sky-700 hover:from-[#002b45] hover:to-sky-800 rounded-full transition-all cursor-pointer shadow-md shadow-[#003859]/20 disabled:opacity-50 hover:shadow-lg hover:-translate-y-0.5"
										>
											{emailSaving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SaveIcon className="w-4 h-4" />}
											Save Configuration
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* ── USERS TAB ── */}
				{activeTab === 'users' && (
					<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
						<div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-700/50 overflow-hidden">
							<div className="px-6 py-5 border-b border-slate-200/50 dark:border-zinc-800/50 flex items-center justify-between gap-4 flex-wrap bg-white/40 dark:bg-zinc-800/40">
								<div>
									<h2 className="text-base font-black text-slate-800 dark:text-zinc-100">User Database</h2>
									<p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5">{users.length} total users registered</p>
								</div>
								<button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-full transition-all cursor-pointer shadow-sm">
									<RefreshCwIcon className="w-3.5 h-3.5" /> Refresh Users
								</button>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-left border-collapse">
									<thead className="bg-slate-50/50 dark:bg-zinc-800/50 border-b border-slate-200/60 dark:border-zinc-700/60 backdrop-blur-sm">
										<tr>
											<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">User</th>
											<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Role</th>
											<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Auth Method</th>
											<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Registered On</th>
											<th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
										{usersLoading ? (
											Array.from({ length: 4 }).map((_, i) => (
												<tr key={i} className="animate-pulse">
													<td className="px-5 py-4">
														<div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-24 mb-2"></div>
														<div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-32"></div>
													</td>
													<td className="px-5 py-4"><div className="h-5 bg-slate-200 dark:bg-zinc-700 rounded-full w-16"></div></td>
													<td className="px-5 py-4"><div className="h-5 bg-slate-200 dark:bg-zinc-700 rounded w-20"></div></td>
													<td className="px-5 py-4"><div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-24"></div></td>
													<td className="px-5 py-4 flex justify-end"><div className="h-7 bg-slate-200 dark:bg-zinc-700 rounded w-24 mt-1"></div></td>
												</tr>
											))
										) : users.length === 0 ? (
											<tr>
												<td colSpan={5} className="p-16 text-center text-slate-400">
													<p className="text-sm font-semibold">No users found in database.</p>
												</td>
											</tr>
										) : (
											users.map(user => (
												<tr key={user._id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
													<td className="px-5 py-4">
														<div className="text-[13px] font-bold text-slate-800 dark:text-zinc-200">{user.name}</div>
														<div className="text-[11px] text-slate-500 mt-0.5">{user.email}</div>
													</td>
													<td className="px-5 py-4">
														<span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : user.role === 'expert' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
															{user.role}
														</span>
													</td>
													<td className="px-5 py-4">
														<span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
															{user.authProvider || 'credentials'}
														</span>
													</td>
													<td className="px-5 py-4 text-[11px] font-medium text-slate-500">
														{user.createdAt ? formatDate(new Date(user.createdAt).getTime()) : 'Unknown'}
													</td>
													<td className="px-5 py-4 text-right">
														<div className="flex items-center justify-end gap-2">
															{user.role === 'pending' && (
																<>
																	<button 
																		onClick={() => handleApprove(user._id, 'expert')}
																		disabled={approving === user._id}
																		className="px-3 py-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer disabled:opacity-50"
																	>
																		Approve (Expert)
																	</button>
																	<button 
																		onClick={() => handleApprove(user._id, 'admin')}
																		disabled={approving === user._id}
																		className="px-3 py-1.5 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-md transition-colors cursor-pointer disabled:opacity-50"
																	>
																		Approve (Admin)
																	</button>
																</>
															)}
															{user.email !== 'admin@sona.com' && user.email !== 'expert@sona.com' && (
																<button
																	onClick={() => handleDeleteUser(user._id)}
																	disabled={deletingUser === user._id}
																	className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer disabled:opacity-50"
																	title="Delete User"
																>
																	{deletingUser === user._id ? (
																		<span className="block w-4 h-4 border-2 border-slate-300 border-t-rose-600 rounded-full animate-spin" />
																	) : (
																		<Trash2Icon className="w-4 h-4" />
																	)}
																</button>
															)}
														</div>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

			</div>
		</div>
	);
}
