import React from "react";
import { motion } from "motion/react";

export default function LivingSignal() {
  const bars = Array.from({ length: 36 });
  const nodes = [
    { label: "EN", angle: 0 },
    { label: "HI", angle: 90 },
    { label: "ES", angle: 180 },
    { label: "AR", angle: 270 },
  ];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-center justify-center mt-12 w-full h-[220px]"
    >
      <div className="relative w-[200px] h-[200px] flex items-center justify-center">
        {/* Central Pulse */}
        <div 
          className="absolute w-8 h-8 bg-[#059669] rounded-full opacity-20"
          style={{ animation: "pulseCenter 4s ease-in-out infinite" }}
        />
        <div className="absolute w-2 h-2 bg-[#059669] rounded-full" />

        {/* Audio Ring */}
        <svg
          className="absolute inset-0 w-full h-full overflow-visible"
          viewBox="0 0 200 200"
        >
          <g transform="translate(100, 100)">
            {bars.map((_, i) => {
              const angle = (i * 360) / bars.length;
              const delay = (i % 6) * 0.1;
              return (
                <g key={i} transform={`rotate(${angle}) translate(0, -60)`}>
                  <rect
                    x="-0.75"
                    y="0"
                    width="1.5"
                    height="12"
                    fill="#4B5563"
                    style={{
                      transformOrigin: "center top",
                      animation: `audioBar 5s ease-in-out infinite ${delay}s`,
                    }}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Orbiting Nodes */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{ animation: "orbitRotate 24s linear infinite" }}
        >
          {nodes.map((node, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-8 h-8 -ml-4 -mt-4 bg-[#FAF8F5] border border-[#E8E2D9] rounded-full shadow-sm flex items-center justify-center"
              style={{
                transform: `rotate(${node.angle}deg) translateY(-85px)`,
              }}
            >
              <span 
                className="text-[9px] font-bold text-[#0D1117] font-mono"
                style={{ animation: "counterRotate 24s linear infinite" }}
              >
                {node.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulseCenter {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(3.5); opacity: 0.3; }
        }
        @keyframes audioBar {
          0%, 100% { transform: scaleY(1); opacity: 0.3; }
          50% { transform: scaleY(2.5); opacity: 0.8; }
        }
        @keyframes orbitRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes counterRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
      `}} />
    </motion.div>
  );
}
