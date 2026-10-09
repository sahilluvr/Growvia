import { build } from "/home/claude/Growvia/node_modules/esbuild/lib/main.js";
const S = "/home/claude/ft/stubs/", R = "/home/claude/Growvia/src/";
const map = { "@/lib/forms-submit": S + "forms-submit.ts", "@/lib/data": S + "data.ts", "@/lib/server/admin": S + "admin.ts", "@/lib/captcha": S + "captcha.ts" };
await build({ entryPoints: ["/home/claude/ft/entry.ts"], bundle: true, platform: "node", format: "cjs", outfile: "/home/claude/Growvia/.fttmp/routes.cjs", external: ["next", "next/*"], nodePaths: ["/home/claude/Growvia/node_modules"],
  plugins: [{ name: "alias", setup(b) { b.onResolve({ filter: /^@\// }, (a) => ({ path: map[a.path] ?? (R + a.path.slice(2) + (a.path.endsWith(".ts") ? "" : ".ts")) })); } }] });
console.log("built");
