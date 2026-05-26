// ── Pxl Pets — Sprite Definitions ─────────────────────────────────────────────
// Terminal aesthetic: phosphor green monochrome, very low resolution.
// Sprites are 6×4 pixel glyphs (width × height) — tiny dot-matrix style.
// Values are palette indices; 0 = transparent, 1 = primary, 2 = dim, 3 = bright.
// Palettes map to the theme's CSS custom properties at render time.

// ── Color palettes ─────────────────────────────────────────────────────────────
// All species share the same palette structure — colours are swapped per variant.
// Index: 0=transparent  1=body (mid green)  2=dim (dark green)  3=bright (highlight)

export const DOG_PALETTES: Record<string, string[]> = {
  default: ['transparent', '#39ff14', '#1a7a08', '#afffA0'],
  golden:  ['transparent', '#ffb000', '#7a5000', '#ffe090'],
  dark:    ['transparent', '#00e5ff', '#006070', '#a0f8ff'],
}

export const CAT_PALETTES: Record<string, string[]> = {
  default: ['transparent', '#39ff14', '#1a7a08', '#afffA0'],
  orange:  ['transparent', '#ffb000', '#7a5000', '#ffe090'],
  white:   ['transparent', '#ff007f', '#7a003a', '#ffa0cf'],
}

// ── Sprite grid ────────────────────────────────────────────────────────────────
// 6 cols × 5 rows. Side-view quadruped. Head faces RIGHT.
// Tail is LEFT. Legs in rows 3–4.
// Palette: 0=transparent  1=body  2=dim  3=bright
//
//  col: 0 1 2 3 4 5
// row0: . . . . e e   ← ears/head top
// row1: t . b b H H   ← tail, body, head
// row2: . b b b b .   ← belly
// row3: . L b b F .   ← back Leg, body, Front leg
// row4: . L . . F .   ← leg lower / paws

// ── Dog frames ─────────────────────────────────────────────────────────────────
export const DOG_FRAMES: number[][][] = [
  // Frame 0 — neutral, both legs down
  [
    [0,0,0,0,2,1],
    [1,0,1,1,1,2],
    [0,1,1,1,1,0],
    [0,1,1,1,1,0],
    [0,1,0,0,1,0],
  ],
  // Frame 1 — back leg fwd, front leg back
  [
    [0,0,0,0,2,1],
    [1,0,1,1,1,2],
    [0,1,1,1,1,0],
    [1,1,1,1,0,0],
    [1,0,0,1,0,0],
  ],
  // Frame 2 — legs tucked (mid-stride)
  [
    [0,0,0,0,2,1],
    [1,0,1,1,1,2],
    [0,1,1,1,1,0],
    [0,0,1,1,0,0],
    [0,0,1,1,0,0],
  ],
  // Frame 3 — front leg fwd, back leg back
  [
    [0,0,0,0,2,1],
    [1,0,1,1,1,2],
    [0,1,1,1,1,0],
    [0,0,1,1,1,1],
    [0,0,0,1,0,1],
  ],
]

// ── Cat frames ─────────────────────────────────────────────────────────────────
// Cat has pointy ears (bright tips) and a raised tail (col 0, row 0-1)
export const CAT_FRAMES: number[][][] = [
  // Frame 0 — neutral
  [
    [3,0,0,0,3,1],
    [1,0,1,1,1,2],
    [0,1,1,1,1,0],
    [0,1,1,1,1,0],
    [0,1,0,0,1,0],
  ],
  // Frame 1 — back leg fwd, front leg back
  [
    [3,0,0,0,3,1],
    [1,0,1,1,1,2],
    [0,1,1,1,1,0],
    [1,1,1,1,0,0],
    [1,0,0,1,0,0],
  ],
  // Frame 2 — legs tucked
  [
    [3,0,0,0,3,1],
    [1,0,1,1,1,2],
    [0,1,1,1,1,0],
    [0,0,1,1,0,0],
    [0,0,1,1,0,0],
  ],
  // Frame 3 — front leg fwd, back leg back
  [
    [3,0,0,0,3,1],
    [1,0,1,1,1,2],
    [0,1,1,1,1,0],
    [0,0,1,1,1,1],
    [0,0,0,1,0,1],
  ],
]

