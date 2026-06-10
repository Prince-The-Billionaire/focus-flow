import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing authenticated user identity mapping' }, { status: 400 });
    }

    // 1. Fetch ALL messages for this authenticated user, sorted OLDEST first.
    // This makes sure the first message we encounter for a session_id is its starting chat.
    const { data: records, error } = await supabase
      .from('chat_messages')
      .select('session_id, text, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 2. Map tracking structures
    const sessionMap = new Map<string, { sessionId: string; preview: string; rawDate: Date }>();

    (records || []).forEach((row) => {
      if (!row.session_id) return;

      // If we haven't seen this session_id yet, this is the FIRST/STARTING chat message of the thread.
      if (!sessionMap.has(row.session_id)) {
        sessionMap.set(row.session_id, {
          sessionId: row.session_id,
          preview: row.text || 'New conversation...',
          rawDate: new Date(row.created_at)
        });
      }
    });

    // 3. Convert map to array and sort the final list so the conversations with the newest activity appear at the top
    const uniqueSessions = Array.from(sessionMap.values()).sort(
      (a, b) => b.rawDate.getTime() - a.rawDate.getTime()
    );

    // Format output dates nicely for presentation
    const formattedSessions = uniqueSessions.map(item => ({
      sessionId: item.sessionId,
      preview: item.preview,
      timestamp: item.rawDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }));

    return NextResponse.json({ sessions: formattedSessions });

  } catch (err: any) {
    console.error('Session aggregation loop failure:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}