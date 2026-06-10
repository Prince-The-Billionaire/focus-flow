import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing authenticated user identity' }, { status: 400 });
    }

    const { data: records, error } = await supabase
      .from('task_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ tasks: records || [] });
  } catch (err: any) {
    console.error('[API TASKS GET EXCEPTION]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    console.log('[API TASKS INCOMING PAYLOAD]:', rawBody);

    const targetUserId = rawBody.userId || rawBody.user_id;
    const targetSessionId = rawBody.sessionId || rawBody.session_id;
    const targetTask = rawBody.task;
    const targetApp = rawBody.app || 'Focus Core Engine';
    const targetTimeDue = rawBody.time_due || rawBody.timeDue || 'Immediate';

    if (!targetUserId || !targetTask) {
      return NextResponse.json({ error: 'Missing baseline validation properties' }, { status: 400 });
    }

    // Attempt 1: Standard snake_case database schema arrangement
    let databasePayload: Record<string, any> = {
      user_id: targetUserId,
      session_id: targetSessionId || null,
      task: targetTask,
      app: targetApp,
      time_due: targetTimeDue,
      status: 'pending'
    };

    console.log('[API TASKS EXECUTION TRY 1 - snake_case]:', databasePayload);
    let { data: record, error: supabaseError } = await supabase
      .from('task_alerts')
      .insert([databasePayload])
      .select()
      .single();

    // Catch schema cache mismatch errors (PGRST204) and execute camelCase fallback fallback
    if (supabaseError && (supabaseError.code === 'PGRST204' || supabaseError.message?.includes('session_id'))) {
      console.warn('[API TASKS WARNING]: Column session_id not found. Attempting camelCase structural swap...');
      
      databasePayload = {
        userId: targetUserId,
        sessionId: targetSessionId || null,
        task: targetTask,
        app: targetApp,
        timeDue: targetTimeDue,
        status: 'pending'
      };

      console.log('[API TASKS EXECUTION TRY 2 - camelCase]:', databasePayload);
      const retryResult = await supabase
        .from('task_alerts')
        .insert([databasePayload])
        .select()
        .single();

      record = retryResult.data;
      supabaseError = retryResult.error;
    }

    if (supabaseError) {
      console.error('[API TASKS CRITICAL SUPABASE ERROR]:', supabaseError);
      throw supabaseError;
    }

    console.log('[API TASKS SYSTEM COMTTED SUCCESSFULLY]:', record?.id);
    return NextResponse.json({ success: true, task: record });

  } catch (err: any) {
    console.error('[API TASKS POST CRITICAL EXCEPTION]:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal processing pipeline sync fault',
      details: err
    }, { status: 500 });
  }
}