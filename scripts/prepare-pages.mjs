import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
copyFileSync(join(dist, "index.html"), join(dist, "404.html"));
writeFileSync(join(dist, ".nojekyll"), "");
const domain = (process.env.CUSTOM_DOMAIN || "").trim();
if (domain) writeFileSync(join(dist, "CNAME"), `${domain}\n`);
console.log(domain ? `pages artifacts ready; CNAME=${domain}` : "pages artifacts ready in dist/");
