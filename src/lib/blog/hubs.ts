// Industry guide hubs. Each hub has a pillar guide; supporting guides set `hub:` in their front matter,
// so pages can link pillar ↔ guides ↔ local market pages automatically.
export type Hub = { id: string; name: string; who: string; pillar: string; blurb: string };

export const HUBS: Hub[] = [
  { id: "dentists", name: "Dentists", who: "dental practices", pillar: "ai-marketing-for-dentists", blurb: "New patients, recalls, HIPAA-safe reviews and local SEO for dental practices." },
  { id: "lawyers", name: "Lawyers", who: "law firms", pillar: "ai-marketing-for-lawyers", blurb: "Intake speed, bar-compliant ads, reviews and local SEO for law firms." },
  { id: "healthcare", name: "Medical & wellness", who: "clinics, chiropractors, med spas and therapists", pillar: "ai-marketing-for-medical-practices", blurb: "Patient acquisition without HIPAA headaches for clinics, chiropractors, med spas and PT." },
  { id: "home-services", name: "Home services", who: "plumbers, HVAC, roofers and electricians", pillar: "ai-marketing-for-home-services", blurb: "Win 'near me' calls, never miss a lead, and ride the seasons." },
  { id: "real-estate", name: "Real estate", who: "real estate agents and teams", pillar: "ai-marketing-for-real-estate-agents", blurb: "Hyperlocal SEO, fast follow-up and video for agents and teams." },
  { id: "accountants", name: "Accountants & CPAs", who: "accounting and tax firms", pillar: "ai-marketing-for-accountants-cpas", blurb: "Fill the calendar before tax season and keep clients all year." },
  { id: "restaurants", name: "Restaurants", who: "restaurants and cafés", pillar: "ai-marketing-for-restaurants", blurb: "Google Maps, reviews and regulars who come back." },
  { id: "salons", name: "Salons & spas", who: "salons, barbers and spas", pillar: "ai-marketing-for-salons-spas", blurb: "Rebooking, reviews and Instagram that fills the chair." },
  { id: "fitness", name: "Gyms & studios", who: "gyms and fitness studios", pillar: "ai-marketing-for-gyms-fitness-studios", blurb: "Trials that convert and members who stay." },
];
export const hubById = (id?: string) => HUBS.find((h) => h.id === id);
