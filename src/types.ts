import { Element } from "domhandler";

export interface WordReferenceResult {
  word: string;
  pronWR?: string;
  audio?: Element[];
  translations?: WordReferenceTranslation[];
}

export interface WordReferenceTranslation {
  title: string;
  translations: WordReferenceTranslationItem[];
}

export interface WordReferenceTranslationItem {
  from: string;
  fromType: string;
  toType: string;
  to: string;
  example: WordReferenceExample;
}

export interface WordReferenceExample {
  from: string[];
  to: string[];
}

export interface Arguments {
  words?: string;
  nwords?: number;
  append?: string;
  search?: string;
  from: string;
  to: string;
  chunkSize: number;
}
