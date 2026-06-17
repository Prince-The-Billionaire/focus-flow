'use client';

import React, { useState, useEffect } from 'react';
import SoftAurora from '@/components/ui/SoftAurora';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { FiCheckCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi';
import { SiGooglecalendar, SiGmail, SiGithub, SiNotion } from 'react-icons/si';

interface AppIntegrationNode {
  id: string;
  name: string;
  connected: boolean;
  lastSynced: string | null;
  scope: string;
}

export default function AppsWorkspace() {
  const { userId, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [integrations, setIntegrations] = useState<AppIntegrationNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncIntegrationStates = React.useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/apps?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch (err) {
      console.error("Failed loading service integration matrix mapping:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      syncIntegrationStates();
    }
  }, [userId, syncIntegrationStates]);

  const handleAppDisconnection = async (appId: string) => {
    if (!userId) return;
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          appId,
          action: 'disconnect'
        })
      });
      if (res.ok) {
        setIntegrations(prev => 
          prev.map(item => item.id === appId ? { ...item, connected: false, lastSynced: null } : item)
        );
      }
    } catch (err) {
      console.error("Ecosystem route disconnection exception context:", err);
    }
  };

  // Maps Simple Icons SVGs precisely to their platform connection cards
  const fetchIntegrationBrandLogoNode = (appId: string) => {
    switch (appId) {
      case 'google_calendar':
        return <SiGooglecalendar className="w-6 h-6 text-[#4285F4] shrink-0" />;
      case 'gmail':
      case 'system_emails':
        return <SiGmail className="w-6 h-6 text-[#EA4335] shrink-0" />;
      case 'github':
        return <SiGithub className="w-6 h-6 text-[#181717] shrink-0" />;
      case 'notion':
        return <SiNotion className="w-6 h-6 text-[#000000] shrink-0" />;
      default:
        return <div className="w-6 h-6 bg-indigo-500 rounded-lg shrink-0" />;
    }
  };

  if (authLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-xs font-mono text-slate-400 animate-pulse">Resolving integration parameters...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-4 md:p-6 overflow-y-auto relative space-y-6 dark:bg-slate-950 transition-colors duration-300">
      <SoftAurora speed={0.15} scale={1.1} brightness={0.96} color1="#cbd5e1" color2="#f1f5f9" />

      <div className="relative z-10 space-y-1">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Connected Apps</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500">Link your study tools to sync assignments and deadlines</p>
      </div>

      <div className="relative z-10 space-y-3 max-w-2xl animate-fade-in pt-2">
        {isLoading ? (
          <div className="text-xs font-mono text-indigo-500 dark:text-indigo-400 animate-pulse py-4">Loading your apps...</div>
        ) : (
          integrations.map((app) => (
            <div key={app.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-between transition hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex items-start space-x-4 max-w-[75%]">
                {fetchIntegrationBrandLogoNode(app.id)}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-sans">{app.name}</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal font-medium">{app.scope}</p>
                  {app.lastSynced && (
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                      Last synced: {new Date(app.lastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              
              {app.connected ? (
                <button
                  onClick={() => handleAppDisconnection(app.id)}
                  className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold border transition shrink-0 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/30 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 group flex items-center space-x-1.5"
                >
                  <FiCheckCircle className="w-3 h-3 group-hover:hidden" />
                  <FiXCircle className="w-3 h-3 hidden group-hover:block" />
                  <span className="group-hover:hidden">Connected</span>
                  <span className="hidden group-hover:block">Disconnect</span>
                </button>
              ) : (
                <a
                  href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=FocusFlow%20Task&details=Task%20from%20FocusFlow&sf=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold border transition shrink-0 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 flex items-center space-x-1"
                >
                  <FiRefreshCw className="w-2.5 h-2.5" />
                  <span>Connect</span>
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}