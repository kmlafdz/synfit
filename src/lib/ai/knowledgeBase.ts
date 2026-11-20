/**
 * SYNFIT AI FOUNDATION - KNOWLEDGE BASE & RETRIEVAL ENGINE
 * Ingests, chunks, indexes, and retrieves verified official SynFit documents.
 * Employs deterministic BM25 / lexical scoring with pluggable KnowledgeRetriever interface.
 */

import fs from "fs";
import path from "path";

export interface KnowledgeDocumentMetadata {
  id: string;
  title: string;
  category: string;
  verificationStatus: "VERIFIED" | "NEEDS_VERIFICATION" | "DEPRECATED";
  updatedAt: string;
  version: string;
}

export interface KnowledgeChunk {
  chunkId: string;
  docId: string;
  docTitle: string;
  category: string;
  heading: string;
  content: string;
  isVerified: boolean;
  keywords: string[];
}

export interface RetrievalOptions {
  category?: string;
  topK?: number;
  minScoreThreshold?: number;
}

export interface ScoredChunk {
  chunk: KnowledgeChunk;
  score: number;
  matchedKeywords: string[];
}

export interface RetrievalResult {
  query: string;
  totalChunksSearched: number;
  results: ScoredChunk[];
  hasSufficientContext: boolean;
}

export interface KnowledgeRetriever {
  retrieve(query: string, options?: RetrievalOptions): Promise<RetrievalResult>;
}

// SynFit Verified Knowledge Base Static Registry (acts as embedded high-performance cache)
const KNOWLEDGE_DOCS_DIR = path.join(process.cwd(), "docs", "knowledge");

// Indonesian stop words and generic domain filler words
const STOP_WORDS = new Set([
  "yang", "di", "dan", "dari", "ke", "ini", "itu", "untuk", "pada", "adalah",
  "dengan", "atau", "sebagai", "dalam", "bisa", "ada", "saya", "kamu", "anda",
  "kami", "kita", "apa", "apakah", "bagaimana", "berapa", "kapan", "dimana",
  "the", "is", "at", "which", "on", "in", "and", "or", "to", "for", "of", "a", "an",
  // Generic gym domain words that do not distinguish specific topics
  "synfit", "areta", "fitness", "gym"
]);

// Indonesian common synonyms mapping for enhanced keyword retrieval
const SYNONYM_MAP: Record<string, string[]> = {
  "harga": ["tarif", "biaya", "bayar", "paket", "cost", "price", "fee"],
  "tarif": ["harga", "biaya", "bayar", "paket"],
  "biaya": ["harga", "tarif", "bayar"],
  "jadwal": ["jam", "waktu", "buka", "tutup", "operasional", "hours"],
  "jam": ["jadwal", "waktu", "operasional"],
  "waktu": ["jadwal", "jam", "operasional"],
  "buka": ["jam", "jadwal", "operasional"],
  "tutup": ["jam", "jadwal", "operasional"],
  "daftar": ["registrasi", "join", "gabung", "membership", "register"],
  "registrasi": ["daftar", "membership", "gabung"],
  "harian": ["visit", "drop", "drop-in", "sehari"],
  "visit": ["harian", "drop", "drop-in", "sehari"],
  "drop": ["harian", "visit", "drop-in", "sehari"],
  "sehari": ["harian", "visit", "drop"],
  "alat": ["peralatan", "equipment", "mesin", "dumbbell", "barbell", "treadmill"],
  "fasilitas": ["loker", "shower", "wifi", "kamar mandi"],
  "coach": ["pelatih", "instruktur", "form coach", "ai form", "ai", "asisten"],
  "lokasi": ["alamat", "tempat", "peta", "maps", "dimana"],
  "alamat": ["lokasi", "tempat", "maps", "dimana"],
  "olahraga": ["latihan", "workout"],
  "berolahraga": ["olahraga", "latihan", "workout"],
  "duit": ["harga", "biaya", "tarif", "bayar", "paket"],
  "join": ["daftar", "membership", "gabung"],
  "sebulan": ["bulan", "bulanan"],
  "weekend": ["sabtu", "minggu", "pekan", "operasional", "jam"],
  "squat": ["jongkok", "kaki", "paha", "quads", "depth", "lutut"],
  "pushup": ["push-up", "dada", "chest", "push up", "tangan", "lengan", "plank"],
  "curl": ["bicep", "bisep", "biceps", "dumbbell", "tekuk", "lengan"],
  "postur": ["form", "teknik", "gerakan", "posisi", "sikap", "biomekanika"],
  "kunjungan": ["checkin", "check-in", "datang", "hadir", "visit", "kehadiran"],
  "expired": ["kadaluarsa", "habis", "tenggat", "berlaku", "masa aktif"],
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function expandSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    if (SYNONYM_MAP[token]) {
      for (const syn of SYNONYM_MAP[token]) {
        expanded.add(syn);
      }
    }
  }
  return Array.from(expanded);
}