// ── Hat overlays (4×4, drawn at top-center of sprite) ─────────────────────────
// Values are CSS color strings directly (not palette-indexed).

// Hats sit on the head at the RIGHT side of the 6-wide sprite (cols 4–5).
// Sprites are SPRITE_COLS=6 wide. Head occupies cols 4–5.
// Hat anchor: right edge of sprite. offsetX shifts left from there (sprite pixels).
// offsetY: rows above sprite row 0 (negative = above top).
export const SPRITE_COLS = 6

export const HATS: Record<string, {
  pixels: Array<Array<string | null>>
  offsetX: number
  offsetY: number
}> = {
  party_hat: {
    offsetX: -1,
    offsetY: -2,
    pixels: [
      [null, '1'],    // tip — '1' means use palette index 3 (bright) as a signal; actual color below
      ['1',  '1'],
      ['1',  '1'],
    ],
  },
  crown: {
    offsetX: -1,
    offsetY: -2,
    pixels: [
      ['1', null, '1'],
      ['1', '1',  '1'],
    ],
  },
  cowboy: {
    offsetX: -2,
    offsetY: -1,
    pixels: [
      [null, '1', '1', null],
      ['1',  '1', '1', '1' ],
    ],
  },
}

// Hat pixel '1' strings are rendered using the pet's palette index 3 (bright highlight).
// This keeps hats theme-aware rather than hardcoded hex.

// ── Render helpers ─────────────────────────────────────────────────────────────

export type PetSpecies = 'dog' | 'cat'

export function getFrames(species: PetSpecies): number[][][] {
  return species === 'dog' ? DOG_FRAMES : CAT_FRAMES
}

export function getPalette(species: PetSpecies, colorId: string): string[] {
  const map = species === 'dog' ? DOG_PALETTES : CAT_PALETTES
  return map[colorId] ?? map['default']!
}

/**
 * Draw a 6×5 pet sprite onto a canvas context.
 * @param ctx     2D rendering context
 * @param frame   pixel grid (rows × cols, palette indices)
 * @param palette color strings, index 0 = transparent
 * @param x       top-left x (canvas pixels)
 * @param y       top-left y (canvas pixels)
 * @param scale   pixels per sprite pixel (default 6 → 36×30 display)
 * @param flipX   mirror horizontally (when walking left)
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  frame: number[][],
  palette: string[],
  x: number,
  y: number,
  scale = 6,
  flipX = false,
): void {
  const rows = frame.length
  const cols = frame[0]!.length
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = flipX ? frame[row]![cols - 1 - col]! : frame[row]![col]!
      const color = palette[idx]
      if (!color || color === 'transparent') continue
      ctx.fillStyle = color
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale)
    }
  }
}

/**
 * Draw a hat on the head of a side-view sprite.
 * Head is at cols 4–5 (right side) of the 6-wide grid.
 * Hat pixels use the string '1' to mean "draw using palette[3] (bright)".
 * @param palette the pet's current palette (for theme-aware hat color)
 * @param flipX   true when sprite is mirrored
 */
export function drawHat(
  ctx: CanvasRenderingContext2D,
  hatId: string,
  palette: string[],
  spriteX: number,
  spriteY: number,
  scale = 6,
  flipX = false,
): void {
  const hat = HATS[hatId]
  if (!hat) return
  const hatW = hat.pixels[0]!.length
  const hatColor = palette[3] ?? palette[1] ?? '#39ff14'

  // Anchor to right side of sprite (head). When flipped, head is on left.
  let startX: number
  if (flipX) {
    startX = spriteX + hat.offsetX * scale
  } else {
    startX = spriteX + (SPRITE_COLS - hatW + hat.offsetX) * scale
  }
  const startY = spriteY + hat.offsetY * scale

  for (let row = 0; row < hat.pixels.length; row++) {
    const hatRow = flipX ? [...hat.pixels[row]!].reverse() : hat.pixels[row]!
    for (let col = 0; col < hatRow.length; col++) {
      if (!hatRow[col]) continue
      ctx.fillStyle = hatColor
      ctx.fillRect(startX + col * scale, startY + row * scale, scale, scale)
    }
  }
}
