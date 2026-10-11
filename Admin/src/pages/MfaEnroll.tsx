import React, { useEffect } from 'react';

export const MfaEnroll: React.FC = () => {
  useEffect(() => {
    window.location.replace('/overview');
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
      <div className="text-center space-y-3">
        <div className="h-12 w-12 mx-auto rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg shadow-sm animate-pulse">
          C
        </div>
        <h2 className="text-lg font-bold text-white">Claritiy Voice Security Gateway</h2>
        <p className="text-xs text-zinc-400 font-mono">MFA Bypassed &bull; Redirecting to Console...</p>
        <div className="pt-2">
          <a
            href="/overview"
            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-xs inline-block"
          >
            Enter Console
          </a>
        </div>
      </div>
    </div>
  );
};
