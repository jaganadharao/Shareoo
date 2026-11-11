import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, LogOut, RefreshCw, ShieldCheck, Users, Lightbulb, MessageCircle, Trash2, Loader2 } from 'lucide-react';

type SparkRow = { id: string; title: string; author_name: string | null; category: string; created_at: string };
type CommentRow = { id: string; spark_id: string; body: string; author_name: string | null; created_at: string };

type Props = { onBack: () => void; onSignOut: () => void };

export default function AdminDashboard({ onBack, onSignOut }: Props) {
  const [stats, setStats] = useState({ users: 0, sparks: 0, comments: 0 });
  const [sparks, setSparks] = useState<SparkRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    const [statsResult, sparksResult, commentsResult] = await Promise.all([
      supabase.rpc('admin_dashboard_stats'),
      supabase.from('sparks').select('id,title,author_name,category,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('comments').select('id,spark_id,body,author_name,created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    if (statsResult.error || sparksResult.error || commentsResult.error) {
      setError(statsResult.error?.message || sparksResult.error?.message || commentsResult.error?.message || 'Unable to load dashboard data.');
    } else {
      setStats(statsResult.data as typeof stats);
      setSparks((sparksResult.data || []) as SparkRow[]);
      setComments((commentsResult.data || []) as CommentRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const removeSpark = async (id: string) => {
    if (!window.confirm('Delete this spark? Its votes and comments may also be removed.')) return;
    const { error } = await supabase.from('sparks').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    await loadDashboard();
  };

  const removeComment = async (id: string) => {
    if (!window.confirm('Delete this comment?')) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    await loadDashboard();
  };

  const cards = [
    { label: 'Registered users', value: stats.users, icon: Users },
    { label: 'Total sparks', value: stats.sparks, icon: Lightbulb },
    { label: 'Total comments', value: stats.comments, icon: MessageCircle },
  ];

  return <div className="min-h-screen bg-[#F8F7F4] text-[#211F1D]">
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white"><ShieldCheck size={20}/></div>
          <div><h1 className="font-bold">Shareo Admin</h1><p className="text-xs text-stone-500">Community moderation dashboard</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="flex items-center gap-2 rounded-full border border-stone-200 px-3 py-2 text-sm"><ArrowLeft size={15}/> Back to Shareo</button>
          <button onClick={onSignOut} className="flex items-center gap-2 rounded-full bg-stone-900 px-3 py-2 text-sm text-white"><LogOut size={15}/> Sign out</button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl space-y-7 px-5 py-8">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">Dashboard overview</h2><p className="mt-1 text-sm text-stone-500">Monitor members and moderate community content.</p></div><button onClick={() => void loadDashboard()} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm"><RefreshCw size={15}/> Refresh</button></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}<p className="mt-1 text-xs">Make sure you have run the Shareo admin SQL migration in Supabase.</p></div>}
      {loading ? <div className="flex justify-center py-16 text-stone-400"><Loader2 className="animate-spin" size={28}/></div> : <>
        <section className="grid gap-4 sm:grid-cols-3">{cards.map(({label,value,icon:Icon}) => <div key={label} className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><span className="text-sm text-stone-500">{label}</span><Icon className="text-stone-400" size={20}/></div><p className="mt-3 text-3xl font-bold">{value.toLocaleString()}</p></div>)}</section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Manage sparks</h3><span className="text-xs text-stone-400">Latest 100</span></div>
          {sparks.length === 0 ? <p className="text-sm text-stone-500">No sparks found.</p> : <div className="divide-y divide-stone-100">{sparks.map(s => <div key={s.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{s.title}</p><p className="mt-1 text-xs text-stone-400">{s.category} · {s.author_name || 'Anonymous'} · {new Date(s.created_at).toLocaleString()}</p></div><button onClick={() => void removeSpark(s.id)} className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"><Trash2 size={14}/> Delete</button></div>)}</div>}
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Manage comments</h3><span className="text-xs text-stone-400">Latest 100</span></div>
          {comments.length === 0 ? <p className="text-sm text-stone-500">No comments found.</p> : <div className="divide-y divide-stone-100">{comments.map(c => <div key={c.id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="break-words text-sm">{c.body}</p><p className="mt-1 text-xs text-stone-400">{c.author_name || 'Anonymous'} · Spark ID: {c.spark_id.slice(0,8)} · {new Date(c.created_at).toLocaleString()}</p></div><button onClick={() => void removeComment(c.id)} className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"><Trash2 size={14}/> Delete</button></div>)}</div>}
        </section>
      </>}
    </main>
  </div>;
}
