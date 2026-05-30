# QR Code on Card Front — Design Spec

**Date:** 2026-05-30
**Status:** Approved

## Goal

Display a QR code in the bottom-right corner of the business card front face. The QR always encodes the card's own URL so anyone who sees the card can scan it to open the digital version.

NFC support is a follow-up task and is explicitly out of scope here.

## Requirements

- QR appears on the front face only, bottom-right corner.
- QR always encodes the card URL (`CARD_URL` env var, fallback `https://business-card.riumu.net`).
- Generated at build time — zero runtime JavaScript, no external requests.
- Size and position use `cqi` units to scale with the card (fullscreen mode, etc.).
- No changes to card content, data model, or back face.

## Architecture

### Data flow

```
index.astro (build time)
  └── QRCode.toString(cardUrl, { type: "svg" })
        └── qrSvg: string
              └── <CardFront profile={...} qrSvg={qrSvg} />
                    └── <div set:html={qrSvg} />  ← bottom-right, absolute
```

### QR URL resolution

```ts
const cardUrl = import.meta.env.CARD_URL ?? "https://business-card.riumu.net";
```

`CARD_URL` is a build-time env var (not `PUBLIC_` prefix — never exposed to the browser). The existing `QR_BASE_URL` used by `generate-qrs.ts` is a separate variable; both are documented in `.env.example`.

### QR generation options

```ts
QRCode.toString(cardUrl, {
  type: "svg",
  errorCorrectionLevel: "H",
  margin: 1,
})
```

Error correction level H gives maximum redundancy (30%), important for a small on-screen QR.

## File Changes

| File | Change |
|------|--------|
| `src/pages/index.astro` | Import `qrcode`, generate `qrSvg`, pass to `CardFront` |
| `src/components/CardFront.astro` | Add `qrSvg` prop, render bottom-right, add `position: relative` to `.card-front` |
| `.env.example` | Add `CARD_URL=https://business-card.riumu.net` |

No changes to `src/types/card.ts`, `card-config.json`, or any other file.

## CSS

```css
.card-front {
  /* existing rules */
  position: relative;  /* add — enables absolute child */
}

.card-front__qr {
  position: absolute;
  bottom: 2.5cqi;
  right: 2.5cqi;
  width: 13cqi;
  height: 13cqi;
  background: white;
  border-radius: 1.5cqi;
  padding: 1cqi;
  box-sizing: border-box;
}

.card-front__qr svg {
  width: 100%;
  height: 100%;
  display: block;
}
```

Size at the default card width (358px): `13cqi` ≈ 46px. Scales proportionally in fullscreen mode.

## Out of Scope

- `?mode=` URL param switching (decided not needed — portfolio link is already a button on the card)
- NFC writing / Web NFC API (follow-up task)
- QR on the back face
- Dynamic QR (client-side generation)