/**
 * Parses markdown document content into structured metadata and sections.
 * Excludes frontmatter header from search index.
 */
export function parseMarkdownDocument(rawContent: string, fallbackFileName: string): {
  metadata: KnowledgeDocumentMetadata;
  chunks: KnowledgeChunk[];
} {
  const lines = rawContent.split("\n");
  let docId = fallbackFileName.replace(/\.md$/, "");
  let title = "SynFit Knowledge Document";
  let category = "general";
  let verificationStatus: "VERIFIED" | "NEEDS_VERIFICATION" | "DEPRECATED" = "VERIFIED";
  let updatedAt = new Date().toISOString();
  let version = "1.0.0";

  // Parse header block
  for (const line of lines.slice(0, 15)) {
    const idMatch = line.match(/\*\*ID Dokumen:\*\*\s*`?([^`\n]+)`?/i);
    if (idMatch) docId = idMatch[1].trim();

    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch) title = titleMatch[1].trim();

    const catMatch = line.match(/\*\*Kategori:\*\*\s*`?([^`\n]+)`?/i);
    if (catMatch) category = catMatch[1].trim();

    const statusMatch = line.match(/\*\*Status Verifikasi:\*\*\s*`?([^`\n]+)`?/i);
    if (statusMatch) {
      const s = statusMatch[1].trim().toUpperCase();
      if (s === "NEEDS_VERIFICATION" || s === "DEPRECATED" || s === "VERIFIED") {
        verificationStatus = s;
      }
    }

    const versionMatch = line.match(/\*\*Versi:\*\*\s*`?([^`\n]+)`?/i);
    if (versionMatch) version = versionMatch[1].trim();
  }

  // Split into chunks by Markdown Heading (## and ###)
  const sections: { heading: string; lines: string[] }[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("### ")) {
      if (currentHeading && currentLines.length > 0) {
        sections.push({ heading: currentHeading, lines: currentLines });
      }
      currentHeading = line.replace(/^#{2,3}\s+/, "").trim();
      currentLines = [];
    } else if (currentHeading) {
      // Only collect lines after the first heading (skipping frontmatter header)
      currentLines.push(line);
    }
  }

  if (currentHeading && currentLines.length > 0) {
    sections.push({ heading: currentHeading, lines: currentLines });
  }

  const chunks: KnowledgeChunk[] = sections.map((sec, idx) => {
    const content = sec.lines.join("\n").trim();
    const isNeedsVerif = content.includes("[NEEDS_VERIFICATION]") || verificationStatus === "NEEDS_VERIFICATION";
    return {
      chunkId: `${docId}_chk_${idx + 1}`,
      docId,
      docTitle: title,
      category,
      heading: sec.heading,
      content,
      isVerified: !isNeedsVerif,
      keywords: tokenize(`${title} ${sec.heading} ${content}`),
    };
  }).filter((c) => c.content.length > 15);

  return {
    metadata: {
      id: docId,
      title,
      category,
      verificationStatus,
      updatedAt,
      version,
    },
    chunks,
  };
}

/**
 * Lexical / BM25-inspired Knowledge Retriever for SynFit documentation.
 */
