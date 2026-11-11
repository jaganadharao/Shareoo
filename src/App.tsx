
import Auth from './components/Auth';
import AdminDashboard from './AdminDashboard';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getVoterId } from '@/lib/voter';
import {
  CATEGORIES,
  CATEGORY_STYLES,
  type Category,
  type SortMode,
} from '@/lib/constants';
import {
  Sparkles,
  Flame,
  TrendingUp,
  Clock,
  ArrowBigUp,
  Search,
  Plus,
  Loader2,
  X,
  Trash2,
  Mail,
  Download,
  MessageCircle,
  Send, 
} from 'lucide-react';

type Spark = {
  id: string;
  title: string;
  body: string | null;
  category: Category;
  author_name: string | null;
  votes_count: number;
  created_at: string;
};

type VoteRecord = { spark_id: string };

const SORT_OPTIONS: { mode: SortMode; label: string; icon: typeof Flame }[] = [
  { mode: 'hot', label: 'Hot', icon: Flame },
  { mode: 'top', label: 'Top', icon: TrendingUp },
  { mode: 'new', label: 'New', icon: Clock },
];

const PAGE_SIZE = 12;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function hotScore(s: Spark): number {
  const ageHours = (Date.now() - new Date(s.created_at).getTime()) / 3600000;
  return s.votes_count / Math.pow(ageHours + 2, 1.3);
}

