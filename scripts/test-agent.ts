// Runs the full agent once from the command line. Run: npm run test:agent -- "Dua Lipa" "anime" "street food"
import { runAgent } from "../lib/agent/run";

async function main() {
  const likes = process.argv.slice(2).length ? process.argv.slice(2) : ["Dua Lipa", "anime", "street food", "hiking"];
  const started = Date.now();
  const result = await runAgent({ likes, filters: {}, lang: "en" }, (event) => {
    const t = `${((Date.now() - started) / 1000).toFixed(1)}s`;
    if (event.type === "step") console.log(t, "step", event.step, event.status, event.detail ?? "");
    if (event.type === "tool") console.log(t, "  tool", event.entry.tool, event.entry.ok ? "ok" : "FAILED", `${event.entry.ms}ms`, event.entry.args.slice(0, 120));
  });

  console.log(`\nmode=${result.mode} notes=${result.notes.join(",") || "-"} total=${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log("resolved:", result.resolved.map((r) => `${r.input} -> ${r.name} (${r.kind})`).join("; "));
  if (result.unresolved.length) console.log("unresolved:", result.unresolved.join(", "));
  for (const c of result.cities) {
    console.log(`\n${c.score}%  ${c.city.name}, ${c.city.country}`);
    console.log(`  why: ${c.why}`);
    console.log(`  life: ${c.studentLife}`);
  }
  console.log("\nalso liked:", result.alsoLiked.map((a) => a.name).join(", "));
  console.log("worldwide:", result.worldwide.map((w) => `${w.name} (${w.countryCode ?? "?"})`).join(", "));
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
