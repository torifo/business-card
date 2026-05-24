/**
 * 言語切替: ja ↔ en で <html lang> 属性を書き換える。
 *
 * - 翻訳テキストは各コンポーネント内で .i18n-ja / .i18n-en の二段スパンに分割
 *   されており、表示切替は global.css の `html[lang="..."]` セレクタで完結する
 *   (このスクリプトは lang 属性を書き換えるだけ)
 * - 初期値は <html lang="ja"> (Layout.astro で設定)
 * - リロードで永続化はしない (テーマと同じ非永続ポリシー)
 */
const toggles = document.querySelectorAll<HTMLButtonElement>("[data-lang-toggle]");
const html = document.documentElement;

if (!html.lang) html.lang = "ja";

for (const toggle of toggles) {
  toggle.addEventListener("click", () => {
    html.lang = html.lang === "en" ? "ja" : "en";
  });
}
