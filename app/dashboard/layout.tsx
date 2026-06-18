'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import SoftAurora from '@/components/ui/SoftAurora';
import { FiMessageSquare, FiActivity, FiLogOut, FiClock, 
  FiCheckSquare, FiAlertCircle, FiPlusCircle, FiGrid, FiCompass, FiBellOff, FiVolume2, FiRadio, FiSun, FiMoon, FiX, FiMove, FiMenu 
} from 'react-icons/fi';
import { SiGooglecalendar, SiGmail, SiGithub, SiNotion } from 'react-icons/si';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PersistentTaskNode {
  id: string;
  task: string;
  app: string;
  time_due: string;
  status: 'pending' | 'completed';
  created_at: string;
}

interface HistoricalChatSession {
  sessionId: string;
  preview: string;
  timestamp: string;
}

interface ManagedAlarmNode {
  taskId: string;
  taskTitle: string;
  nextTriggerTime: Date;
  timeDue: string;
}

interface UIVisualCountdown {
  taskId: string;
  taskTitle: string;
  secondsRemaining: number;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, userId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  
  const [taskItems, setTaskItems] = useState<PersistentTaskNode[]>([]);
  const [recentChats, setRecentChats] = useState<HistoricalChatSession[]>([]);
  
  const [loadingTasks, setLoadingTasks] = useState<boolean>(true);
  const [loadingChats, setLoadingChats] = useState<boolean>(true);
  
  const [isTasksOpen, setIsTasksOpen] = useState<boolean>(true);
  const [isChatsOpen, setIsChatsOpen] = useState<boolean>(true);
  const [isRadarVisible, setIsRadarVisible] = useState<boolean>(true);
  const [isRadarCentered, setIsRadarCentered] = useState<boolean>(true);

  // Browser Audio Activation Gating State
  const [needsUserInteractionUnlock, setNeedsUserInteractionUnlock] = useState<boolean>(true);

  // UI State for live rendering countdown matrix
  const [liveCountdowns, setLiveCountdowns] = useState<UIVisualCountdown[]>([]);

