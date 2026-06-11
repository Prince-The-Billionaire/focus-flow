'use client';

import React from 'react';
import ThreeAvatar from './ThreeAvatar';
import { FiArrowRight, FiActivity, FiCheckCircle } from 'react-icons/fi';

export default function HeroSection() {
  return (
    <div className="h-screen w-full flex flex-col lg:flex-row items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="flex-1 flex flex-col items-center lg:items-start justify-center space-y-6 max-w-2xl">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            FocusFlow
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            Organize your goals, track your progress, and boost productivity with AI-powered task management.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <button
            onClick={() => window.location.href = '/login'}
            className="px-8 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm uppercase tracking-wider rounded-xl shadow-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition flex items-center space-x-2"
          >
            <span>Get Started</span>
            <FiArrowRight className="w-4 h-4" />
          </button>
          
          <div className="flex items-center space-x-6 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-2">
              <FiActivity className="w-4 h-4 text-indigo-500" />
              <span>Analytics Dashboard</span>
            </div>
            <div className="flex items-center space-x-2">
              <FiCheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Task Management</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center mt-12 lg:mt-0">
        <div className="relative w-64 h-64 md:w-80 md:h-80">
          <ThreeAvatar isAnalyzing={false} layoutMode="center" />
        </div>
      </div>
    </div>
  );
}