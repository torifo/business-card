/**
 * カードのタブクリックで表/裏に snap する (Task 6.3 / FR-003)。
 *
 * - [data-face="front" | "back"] ボタンのクリックを購読
 * - CSS 変数 --rot-x / --rot-y を書き換え、card.css の transition で
 *   600ms かけて目標値まで補間する
 * - .is-flipped クラスはトランスフォーム値ではなく "状態ラベル" として保持し、
 *   aria-selected / inert / 自由回転スクリプトとの整合に使う
 *
 * 自由回転は card-3d.ts が同じ CSS 変数を書き換えることで実現する。
 */
export function flipTo(face: "front" | "back"): void {
  const card = document.getElementById("card");
  if (!card) return;
  // タブクリック経路は X を 0 にリセットしてフラットに揃える
  setRotation(card, 0, face === "back" ? 180 : 0);
  setFaceState(face);
}

/**
 * X の回転を保ったまま Y だけを target に向ける snap (card-3d.ts のドラッグ
 * release 用)。X が 0 に巻き戻る違和感を避けるため、ドラッグ系のジェスチャは
 * 必ずこちらを使う。
 */
export function snapFaceKeepX(face: "front" | "back", x: number, y: number): void {
  const card = document.getElementById("card");
  if (!card) return;
  setRotation(card, x, y);
  setFaceState(face);
}

export function setRotation(card: HTMLElement, x: number, y: number): void {
  card.style.setProperty("--rot-x", `${x}deg`);
  card.style.setProperty("--rot-y", `${y}deg`);
}

/** is-flipped / aria-selected / inert を target の面に合わせるだけのヘルパ */
export function setFaceState(face: "front" | "back"): void {
  const card = document.getElementById("card");
  if (!card) return;
  card.classList.toggle("is-flipped", face === "back");
  syncFaceFocusability(face);
  syncTabState(face);
}

/**
 * 非アクティブ側の面を inert + aria-hidden にし、Tab フォーカスや AT を
 * アクティブな面に閉じ込める。aria-hidden-focus a11y 警告を解消する。
 */
function syncFaceFocusability(activeFace: "front" | "back"): void {
  const front = document.getElementById("card-face-front");
  const back = document.getElementById("card-face-back");
  setInert(front, activeFace !== "front");
  setInert(back, activeFace !== "back");
}

function setInert(el: HTMLElement | null, inert: boolean): void {
  if (!el) return;
  if (inert) {
    el.setAttribute("inert", "");
    el.setAttribute("aria-hidden", "true");
  } else {
    el.removeAttribute("inert");
    el.removeAttribute("aria-hidden");
  }
}

function syncTabState(activeFace: "front" | "back"): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>("[data-face]");
  for (const tab of tabs) {
    const isActive = tab.dataset.face === activeFace;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.classList.toggle("is-active", isActive);
  }
}

// 起動時にタブクリック → snap を配線
const tabs = document.querySelectorAll<HTMLButtonElement>("[data-face]");
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    const targetFace = tab.dataset.face === "back" ? "back" : "front";
    flipTo(targetFace);
  });
}
