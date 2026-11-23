// utils/barcode.ts

/**
 * Pure TypeScript Code 128 SVG barcode generator.
 *
 * Implements ISO/IEC 15417 Code 128 standard (Subsets B and C).
 * Generates crisp, resolution-independent SVG vector barcodes suitable
 * for mobile phone screens, laser scanners, and thermal/adhesive printing.
 *
 * Optimized for 18-digit Swedish DHL Freight Kolli-IDs via high-density Code 128 Subset C.
 */

// Code 128 bar and space widths (6 numbers per pattern: bar, space, bar, space, bar, space)
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112', // 100-106 (106 is STOP pattern)
]

const START_CODE_B = 104
const START_CODE_C = 105
const STOP_CODE = 106

export interface BarcodeRenderOptions {
  /** Height of the barcode in pixels (default: 80) */
  height?: number
  /** Width multiplier per unit module in pixels (default: 2) */
  moduleWidth?: number
  /** Quiet zone margins in modules (default: 10) */
  quietZone?: number
  /** Color of the bars (default: '#000000') */
  color?: string
  /** Background fill (default: '#ffffff' or transparent) */
  backgroundColor?: string
  /** Include human-readable text beneath bars (default: false, rendered externally for crisp styling) */
  includeText?: boolean
}

/**
 * Encodes an input string into Code 128 symbol values.
 * Automatically chooses Subset C when input is an even number of digits (e.g. 18-digit Kolli-ID).
 */
export function encodeCode128(text: string): number[] {
  const clean = text.trim()
  const isAllDigits = /^\d+$/.test(clean)
  const isEvenLength = clean.length % 2 === 0

  const symbols: number[] = []

  if (isAllDigits && isEvenLength && clean.length >= 2) {
    // Mode C: High-density numeric pairs (00-99)
    symbols.push(START_CODE_C)
    for (let i = 0; i < clean.length; i += 2) {
      const pair = parseInt(clean.slice(i, i + 2), 10)
      symbols.push(pair)
    }
  } else {
    // Mode B: Standard alphanumeric ASCII (32-127)
    symbols.push(START_CODE_B)
    for (let i = 0; i < clean.length; i++) {
      const charCode = clean.charCodeAt(i)
      symbols.push(charCode - 32)
    }
  }

  // Calculate Modulo 103 Checksum:
  // Checksum = (StartValue + Sum(i * SymbolValue_i)) mod 103
  let checksum = symbols[0]!
  for (let i = 1; i < symbols.length; i++) {
    checksum += i * symbols[i]!
  }
  symbols.push(checksum % 103)

  // Append Stop Symbol
  symbols.push(STOP_CODE)

  return symbols
}

/**
 * Generates a crisp, scannable SVG markup string for a Code 128 barcode.
 *
 * @param code Input tracking code or Kolli-ID.
 * @param options Dimensions and color rendering options.
 * @returns Complete SVG string `<svg ...>...</svg>`.
 */
export function generateCode128Svg(code: string, options: BarcodeRenderOptions = {}): string {
  const {
    height = 90,
    moduleWidth = 2.5,
    quietZone = 12,
    color = '#000000',
    backgroundColor = '#ffffff',
  } = options

  const symbols = encodeCode128(code)

  // Convert symbol values into binary bar/space modules
  let binaryString = ''
  for (const sym of symbols) {
    const pattern = CODE128_PATTERNS[sym] || ''
    let isBar = true
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i]!, 10)
      binaryString += (isBar ? '1' : '0').repeat(width)
      isBar = !isBar
    }
  }

  const quietModules = '0'.repeat(quietZone)
  const fullBinary = quietModules + binaryString + quietModules
  const totalModules = fullBinary.length
  const totalWidth = totalModules * moduleWidth

  // Construct SVG rect paths for each bar segment
  let rects = ''
  let currentRun = 0
  let runStart = 0
  let inBar = false

  for (let i = 0; i < totalModules; i++) {
    const char = fullBinary[i]
    if (char === '1') {
      if (!inBar) {
        inBar = true
        runStart = i
        currentRun = 1
      } else {
        currentRun++
      }
    } else if (inBar) {
      rects += `<rect x="${(runStart * moduleWidth).toFixed(1)}" y="0" width="${(currentRun * moduleWidth).toFixed(1)}" height="${height}" fill="${color}" />`
      inBar = false
      currentRun = 0
    }
  }

  if (inBar) {
    rects += `<rect x="${(runStart * moduleWidth).toFixed(1)}" y="0" width="${(currentRun * moduleWidth).toFixed(1)}" height="${height}" fill="${color}" />`
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(1)} ${height}" width="100%" height="100%" style="display: block; max-width: 100%;">
      ${backgroundColor ? `<rect width="100%" height="100%" fill="${backgroundColor}" />` : ''}
      ${rects}
    </svg>
  `.trim()
}

