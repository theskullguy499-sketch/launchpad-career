import { PLANS, OPERATION_LIMITS, LEGACY_LIMITS } from "../lib/plans.mjs";
import { readFile, writeFile } from "node:fs/promises";
export const seed = `-- Generated from lib/plans.mjs. Apply as project owner after reviewing proposed prices/quotas.\nupdate public.commercial_settings set plans = $catalog$${JSON.stringify(PLANS)}$catalog$::jsonb where id = true;\nupdate public.commercial_settings set limits = $limits$${JSON.stringify(OPERATION_LIMITS)}$limits$::jsonb where id = true;\nupdate public.commercial_settings set legacy_limits = $legacy$${JSON.stringify(LEGACY_LIMITS)}$legacy$::jsonb where id = true;\n`;
if (process.argv.includes("--check")) {
  if (
    (await readFile(
      new URL("../supabase/seed-plan-catalog.sql", import.meta.url),
      "utf8",
    )) !== seed
  )
    throw new Error(
      "Plan seed is stale. Run node scripts/generate-plans.mjs and review the SQL.",
    );
} else
  await writeFile(
    new URL("../supabase/seed-plan-catalog.sql", import.meta.url),
    seed,
  );
