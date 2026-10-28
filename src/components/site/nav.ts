import { LayoutGrid, PlaneTakeoff, FileSearch, Radar, RadioTower, Upload, ShieldCheck, Database, BookOpen, Lock, type LucideIcon } from "lucide-react";
import type { PhotoKey } from "@/lib/photos";

export interface NavItem {
  title: string;
  description: string;
  to: string;
  hash?: string | undefined;
  icon: LucideIcon;
}

export interface NavGroup {
  id: "product" | "trust";
  label: string;
  items: NavItem[];
  card: { photo: PhotoKey; title: string; text: string; to: string; cta: string };
  footnote: string;
}

export const navGroups: NavGroup[] = [
  {
    id: "product",
    label: "Product",
    items: [
      { title: "Overview", description: "How one record serves three decisions.", to: "/product", icon: LayoutGrid },
      { title: "Pre-flight check", description: "A clear GO or NO-GO before a drone flies.", to: "/pre-flight", icon: PlaneTakeoff },
      { title: "Incident evidence", description: "What the GPS environment was, after the fact.", to: "/evidence", icon: FileSearch },
      { title: "Site monitoring", description: "Continuous watch on places that rely on GPS.", to: "/monitor", icon: Radar },
      { title: "Ground sensors", description: "The street-level receivers behind the record.", to: "/network", icon: RadioTower },
      { title: "Try it with your data", description: "Upload a flight log and see the result.", to: "/demo", icon: Upload },
    ],
    card: {
      photo: "airportNight",
      title: "One product, one record",
      text: "An independent, street-level record of GPS jamming and spoofing, turned into decisions before and after a flight.",
      to: "/product",
      cta: "See the overview",
    },
    footnote: "This is a demo version. Anything simulated is labelled as such.",
  },
  {
    id: "trust",
    label: "Trust",
    items: [
      { title: "Security", description: "How the record is protected end to end.", to: "/trust", hash: "security", icon: ShieldCheck },
      { title: "Data handling", description: "What we collect, keep and delete.", to: "/trust", icon: Database },
      { title: "Method & limitations", description: "How results are made, and where they stop.", to: "/method", icon: BookOpen },
      { title: "Privacy", description: "Your data, your rights, plainly stated.", to: "/privacy", icon: Lock },
    ],
    card: {
      photo: "datacenter",
      title: "Security you can verify",
      text: "Controls are documented and checkable, not just claimed.",
      to: "/trust",
      cta: "Read about trust",
    },
    footnote: "Report a vulnerability via /.well-known/security.txt.",
  },
];

export const allPages: { title: string; to: string; hash?: string | undefined }[] = [
  { title: "Home", to: "/" },
  ...navGroups.flatMap((g) => g.items.map((i) => ({ title: i.title, to: i.to, hash: i.hash }))),
  { title: "About", to: "/about" },
  { title: "Terms", to: "/terms" },
  { title: "Accessibility", to: "/accessibility" },
];
