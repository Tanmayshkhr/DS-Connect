import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyOtp, requestOtp } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function OtpVerifyPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('ds_otp_email');
    if (!stored) {
      navigate('/login');
      return;
    }
    setEmail(stored);
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');

    try {
      const data = await verifyOtp(email, otp);
      login(data.access_token, data.refresh_token, data.user);
      navigate('/dashboard');
    } catch {
      setError('Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError('');

    try {
      await requestOtp(email);
      setCooldown(60);
    } catch {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
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
          Enter OTP
        </h1>
        <p className="text-sm text-slate-400 font-medium mb-2">
          Check your email for a 6-digit code
        </p>
        {email && (
          <p className="text-xs text-slate-500 font-semibold bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 mb-6 truncate max-w-full">
            {email}
          </p>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="otp"
              className="text-xs font-bold text-slate-500 uppercase tracking-wider"
            >
              6-Digit Code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none text-center tracking-[0.4em] font-semibold transition focus:border-[#1A9F52] focus:ring-2 focus:ring-[#1A9F52]/20"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full rounded-lg bg-[#1A9F52] text-white text-sm font-semibold py-2.5 tracking-wide transition hover:bg-[#158a45] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying…' : 'Verify OTP'}
          </button>
        </form>

        <div className="mt-5 text-center">
          {cooldown > 0 ? (
            <p className="text-xs text-slate-400">
              Resend OTP in <span className="font-semibold text-slate-600">{cooldown}s</span>
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="text-xs font-semibold text-[#1A9F52] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendLoading ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