  // Alarm Matrix Structural Ref Refs & State
  const [activeAlarmOverlay, setActiveAlarmOverlay] = useState<{ title: string; id: string } | null>(null);
  const activeAlarmsRef = useRef<ManagedAlarmNode[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioOscillatorsRef = useRef<OscillatorNode[]>([]);
  const audioGainNodeRef = useRef<GainNode | null>(null);
  
  // High accuracy tracking loops for runtime dismissal arrays
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      } else if (Notification.permission === 'granted') {
        checkAudioContextStatus();
      }
    }
    return () => {
      if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  const checkAudioContextStatus = () => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const testCtx = new AudioContextClass();
    if (testCtx.state === 'running') {
      setNeedsUserInteractionUnlock(false);
    }
    testCtx.close();
  };

  const handleExplicitAudioUnlock = () => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContextRef.current = new AudioContextClass();
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
    setNeedsUserInteractionUnlock(false);
    console.log('[AUDIO AUDIO ENGINE]: Unlocked via explicit user action engagement.');
  };

  // Calculate alarm time: 1 hour before task's time_due, but if due is under 1 hour away use the due time directly
  const calculateAlarmTimeFromDueTime = (timeDueString: string): Date => {
    try {
      // Parse the time_due string (e.g., "2:30 PM", "14:30", "12:00 PM", etc.)
      const now = new Date();
      let dueTime: Date;

      // Try to parse various time formats
      if (timeDueString.includes(':')) {
        // Extract hours and minutes
        const match = timeDueString.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const meridiem = match[3]?.toUpperCase();

          // Handle 12-hour format
          if (meridiem) {
            if (meridiem === 'PM' && hours !== 12) hours += 12;
            if (meridiem === 'AM' && hours === 12) hours = 0;
          }

          dueTime = new Date(now);
          dueTime.setHours(hours, minutes, 0, 0);

          // If the time is in the past today, assume it's for tomorrow
          if (dueTime < now) {
            dueTime.setDate(dueTime.getDate() + 1);
          }
        } else {
          // Fallback: use current time + 1 hour
          dueTime = new Date(now);
          dueTime.setHours(dueTime.getHours() + 1);
        }
      } else {
        // If no time format recognized, set for 1 hour from now
        dueTime = new Date(now);
        dueTime.setHours(dueTime.getHours() + 1);
      }

      const millisecondsUntilDue = dueTime.getTime() - now.getTime();
      const oneHourMs = 60 * 60 * 1000;

      // If there's less than one hour until due, use the due time directly
      if (millisecondsUntilDue <= oneHourMs) {
        return dueTime < now ? now : dueTime;
      }

      // Set alarm for 1 hour before the due time
      const alarmTime = new Date(dueTime);
      alarmTime.setHours(alarmTime.getHours() - 1);

      return alarmTime < now ? now : alarmTime;
    } catch (err) {
      console.error('[ALARM TIME PARSE ERROR]:', err);
      // Fallback: 1 hour from now
      const fallback = new Date();
      fallback.setHours(fallback.getHours() + 1);
      return fallback;
    }
  };

  const rebuildAlarmScheduleMatrix = useCallback((tasks: PersistentTaskNode[]) => {
    // Isolate non-completed records cleanly
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    
    // Scan existing state to preserve current targets and avoid resetting horizons
    const updatedAlarms = pendingTasks.map(task => {
      const existing = activeAlarmsRef.current.find(a => a.taskId === task.id);
      if (existing) {
        return existing; // KEEP THE ORIGINAL TIMER TARGET INTENTIONAL
      }

      return {
        taskId: task.id,
        taskTitle: task.task,
        timeDue: task.time_due,
        nextTriggerTime: calculateAlarmTimeFromDueTime(task.time_due)
      };
    });

    // Strip out tasks that have dropped off the system loop entirely
    activeAlarmsRef.current = updatedAlarms.filter(alarm => 
      pendingTasks.some(t => t.id === alarm.taskId)
    );

    console.log('[ALARM ENGINE DATA DESYNC GUARD]: Preserved existing timers. Matrix allocation size ->', activeAlarmsRef.current.length);
  }, [calculateAlarmTimeFromDueTime]);

  // VClock Continuous High-Decibel Looping Audio Pipeline Engine
  const triggerLoudSirenLoop = (taskTitle: string) => {
    try {
      if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      audioOscillatorsRef.current.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch {} });
      audioOscillatorsRef.current = [];

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.35, ctx.currentTime);
      masterGain.connect(ctx.destination);
      audioGainNodeRef.current = masterGain;

      const frequencies = [987.77, 1318.51, 523.25]; 
      frequencies.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        osc.connect(masterGain);
        osc.start();
        audioOscillatorsRef.current.push(osc);
      });

      const modulationInterval = setInterval(() => {
        if (audioOscillatorsRef.current.length === 0) {
          clearInterval(modulationInterval);
          return;
        }
        audioOscillatorsRef.current.forEach((osc, idx) => {
          const baseFreq = frequencies[idx];
          const modifier = Math.sin(ctx.currentTime * 12) * 200;
          osc.frequency.setValueAtTime(baseFreq + modifier, ctx.currentTime);
        });
      }, 50);

      // FORCE STOP AUDIOS AFTER 5 MINUTES (300,000 MS)
      audioTimeoutRef.current = setTimeout(() => {
        console.log(`[ALARM ENGINE TIME ELAPSED]: Auto-muting sirens for -> ${taskTitle}`);
        killActiveSirenAudio();
      }, 300000);

    } catch (err) {
      console.error('[HARDWARE AUDIO ENGINE FAULT]:', err);
    }
  };

  const triggerInstantBypassTestAlarm = (taskId: string, taskTitle: string) => {
    console.log(`[BYPASS TESTING]: Forcing immediate trip sequences for -> ${taskTitle}`);
    setActiveAlarmOverlay({ title: taskTitle, id: taskId });
    triggerLoudSirenLoop(taskTitle);

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      if (notificationRef.current) notificationRef.current.close();
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);

      const toast = new Notification('⏰ CRITICAL TASK HORIZON BREACH', {
        body: `Action Required: "${taskTitle}". System pipeline requires prompt resolution.`,
        tag: `focus_task_${taskId}`,
        requireInteraction: true, 
        silent: true 
      });

      notificationRef.current = toast;

      notificationTimeoutRef.current = setTimeout(() => {
        try { toast.close(); } catch {}
      }, 120000);
    }
  };

  const killActiveSirenAudio = () => {
    if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);

    audioOscillatorsRef.current.forEach(osc => {
      try { osc.stop(); osc.disconnect(); } catch {}
    });
    audioOscillatorsRef.current = [];
    
    if (audioGainNodeRef.current) {
      try { audioGainNodeRef.current.disconnect(); } catch {}
      audioGainNodeRef.current = null;
    }

    if (notificationRef.current) {
      try { notificationRef.current.close(); } catch {}
      notificationRef.current = null;
    }

    setActiveAlarmOverlay(null);
  };

  const formatTimerString = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Pull active analytics alert tasks bound to the user id from the dedicated tasks pipeline
  const pullActiveTaskStream = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/tasks?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        const incomingTasks = data.tasks || [];
        setTaskItems(incomingTasks);
        rebuildAlarmScheduleMatrix(incomingTasks);
      }
    } catch (err) {
      console.error("Failed syncing layout elements:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [userId, rebuildAlarmScheduleMatrix]);

  // High Accuracy Clock Poll Worker Loop (Handles UI synchronization state updates)
  useEffect(() => {
    const clockWorkerId = setInterval(() => {
      const rightNow = new Date();
      const updatedCountdowns: UIVisualCountdown[] = [];
      
      activeAlarmsRef.current.forEach((alarm) => {
        const timeRemainingMs = alarm.nextTriggerTime.getTime() - rightNow.getTime();
        const secondsLeft = Math.max(0, Math.floor(timeRemainingMs / 1000));
        
        updatedCountdowns.push({
          taskId: alarm.taskId,
          taskTitle: alarm.taskTitle,
          secondsRemaining: secondsLeft
        });

        if (rightNow >= alarm.nextTriggerTime) {
          setActiveAlarmOverlay({ title: alarm.taskTitle, id: alarm.taskId });
          triggerLoudSirenLoop(alarm.taskTitle);

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            if (notificationRef.current) notificationRef.current.close();
            if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);

            const toast = new Notification('⏰ CRITICAL TASK HORIZON BREACH', {
              body: `Action Required: "${alarm.taskTitle}". System pipeline requires prompt resolution.`,
              tag: `focus_task_${alarm.taskId}`,
              requireInteraction: true, 
              silent: true 
            });

            notificationRef.current = toast;

            notificationTimeoutRef.current = setTimeout(() => {
              try { toast.close(); } catch {}
            }, 120000);
          }

          // Cycle to next occurrence (same time next day)
          const nextTrigger = new Date(alarm.nextTriggerTime);
          nextTrigger.setDate(nextTrigger.getDate() + 1);
          alarm.nextTriggerTime = nextTrigger;
        }
      });

      setLiveCountdowns(updatedCountdowns);
    }, 1000);

    return () => clearInterval(clockWorkerId);
  }, []);

  // Fetch unique chat sessions grouped and named by their earliest first message text
  const pullChatSessionStream = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: records, error } = await supabase
        .from('chat_messages')
        .select('session_id, text, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const sessionMap = new Map<string, { sessionId: string; preview: string; rawDate: Date }>();

      (records || []).forEach((row) => {
        if (!row.session_id) return;
        
        if (!sessionMap.has(row.session_id)) {
          sessionMap.set(row.session_id, {
            sessionId: row.session_id,
            preview: row.text || 'New conversation thread...',
            rawDate: new Date(row.created_at)
          });
        }
      });

      const sortedSessions = Array.from(sessionMap.values()).sort(
        (a, b) => b.rawDate.getTime() - a.rawDate.getTime()
      );

      const formattedSessions = sortedSessions.map(item => ({
        sessionId: item.sessionId,
        preview: item.preview,
        timestamp: item.rawDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
      }));

      setRecentChats(formattedSessions);
    } catch (err) {
      console.error("Failed fetching structural sidebar chat threads:", err);
    } finally {
      setLoadingChats(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    
    pullActiveTaskStream();
    pullChatSessionStream();

    const handleSyncTrigger = () => {
      pullActiveTaskStream();
      pullChatSessionStream();
    };

    window.addEventListener('focusflow_tasks_sync', handleSyncTrigger);
    return () => window.removeEventListener('focusflow_tasks_sync', handleSyncTrigger);
  }, [userId, pathname, pullActiveTaskStream, pullChatSessionStream]);

  const createFreshSessionPipeline = () => {
    const freshSessionUUID = globalThis.crypto.randomUUID();
    router.push(`/dashboard/${freshSessionUUID}`);
  };

  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const radarWrapperClasses = isRadarCentered
    ? 'fixed left-1/2 top-5 z-[50] w-[320px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2'
    : 'absolute top-4 right-4 z-[50] flex flex-col space-y-2 max-w-[280px] w-full';

  const mobileDrawerClass = (isOpen: boolean) =>
    `fixed inset-y-0 right-0 z-40 w-3/4 max-w-sm bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`;

  const executeSessionDrop = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/');
    } catch (err) {
      console.error("Failed to cleanly drop session token:", err);
    }
  };

  const renderTaskPlatformIcon = (appName: string) => {
    const q = (appName || '').toLowerCase();
    if (q.includes('calendar')) return <SiGooglecalendar className="w-3 h-3 text-[#4285F4]" />;
    if (q.includes('gmail') || q.includes('email')) return <SiGmail className="w-3 h-3 text-[#EA4335]" />;
    if (q.includes('github')) return <SiGithub className="w-3 h-3 text-[#181717]" />;
    if (q.includes('notion')) return <SiNotion className="w-3 h-3 text-[#000000]" />;
    return <FiClock className="w-3 h-3 text-slate-400" />;
  };

