import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from 'lucide-react';

type AuthProps = {
  onClose: () => void;
};

export default function Auth({ onClose }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setMessage('');
    setSuccess(false);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setMessage('Please enter a valid email address.');
      setSuccess(false);
      return;
    }

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setMessage('Please enter your full name.');
        setSuccess(false);
        return;
      }
      if (password.length < 8) {
        setMessage('Please use a password with at least 8 characters.');
        setSuccess(false);
        return;
      }
      if (password !== confirmPassword) {
        setMessage('Your passwords do not match.');
        setSuccess(false);
        return;
      }
    } else if (!password) {
      setMessage('Please enter your password.');
      setSuccess(false);
      return;
    }

    setLoading(true);
    setMessage('');
    setSuccess(false);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          onClose();
        } else {
          setSuccess(true);
          setMessage(
            'Your account has been created. Please check your email for the confirmation link, then log in.'
          );
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        onClose();
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const lowerMessage = rawMessage.toLowerCase();
      if (
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('networkerror') ||
        lowerMessage.includes('fetch failed')
      ) {
        setMessage(
          'Unable to connect to Shareo right now. Check your internet connection and verify the Supabase project URL and API key in your .env file.'
        );
      } else {
        setMessage(rawMessage || 'Something went wrong. Please try again.');
      }
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="my-auto w-full max-w-md rounded-3xl border border-stone-100 bg-white p-7 shadow-2xl sm:p-8"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-sm">
  <Sparkles size={28} />
</div>
          <h1 id="auth-title" className="text-2xl font-bold tracking-tight text-stone-900">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            {mode === 'signup'
              ? 'Join Shareo and be part of a thoughtful community.'
              : 'Log in to continue your Shareo journey.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="full-name" className="mb-1.5 block text-sm font-semibold text-stone-700">
                Full name
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  id="full-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your name"
                  maxLength={80}
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-stone-100"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-stone-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Password
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                required
                className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-12 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-stone-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 transition hover:text-stone-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-stone-700">
                Confirm password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-stone-100"
                />
              </div>
            </div>
          )}

          {message && (
            <div
              role="status"
              className={`flex gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-5 ${
                success
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {success ? (
                <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
              ) : (
                <AlertCircle className="mt-0.5 shrink-0" size={17} />
              )}
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700 focus:outline-none focus:ring-4 focus:ring-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 size={17} className="animate-spin" /> Please wait...</>
            ) : (
              <><Sparkles size={17} /> {mode === 'signup' ? 'Create account' : 'Log in'}</>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
            disabled={loading}
            className="font-semibold text-stone-900 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="mt-4 w-full text-sm font-medium text-stone-400 transition hover:text-stone-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </section>
    </div>
  );
}
