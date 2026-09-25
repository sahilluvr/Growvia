export type Stage = "new" | "contacted" | "qualified" | "won" | "lost";
export type ContentStatus = "draft" | "approved" | "scheduled" | "published";
export type CampaignStatus = "draft" | "active" | "completed";

export type AppUser = { id: string; email: string; name: string };

export type Opportunity = { id: string; title: string; why: string; pitch?: string };

export type GrowthPlan = {
  generatedAt: string;
  summary: string;
  customers: string[];
  opportunities: Opportunity[];
  priorities: { title: string; agent: string; done?: boolean }[];
  roadmap: { day: number; text: string }[];
  channels: string[];
};

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  website: string | null;
  segment: string;
  city: string | null;
  goal: string | null;
  audience: string | null;
  offer: string | null;
  voice: string | null;
  channels: string[];
  plan: GrowthPlan | null;
  created_at: string;
  updated_at: string;
};

export type BusinessInput = Pick<Business, "name" | "website" | "segment" | "city" | "goal" | "audience" | "offer" | "voice" | "channels">;

export type Campaign = {
  id: string;
  owner_id: string;
  business_id: string;
  name: string;
  objective: string | null;
  channels: string[];
  status: CampaignStatus;
  created_at: string;
};

export type ContentItem = {
  id: string;
  owner_id: string;
  campaign_id: string;
  channel: string;
  kind: string;
  title: string;
  body: string;
  status: ContentStatus;
  scheduled_at: string | null;
  created_at: string;
};

export type Lead = {
  id: string;
  owner_id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  stage: Stage;
  value: number;
  notes: string | null;
  created_at: string;
  tags?: string[];
  unsubscribed?: boolean;
  email_status?: string;
  last_contacted_at?: string | null;
  last_replied_at?: string | null;
  wa_id?: string | null;
  fb_psid?: string | null;
  ig_id?: string | null;
  wa_opt_in?: boolean;
};

export type LeadInput = Pick<Lead, "name" | "email" | "phone" | "company" | "source" | "stage" | "value" | "notes" | "wa_opt_in">;

export type ActivityInput = { agent: string; text: string; tag?: string | null };

export type Activity = { id: string; owner_id: string; agent: string; text: string; tag: string | null; created_at: string };

export type NewContent = Pick<ContentItem, "channel" | "kind" | "title" | "body">;

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string };

export interface Repo {
  mode: "supabase";
  // auth
  getUser(): Promise<AppUser | null>;
  signUp(input: { email: string; password: string; name: string; redirectTo: string }): Promise<AuthResult>;
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
  updateProfile(name: string): Promise<AuthResult>;
  // business
  getBusiness(): Promise<Business | null>;
  saveBusiness(input: BusinessInput): Promise<Business>;
  savePlan(plan: GrowthPlan): Promise<void>;
  // campaigns & content
  listCampaigns(): Promise<(Campaign & { counts: Record<ContentStatus, number> })[]>;
  getCampaign(id: string): Promise<{ campaign: Campaign; items: ContentItem[] } | null>;
  createCampaign(input: { name: string; objective: string; channels: string[] }, items: NewContent[]): Promise<Campaign>;
  updateCampaign(id: string, patch: Partial<Pick<Campaign, "name" | "status">>): Promise<void>;
  deleteCampaign(id: string): Promise<void>;
  listContent(): Promise<ContentItem[]>;
  updateContent(id: string, patch: Partial<Pick<ContentItem, "title" | "body" | "status" | "scheduled_at">>): Promise<void>;
  // leads
  listLeads(): Promise<Lead[]>;
  createLead(input: LeadInput): Promise<Lead>;
  updateLead(id: string, patch: Partial<LeadInput>): Promise<void>;
  deleteLead(id: string): Promise<void>;
  // activity
  listActivity(limit?: number): Promise<Activity[]>;
  addActivity(a: ActivityInput | ActivityInput[]): Promise<void>;
  countLeads(stage: Stage): Promise<number>;
  // public
  publicBusiness(id: string): Promise<{ id: string; name: string; segment: string; city: string | null; offer: string | null } | null>;
  submitPublicLead(id: string, lead: { name: string; email: string; phone: string; message: string }): Promise<boolean>;
}