export class LocalKnowledgeRetriever implements KnowledgeRetriever {
  private chunks: KnowledgeChunk[] = [];
  private isLoaded = false;

  constructor() {
    this.loadDocuments();
  }

  public loadDocuments(): void {
    this.chunks = [];
    try {
      if (fs.existsSync(KNOWLEDGE_DOCS_DIR)) {
        const files = fs.readdirSync(KNOWLEDGE_DOCS_DIR).filter((f) => f.endsWith(".md"));
        for (const file of files) {
          const filePath = path.join(KNOWLEDGE_DOCS_DIR, file);
          const raw = fs.readFileSync(filePath, "utf-8");
          const { chunks } = parseMarkdownDocument(raw, file);
          this.chunks.push(...chunks);
        }
      }
    } catch (err) {
      console.warn("Notice: Loading knowledge documents from filesystem encountered:", err);
    }
    this.isLoaded = true;
  }

  public getChunkCount(): number {
    return this.chunks.length;
  }

  public async retrieve(query: string, options: RetrievalOptions = {}): Promise<RetrievalResult> {
    if (!this.isLoaded || this.chunks.length === 0) {
      this.loadDocuments();
    }

    const topK = options.topK || 4;
    const minThreshold = options.minScoreThreshold ?? 1.5;
    const queryTokens = tokenize(query);
    const expandedTokens = expandSynonyms(queryTokens);

    if (queryTokens.length === 0) {
      return {
        query,
        totalChunksSearched: this.chunks.length,
        results: [],
        hasSufficientContext: false,
      };
    }

    const scored: ScoredChunk[] = [];

    for (const chunk of this.chunks) {
      if (options.category && chunk.category !== options.category) {
        continue;
      }

      let score = 0;
      const matchedKeywords: string[] = [];
      const headingTokens = tokenize(chunk.heading);
      const titleTokens = tokenize(chunk.docTitle);

      for (const token of expandedTokens) {
        const isOriginalQueryToken = queryTokens.includes(token);
        const weight = isOriginalQueryToken ? 1.0 : 0.6;

        // Match in heading (high weight)
        if (headingTokens.includes(token)) {
          score += 3.0 * weight;
          matchedKeywords.push(token);
        }

        // Match in document title (moderate weight)
        if (titleTokens.includes(token)) {
          score += 2.0 * weight;
          matchedKeywords.push(token);
        }

        // Match in body text
        const bodyMatches = chunk.keywords.filter((kw) => kw === token).length;
        if (bodyMatches > 0) {
          score += Math.min(bodyMatches, 5) * 1.0 * weight;
          matchedKeywords.push(token);
        }
      }

      // De-prioritize unverified chunks
      if (!chunk.isVerified) {
        score *= 0.5;
      }

      if (score >= minThreshold) {
        scored.push({
          chunk,
          score: Math.round(score * 10) / 10,
          matchedKeywords: Array.from(new Set(matchedKeywords)),
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.slice(0, topK);

    // Strict Entity Coverage Verification:
    // Ensures that queries asking about non-existent features (e.g. sauna, pool, futsal)
    // are not falsely matched just because they contain generic words like 'fasilitas'.
    const topMatched = topResults.length > 0 ? topResults[0].matchedKeywords : [];
    const matchedOriginalTokens = queryTokens.filter(
      (qt) => topMatched.includes(qt) || (SYNONYM_MAP[qt] && SYNONYM_MAP[qt].some((syn) => topMatched.includes(syn)))
    );

    const tokenCoverageRatio = queryTokens.length > 0 ? matchedOriginalTokens.length / queryTokens.length : 0;
    const hasSufficientContext =
      topResults.length > 0 &&
      topResults[0].score >= minThreshold &&
      tokenCoverageRatio >= 0.4;

    return {
      query,
      totalChunksSearched: this.chunks.length,
      results: hasSufficientContext ? topResults : [],
      hasSufficientContext,
    };
  }
}

// Global Singleton Instance
export const knowledgeRetriever = new LocalKnowledgeRetriever();
