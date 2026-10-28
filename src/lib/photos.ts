export type PhotoKey = "london" | "drone" | "rooftop" | "cityRoof" | "datacenter" | "tower" | "airportNight";

export interface PhotoMeta {
  id: string;
  alt: string;
  name: string;
  handle: string;
}

export const photos: Record<PhotoKey, PhotoMeta> = {
  london: { id: "photo-1697615235353-8547a571f0ea", alt: "London from the air at night", name: "Marc Kleen", handle: "marckleen" },
  drone: { id: "photo-1495764506633-93d4dfed7c6b", alt: "Silhouette of a quadcopter drone near a city", name: "Goh Rhy Yan", handle: "gohrhyyan" },
  rooftop: { id: "photo-1766788464879-ffb8f7d3be98", alt: "A receiver and antenna on a rooftop at night", name: "Juan Pablo", handle: "who0ne" },
  cityRoof: { id: "photo-1671593162654-bfab03c99442", alt: "A city at night seen from a rooftop", name: "weston m", handle: "shootnmatch" },
  datacenter: { id: "photo-1564457461758-8ff96e439e83", alt: "A server room", name: "Taylor Vick", handle: "tvick" },
  tower: { id: "photo-1782999236858-32f90b3f121e", alt: "An airport control tower with a radar dome", name: "Jeff", handle: "oknotok1" },
  airportNight: { id: "photo-1642575468355-3eef1e95ea70", alt: "An airport from the air at night", name: "Jack B", handle: "nervum" },
};

export function photoUrl(key: PhotoKey, w: number) {
  return `https://images.unsplash.com/${photos[key].id}?auto=format&fit=crop&q=75&w=${w}`;
}

export function photoSrcSet(key: PhotoKey, widths = [640, 960, 1280, 1920, 2560]) {
  return widths.map((w) => `${photoUrl(key, w)} ${w}w`).join(", ");
}
