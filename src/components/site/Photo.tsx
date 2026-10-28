import { useState } from "react";
import { cn } from "@/lib/utils";
import { photos, photoSrcSet, photoUrl, type PhotoKey } from "@/lib/photos";

const UTM = "?utm_source=witnessmark&utm_medium=referral";

export function Photo({
  photo,
  sizes = "100vw",
  className,
  priority,
}: {
  photo: PhotoKey;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const meta = photos[photo];
  return (
    <div className={cn("relative overflow-hidden bg-photo-fallback", className)}>
      {!failed && (
        <img
          src={photoUrl(photo, 1280)}
          srcSet={photoSrcSet(photo)}
          sizes={sizes}
          alt={meta.alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export function PhotoCredit({ photo, className }: { photo: PhotoKey; className?: string }) {
  const meta = photos[photo];
  return (
    <p className={cn("text-[11px] text-subtle", className)}>
      Photo:{" "}
      <a className="underline-offset-2 hover:underline" href={`https://unsplash.com/@${meta.handle}${UTM}`} target="_blank" rel="noreferrer">
        {meta.name}
      </a>{" "}
      /{" "}
      <a className="underline-offset-2 hover:underline" href={`https://unsplash.com/${UTM}`} target="_blank" rel="noreferrer">
        Unsplash
      </a>
    </p>
  );
}