export default function App() {
  const voterId = getVoterId();
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('hot');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const isAdmin = user?.app_metadata?.role === 'admin';
  useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user);
    setAuthReady(true);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
    setAuthReady(true);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

  const fetchSparks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let request = supabase
        .from('sparks')
        .select('id, title, body, category, author_name, votes_count, created_at');

      if (activeCategory !== 'All') request = request.eq('category', activeCategory);
      if (query.trim()) {
        const search = query.trim().replace(/[(),]/g, ' ');
        request = request.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
      }

      const { data, error: fetchError } = await request
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        console.error('Shareo sparks query failed:', fetchError);
        if (fetchError.code === '42P01' || fetchError.code === 'PGRST205') {
          setError('The sparks table is missing in Supabase. Run the SQL migration in supabase/migrations/20260808073147_create_sparkboard_schema.sql.');
        } else if (fetchError.code === '42501' || fetchError.code === 'PGRST301') {
          setError('Supabase blocked access to sparks. Check that the anon SELECT policy is enabled for the sparks table.');
        } else {
          setError(`Could not load sparks: ${fetchError.message}. Check your Supabase project URL, API key, project status, and browser network connection.`);
        }
        setSparks([]);
        return;
      }

      setSparks((data ?? []) as Spark[]);
    } catch (cause) {
      console.error('Shareo sparks request failed:', cause);
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(`Unable to connect to Supabase (${message}). Check your internet connection and VITE_SUPABASE_URL in the .env file.`);
      setSparks([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, query]);

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase
      .from('votes')
      .select('spark_id')
      .eq('voter_id', voterId);
    if (data) {
      setVotedIds(new Set((data as VoteRecord[]).map((v) => v.spark_id)));
    }
  }, [voterId]);

  useEffect(() => {
    fetchSparks();
  }, [fetchSparks]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  const sortedSparks = [...sparks].sort((a, b) => {
    if (sort === 'top') return b.votes_count - a.votes_count;
    if (sort === 'new')
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return hotScore(b) - hotScore(a);
  });

  const toggleVote = async (s: Spark) => {
    if (votedIds.has(s.id)) {
      setVotedIds((prev) => {
        const n = new Set(prev);
        n.delete(s.id);
        return n;
      });
      setSparks((prev) =>
        prev.map((p) => (p.id === s.id ? { ...p, votes_count: p.votes_count - 1 } : p))
      );
      await supabase
        .from('votes')
        .delete()
        .eq('spark_id', s.id)
        .eq('voter_id', voterId);
    } else {
      setVotedIds((prev) => new Set(prev).add(s.id));
      setSparks((prev) =>
        prev.map((p) => (p.id === s.id ? { ...p, votes_count: p.votes_count + 1 } : p))
      );
      await supabase
        .from('votes')
        .insert({ spark_id: s.id, voter_id: voterId });
    }
  };

  const deleteSpark = async (s: Spark) => {
    if (!isAdmin) return;
    setSparks((prev) => prev.filter((p) => p.id !== s.id));
    const { error } = await supabase.from('sparks').delete().eq('id', s.id);
    if (error) {
      setError('Could not delete that spark. Please try again.');
      fetchSparks();
      return;
    }
    setError(null);
  };

  const totalVotes = sparks.reduce((sum, s) => sum + s.votes_count, 0);
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setPathname(path);
    window.scrollTo(0, 0);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (pathname === '/admin') {
    if (!authReady) {
      return <div className="flex min-h-screen items-center justify-center bg-[#F7F5F2] text-stone-600">Checking administrator access...</div>;
    }
    if (!isAdmin) {
      navigate('/');
      return null;
    }
    return <AdminDashboard onBack={() => navigate('/')} onSignOut={signOut} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#211F1D]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">
                Shareo
              </h1>
              <p className="mt-0.5 text-xs text-stone-500">
                {sparks.length} sparks · {totalVotes} votes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
          
{isAdmin && (
  <button
    onClick={() => navigate('/admin')}
    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-95"
  >
    Admin
  </button>
)}
{user ? (
  <button
    onClick={signOut}
    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
  >
    Sign out
  </button>
) : (
  <button
    onClick={() => setShowAuth(true)}
    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-95"
  >
    Login
  </button>
)}
            <button
              onClick={() => {
  if (!user) {
    setShowAuth(true);
  } else {
    setShowForm(true);
  }
}}
              className="flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-95"
            >
              <Plus size={16} /> Share
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-[#E9E6E1] bg-gradient-to-b from-[#F3F0FA] to-[#F8F7F4]">
        <div className="mx-auto max-w-5xl px-5 py-12 text-center sm:py-16">
          <div className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600">
            <Sparkles size={12} /> Community inspiration board
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Share a spark.
            <br />
            <span className="text-stone-400">Upvote the best ones.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-stone-500 sm:text-base">
            Post your product ideas, side projects, and creative thoughts. The
            community decides what rises to the top.
          </p>
          <button
  onClick={() => {
    if (!user) {
      setShowAuth(true);
    } else {
      setShowForm(true);
    }
  }}
  className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95"
>
  <Plus size={18} /> Share your idea
</button>
        </div>
      </section>

      {/* Controls */}
      <div className="sticky top-[61px] z-20 border-b border-[#E9E6E1] bg-[#F1EFEC]/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-5 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sparks..."
                className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
              />
            </div>
            {/* Sort */}
           <div className="flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
  {SORT_OPTIONS.map(({ mode, label, icon: Icon }) => {
    const active = sort === mode;

    return (
      <button
        key={mode}
        onClick={() => setSort(mode)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
          active
            ? 'bg-stone-900 text-white'
            : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
        }`}
      >
        <Icon size={15} />
        {label}
      </button>
    );
  })}
</div>
          </div>
          {/* Categories */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory('All')}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                activeCategory === 'All'
                  ? 'bg-stone-900 text-white'
                  : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-300'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const st = CATEGORY_STYLES[cat];
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? `${st.bg} ${st.text} ring-1 ${st.ring}`
                      : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-5 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-stone-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : sortedSparks.length === 0 ? (
          <EmptyState onShare={() => setShowForm(true)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sortedSparks.slice(0, PAGE_SIZE).map((s) => (
              <SparkCard
              key={s.id}
              spark={s}
              voted={votedIds.has(s.id)}
              isAdmin={isAdmin}
              onVote={() => toggleVote(s)}
              onDelete={() => deleteSpark(s)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-stone-200 py-8 text-center text-xs text-stone-400">
        Once Uploaded Your Idea There is no Deletion In Shrareo.
      </footer>

      {showForm && (
        <SparkForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            fetchSparks();
          }}
        />
      )}
      {showAuth && (
  <Auth onClose={() => setShowAuth(false)} />
)}
    </div>
  );
}

function SparkCard({
  spark,
  voted,
  isAdmin,
  onVote,
  onDelete,
}: {
  spark: Spark;
  voted: boolean;
  isAdmin: boolean;
  onVote: () => void;
  onDelete: () => void;
}) {
  const st = CATEGORY_STYLES[spark.category];

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    onDelete();
  };

  return (
    <article className="rounded-2xl border border-[#E9E6E1] bg-white p-5 shadow-sm transition hover:border-[#D8D1E8] hover:shadow-md">

      {/* Spark content */}
      <div className="flex items-start gap-4">

        {/* Vote button */}
        <button
          onClick={onVote}
          className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-xl py-3 transition ${
            voted
              ? 'bg-orange-500 text-white'
              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
        >
          <ArrowBigUp
            size={21}
            className={voted ? 'fill-white' : 'fill-current'}
          />

          <span className="mt-1 text-sm font-bold">
            {spark.votes_count}
          </span>
        </button>

        {/* Spark details */}
        <div className="min-w-0 flex-1">

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-full ${st.bg} ${st.text} px-2 py-1 text-xs font-medium`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              {spark.category}
            </span>

            <span className="text-xs text-stone-400">
              {timeAgo(spark.created_at)}
            </span>
          </div>

          <h3 className="break-words font-semibold leading-snug text-stone-900">
            {spark.title}
          </h3>

          {spark.body && (
            <p className="mt-2 break-words text-sm leading-relaxed text-stone-500">
              {spark.body}
            </p>
          )}

          {/* Author and actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <span className="text-xs text-stone-400">
              by {spark.author_name?.trim() || 'Anonymous'}
            </span>

            <div className="flex flex-wrap items-center gap-2">

              <button
                onClick={() => setShowComments((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-100"
              >
                <MessageCircle size={15} />
                {showComments ? 'Hide comments' : 'Comments'}
              </button>
{isAdmin && (
                confirming ? (
                  <>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Confirm delete'}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={deleting}
                      className="rounded-lg px-2 py-2 text-xs text-stone-500 hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )
              )}

            </div>
          </div>

        </div>
      </div>

      {/* IMPORTANT: Comments are now BELOW the spark content */}
      {showComments && (
  <div className="mt-5 border-t border-stone-200 pt-5">
    <Comments
      sparkId={spark.id}
      isAdmin={isAdmin}
    />
  </div>
)}
    </article>
  );
}

function EmptyState({ onShare }: { onShare: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        <Sparkles size={28} />
      </div>
      <h3 className="text-lg font-semibold">No sparks yet</h3>
      <p className="mt-1 max-w-xs text-sm text-stone-500">
        Be the first to share an idea in this category.
      </p>
      <button
        onClick={onShare}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95"
      >
        <Plus size={16} /> Share a spark
      </button>
    </div>
  );
}

function SparkForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<Category>('Product');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (title.trim().length < 4) {
      setFormError('Title must be at least 4 characters.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const { error } = await supabase.from('sparks').insert({
      title: title.trim(),
      body: body.trim() || null,
      category,
      author_name: author.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setFormError('Could not post your spark. Please try again.');
      return;
    }
    onCreated();
  };

  const shareViaGmail = () => {
    const subject = encodeURIComponent(
      title.trim() ? title.trim() : 'Check out this idea on Shareo'
    );
    const bodyText = encodeURIComponent(
      `${title.trim() ? title.trim() + '\n\n' : ''}${body.trim() ? body.trim() + '\n\n' : ''}Shared from Shareo — community ideas, one spark at a time.`
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${bodyText}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Share a spark</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A one-line headline for your idea"
              maxLength={120}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Details <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add more context, links, or next steps..."
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const st = CATEGORY_STYLES[cat];
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? `${st.bg} ${st.text} ring-1 ${st.ring}`
                        : 'border border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Your name <span className="text-stone-400">(optional)</span>
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Anonymous"
              maxLength={60}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {submitting ? 'Posting...' : 'Post spark'}
            </button>
            <button
              onClick={shareViaGmail}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-60"
            >
              <Mail size={16} /> Gmail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Comments({
  sparkId,
  isAdmin,
}: {
  sparkId: string;
  isAdmin: boolean;
}) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('comments')
      .select('id, spark_id, author_name, body, created_at')
      .eq('spark_id', sparkId)
      .order('created_at', { ascending: true });

    if (error) {
      setError('Could not load comments.');
    } else {
      setComments(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchComments();
  }, [sparkId]);

  const submitComment = async () => {
    if (!text.trim()) return;

    setSubmitting(true);
    setError(null);

    const { error } = await supabase
      .from('comments')
      .insert({
        spark_id: sparkId,
        author_name: author.trim() || 'Anonymous',
        body: text.trim(),
      });

    if (error) {
      setError('Could not post comment.');
    } else {
      setText('');
      await fetchComments();
    }

    setSubmitting(false);
  };

  // Delete comment
  const deleteComment = async (commentId: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      'Are you sure you want to delete this comment?'
    );

    if (!confirmed) return;

    setDeletingId(commentId);
    setError(null);

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('spark_id', sparkId);

    if (error) {
      console.error('Delete comment error:', error);
      setError('Could not delete comment. Check your permissions.');
    } else {
      setComments((previous) =>
        previous.filter((comment) => comment.id !== commentId)
      );
    }

    setDeletingId(null);
  };

  return (
    <div className="mt-5 border-t border-stone-200 pt-5">

      <h4 className="mb-5 flex items-center gap-2 text-base font-semibold text-stone-900">
        <MessageCircle size={17} />
        Comments ({comments.length})
      </h4>

      {loading ? (
        <div className="py-4 text-sm text-stone-400">
          <Loader2 size={16} className="inline animate-spin mr-2" />
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <p className="py-3 text-sm text-stone-400">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-5">

          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3">

              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600">
                {(comment.author_name || 'A')
                  .charAt(0)
                  .toUpperCase()}
              </div>

              {/* Comment content */}
              <div className="min-w-0 flex-1">

                <div className="flex flex-wrap items-center justify-between gap-2">

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">
                      {comment.author_name || 'Anonymous'}
                    </span>

                    <span className="text-xs text-stone-400">
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>

                  {/* Delete button */}
                  {isAdmin && (
                    <button
                      onClick={() => deleteComment(comment.id)}
                      disabled={deletingId === comment.id}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      aria-label="Delete comment"
                    >
                      {deletingId === comment.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      Delete
                    </button>
                  )}

                </div>

                <p className="mt-1 break-words text-sm leading-relaxed text-stone-600">
                  {comment.body}
                </p>

              </div>
            </div>
          ))}

        </div>
      )}

      {/* Comment form */}
      <div className="mt-6 space-y-3">

        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name"
          maxLength={60}
          className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-100"
        />

        <div className="flex flex-col gap-2 sm:flex-row">

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitComment();
              }
            }}
            placeholder="Write a comment..."
            maxLength={500}
            className="min-w-0 flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-100"
          />

          <button
            onClick={submitComment}
            disabled={submitting || !text.trim()}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}

            Post
          </button>

        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}

    </div>
  );
}