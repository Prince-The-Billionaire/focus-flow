'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import gsap from 'gsap';
import SoftAurora from '@/components/ui/SoftAurora';
import ThreeAvatar from '@/components/ui/ThreeAvatar';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { FiSend, FiTrendingUp, FiBell, FiClock, FiCheckCircle } from 'react-icons/fi';
import { SiGooglecalendar, SiGmail, SiGithub, SiNotion } from 'react-icons/si';

interface TaskTriggerNode {
  action: 'create' | 'complete';
  task: string;
  app: string;
  time_due: string;
}

interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  text: string;
  timestamp: string;
  triggerData?: TaskTriggerNode[];
}

export default function SmoothWorkspace() {
  const { userId } = useAuth();
  const { theme } = useTheme();
  const params = useParams();
  
  const currentSessionId = params?.sessionId as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isComputing, setIsComputing] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'center' | 'side'>('center');
  const [activeAlarms, setActiveAlarms] = useState<Array<{ id: string; time: Date; task: string; triggered: boolean }>>([]);

  const avatarWrapperRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const centerHeaderRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load historical thread streams bounded to the database session architecture
  useEffect(() => {
    if (!userId || !currentSessionId) return;

    async function loadSessionState() {
      try {
        const res = await fetch(`/api/chat/history?sessionId=${currentSessionId}&userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
            setLayoutMode('side');
          } else {
            setMessages([]);
            setLayoutMode('center');
          }
        }
      } catch (err) {
        console.error("Failed loading structural room state logs:", err);
      }
    }
    loadSessionState();
  }, [currentSessionId, userId]);

  // Local physical device hardware background polling loops
  useEffect(() => {
    const alarmInterval = setInterval(() => {
      const now = new Date();
      activeAlarms.forEach((alarm) => {
        if (!alarm.triggered && now >= alarm.time) {
          alarm.triggered = true;
          triggerHardwareAudioSiren();
          alert(`⏰ FOCUS SYSTEMS REMINDER: ${alarm.task}`);
        }
      });
    }, 1000);

    return () => clearInterval(alarmInterval);
  }, [activeAlarms]);

  useEffect(() => {
    if (layoutMode === 'side') {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      const tl = gsap.timeline({ defaults: { ease: 'power3.inOut', duration: 0.85 } });
      if (centerHeaderRef.current) {
        tl.to(centerHeaderRef.current, { opacity: 0, y: -20, duration: 0.3 }, 0);
      }
      tl.to(avatarWrapperRef.current, { width: isMobile ? '18vh' : '45%' }, 0);
      tl.fromTo(chatPanelRef.current, 
        { opacity: 0, x: 40, display: 'none' },
        { opacity: 1, x: 0, display: 'flex', width: isMobile ? '100%' : '55%' },
        0
      );
    } else {
      gsap.set(avatarWrapperRef.current, { width: '100%' });
      gsap.set(chatPanelRef.current, { display: 'none', opacity: 0, width: '0%' });
    }
  }, [layoutMode]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const parseAlarmTimeString = (timeDueStr: string): Date => {
    const targetDate = new Date();
    const cleanStr = (timeDueStr || '').toLowerCase();

    if (cleanStr.includes('minute')) {
      const minutes = parseInt(cleanStr.match(/\d+/)?.[0] || '5', 10);
      targetDate.setMinutes(targetDate.getMinutes() + minutes);
    } else if (cleanStr.includes('hour')) {
      const hours = parseInt(cleanStr.match(/\d+/)?.[0] || '1', 10);
      targetDate.setHours(targetDate.getHours() + hours);
    } else if (cleanStr.includes(':')) {
      const [hrs, mins] = cleanStr.split(':');
      targetDate.setHours(parseInt(hrs, 10), parseInt(mins, 10), 0, 0);
    } else {
      targetDate.setMinutes(targetDate.getMinutes() + 1);
    }
    return targetDate;
  };

  const triggerHardwareAudioSiren = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      [0, 0.15, 0.3].forEach((delayTime) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime + delayTime); 
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime + delayTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delayTime + 0.15);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(ctx.currentTime + delayTime);
        osc.stop(ctx.currentTime + delayTime + 0.15);
      });
    } catch (err) {
      console.error("Hardware audio initialization failure context:", err);
    }
  };

  const renderPlatformBrandIcon = (appName: string) => {
    const query = (appName || '').toLowerCase();
    if (query.includes('calendar') || query.includes('google calendar')) {
      return <SiGooglecalendar className="w-4 h-4 text-[#4285F4]" />;
    }
    if (query.includes('gmail') || query.includes('email') || query.includes('mail')) {
      return <SiGmail className="w-4 h-4 text-[#EA4335]" />;
    }
    if (query.includes('github')) {
      return <SiGithub className="w-4 h-4 text-[#181717]" />;
    }
    if (query.includes('notion')) {
      return <SiNotion className="w-4 h-4 text-[#000000]" />;
    }
    return <FiBell className="w-4 h-4 text-indigo-400" />;
  };

  const dispatchMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isComputing || !userId) return;

    const userText = inputVal;
    setInputVal('');
    setIsComputing(true);

    if (layoutMode === 'center') {
      setLayoutMode('side');
    }

    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'USER', text: userText, timestamp: stamp }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          userInput: userText,
          sessionId: currentSessionId 
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();

      const assistantStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let parsedTriggers: TaskTriggerNode[] | undefined = undefined;
      
      if (data.assistantMessage.triggerData && Array.isArray(data.assistantMessage.triggerData)) {
        parsedTriggers = data.assistantMessage.triggerData.map((payload: any) => ({
          action: payload.action,
          task: payload.task,
          app: payload.app || 'Reminder',
          time_due: payload.time_due || 'Immediate'
        }));

        // CRITICAL SYNC FIX: Loop over items and commit them to Supabase via the layout API endpoint
        await Promise.all(
          data.assistantMessage.triggerData.map(async (p: any) => {
            if (p.action === 'create') {
              // Local background countdown activation setup
              const calculatedAlarmDate = parseAlarmTimeString(p.time_due);
              setActiveAlarms(prev => [...prev, {
                id: globalThis.crypto.randomUUID(),
                time: calculatedAlarmDate,
                task: p.task,
                triggered: false
              }]);

              // Write the entity object down to the Supabase task_alerts collection block
              try {
                await fetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: userId,
                    sessionId: currentSessionId,
                    task: p.task,
                    app: p.app || 'Reminder',
                    time_due: p.time_due || 'Immediate'
                  })
                });
              } catch (dbErr) {
                console.error("Failed persisting task mutation layer to Supabase:", dbErr);
              }
            }
          })
        );
      }

      setMessages((prev) => [...prev, {
        id: data.assistantMessage.id,
        role: 'ASSISTANT',
        text: data.assistantMessage.text,
        timestamp: assistantStamp,
        triggerData: parsedTriggers
      }]);

      // Fire cross-window sync event notifications to safely refresh layout lists with new DB rows
      window.dispatchEvent(new Event('focusflow_tasks_sync'));

    } catch (error) {
      setMessages((prev) => [...prev, {
        id: `err_${Date.now()}`,
        role: 'ASSISTANT',
        text: "⚠️ Real-time synchronization layer fault. Please inspect your analytical pipeline network maps.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <div className="flex h-full w-full relative flex-col md:flex-row overflow-hidden dark:bg-slate-950 transition-colors duration-300">
      <SoftAurora speed={0.3} scale={1.1} brightness={0.92} color1="#cbd5e1" color2="#e2e8f0" />

      {/* AVATAR / HERO SECTION */}
      <div ref={avatarWrapperRef} className={`${layoutMode === 'side' ? 'absolute top-2 right-2 z-30 h-[18vh] w-[18vh] md:relative md:top-auto md:right-auto md:z-20 md:h-full md:w-auto' : 'relative z-20 h-[45vh] md:h-full w-full md:w-auto'} flex flex-col items-center justify-center px-4 transition-all duration-300 shrink-0`}>
        {layoutMode === 'center' && (
          <div ref={centerHeaderRef} className="text-center mb-4 space-y-1 pointer-events-none absolute top-4 md:top-24 transition-all w-full px-4">
            <h2 className="text-xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Your Focus Space</h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium px-4">Chat to organize your assignments, set reminders, and track deadlines.</p>
          </div>
        )}

        <div className="w-[240px] h-[240px] sm:w-[320px] sm:h-[320px] md:w-[400px] md:h-[400px] flex items-center justify-center relative shrink-0">
          <ThreeAvatar isAnalyzing={isComputing} layoutMode={layoutMode} />
        </div>

        {layoutMode === 'center' && (
          <div className="w-full absolute bottom-4 md:bottom-12 px-4">
            <form onSubmit={dispatchMessage} className="flex items-center bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xl rounded-2xl p-1.5 max-w-xl mx-auto transition-all">
              <input 
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="What's your next assignment?"
                className="flex-1 bg-transparent border-0 py-2.5 pl-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
              <button type="submit" className="bg-slate-950 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 p-3 rounded-xl shadow transition">
                <FiSend className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* CHAT PANEL */}
      <div ref={chatPanelRef} className={`flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200/40 dark:border-slate-700/40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl z-10 overflow-hidden shadow-2xl transition-all duration-300 w-full md:w-auto ${layoutMode === 'center' ? 'hidden md:flex' : 'flex h-[calc(100dvh-1rem)] md:h-full'}`}>
        <header className="px-6 py-4 border-b border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between bg-white/40 dark:bg-slate-800/40 shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 font-mono">Study Chat</span>
          <div className="flex items-center space-x-2 text-[10px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 rounded-lg font-mono">
            <FiTrendingUp className="w-3 h-3 text-cyan-400" />
            <span>Room: {currentSessionId ? currentSessionId.substring(0, 8) : '...'}...</span>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="w-full flex flex-col space-y-2">
              <div className={`flex w-full ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col max-w-[85%] ${msg.role === 'USER' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'USER' ? 'bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60'}`}>
                    {msg.text}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-1 px-1">{msg.timestamp}</div>
                </div>
              </div>

              {msg.triggerData && msg.triggerData.map((trigger, idx) => (
                <div key={`${msg.id}_trig_${idx}`} className="w-full flex justify-start animate-fade-in py-1">
                  <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 rounded-xl p-4 max-w-sm w-full shadow-lg text-white dark:text-slate-100 space-y-3 transition-colors duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold font-mono flex items-center space-x-1.5">
                        {renderPlatformBrandIcon(trigger.app)}
                        <span>{trigger.action === 'create' ? 'Task Added' : 'Task Completed'}</span>
                      </span>
                      <span className="text-[9px] font-mono bg-slate-800 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-300 dark:text-slate-400 flex items-center space-x-1">
                        {trigger.app}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h5 className="text-xs font-semibold text-slate-100 dark:text-slate-200">{trigger.task}</h5>
                      {trigger.action === 'create' && (
                        <div className="flex flex-col space-y-1">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center space-x-1">
                            <FiClock className="w-3 h-3 text-slate-500" />
                            <span>Due: {trigger.time_due}</span>
                          </p>
                          {trigger.app?.toLowerCase().includes('calendar') && (
                            <a
                              href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(trigger.task)}&details=FocusFlow%20reminder&sf=true&output=xml`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] text-[#4285F4] hover:text-[#3367D6] font-mono flex items-center space-x-1 cursor-pointer"
                            >
                              <SiGooglecalendar className="w-3 h-3" />
                              <span>Add to Calendar</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-800 dark:border-slate-700 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400 font-mono">Status</span>
                      <span className="text-emerald-400 font-bold flex items-center space-x-1">
                        <FiCheckCircle className="w-3 h-3" />
                        <span>Saved</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {isComputing && (
                <div className="flex justify-start items-center p-3.5 bg-white/90 dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none w-max shadow-sm animate-pulse transition-colors duration-300">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-500 dark:text-indigo-400 uppercase">Thinking...</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <footer className="p-4 md:p-6 border-t border-slate-200/40 dark:border-slate-700/40 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md shrink-0 transition-colors duration-300">
          <form onSubmit={dispatchMessage} className="flex items-center bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 shadow-sm rounded-xl p-1.5 focus-within:border-slate-950 dark:focus-within:border-slate-200 transition-all">
            <input 
              type="text"
              value={inputVal}
              disabled={isComputing}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Add a task or ask a question..."
              className="flex-1 bg-transparent border-0 py-2.5 pl-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-50"
            />
            <button type="submit" disabled={!inputVal.trim() || isComputing} className="bg-slate-950 dark:bg-slate-100 hover:bg-slate-900 dark:hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-white dark:text-slate-900 p-2.5 rounded-lg transition">
              <FiSend className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}