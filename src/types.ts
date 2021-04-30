export interface Language {
  code: string;
  name: string;
}

export interface Arguments {
  words?: string;
  nwords?: number;
  append?: boolean;
  get?: string;
  from?: string;
  to?: string;
  chunkSize: number;
  output: string;
  data?: string;
  save?: string;
  offset: number;
  header?: string;
  noExamples?: boolean;
  langs?: boolean;
}

export interface WordReferenceResult {
  word: string;
  pronWR?: string;
  audio?: string[];
  inflections?: string[];
  translations?: WordReferenceTranslation[];
  frequency?: number;
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

export interface FrequencyItem {
  word: string;
  frequency: number;
}

export interface ConjugationItem {
  inflected: string;
  dict: string[];
}

export interface MigakuDictionary {
  header?: string;
  frequency: string[];
  conjugations: ConjugationItem[];
  dictionary: MigakuDictionaryItem[];
}

export interface MigakuDictionaryItem {
  term: string;
  altterm: string;
  pronunciation: string;
  definition: string;
  pos: string;
  examples: string;
  audio: string;
}
