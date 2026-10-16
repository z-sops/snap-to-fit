// Navigation map shared by the bottom bar, the slide-out menu and the root
// route guard. Pure data/helpers only, so it can be covered by node tests.

export type AppRoute =
  | "/"
  | "/food"
  | "/move"
  | "/health"
  | "/meal-plan"
  | "/metabolic"
  | "/journey"
  | "/medicines"
  | "/cgm"
  | "/coach"
  | "/education"
  | "/gyms"
  | "/music"
  | "/settings"
  | "/account"
  | "/subscription"
  | "/legal"
  | "/onboarding"
  | "/numbers"
  | "/report"
  | "/exercises";

export interface NavItem {
  href: AppRoute;
  label: string;
  icon: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Routes that stay reachable before a profile exists. */
export const publicRoutes: readonly AppRoute[] = [
  "/onboarding",
  "/account",
  "/legal",
  "/gyms",
];

export const mainTabs: readonly NavItem[] = [
  { href: "/", label: "Today", icon: "today-outline" },
  { href: "/food", label: "Food", icon: "restaurant-outline" },
  { href: "/move", label: "Move", icon: "barbell-outline" },
  { href: "/health", label: "Health", icon: "pulse-outline" },
];

const profiledSections: NavSection[] = [
  { title: "Main", items: [...mainTabs] },
  {
    title: "Plan and track",
    items: [
      { href: "/report", label: "Weekly report", icon: "bar-chart-outline" },
      { href: "/numbers", label: "My numbers (BMR, TDEE, BMI)", icon: "calculator-outline" },
      { href: "/meal-plan", label: "Meal plan", icon: "calendar-outline" },
      { href: "/metabolic", label: "Tracker", icon: "stats-chart-outline" },
      { href: "/journey", label: "Journey", icon: "trending-up-outline" },
      { href: "/medicines", label: "GLP-1 & medicines", icon: "medkit-outline" },
      { href: "/cgm", label: "CGM readings", icon: "water-outline" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/coach", label: "Coach", icon: "chatbubbles-outline" },
      { href: "/education", label: "Gym Truth", icon: "school-outline" },
      { href: "/gyms", label: "Gyms", icon: "location-outline" },
      { href: "/music", label: "Music", icon: "musical-notes-outline" },
    ],
  },
  {
    title: "You",
    items: [
      { href: "/settings", label: "Settings", icon: "settings-outline" },
      { href: "/account", label: "Account and backup", icon: "person-circle-outline" },
      { href: "/subscription", label: "Plans", icon: "star-outline" },
      { href: "/legal", label: "Privacy and terms", icon: "shield-checkmark-outline" },
    ],
  },
];

const setupSections: NavSection[] = [
  {
    title: "Get started",
    items: [
      { href: "/onboarding", label: "Set up my profile", icon: "person-add-outline" },
      { href: "/account", label: "Sign in", icon: "log-in-outline" },
      { href: "/gyms", label: "Gyms", icon: "location-outline" },
      { href: "/legal", label: "Privacy and terms", icon: "shield-checkmark-outline" },
    ],
  },
];

/** Menu sections. Without a profile only routes the guard allows are listed. */
export function menuSections(hasProfile: boolean): NavSection[] {
  return hasProfile ? profiledSections : setupSections;
}

/** Normalise router pathnames ("/index", trailing slash, query) to a route. */
export function normalizePath(path: string | null | undefined): string {
  if (!path) return "/";
  let p = path.split(/[?#]/)[0] || "/";
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  if (p === "/index") return "/";
  return p;
}

/** Which bottom tab is selected, or null when the screen is not a main tab. */
export function activeMainTab(path: string | null | undefined): AppRoute | null {
  const p = normalizePath(path);
  return mainTabs.find((t) => t.href === p)?.href ?? null;
}

export function isActive(path: string | null | undefined, href: AppRoute) {
  return normalizePath(path) === href;
}

/** Every route file (except the layout) must appear in the profiled menu. */
export function allMenuRoutes(): AppRoute[] {
  return [...new Set(profiledSections.flatMap((s) => s.items.map((i) => i.href)))];
}
