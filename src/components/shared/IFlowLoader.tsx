import React from "react";

export function IFlowLoader() {
  return (
    <div className="flex-1 w-full min-h-[75vh] flex flex-col items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-8">
        <div className="relative flex items-center justify-center">
          {/* Ambient Pulse Glow */}
          <div className="absolute w-28 h-28 bg-primary/20 blur-2xl rounded-full animate-pulse" />
          
          {/* Animated SVG Container */}
          <svg
            width="64"
            height="132"
            viewBox="0 0 178 370"
            className="relative z-10 overflow-visible"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 28 6 H 150 Q 172 6 172 28 V 76 Q 172 88 162 94 L 112 120 Q 95 128 86 138 Q 80 145 86 152 Q 95 162 112 170 L 162 196 Q 172 202 172 214 V 342 Q 172 364 150 364 H 28 Q 6 364 6 342 V 292 Q 6 280 16 274 L 66 248 Q 84 239 93 229 Q 99 222 93 214 Q 84 205 66 196 L 16 170 Q 6 164 6 152 V 28 Q 6 6 28 6 Z"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinejoin="round"
              className="text-primary"
              style={{
                strokeDasharray: 2500,
                strokeDashoffset: 2500,
                animation: "drawIFlow 3s ease-in-out infinite"
              }}
            />
          </svg>
          
          {/* Inline keyframes specifically for this component */}
          <style>{`
            @keyframes drawIFlow {
              0% { stroke-dashoffset: 2500; fill: transparent; }
              40% { stroke-dashoffset: 0; fill: transparent; }
              80% { stroke-dashoffset: 0; fill: currentColor; }
              100% { stroke-dashoffset: 0; fill: currentColor; }
            }
          `}</style>
        </div>

        {/* Text and bouncing dots */}
        <div className="flex flex-col items-center gap-3">
          <h3 className="text-sm font-bold tracking-[0.4em] uppercase text-text-primary ml-2 animate-pulse">
            IFlow
          </h3>

        </div>
      </div>
    </div>
  );
}
