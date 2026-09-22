"use client";

import { useState } from "react";
import { User } from "lucide-react";

import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function Avatar({ src, alt, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable-domain profile photo URLs
        <img
          src={src as string}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <User className="h-1/2 w-1/2" aria-hidden="true" />
      )}
    </span>
  );
}
