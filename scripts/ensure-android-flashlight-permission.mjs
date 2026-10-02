import { readFile, writeFile } from "node:fs/promises";

const manifestPath = new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url);
const permission = '<uses-permission android:name="android.permission.FLASHLIGHT" />';
const manifest = await readFile(manifestPath, "utf8");

if (!manifest.includes(permission)) {
  if (!manifest.includes("</manifest>")) throw new Error("Invalid AndroidManifest.xml");
  await writeFile(manifestPath, manifest.replace("</manifest>", `    ${permission}\n</manifest>`));
}
