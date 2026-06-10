'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import SoftAurora from '@/components/ui/SoftAurora';
import { useAuth } from '@/components/providers/AuthProvider';
import { FiMail, FiLock, FiTerminal, FiArrowRight, FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function AuthenticativeGateway() {
  const { isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const executeAuthForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data?.user && !data.session) {
          setErrorMsg('Awesome! Check your email inbox for a verification link.');
          setIsSubmitting(false);
          return;
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#fdfefe] dark:bg-slate-950">
        <SoftAurora speed={0.2} scale={1.05} brightness={0.95} color1="#cbd5e1" color2="#e2e8f0" />
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 z-10 animate-pulse font-sans">
          Loading your workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#fdfefe] text-slate-900 antialiased overflow-hidden font-sans select-none relative dark:bg-slate-950 dark:text-slate-100">
      <SoftAurora speed={0.2} scale={1.05} brightness={0.95} color1="#cbd5e1" color2="#e2e8f0" />
      
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-md hover:scale-105 transition z-30"
        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      >
        {theme === 'light' ? (
          <FiMoon className="w-4 h-4 text-slate-600" />
        ) : (
          <FiSun className="w-4 h-4 text-amber-400" />
        )}
      </button>

      <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700 p-8 rounded-2xl shadow-2xl z-20 space-y-6 mx-4">
        <div className="text-center space-y-1.5">
          <div className="h-12 w-12 bg-slate-950 dark:bg-slate-100 rounded-2xl flex items-center justify-center text-white dark:text-slate-900 shadow-md mx-auto mb-3">
            <FiTerminal className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            {isLogin ? 'Welcome back, student!' : 'Create your student account'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isLogin 
              ? 'Sign in to continue tracking your assignments and study sessions.' 
              : 'Join to organize your homework, deadlines, and study goals.'}
          </p>
        </div>

        {errorMsg && (
          <div className={`p-3 border rounded-xl text-[11px] font-medium ${errorMsg.includes('Check your email') ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'}`}>
            {errorMsg.includes('Check your email') ? '✨' : '⚠️'} {errorMsg}
          </div>
        )}

<form onSubmit={executeAuthForm} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="relative flex items-center">
              <FiMail className="absolute left-3.5 text-slate-400 w-4 h-4" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-slate-950 dark:focus:border-slate-200 focus:bg-white dark:focus:bg-slate-800 transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative flex items-center">
              <FiLock className="absolute left-3.5 text-slate-400 w-4 h-4" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your secure password"
                className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-slate-950 dark:focus:border-slate-200 focus:bg-white dark:focus:bg-slate-800 transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-950 dark:bg-slate-100 hover:bg-slate-900 dark:hover:bg-slate-200 disabled:bg-slate-200 disabled:text-slate-400 text-white dark:text-slate-900 font-semibold text-xs py-3 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 mt-2"
          >
            <span>{isSubmitting ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}</span>
            {!isSubmitting && <FiArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition"
          >
            {isLogin ? "New student? Create an account" : 'Already registered? Sign in instead'}
          </button>
        </div>
      </div>
    </div>
  );
}