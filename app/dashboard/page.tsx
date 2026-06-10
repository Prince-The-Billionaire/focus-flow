'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkspaceRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    // Generate a clean session token UUID step on empty landing requests
    const freshSessionToken = globalThis.crypto.randomUUID();
    router.replace(`/dashboard/${freshSessionToken}`);
  }, [router]);

  return (
    <div className="h-screen w-screen bg-[#fdfefe] flex items-center justify-center">
      <div className="text-xs font-mono text-slate-400 animate-pulse">
        Allocating Virtual Core Room Thread...
      </div>
    </div>
  );
}