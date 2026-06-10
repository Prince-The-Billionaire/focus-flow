import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing active identity mapping context token' }, { status: 400 });
    }

    // 1. Fetch raw emotion logs to compile historical distribution data frames
    const { data: emotionalLogs, error: emotionErr } = await supabase
      .from('emotion_logs')
      .select('id, emotion, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (emotionErr) throw emotionErr;

    // 2. Fetch the task alert operational records
    const { data: criticalAlerts, error: alertErr } = await supabase
      .from('task_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (alertErr) throw alertErr;

    // 3. Compute metric distribution weights
    const totalTasks = criticalAlerts?.length || 0;
    const completedTasks = criticalAlerts?.filter(t => t.status === 'completed').length || 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 4. Build a comprehensive frequency matrix accounting for every potential DistilBERT label
    const emotionFrequencyMatrix: Record<string, number> = {
      joy: 0,
      love: 0,
      surprise: 0,
      neutral: 0,
      sadness: 0,
      fear: 0,
      anger: 0
    };

    if (emotionalLogs && emotionalLogs.length > 0) {
      emotionalLogs.forEach((log) => {
        // FIXED: Replaced python's .strip() with JavaScript's native .trim()
        const key = (log.emotion || 'neutral').toLowerCase().trim();
        if (typeof emotionFrequencyMatrix[key] !== 'undefined') {
          emotionFrequencyMatrix[key]++;
        } else {
          // Dynamic allocation fallback for unexpected structural model variants
          emotionFrequencyMatrix[key] = 1;
        }
      });
    }

    return NextResponse.json({
      logs: emotionalLogs || [],
      alerts: criticalAlerts || [],
      metrics: {
        totalTasks,
        completedTasks,
        completionRate,
        emotionBreakdown: emotionFrequencyMatrix
      }
    });

  } catch (err: any) {
    console.error('Next.js Analytics Compilation Engine Loop Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}