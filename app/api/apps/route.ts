import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET: Check active connection status loops for third party service nodes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'Identity parameters required for infrastructure checkout' }, { status: 400 });
    }

    // Pull configuration rows out of user token authorization charts
    const { data: tokens, error } = await supabase
      .from('user_oauth_tokens')
      .select('provider_token, created_at')
      .eq('user_id', userId)
      .single();

    // Construct a system ecosystem map listing active links
    const applicationsIntegrationMatrix = [
      {
        id: 'google_calendar',
        name: 'Google Calendar API Linker',
        connected: !!tokens?.provider_token,
        lastSynced: tokens?.created_at || null,
        scope: 'https://www.googleapis.com/auth/calendar.events'
      },
      {
        id: 'system_alarms',
        name: 'Local Hardware Sound Sintetizer Matrix',
        connected: true, // Native browser AudioContext driver framework loop
        lastSynced: new Date().toISOString(),
        scope: 'Web Audio Driver Hardware Layer API'
      }
    ];

    return NextResponse.json({ integrations: applicationsIntegrationMatrix });

  } catch (err: any) {
    console.error('Ecosystem integration routing error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Break an application link or update connection credentials manual status frames
export async function POST(request: Request) {
  try {
    const { userId, appId, action } = await request.json();

    if (!userId || !appId || !action) {
      return NextResponse.json({ error: 'Missing target runtime application drop commands' }, { status: 400 });
    }

    if (action === 'disconnect') {
      if (appId === 'google_calendar') {
        const { error } = await supabase
          .from('user_oauth_tokens')
          .delete()
          .eq('user_id', userId);

        if (error) throw error;
      }
      return NextResponse.json({ success: true, message: `Application ${appId} split link purged safely.` });
    }

    return NextResponse.json({ error: 'Unsupported application mutation method sequence configuration' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}