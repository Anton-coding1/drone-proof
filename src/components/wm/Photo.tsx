import { useState } from "react";
import { photoSrcSet, photoUrl, type Photo as P } from "@/lib/photos";

/** Unsplash photo with responsive sizes, a credit line and a quiet fallback if it can't load. */
export function Photo({ photo, className = "", sizes = "100vw", priority = false, position = "center" }: { photo: P; className?: string; sizes?: string; priority?: boolean; position?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`bg-[radial-gradient(ellipse_at_30%_20%,#1b2433,#08090a_70%)] ${className}`} aria-hidden="true" />;
  return (
    <img
      src={photoUrl(photo, 2000)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer-when-downgrade"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      style={{ objectPosition: position }}
    />
  );
}

export function PhotoCredit({ photo, className = "" }: { photo: P; className?: string }) {
  return (
    <p className={`text-[11px] text-white/55 ${className}`}>
      Photo: <a href={`${photo.profile}?utm_source=witnessmark&utm_medium=referral`} target="_blank" rel="noreferrer" className="hover:text-white">{photo.credit}</a> /{" "}
      <a href="https://unsplash.com/?utm_source=witnessmark&utm_medium=referral" target="_blank" rel="noreferrer" className="hover:text-white">Unsplash</a>
    </p>
  );
}
