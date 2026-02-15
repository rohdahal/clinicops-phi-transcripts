import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type TranscriptRow = {
  id: string;
  patient_id?: string | null;
  patient_pseudonym: string;
  source: string;
  source_ref?: string | null;
  redacted_text: string;
  idempotency_key: string;
  status: "new" | "processed";
  meta?: Record<string, unknown> | null;
};

type PatientRow = {
  id?: string;
  created_at?: string;
  updated_at?: string;
  pseudonym: string;
  full_name?: string | null;
  masked_name?: string | null;
  patient_profile_image_url?: string | null;
  email?: string | null;
  email_masked?: string | null;
  email_verified?: boolean;
  phone?: string | null;
  phone_masked?: string | null;
  phone_verified?: boolean;
  preferred_channel?: "phone" | "email" | "sms" | "none";
  consent_status?: "unknown" | "granted" | "revoked" | "pending";
  consent_source?: string | null;
  consent_at?: string | null;
  meta?: Record<string, unknown> | null;
};

type ArtifactRow = {
  id: string;
  transcript_id: string;
  artifact_type: string;
  model: string;
  status: "generated" | "approved";
  content: string;
  meta?: Record<string, unknown> | null;
  approved_at?: string | null;
  approved_by?: string | null;
};

type LeadRow = {
  transcript_id: string;
  source_artifact_id?: string | null;
  model: string;
  title: string;
  reason: string;
  next_action: string;
  lead_score: number;
  status:
    | "open"
    | "in_progress"
    | "contacted"
    | "qualified"
    | "closed_won"
    | "closed_lost"
    | "dismissed"
    | "superseded";
  owner_user_id?: string | null;
  due_at?: string | null;
  last_contacted_at?: string | null;
  notes?: string | null;
  meta?: Record<string, unknown> | null;
};

type AuditEventRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_display: string;
  actor_id?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
};

type SeedFile = {
  patients?: PatientRow[];
  transcripts: TranscriptRow[];
  transcript_artifacts: ArtifactRow[];
  lead_opportunities: LeadRow[];
  audit_events: AuditEventRow[];
};

type CliOptions = {
  filePath: string;
};

type MaybeSupabaseError = {
  code?: string;
  message?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const defaultPath = path.resolve(process.cwd(), "seed/demo-seed.json");
  let filePath = defaultPath;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--file") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value after --file");
      }
      filePath = path.resolve(process.cwd(), value);
      i += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { filePath };
}

function printHelp() {
  console.log(`Seed Supabase demo data\n\nUsage:\n  npm run seed\n  npm run seed -- --file seed/demo-seed.json\n\nBehavior:\n  - With SUPABASE_DB_URL: applies SQL schema files, then upserts seed data.\n  - Without SUPABASE_DB_URL: skips SQL schema setup and only upserts seed data.\n\nOptions:\n  --file   Path to JSON seed file (default: seed/demo-seed.json)\n  -h, --help  Show this help\n`);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function runSchemaSqlFiles(dbUrl: string) {
  const repoRoot = path.resolve(process.cwd(), "..");
  const sqlFiles = [
    "sql/transcripts.sql",
    "sql/patients.sql",
    "sql/transcript_artifacts.sql",
    "sql/audit_events.sql",
    "sql/lead_opportunities.sql"
  ];

  for (const relativePath of sqlFiles) {
    const filePath = path.resolve(process.cwd(), relativePath);
    if (!existsSync(filePath)) {
      throw new Error(`Missing SQL file: ${relativePath}`);
    }

    const localResult = spawnSync(
      "psql",
      ["--dbname", dbUrl, "-v", "ON_ERROR_STOP=1", "-f", filePath],
      { stdio: "inherit" }
    );

    if (!localResult.error) {
      if (localResult.status !== 0) {
        throw new Error(`Failed applying SQL file: ${relativePath}`);
      }
      continue;
    }

    if ((localResult.error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw localResult.error;
    }

    const dockerResult = spawnSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "pg-client",
        "psql",
        "--dbname",
        dbUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        relativePath
      ],
      { stdio: "inherit", cwd: repoRoot }
    );

    if (dockerResult.error) {
      if ((dockerResult.error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          "Neither local psql nor docker CLI is available. Install psql or Docker and rerun."
        );
      }
      throw dockerResult.error;
    }

    if (dockerResult.status !== 0) {
      throw new Error(
        `Failed applying SQL file via docker compose: ${relativePath}. Ensure pg-client is running (docker compose up -d).`
      );
    }
  }
}

