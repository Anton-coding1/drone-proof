/**
 * Stock photography from Unsplash (free Unsplash License). Unsplash asks that images are
 * hotlinked from their CDN and that photographers are credited, which we do on the page.
 */
export type Photo = { id: string; base: string; alt: string; credit: string; profile: string; page: string };

export const PHOTOS = {
  london: {
    id: "1XpGi31dgs8",
    base: "https://images.unsplash.com/photo-1697615235353-8547a571f0ea",
    alt: "London from the air at night",
    credit: "Marc Kleen",
    profile: "https://unsplash.com/@marckleen",
    page: "https://unsplash.com/photos/an-aerial-view-of-the-city-of-london-at-night-1XpGi31dgs8",
  },
  drone: {
    id: "p_5BnqHfz3Y",
    base: "https://images.unsplash.com/photo-1495764506633-93d4dfed7c6b",
    alt: "Silhouette of a quadcopter drone hovering near a city",
    credit: "Goh Rhy Yan",
    profile: "https://unsplash.com/@gohrhyyan",
    page: "https://unsplash.com/photos/p_5BnqHfz3Y",
  },
  rooftop: {
    id: "Oxyd5UEzc8s",
    base: "https://images.unsplash.com/photo-1766788464879-ffb8f7d3be98",
    alt: "A receiver and antenna on a rooftop at night",
    credit: "Juan Pablo",
    profile: "https://unsplash.com/@who0ne",
    page: "https://unsplash.com/photos/Oxyd5UEzc8s",
  },
  cityRoof: {
    id: "47IASDgMGDs",
    base: "https://images.unsplash.com/photo-1671593162654-bfab03c99442",
    alt: "A city at night seen from a rooftop",
    credit: "weston m",
    profile: "https://unsplash.com/@shootnmatch",
    page: "https://unsplash.com/photos/a-view-of-a-city-at-night-from-a-rooftop-47IASDgMGDs",
  },
  datacenter: {
    id: "aWslrFhs1w4",
    base: "https://images.unsplash.com/photo-1564457461758-8ff96e439e83",
    alt: "A server room with rows of cabinets under blue cables",
    credit: "Taylor Vick",
    profile: "https://unsplash.com/@tvick",
    page: "https://unsplash.com/photos/server-room-with-network-cabinets-aWslrFhs1w4",
  },
  tower: {
    id: "WGyw9o5wZDA",
    base: "https://images.unsplash.com/photo-1782999236858-32f90b3f121e",
    alt: "An airport control tower with a radar dome",
    credit: "Jeff",
    profile: "https://unsplash.com/@oknotok1",
    page: "https://unsplash.com/photos/modern-airport-control-tower-with-a-radar-dome-WGyw9o5wZDA",
  },
  airportNight: {
    id: "9YzaEjNamY4",
    base: "https://images.unsplash.com/photo-1642575468355-3eef1e95ea70",
    alt: "An airport from the air at night",
    credit: "Jack B",
    profile: "https://unsplash.com/@nervum",
    page: "https://unsplash.com/photos/an-aerial-view-of-an-airport-at-night-9YzaEjNamY4",
  },
} satisfies Record<string, Photo>;

export function photoUrl(p: Photo, w: number) {
  return `${p.base}?auto=format&fit=crop&q=75&w=${w}`;
}

export function photoSrcSet(p: Photo) {
  return [800, 1400, 2000, 2800].map((w) => `${photoUrl(p, w)} ${w}w`).join(", ");
}
