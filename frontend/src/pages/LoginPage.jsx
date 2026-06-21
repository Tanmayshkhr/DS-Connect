import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestOtp } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await requestOtp(email);
      sessionStorage.setItem('ds_otp_email', email);
      navigate('/verify-otp');
    } catch (err) {
      setError(
        err?.response?.data?.detail || 'Failed to send OTP. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7F5] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 w-full max-w-sm px-8 py-10 flex flex-col items-center">

        <img
          src="/ds-logo.png"
          alt="DS Group Logo"
          className="h-20 w-20 object-contain mb-5"
        />

        <h1 className="text-xl font-bold tracking-tight text-[#1A9F52] mb-1">
          DS CONNECT
        </h1>
        <p className="text-sm text-slate-400 font-medium mb-8">
          Employee Support Portal
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-bold text-slate-500 uppercase tracking-wider"
            >
              Company Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@dsgroup.com"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1A9F52] focus:ring-2 focus:ring-[#1A9F52]/20"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1A9F52] text-white text-sm font-semibold py-2.5 tracking-wide transition hover:bg-[#158a45] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending OTP…' : 'Send OTP'}
          </button>
        </form>

      </div>
    </div>
  );
}
