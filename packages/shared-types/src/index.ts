export type Plan = "STARTER" | "PRO" | "AGENCY";
export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "UNKNOWN";
export type PlatformKey = "CHATGPT" | "PERPLEXITY" | "GEMINI" | "AI_OVERVIEW";
export type RecommendationType =
  | "KEYWORD_GAP" | "SCHEMA_MARKUP" | "REVIEW_SIGNAL"
  | "CITATION_GAP" | "SENTIMENT_ISSUE" | "COMPETITOR_OVERTAKE";

export interface Business {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
  website?: string | null;
}

export interface ScoreBreakdown {
  appearanceRate: number;
  rankScore: number;
  sentimentScore: number;
  citationScore: number;
  weights: Record<string, number>;
}

export interface VisibilityScore {
  score: number;
  breakdown: ScoreBreakdown;
  computedAt: string;
}

export interface ScoreResponse {
  current: VisibilityScore | null;
  trend: { score: number; computedAt: string }[];
}

export interface RecommendationArtifact {
  kind: "code" | "text";
  content: string;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  severity: Severity;
  title: string;
  message: string;
  artifact: RecommendationArtifact | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
}

export interface CompetitorRow {
  name: string;
  appears: number;
  total: number;
  you: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
