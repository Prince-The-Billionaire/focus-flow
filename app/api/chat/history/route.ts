import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    // 1. Enforce validation for both parameters to guarantee secure session mapping
    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Missing historical query parameters (sessionId and userId required)' }, 
        { status: 400 }
      );
    }

    // 2. Fetch all messages belonging strictly to this session AND this specific user id
    const { data: records, error } = await supabase
      .from('chat_messages')
      .select('id, role, text, created_at, trigger_data')
      .eq('session_id', sessionId)
      .eq('user_id', userId) // <-- Tight user isolation checkpoint
      .order('created_at', { ascending: true }); // Keep ascending order here so the conversation renders chronologically top-to-bottom

    if (error) throw error;

    // 3. Map database objects to your frontend-facing interface requirements
    const formattedMessages = (records || []).map((msg) => ({
      id: msg.id,
      // Protect uppercase evaluation against database layer text case transformations
      role: (msg.role || 'ASSISTANT').toUpperCase(), 
      text: msg.text,
      timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      triggerData: msg.trigger_data || undefined
    }));

    return NextResponse.json({ messages: formattedMessages });

  } catch (err: any) {
    console.error('API Error in chat history routing channel:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}