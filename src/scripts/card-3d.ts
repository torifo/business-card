/**
 * ポインタ (マウス/タッチ) でカードを自由に 3D 回転させる (FR-003 拡張)。
 *
 * - pointerdown でドラッグ開始、移動量を rotateY / rotateX に反映
 * - ドラッグ中は `.is-dragging` で transition を無効化し、追従感を出す
 * - 離したら一番近い面 (front=0deg / back=180deg) に snap、X は 0 に戻す
 * - select / a / button / [data-face] / [data-no-drag] 上では drag を開始しない
 * - prefers-reduced-motion: reduce ならドラッグを完全に無効化
 *
 * card-flip.ts の `flipTo` と同じ CSS 変数を共有するので、tab click と
 * pointer drag は同じトランスフォーム経路で動く。
 */
import { setRotation, flipTo } from "./card-flip";

const card = document.getElementById("card");

if (card && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  initFreeRotation(card);
}

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  baseRotX: number;
  baseRotY: number;
  curRotX: number;
  curRotY: number;
  pointerId: number;
}

function initFreeRotation(card: HTMLElement): void {
  const state: DragState = {
    active: false,
    startX: 0,
    startY: 0,
    baseRotX: 0,
    baseRotY: 0,
    curRotX: 0,
    curRotY: 0,
    pointerId: -1,
  };

  const SENS = 0.4; // px → deg
  const MAX_TILT_X = 60; // X 軸 (前後) は上下に倒れすぎないよう制限
  const TAP_SLOP = 6; // この距離未満なら "クリック扱い" で snap しない
  const DOUBLE_TAP_MS = 350; // この間隔以内の連続タップを double tap と判定
  // performance.now() はページロードからの経過 ms。初期値 0 だと最初のタップで
  // 即 double tap 判定になってしまうので -Infinity スタートとする。
  let lastTapTime = Number.NEGATIVE_INFINITY;

  card.addEventListener("pointerdown", (e) => {
    if (!shouldStartDrag(e)) return;
    state.active = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.baseRotX = state.curRotX;
    state.baseRotY = state.curRotY;
    state.pointerId = e.pointerId;
    card.classList.add("is-dragging");
    card.setPointerCapture(e.pointerId);
  });

  card.addEventListener("pointermove", (e) => {
    if (!state.active || e.pointerId !== state.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    state.curRotY = state.baseRotY + dx * SENS;
    state.curRotX = clamp(state.baseRotX - dy * SENS, -MAX_TILT_X, MAX_TILT_X);
    setRotation(card, state.curRotX, state.curRotY);
  });

  const release = (e: PointerEvent) => {
    if (!state.active || e.pointerId !== state.pointerId) return;
    state.active = false;
    card.classList.remove("is-dragging");
    if (card.hasPointerCapture(e.pointerId)) {
      card.releasePointerCapture(e.pointerId);
    }
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    // 移動がほぼ無ければ tap として扱う
    if (Math.hypot(dx, dy) < TAP_SLOP) {
      // 2 連続タップで表裏トグル
      const now = performance.now();
      if (now - lastTapTime < DOUBLE_TAP_MS) {
        const targetFace = card.classList.contains("is-flipped") ? "front" : "back";
        state.curRotX = 0;
        state.curRotY = targetFace === "back" ? 180 : 0;
        flipTo(targetFace);
        lastTapTime = Number.NEGATIVE_INFINITY; // triple tap 誤発火防止
      } else {
        lastTapTime = now;
      }
      return;
    }

    // ドラッグ後の release: 近い面 (front/back) に snap
    const norm = ((state.curRotY % 360) + 360) % 360;
    const isBack = norm >= 90 && norm < 270;
    state.curRotX = 0;
    state.curRotY = isBack ? 180 : 0;
    flipTo(isBack ? "back" : "front");
    lastTapTime = Number.NEGATIVE_INFINITY; // ドラッグ完了したら tap シーケンスはリセット
  };

  card.addEventListener("pointerup", release);
  card.addEventListener("pointercancel", release);
}

function shouldStartDrag(e: PointerEvent): boolean {
  const target = e.target;
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      "[data-face], a, button, select, input, textarea, [data-no-drag]",
    )
  ) {
    return false;
  }
  return true;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