async function readSeedFile(filePath: string): Promise<SeedFile> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as SeedFile;

  if (parsed.patients !== undefined && !Array.isArray(parsed.patients)) {
    throw new Error("Seed file patients must be an array when provided");
  }
  if (!Array.isArray(parsed.transcripts)) {
    throw new Error("Seed file must include transcripts[]");
  }
  if (!Array.isArray(parsed.transcript_artifacts)) {
    throw new Error("Seed file must include transcript_artifacts[]");
  }
  if (!Array.isArray(parsed.lead_opportunities)) {
    throw new Error("Seed file must include lead_opportunities[]");
  }
  if (!Array.isArray(parsed.audit_events)) {
    throw new Error("Seed file must include audit_events[]");
  }

  return parsed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (dbUrl) {
    runSchemaSqlFiles(dbUrl);
  } else {
    console.warn(
      "SUPABASE_DB_URL is not set. Skipping SQL schema setup and attempting seed-only upserts."
    );
  }
  const seed = await readSeedFile(options.filePath);

  const supabase = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  const transcriptPseudonyms = Array.from(
    new Set(seed.transcripts.map((row) => row.patient_pseudonym.trim()).filter((value) => value.length > 0))
  );

  const patientRowsByPseudonym = new Map<string, PatientRow>();
  for (const row of seed.patients ?? []) {
    const pseudonym = row.pseudonym.trim();
    if (!pseudonym) {
      continue;
    }
    patientRowsByPseudonym.set(pseudonym, { ...row, pseudonym });
  }
  for (const pseudonym of transcriptPseudonyms) {
    if (!patientRowsByPseudonym.has(pseudonym)) {
      patientRowsByPseudonym.set(pseudonym, {
        pseudonym,
        masked_name: pseudonym,
        meta: { seeded_from: "transcripts" }
      });
    }
  }

  const patientRows = Array.from(patientRowsByPseudonym.values()).map((row) => {
    const { id: _ignoredId, ...rest } = row;
    return {
      ...rest,
      masked_name: row.masked_name ?? row.pseudonym
    };
  });

  if (patientRows.length > 0) {
    const { error: patientUpsertError } = await supabase
      .from("patients")
      .upsert(patientRows, { onConflict: "pseudonym" });
    if (patientUpsertError) throw patientUpsertError;
  }

  let patientIdByPseudonym = new Map<string, string>();
  if (transcriptPseudonyms.length > 0) {
    const { data: patientLookup, error: patientLookupError } = await supabase
      .from("patients")
      .select("id,pseudonym")
      .in("pseudonym", transcriptPseudonyms);
    if (patientLookupError) throw patientLookupError;

    patientIdByPseudonym = new Map(
      (patientLookup ?? []).map((row) => [row.pseudonym as string, row.id as string])
    );
  }

  if (seed.transcripts.length > 0) {
    const transcriptsWithPatientIds = seed.transcripts.map((row) => ({
      ...row,
      patient_id: patientIdByPseudonym.get(row.patient_pseudonym.trim()) ?? null
    }));

    const { error } = await supabase
      .from("transcripts")
      .upsert(transcriptsWithPatientIds, { onConflict: "id" });
    if (error) throw error;
  }

  if (seed.transcript_artifacts.length > 0) {
    const { error } = await supabase
      .from("transcript_artifacts")
      .upsert(seed.transcript_artifacts, { onConflict: "id" });
    if (error) throw error;
  }

  if (seed.lead_opportunities.length > 0) {
    const { error } = await supabase
      .from("lead_opportunities")
      .upsert(seed.lead_opportunities, { onConflict: "transcript_id" });
    if (error) throw error;
  }

  if (seed.audit_events.length > 0) {
    const { error } = await supabase
      .from("audit_events")
      .upsert(seed.audit_events, { onConflict: "id" });
    if (error) throw error;
  }

  console.log(
    `Seed complete from ${options.filePath} (${(seed.patients ?? []).length} patients, ${seed.transcripts.length} transcripts, ${seed.transcript_artifacts.length} artifacts, ${seed.lead_opportunities.length} leads, ${seed.audit_events.length} audit events).`
  );
}

main().catch((error) => {
  const err = error as MaybeSupabaseError;
  const message = err?.message ?? "";
  const isMissingSchemaTable =
    err?.code === "PGRST205" ||
    message.includes("Could not find the table") ||
    message.includes("schema cache");

  if (isMissingSchemaTable) {
    console.error(
      [
        "Seed failed: missing tables in Supabase schema.",
        "Choose one:",
        "1) Run backend/sql/*.sql manually in Supabase SQL Editor.",
        "2) Set SUPABASE_DB_URL (Connection string -> URI, Primary Database, Session Pooler) and rerun `npm run seed`."
      ].join("\n")
    );
    process.exit(1);
  }

  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
