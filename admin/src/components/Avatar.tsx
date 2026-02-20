import { useState } from "react";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ name, avatarUrl, size = 32, className = "" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const fontSize = size <= 24 ? "text-[10px]" : size <= 32 ? "text-xs" : size <= 40 ? "text-sm" : "text-base";

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center font-bold text-white flex-shrink-0 ${fontSize} ${className}`}
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
