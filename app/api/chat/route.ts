import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { userId, userInput, sessionId } = await request.json();

    // Enforce parameter validation constraints for secure data mapping
    if (!userId || !userInput || !sessionId) {
      return NextResponse.json({ error: 'Missing active channel parameters' }, { status: 400 });
    }

    // 1. Fetch recent chat history context belonging strictly to this user and session
    const { data: dbHistory } = await supabase
      .from('chat_messages')
      .select('role, text')
      .eq('session_id', sessionId)
      .eq('user_id', userId) // <-- User isolation checkpoint
      .order('created_at', { ascending: true })
      .limit(8);

    const historyContext = (dbHistory || []).map((msg) => ({
      role: msg.role?.toUpperCase() === 'USER' ? 'user' : 'assistant',
      content: msg.text,
    }));

    // 2. Log user's incoming question prompt message node row
    const userMessageId = globalThis.crypto.randomUUID();
    await supabase.from('chat_messages').insert({
      id: userMessageId,
      session_id: sessionId,
      user_id: userId,
      role: 'USER',
      text: userInput,
    });

    // 3. Dispatch stateless payload token over to your Python daemon for processing
    const pythonResponse = await fetch('http://127.0.0.1:8000/api/process-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: userInput,
        history_context: historyContext,
      }),
    });

    if (!pythonResponse.ok) throw new Error('Python NLU Inference pipeline exception.');
    const intentData = await pythonResponse.json();
    const assistantMessageId = globalThis.crypto.randomUUID();

    // 4. PROCESS ACTIVE AUTOMATIONS, ALARMS & GOOGLE CALENDAR PIPELINES
    if (intentData.alarm_data && Array.isArray(intentData.alarm_data)) {
      
      // Pull Google OAuth access tokens belonging to the authenticated identity mapping
      const { data: userTokens } = await supabase
        .from('user_oauth_tokens')
        .select('provider_token, provider_refresh_token')
        .eq('user_id', userId)
        .single();

      for (const alert of intentData.alarm_data) {
        if (alert.action === 'create') {
          // Log task automation alert trace record locally
          await supabase.from('task_alerts').insert({
            user_id: userId,
            session_id: sessionId,
            task: alert.task,
            app: alert.app || 'Google Calendar Core',
            time_due: alert.time_due || '',
            status: 'pending',
          });

          // If valid integration authorization state records exist, proceed with API synchronization
          if (userTokens?.provider_token) {
            try {
              const oauth2Client = new google.auth.OAuth2();
              oauth2Client.setCredentials({
                access_token: userTokens.provider_token,
                refresh_token: userTokens.provider_refresh_token
              });

              const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
              
              const eventStartTime = new Date();
              eventStartTime.setMinutes(eventStartTime.getMinutes() + 15); 
              const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60000); // 30-minute default duration window

              await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                  summary: `FocusFlow: ${alert.task}`,
                  description: 'Automated task created via your FocusFlow Engine Workspace panel.',
                  start: { dateTime: eventStartTime.toISOString() },
                  end: { dateTime: eventEndTime.toISOString() },
                  reminders: { useDefault: true }
                },
              });
              console.log(`✅ Successfully injected event row straight to Google Calendar Api for: ${alert.task}`);
            } catch (calErr) {
              console.error("❌ Google Calendar write exception context failure:", calErr);
            }
          }
        } else if (alert.action === 'complete') {
          // Complete tasks targeting only those matching the active authenticated user
          await supabase
            .from('task_alerts')
            .update({ status: 'completed' })
            .eq('user_id', userId)
            .ilike('task', `%${alert.task}%`);
        }
      }
    }

    // 5. Save the DistilBERT emotional telemetry metric trace log to database
    // Normalizes labels to lowercase matching chart breakdown requirements
    const derivedEmotion = (intentData.detected_emotion || 'neutral').toLowerCase();
    await supabase.from('emotion_logs').insert({
      user_id: userId,
      emotion: derivedEmotion,
    });

    // 6. Write Assistant reply data block record row 
    await supabase.from('chat_messages').insert({
      id: assistantMessageId,
      session_id: sessionId,
      user_id: userId,
      role: 'ASSISTANT',
      text: intentData.reply,
      trigger_data: intentData.alarm_data || null,
    });

    // Send payload response structure out to match frontend types safely
    return NextResponse.json({
      sessionId: sessionId,
      userMessage: { id: userMessageId, text: userInput, role: 'USER' },
      assistantMessage: {
        id: assistantMessageId,
        text: intentData.reply,
        role: 'ASSISTANT',
        triggerData: intentData.alarm_data || [],
        emotion: derivedEmotion,
      },
    });

  } catch (err: any) {
    console.error('Next.js Main Stream Exception Routing Interception Loop:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}