import { FileSearch, LayoutGrid, MousePointerClick, Route as RouteIcon, ShieldCheck, BookOpen, Lock, FileText, type LucideIcon } from "lucide-react";
import { PHOTOS, type Photo } from "@/lib/photos";

export type NavLink = { label: string; to: string; hash?: string };
export type MenuItem = NavLink & { desc: string; icon: LucideIcon };
export type Menu = { label: string; items: MenuItem[]; feature: { photo: Photo; title: string; text: string; link: NavLink }; footnote: string };

export const MENUS: Menu[] = [
  {
    label: "Product",
    items: [
      { label: "Overview", desc: "One product for GPS interference, and how its parts fit together.", icon: LayoutGrid, to: "/product" },
      { label: "Pre-flight check", desc: "GO / CAUTION / NO-GO for GPS interference along a planned route.", icon: RouteIcon, to: "/pre-flight" },
      { label: "Incident evidence", desc: "Independent, tamper-evident evidence for drone claims.", icon: FileSearch, to: "/evidence" },
      { label: "Try it with your data", desc: "Every feature, with your own files or the samples provided.", icon: MousePointerClick, to: "/demo" },
    ],
    feature: { photo: PHOTOS.airportNight, title: "One product, one record", text: "Every feature draws on the same independent record of interference, and shows its reasons, confidence and limits.", link: { label: "See how it fits together", to: "/product" } },
    footnote: "This is a demo version. Anything simulated is labelled as such.",
  },
  {
    label: "Trust",
    items: [
      { label: "Security", desc: "How uploads, cases and data are protected.", icon: Lock, to: "/trust", hash: "security" },
      { label: "Data handling", desc: "What we store, who can see it and for how long.", icon: ShieldCheck, to: "/trust" },
      { label: "Method & limitations", desc: "Every rule and threshold, published and versioned.", icon: BookOpen, to: "/method" },
      { label: "Privacy", desc: "Your rights and how to reach us.", icon: FileText, to: "/privacy" },
    ],
    feature: { photo: PHOTOS.datacenter, title: "Security you can verify", text: "Server-computed fingerprints, a hash-chained audit trail and no secrets in the browser.", link: { label: "Read about security", to: "/trust", hash: "security" } },
    footnote: "Found a security issue? See /.well-known/security.txt for how to report it.",
  },
];

export const NAV_LINKS: NavLink[] = [{ label: "Method", to: "/method" }, { label: "About", to: "/about" }];

/** The product's features (used by search). */
export const FEATURES_NAV = MENUS[0]!.items.slice(0, 3);

export const FOOTER: { label: string; links: NavLink[] }[] = [
  { label: "Product", links: [
    { label: "Overview", to: "/product" },
    { label: "Pre-flight check", to: "/pre-flight" },
    { label: "Check a route", to: "/pre-flight/check" },
    { label: "Incident evidence", to: "/evidence" },
    { label: "Analyse a flight log", to: "/evidence", hash: "upload" },
    { label: "Try it with your data", to: "/demo" },
  ] },
  { label: "Method", links: [
    { label: "How it works", to: "/method" },
    { label: "Data sources", to: "/method", hash: "sources" },
    { label: "Limitations", to: "/method", hash: "limitations" },
    { label: "Changelog", to: "/method", hash: "changelog" },
  ] },
  { label: "Company", links: [
    { label: "About", to: "/about" },
    { label: "Trust & security", to: "/trust" },
  ] },
  { label: "Legal", links: [
    { label: "Privacy", to: "/privacy" },
    { label: "Terms", to: "/terms" },
    { label: "Accessibility", to: "/trust", hash: "accessibility" },
  ] },
];
