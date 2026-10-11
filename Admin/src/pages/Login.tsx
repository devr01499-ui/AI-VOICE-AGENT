import React, { useEffect } from 'react';

export const Login: React.FC = () => {
  useEffect(() => {
    window.location.replace('/overview');
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="text-center space-y-3">
        <div className="h-12 w-12 mx-auto rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-indigo-500/20 animate-pulse">
          C
        </div>
        <h2 className="text-lg font-bold text-white">Claritiy Voice Admin Console</h2>
        <p className="text-xs text-indigo-400 font-mono">Bypassing Authentication &bull; Redirecting to Console...</p>
        <div className="pt-2">
          <a
            href="/overview"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium inline-block"
          >
            Enter Console
          </a>
        </div>
      </div>
    </div>
  );
};