if (isLoading || !userId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#fdfefe] dark:bg-slate-950">
        <SoftAurora speed={0.3} scale={1.1} brightness={0.92} color1="#cbd5e1" color2="#e2e8f0" />
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 z-10 animate-pulse font-mono">
          Preparing your workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased overflow-hidden font-sans select-none flex-col md:flex-row relative transition-colors duration-300">
      
      {/* MOBILE TOP BAR — only visible below md */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm z-30 shrink-0">
        <button
          onClick={() => setIsMobileNavOpen(true)}
          className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl transition"
          title="Open Menu"
        >
          <FiMenu className="w-5 h-5" />
        </button>
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 truncate px-2">
          FocusFlow
        </span>
        <button
          onClick={executeSessionDrop}
          className="p-2 -mr-2 text-slate-600 dark:text-slate-400 hover:text-rose-600 rounded-xl transition"
          title="Sign Out"
        >
          <FiLogOut className="w-5 h-5" />
        </button>
      </header>

      {/* MOBILE NAVIGATION OVERLAY */}
      {isMobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsMobileNavOpen(false)} />
          <nav className="relative w-3/4 max-w-xs bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col p-4 space-y-2 overflow-y-auto">
            <button
              onClick={() => { createFreshSessionPipeline(); setIsMobileNavOpen(false); }}
              className="h-11 w-full bg-slate-950 dark:bg-slate-100 rounded-2xl flex items-center justify-center text-white dark:text-slate-900 shadow-md hover:scale-[1.02] transition cursor-pointer gap-2"
            >
              <FiPlusCircle className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider">New Chat</span>
            </button>

            <button
              onClick={() => { router.push('/dashboard/analytics'); setIsMobileNavOpen(false); }}
              className={`p-3 rounded-xl transition flex items-center gap-3 ${pathname.includes('analytics') ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <FiActivity className="w-5 h-5" />
              <span className="text-xs font-medium">Analytics</span>
            </button>

            <button
              onClick={() => { setIsChatsOpen(true); setIsMobileNavOpen(false); }}
              className="p-3 rounded-xl transition flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FiMessageSquare className="w-5 h-5" />
              <span className="text-xs font-medium">Recent Chats</span>
            </button>

            <button
              onClick={() => { setIsTasksOpen(true); setIsMobileNavOpen(false); }}
              className="p-3 rounded-xl transition flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FiCheckSquare className="w-5 h-5" />
              <span className="text-xs font-medium">Tasks</span>
            </button>

            <button
              onClick={() => { router.push('/dashboard/apps'); setIsMobileNavOpen(false); }}
              className={`p-3 rounded-xl transition flex items-center gap-3 ${pathname.includes('apps') ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <FiGrid className="w-5 h-5" />
              <span className="text-xs font-medium">Apps</span>
            </button>

            <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-2 mt-2 space-y-1">
              <button
                onClick={() => { toggleTheme(); setIsMobileNavOpen(false); }}
                className="p-3 rounded-xl transition flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 w-full"
              >
                {theme === 'light' ? <FiMoon className="w-5 h-5" /> : <FiSun className="w-5 h-5 text-amber-400" />}
                <span className="text-xs font-medium">Toggle Theme</span>
              </button>
              <button
                onClick={() => { setIsRadarVisible(!isRadarVisible); setIsMobileNavOpen(false); }}
                className="p-3 rounded-xl transition flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 w-full"
              >
                {isRadarVisible ? <FiX className="w-5 h-5" /> : <FiRadio className="w-5 h-5" />}
                <span className="text-xs font-medium">{isRadarVisible ? 'Hide Radar' : 'Show Radar'}</span>
              </button>
            </div>

            <div className="mt-auto pt-4">
              <button
                onClick={() => { executeSessionDrop(); setIsMobileNavOpen(false); }}
                className="p-3 rounded-xl transition flex items-center gap-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 w-full"
              >
                <FiLogOut className="w-5 h-5" />
                <span className="text-xs font-medium">Sign Out</span>
              </button>
            </div>
          </nav>
        </div>
      )}
       
      {/* HIGH-VISIBILITY TOP-RIGHT SYSTEM RADAR COUNTDOWN LAYER */}
      {isRadarVisible && liveCountdowns.length > 0 && (
        <div className={radarWrapperClasses}>
          <div className="bg-slate-950/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-800 dark:border-slate-700 rounded-xl p-3 shadow-2xl flex flex-col space-y-2">
            <div className="flex items-center border-b border-slate-800 dark:border-slate-700 pb-1.5">
              <div className="flex items-center space-x-1.5">
                <FiRadio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">
                  Alarm Radar Monitor
                </span>
              </div>
            </div>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {liveCountdowns.map((cd) => (
                <div key={cd.taskId} className="flex flex-col space-y-1 bg-slate-900/60 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-800/50 dark:border-slate-700/50 group">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-300 dark:text-slate-400 font-medium truncate max-w-[130px]" title={cd.taskTitle}>
                      {cd.taskTitle}
                    </p>
                    <span className="text-[11px] font-mono font-bold text-indigo-400 dark:text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 shadow-inner shrink-0">
                      {formatTimerString(cd.secondsRemaining)}
                    </span>
                  </div>
                  <button
                    onClick={() => triggerInstantBypassTestAlarm(cd.taskId, cd.taskTitle)}
                    className="w-full text-left text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 hover:text-rose-400 transition uppercase tracking-tight pt-1 border-t border-slate-800/30 dark:border-slate-700/30 cursor-pointer"
                  >
                    ⚡ Force Test Alarm
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INITIALIZATION USER INTERACTION AUDIO UNLOCK OVERLAY */}
      {needsUserInteractionUnlock && (
        <div className="fixed inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-[10000] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center mx-auto">
              <FiVolume2 className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight font-mono">Enable Alarms</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Click below to enable audio reminders for your tasks.
              </p>
            </div>
            <button
              onClick={handleExplicitAudioUnlock}
              className="w-full bg-slate-950 dark:bg-slate-100 hover:bg-slate-900 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow transition cursor-pointer"
            >
              Enable Task Reminders
            </button>
          </div>
        </div>
      )}

      {/* FULLSCREEN LOCKOUT INTERCEPTOR AUDIO ALARM OVERLAY */}
      {activeAlarmOverlay && (
        <div className="fixed inset-0 bg-slate-950/95 dark:bg-slate-950/95 backdrop-blur-2xl z-[9999] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
          <div className="w-24 h-24 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mb-6 animate-ping absolute" style={{ animationDuration: '2s' }} />
          <div className="w-20 h-20 bg-rose-600 rounded-3xl flex items-center justify-center text-white shadow-2xl relative animate-bounce z-10">
            <FiAlertCircle className="w-10 h-10" />
          </div>

          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-8 max-w-xl font-mono">
            Task Reminder
          </h2>
          <p className="text-rose-400 font-mono text-[11px] uppercase tracking-widest mt-2">
            Time to complete your task!
          </p>

          <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 rounded-2xl p-6 mt-6 max-w-lg w-full shadow-2xl">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mb-1">Assigned Task</span>
            <h3 className="text-base font-bold text-slate-100 dark:text-slate-200 leading-relaxed">
              {activeAlarmOverlay.title}
            </h3>
          </div>

          <button
            onClick={killActiveSirenAudio}
            className="mt-8 bg-white dark:bg-slate-100 hover:bg-slate-100 dark:hover:bg-slate-200 text-slate-950 dark:text-slate-900 font-bold text-xs uppercase tracking-wider px-8 py-4 rounded-xl shadow-xl flex items-center space-x-2 transition cursor-pointer transform active:scale-95"
          >
            <FiBellOff className="w-4 h-4" />
            <span>Dismiss Reminder</span>
          </button>
        </div>
      )}

      {/* SIDEBAR CENTRAL UTILITY NAVIGATION ICON BAR — hidden on mobile */}
      <aside className="hidden md:flex md:w-20 h-full bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-700/60 flex-col items-center justify-between py-8 z-30  shadow-sm shrink-0 transition-colors duration-300">
        <div className="flex flex-col items-center space-y-10">
          <button 
            onClick={createFreshSessionPipeline}
            className="h-10 w-10 bg-slate-950 dark:bg-slate-100 rounded-2xl flex items-center justify-center text-white dark:text-slate-900 shadow-md hover:scale-105 transition cursor-pointer" 
            title="Start New Conversation Session"
          >
            <FiPlusCircle className="w-5 h-5 text-indigo-400" />
          </button>
          
          <nav className="flex flex-col items-center space-y-5">
            <button 
              onClick={() => setIsChatsOpen(!isChatsOpen)}
              className={`p-3 rounded-xl transition flex flex-col items-center ${isChatsOpen ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              title="Toggle Recent Conversations Drawer"
            >
              <FiMessageSquare className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-wider mt-1">Messages</span>
            </button>

            <button
              onClick={() => setIsTasksOpen(!isTasksOpen)}
              className={`p-3 rounded-xl transition flex flex-col items-center ${isTasksOpen ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              title="Toggle Task Board Streams"
            >
              <FiCheckSquare className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-wider mt-1">Tasks</span>
            </button>
            
            <button
              onClick={() => router.push('/dashboard/analytics')}
              className={`p-3 rounded-xl transition flex flex-col items-center ${pathname.includes('analytics') ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              title="System Analytics Metrics"
            >
              <FiActivity className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-wider mt-1">Analytics</span>
            </button>

            <button
              onClick={() => router.push('/dashboard/apps')}
              className={`p-3 rounded-xl transition flex flex-col items-center ${pathname.includes('apps') ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              title="Connected Pipelines Ecosystem"
            >
              <FiGrid className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-wider mt-1">Apps</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-3 rounded-xl transition flex flex-col items-center text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? (
                <FiMoon className="w-5 h-5" />
              ) : (
                <FiSun className="w-5 h-5 text-amber-400" />
              )}
              <span className="text-[8px] font-mono uppercase tracking-wider mt-1">Theme</span>
            </button>
            <button
              onClick={() => setIsRadarVisible(!isRadarVisible)}
              className="p-3 rounded-xl transition flex flex-col items-center text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
              title={isRadarVisible ? 'Hide Radar Monitor' : 'Show Radar Monitor'}
            >
              <FiX className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-wider mt-1">Radar</span>
            </button>
            {/* <button
              onClick={() => setIsRadarCentered(!isRadarCentered)}
              className="p-3 rounded-xl transition flex flex-col items-center text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
              title={isRadarCentered ? 'Move Radar to corner' : 'Center Radar Monitor'}
            >
              <FiMove className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-wider mt-1">Center</span>
            </button> */}
          </nav>
        </div>
        
        <button 
          onClick={executeSessionDrop}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition"
          title="Sign Out"
        >
          <FiLogOut className="w-5 h-5" />
        </button>
      </aside>

      {/* RECENT CHATS LOG DOCK PANEL */}
      <section 
        className={`${isChatsOpen ? 'flex' : 'hidden'} h-full bg-slate-50/30 dark:bg-slate-900/30 border-r border-slate-200/50 dark:border-slate-700/50 flex-col shrink-0 overflow-hidden select-none transition-all duration-300 ease-in-out w-64 opacity-100 lg:static lg:z-auto fixed inset-0 z-50 lg:z-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md lg:backdrop-blur-none`}
      >
        <header className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between bg-white/40 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center space-x-2">
            <FiCompass className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <h4 className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase font-mono">Conversations</h4>
          </div>
          <button
            onClick={() => setIsChatsOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition"
          >
            <FiX className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loadingChats ? (
            <div className="space-y-2 p-1">
              <div className="h-11 w-full bg-slate-200/40 dark:bg-slate-700/40 rounded-lg animate-pulse" />
              <div className="h-11 w-full bg-slate-200/40 dark:bg-slate-700/40 rounded-lg animate-pulse" />
            </div>
          ) : recentChats.length === 0 ? (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center pt-8 px-4 leading-relaxed flex flex-col items-center space-y-1.5 font-medium">
              <FiMessageSquare className="w-3.5 h-3.5 text-slate-300" />
              <span>No conversations yet.</span>
            </div>
          ) : (
            recentChats.map((chat) => {
              const isCurrentActiveSession = pathname.includes(chat.sessionId);
              return (
                <button
                  key={chat.sessionId}
                  onClick={() => router.push(`/dashboard/${chat.sessionId}`)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all duration-200 flex flex-col space-y-1 group border ${
                    isCurrentActiveSession 
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm text-slate-900 dark:text-slate-100 font-medium' 
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-mono tracking-tight font-bold ${isCurrentActiveSession ? 'text-slate-950 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400'}`}>
                      CHAT://{chat.sessionId.substring(0, 6).toUpperCase()}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono shrink-0">{chat.timestamp}</span>
                  </div>
                  <p className="text-xs truncate w-full text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 pl-0.5 font-medium transition-colors">
                    {chat.preview}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* ACTIVE TASKS TRACK PANEL */}
      <section 
        className={`${isTasksOpen ? 'flex' : 'hidden'} h-full bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200/50 dark:border-slate-700/50 flex-col shrink-0 overflow-hidden select-none transition-all duration-300 ease-in-out w-64 opacity-100 lg:static lg:z-auto fixed inset-0 z-50 lg:z-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md lg:backdrop-blur-none`}
      >
        <header className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between bg-white/40 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center space-x-2">
            <FiCheckSquare className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase font-mono">Active Tasks</h4>
          </div>
          <button
            onClick={() => setIsTasksOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition"
          >
            <FiX className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loadingTasks ? (
            <div className="space-y-2 pt-2">
              <div className="h-16 w-full bg-slate-200/40 dark:bg-slate-700/40 rounded-xl animate-pulse" />
            </div>
          ) : taskItems.length === 0 ? (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium text-center pt-8 px-4 leading-relaxed flex flex-col items-center space-y-2">
              <FiAlertCircle className="w-4 h-4 text-slate-300" />
              <span>No tasks yet. Add your first assignment!</span>
            </div>
          ) : (
            taskItems.map((task) => (
              <div key={task.id} className="w-full bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-3 shadow-sm flex flex-col space-y-2 transition-colors duration-300">
                <div className="flex items-center justify-between">
                  <span className={`text-[8px] font-bold uppercase font-mono px-1.5 py-0.5 rounded ${
                    task.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30'
                  }`}>
                    {task.status}
                  </span>
                  <div className="flex items-center space-x-1">
                    {renderTaskPlatformIcon(task.app)}
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 max-w-[80px] truncate">{task.app}</span>
                  </div>
                </div>
                <h6 className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">{task.task}</h6>
                
                {task.app?.toLowerCase().includes('calendar') && (
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.task)}&details=FocusFlow%20reminder&sf=true&output=xml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-[#4285F4] hover:text-[#3367D6] font-mono flex items-center space-x-1"
                  >
                    <SiGooglecalendar className="w-3 h-3" />
                    <span>Add to Google Calendar</span>
                  </a>
                )}
                
                {task.time_due && (
                  <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 flex items-center space-x-1 border-t border-slate-100 dark:border-slate-700 pt-1.5">
                    <FiClock className="w-2.5 h-2.5" />
                    <span>Due: {task.time_due}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <main className="flex-1 w-full relative min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}