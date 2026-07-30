import React from "react";

export function IFlowLoader() {
  return (
    <div className="flex-1 w-full h-full min-h-[50vh] flex flex-col items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-8">
        <div className="relative flex items-center justify-center">
          {/* Ambient Pulse Glow */}
          <div className="absolute w-28 h-28 bg-primary/20 blur-2xl rounded-full animate-pulse" />
          
          {/* Animated SVG Container */}
          <svg
            width="64"
            height="64"
            viewBox="0 0 100 100"
            className="relative z-10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer rotating subtle dashed ring */}
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-primary/30 origin-center animate-[spin_10s_linear_infinite]"
              strokeDasharray="4 8"
            />
            
            {/* Inner bold infinity flow path */}
            <path
              d="M25 50 C25 25 45 30 50 50 C55 70 75 75 75 50 C75 25 55 30 50 50 C45 70 25 75 25 50 Z"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary origin-center"
              style={{
                strokeDasharray: 210,
                strokeDashoffset: 0,
                animation: "drawIFlow 2.5s ease-in-out infinite alternate"
              }}
            />
            
            {/* Orbiting dot */}
            <circle
              cx="50"
              cy="6"
              r="4"
              fill="currentColor"
              className="text-primary origin-center animate-[spin_2s_linear_infinite]"
            />
          </svg>
          
          {/* Inline keyframes specifically for this component */}
          <style>{`
            @keyframes drawIFlow {
              0% { stroke-dashoffset: 210; }
              40% { stroke-dashoffset: 0; }
              100% { stroke-dashoffset: 0; }
            }
          `}</style>
        </div>

        {/* Text and bouncing dots */}
        <div className="flex flex-col items-center gap-3">
          <h3 className="text-sm font-bold tracking-[0.4em] uppercase text-text-primary ml-2 animate-pulse">
            IFlow
          </h3>
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
