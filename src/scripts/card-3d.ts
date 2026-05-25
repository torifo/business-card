/**
 * ポインタ (マウス/タッチ) でカードを自由に 3D 回転させる (FR-003 拡張)。
 *
 * - pointerdown でドラッグ開始、移動量を rotateY / rotateX に反映
 * - ドラッグ中は `.is-dragging` で transition を無効化し、追従感を出す
 * - **離した直後はその時点の角速度で回り続け** (慣性)、摩擦で減速してから
 *   近い面 (front=0deg / back=180deg) に snap する
 * - select / a / button / [data-face] / [data-no-drag] 上では drag を開始しない
 * - prefers-reduced-motion: reduce ならドラッグも慣性も完全に無効化
 *
 * card-flip.ts の `flipTo` と同じ CSS 変数を共有するので、tab click と
 * pointer drag と慣性回転は同じトランスフォーム経路で動く。
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

  const SENS = 0.4; // px → deg
  const MAX_TILT_X = 60; // X 軸 (前後) は上下に倒れすぎないよう制限
  const TAP_SLOP = 6; // この距離未満なら "クリック扱い" で snap しない
  const DOUBLE_TAP_MS = 350;
  const FRAME_MS = 16; // 60fps 想定 (velocity を deg/frame で扱うときの基準)
  const FRICTION = 0.94; // 各フレームに掛ける減速係数
  const FLING_MIN_SPEED = 1.5; // deg/frame: これ以上で慣性回転を起動
  const MOMENTUM_END_SPEED = 0.15; // deg/frame: これ未満になったら snap に移行

  // performance.now() はページロードからの経過 ms。初期値 0 だと最初のタップで
  // 即 double tap 判定になるので -Infinity スタート。
  let lastTapTime = Number.NEGATIVE_INFINITY;

  card.addEventListener("pointerdown", (e) => {
    if (!shouldStartDrag(e)) return;
    // 慣性ループが走っていれば停止
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
    state.curRotY = state.baseRotY + dx * SENS;
    state.curRotX = clamp(state.baseRotX - dy * SENS, -MAX_TILT_X, MAX_TILT_X);
    setRotation(card, state.curRotX, state.curRotY);

    // 直近サンプルとの差分から角速度 (deg / フレーム) を推定。
    // 短時間 (5ms 未満) のサンプルは EMA でノイズを抑える。
    const now = performance.now();
    const dt = now - state.lastMoveTime;
    if (dt > 0) {
      const mx = e.clientX - state.lastMoveX;
      const my = e.clientY - state.lastMoveY;
      const sampleVy = (mx * SENS * FRAME_MS) / dt;
      const sampleVx = (-my * SENS * FRAME_MS) / dt;
      // 直近サンプル重視の EMA で慣性発火直前の意図を反映しやすくする
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

    // 移動がほぼ無ければ tap として扱う (double tap でフリップ)
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

    // 慣性に乗せるほどの勢いがあれば fling ループへ。
    // 速度が弱ければそのまま近い面に snap する。
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

  /**
   * 慣性ループ: 直近のドラッグ速度を初期値に、毎フレーム摩擦で減速しながら
   * カードを回転させる。十分減速したら近い面に snap する。
   */
  function runMomentum(): void {
    let vx = state.velocityX;
    let vy = state.velocityY;

    function step(): void {
      vx *= FRICTION;
      vy *= FRICTION;
      state.curRotX = clamp(state.curRotX + vx, -MAX_TILT_X, MAX_TILT_X);
      state.curRotY = state.curRotY + vy;
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

  /** 現在角に最も近い面に snap し、is-dragging を外して CSS transition で滑らせる */
  function finishWithSnap(): void {
    card.classList.remove("is-dragging");
    const norm = ((state.curRotY % 360) + 360) % 360;
    const isBack = norm >= 90 && norm < 270;
    state.curRotX = 0;
    state.curRotY = isBack ? 180 : 0;
    flipTo(isBack ? "back" : "front");
  }
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
