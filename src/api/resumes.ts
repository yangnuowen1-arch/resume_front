import type { ApiId } from "./types";

export type ResumeParseStatus = "pending" | "parsing" | "parsed" | "failed";

export interface Resume {
  id: ApiId;
  candidateId?: ApiId;
  candidateName?: string;
  originalFilename?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
  rawText?: string;
  language?: string;
  createdAt?: string;
  parseStatus: ResumeParseStatus;
  parseError?: string;
  parsedAt?: string;
  fileKey?: string;
  parsedData?: string;
}
