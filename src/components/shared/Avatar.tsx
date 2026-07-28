import React from "react";

interface AvatarProps {
  name?: string;
  color?: string;
  displayName?: string;
  avatarColor?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Avatar({ name, color, displayName, avatarColor, size = "md" }: AvatarProps) {
  const finalName = name || displayName || "Unknown";
  const finalColor = color || avatarColor || "#ccc";
  
  const initials = finalName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const sizeClasses = {
    sm: "w-8 h-8 text-[11px]",
    md: "w-10 h-10 text-[13px]",
    lg: "w-12 h-12 text-[15px]",
    xl: "w-full h-full text-[28px]",
  };

  const isXl = size === "xl";

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0 overflow-hidden ${!isXl ? sizeClasses[size] : ""}`}
      style={{ 
        background: finalColor,
        ...(isXl ? { width: "100%", height: "100%", fontSize: "28px" } : {})
      }}
    >
      {initials}
    </div>
  );
}
