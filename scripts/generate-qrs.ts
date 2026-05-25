/**
 * tag 別 QR の一括生成スクリプト (Future Considerations / Galaxy routines)。
 *
 * `card-config.json` の hierarchy を読み、各 leaf について
 * `?target=<leaf-id>` を埋め込んだ QR を public/qr/target-<leaf-id>.png に出力する。
 * 併せて `card.png` (素のカード URL) と `portfolio.png` (config の portfolio リンク)
 * もここで生成し、CLI で個別実行する必要を無くす。
 *
 * 実行: `npm run qr`
 * 環境変数 `QR_BASE_URL` で本番 URL を上書き可能 (default: business-card.riumu.net)。
 */
import QRCode from "qrcode";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import config from "../card-config.json" with { type: "json" };

const BASE_URL = process.env.QR_BASE_URL ?? "https://business-card.riumu.net";
const QR_DIR = resolve("public/qr");
const OPTIONS: QRCode.QRCodeToFileOptions = {
  errorCorrectionLevel: "H",
  width: 512,
  margin: 1,
  type: "png",
};

interface Leaf {
  id: string;
  label: string;
}
interface Subcategory {
  id: string;
  label: string;
  leaves: Leaf[];
}
interface Hierarchy {
  id: string;
  label: string;
  children: Subcategory[];
}
interface PortfolioLink {
  type: string;
  url: string;
}

async function emit(filename: string, url: string): Promise<void> {
  const dest = resolve(QR_DIR, filename);
  await QRCode.toFile(dest, url, OPTIONS);
  console.log(`  ${filename.padEnd(28)} -> ${url}`);
}

async function main(): Promise<void> {
  await mkdir(QR_DIR, { recursive: true });
  console.log(`[generate-qrs] base URL: ${BASE_URL}`);
  console.log(`[generate-qrs] output:   ${QR_DIR}`);
  console.log("");

  await emit("card.png", BASE_URL);

  const portfolioLink = (config.profile.links as PortfolioLink[]).find(
    (l) => l.type === "portfolio",
  );
  if (portfolioLink) {
    await emit("portfolio.png", portfolioLink.url);
  } else {
    console.log("  (portfolio link not configured, skipping portfolio.png)");
  }

  let count = 0;
  for (const cat of config.hierarchy as Hierarchy[]) {
    for (const sub of cat.children) {
      for (const leaf of sub.leaves) {
        await emit(`target-${leaf.id}.png`, `${BASE_URL}/?target=${leaf.id}`);
        count += 1;
      }
    }
  }

  console.log("");
  console.log(`[generate-qrs] done: ${count} per-tag QRs + 2 root QRs`);
}

main().catch((e: unknown) => {
  console.error("[generate-qrs] failed:", e);
  process.exit(1);
});
