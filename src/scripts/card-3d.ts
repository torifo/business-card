/**
 * ポインタ (マウス/タッチ) でカードを自由に 3D 回転させる (FR-003 拡張)。
 *
 * - X 軸クランプを撤去して X/Y どちらも完全自由に回せる (斜めも含む)
 * - X 感度は Y より高く、縦の card 高さが狭い分を補う
 * - 離した直後は慣性で回り続け、摩擦で減速してから snap
 * - snap target は 3D 法線 (cos(X) * cos(Y)) で front/back を判定し、
 *   X も Y も flat-face (0, 0 or 0, 180) に戻す
 * - snap 前に nearestEquivalent で累積回転を ±180° 内に正規化し、
 *   CSS transition の巻き戻し距離を最小化する
 * - select / a / button / [data-face] / [data-no-drag] 上では drag を開始しない
 * - prefers-reduced-motion: reduce ならドラッグも慣性も完全に無効化
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
  /** 直近の pointermove のタイムスタンプ。慣性用の速度サンプリングに使う */
  lastMoveTime: number;
  lastMoveX: number;
  lastMoveY: number;
  /** 直近サンプルから推定した瞬間角速度 (deg / 16ms フレーム) */
  velocityX: number;
  velocityY: number;
  /** 慣性ループの requestAnimationFrame id (0 = 停止中) */
  momentumId: number;
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
    lastMoveTime: 0,
    lastMoveX: 0,
    lastMoveY: 0,
    velocityX: 0,
    velocityY: 0,
    momentumId: 0,
  };

  // Y は横幅 (361px ぐらい) に対する追従、X は縦幅 (217px ぐらい) と
  // 狭いので相対的に多く回す。これで縦方向ドラッグでも素直に flip まで届く。
  const SENS_Y = 0.4; // 横ドラッグ: px → deg
  const SENS_X = 0.65; // 縦ドラッグ: px → deg (高めにして "縦の幅が狭い" を補正)
  const TAP_SLOP = 6;
  const DOUBLE_TAP_MS = 350;
  const FRAME_MS = 16;
  const FRICTION = 0.94;
  const FLING_MIN_SPEED = 1.5;
  const MOMENTUM_END_SPEED = 0.15;

  let lastTapTime = Number.NEGATIVE_INFINITY;

  card.addEventListener("pointerdown", (e) => {
    if (!shouldStartDrag(e)) return;
    if (state.momentumId) {
      cancelAnimationFrame(state.momentumId);
      state.momentumId = 0;
    }
    state.active = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.baseRotX = state.curRotX;
    state.baseRotY = state.curRotY;
    state.pointerId = e.pointerId;
    state.lastMoveTime = performance.now();
    state.lastMoveX = e.clientX;
    state.lastMoveY = e.clientY;
    state.velocityX = 0;
    state.velocityY = 0;
    card.classList.add("is-dragging");
    card.setPointerCapture(e.pointerId);
  });

  card.addEventListener("pointermove", (e) => {
    if (!state.active || e.pointerId !== state.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    // X / Y どちらもクランプ無し: 累積で何回転でも可能
    state.curRotY = state.baseRotY + dx * SENS_Y;
    state.curRotX = state.baseRotX - dy * SENS_X;
    setRotation(card, state.curRotX, state.curRotY);

    const now = performance.now();
    const dt = now - state.lastMoveTime;
    if (dt > 0) {
      const mx = e.clientX - state.lastMoveX;
      const my = e.clientY - state.lastMoveY;
      const sampleVy = (mx * SENS_Y * FRAME_MS) / dt;
      const sampleVx = (-my * SENS_X * FRAME_MS) / dt;
      state.velocityY = state.velocityY * 0.3 + sampleVy * 0.7;
      state.velocityX = state.velocityX * 0.3 + sampleVx * 0.7;
    }
    state.lastMoveTime = now;
    state.lastMoveX = e.clientX;
    state.lastMoveY = e.clientY;
  });

  const release = (e: PointerEvent) => {
    if (!state.active || e.pointerId !== state.pointerId) return;
    state.active = false;
    if (card.hasPointerCapture(e.pointerId)) {
      card.releasePointerCapture(e.pointerId);
    }
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (Math.hypot(dx, dy) < TAP_SLOP) {
      card.classList.remove("is-dragging");
      const now = performance.now();
      if (now - lastTapTime < DOUBLE_TAP_MS) {
        const targetFace = card.classList.contains("is-flipped") ? "front" : "back";
        state.curRotX = 0;
        state.curRotY = targetFace === "back" ? 180 : 0;
        flipTo(targetFace);
        lastTapTime = Number.NEGATIVE_INFINITY;
      } else {
        lastTapTime = now;
      }
      return;
    }

    const speed = Math.hypot(state.velocityX, state.velocityY);
    lastTapTime = Number.NEGATIVE_INFINITY;
    if (speed >= FLING_MIN_SPEED) {
      runMomentum();
    } else {
      finishWithSnap();
    }
  };

  card.addEventListener("pointerup", release);
  card.addEventListener("pointercancel", release);

  function runMomentum(): void {
    let vx = state.velocityX;
    let vy = state.velocityY;

    function step(): void {
      vx *= FRICTION;
      vy *= FRICTION;
      // X / Y どちらもクランプ無しで自由に減速回転
      state.curRotX += vx;
      state.curRotY += vy;
      setRotation(card, state.curRotX, state.curRotY);

      const remaining = Math.hypot(vx, vy);
      if (remaining < MOMENTUM_END_SPEED) {
        state.momentumId = 0;
        finishWithSnap();
        return;
      }
      state.momentumId = requestAnimationFrame(step);
    }

    state.momentumId = requestAnimationFrame(step);
  }

  /**
   * 現在の (X, Y) から見えている面 (front/back) を決定し、最短経路で
   * flat-face position (X=0, Y=0 or 180) に snap する。
   *
   * front/back 判定は 3D 法線の Z 成分 (cos(X) * cos(Y)) で行うので
   * X 軸だけの傾き、Y 軸だけの回転、斜めの組合せ、いずれも自然に処理される。
   */
  function finishWithSnap(): void {
    const isBack = isBackVisible(state.curRotX, state.curRotY);
    const targetY = isBack ? 180 : 0;

    // 累積回転を ±180° 範囲に正規化 (見た目同じ、transition 距離だけ最小化)
    state.curRotX = nearestEquivalent(state.curRotX, 0);
    state.curRotY = nearestEquivalent(state.curRotY, targetY);
    setRotation(card, state.curRotX, state.curRotY);

    card.classList.remove("is-dragging");
    state.curRotX = 0;
    state.curRotY = targetY;
    flipTo(isBack ? "back" : "front");
  }
}

/** front normal の Z 成分が負なら back が見えている (cos(X) * cos(Y) < 0) */
function isBackVisible(rotX: number, rotY: number): boolean {
  const cx = Math.cos((rotX * Math.PI) / 180);
  const cy = Math.cos((rotY * Math.PI) / 180);
  return cx * cy < 0;
}

/** value を target ± 180° 範囲内に正規化 (見た目は同じだが数値差が最小化される) */
function nearestEquivalent(value: number, target: number): number {
  const diff = value - target;
  const wrappedDiff = (((diff + 180) % 360) + 360) % 360 - 180;
  return target + wrappedDiff;
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
