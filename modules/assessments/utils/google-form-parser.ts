/**
 * Google Forms Response Parser & Student Matcher
 * Parses CSV exports and Google Sheet pastes, extracting scores and mapping to enrolled students.
 */

export interface ParsedScoreRow {
  studentId: number | null
  studentName: string
  score: number
  percentage: number
  matched: boolean
  rawName: string
  rawScore: string
  matchType: 'id' | 'name-exact' | 'name-fuzzy' | 'manual' | 'unmatched'
  existingScore?: number | null
  /** F-24: score is below 0 or above the maximum; shown in the preview and never imported. */
  outOfRange?: boolean
}

export interface StudentOption {
  id: string
  register_id: number
  name: string
}

/**
 * Quote-aware CSV/TSV parser (F-24). Newlines inside quoted cells belong to the cell, so
 * multi-line answers no longer split one response across several rows.
 */
export function parseCsvOrTsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  if (!source.trim()) return []

  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const tabCount = (firstLine.match(/\t/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  const delimiter = tabCount > commaCount ? '\t' : ','

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  const endCell = () => {
    row.push(cell.trim())
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (row.some((value) => value.length > 0)) rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      endCell()
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++
      endRow()
    } else {
      cell += char
    }
  }
  endRow()
  return rows
}

export function extractNumericScore(rawScore: string, maxScore: number): number | null {
  if (!rawScore) return null
  const cleaned = rawScore.trim()

  // Case 1: "28.00 / 30" or "28 / 30"
  const fractionMatch = cleaned.match(/^([\d.]+)\s*\/\s*([\d.]+)/)
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1])
    const den = parseFloat(fractionMatch[2])
    if (!isNaN(num) && !isNaN(den) && den > 0) {
      // If denominator differs from maxScore, scale appropriately
      if (den !== maxScore && maxScore > 0) {
        return Math.round((num / den) * maxScore * 100) / 100
      }
      return num
    }
  }

  // Case 2: "80%" or "80 %"
  const pctMatch = cleaned.match(/^([\d.]+)\s*%/)
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1])
    if (!isNaN(pct)) {
      return Math.round((pct / 100) * maxScore * 100) / 100
    }
  }

  // Case 3: Simple decimal/number: "28" or "28.5"
  // F-24: no silent clamping; out-of-range values are flagged by the caller instead.
  const simpleNum = parseFloat(cleaned)
  if (!isNaN(simpleNum)) {
    return simpleNum
  }

  return null
}

export function parseGoogleFormResponses(
  rawText: string,
  enrolledStudents: StudentOption[],
  maxScore: number,
  existingResultsMap: Map<number, number> = new Map(),
): ParsedScoreRow[] {
  const table = parseCsvOrTsv(rawText)
  if (table.length === 0) return []

  // Analyze header row
  let headerIndex = 0
  let nameCol = -1
  let scoreCol = -1
  let idCol = -1
  let emailCol = -1

  // Detect header row by scanning first 3 rows
  for (let r = 0; r < Math.min(3, table.length); r++) {
    const row = table[r].map((h) => h.toLowerCase())
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (
        scoreCol === -1 &&
        (cell.includes('score') || cell.includes('marks') || cell.includes('points') || cell.includes('total'))
      ) {
        scoreCol = c
        headerIndex = r
      }
      if (
        nameCol === -1 &&
        (cell.includes('student name') || cell === 'name' || cell.includes('full name') || cell.includes('candidate'))
      ) {
        nameCol = c
        headerIndex = r
      }
      if (
        idCol === -1 &&
        (cell.includes('register') ||
          cell.includes('student id') ||
          cell.includes('roll') ||
          cell === 'id' ||
          cell.includes('tai-'))
      ) {
        idCol = c
        headerIndex = r
      }
      if (emailCol === -1 && cell.includes('email')) {
        emailCol = c
        headerIndex = r
      }
    }
  }

  // Fallback heuristics if no header row was detected (e.g. direct data paste)
  if (scoreCol === -1) {
    // Check if column 1 or column 2 contains fractions like "24 / 30"
    for (let c = 0; c < (table[0]?.length || 0); c++) {
      if (table.some((row) => /\d+\s*\/\s*\d+/.test(row[c]))) {
        scoreCol = c
        break
      }
    }
  }

  // If still not found and there are 2 columns: column 0 is name, column 1 is score
  if (scoreCol === -1 && table[0]?.length === 2) {
    nameCol = 0
    scoreCol = 1
  }

  const rowsToProcess = headerIndex >= 0 && (nameCol !== -1 || scoreCol !== -1) ? table.slice(headerIndex + 1) : table

  const parsedResults: ParsedScoreRow[] = []

  for (const row of rowsToProcess) {
    if (row.length === 0 || row.every((c) => c === '')) continue

    const rawName = nameCol !== -1 && row[nameCol] ? row[nameCol].trim() : ''
    const rawScore = scoreCol !== -1 && row[scoreCol] ? row[scoreCol].trim() : ''
    const rawId = idCol !== -1 && row[idCol] ? row[idCol].trim() : ''
    const rawEmail = emailCol !== -1 && row[emailCol] ? row[emailCol].trim() : ''

    const numericScore = extractNumericScore(rawScore, maxScore)
    if (numericScore === null) continue // Skip rows without valid score

    // Match student against enrolled roster
    let matchedStudent: StudentOption | null = null
    let matchType: ParsedScoreRow['matchType'] = 'unmatched'

    // 1. Try matching by Register ID
    if (rawId) {
      const parsedId = parseInt(rawId.replace(/\D/g, ''), 10)
      if (!isNaN(parsedId)) {
        matchedStudent = enrolledStudents.find((s) => s.register_id === parsedId) || null
        if (matchedStudent) matchType = 'id'
      }
    }

    // Also check if ID is embedded inside student name: e.g. "Asha (1042)" or "Asha #1042"
    if (!matchedStudent && rawName) {
      const embeddedIdMatch = rawName.match(/(?:#|tai-|id:?\s*)(\d+)/i) || rawName.match(/\((\d+)\)/)
      if (embeddedIdMatch) {
        const parsedId = parseInt(embeddedIdMatch[1], 10)
        matchedStudent = enrolledStudents.find((s) => s.register_id === parsedId) || null
        if (matchedStudent) matchType = 'id'
      }
    }

    // 2. Try exact name match (case-insensitive, trimmed)
    if (!matchedStudent && rawName) {
      const cleanRaw = rawName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      matchedStudent =
        enrolledStudents.find((s) => {
          const cleanS = s.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          return cleanS === cleanRaw
        }) || null
      if (matchedStudent) matchType = 'name-exact'
    }

    // 3. Try fuzzy name match (first name match or contains)
    if (!matchedStudent && rawName) {
      const rawWords = rawName.toLowerCase().split(/\s+/).filter(Boolean)
      if (rawWords.length > 0) {
        matchedStudent =
          enrolledStudents.find((s) => {
            const sWords = s.name.toLowerCase().split(/\s+/).filter(Boolean)
            // Match if first names match and last initial matches
            return sWords[0] === rawWords[0]
          }) || null
        if (matchedStudent) matchType = 'name-fuzzy'
      }
    }

    const percentage = maxScore > 0 ? Math.round((numericScore / maxScore) * 1000) / 10 : 0
    const existingScore = matchedStudent ? (existingResultsMap.get(matchedStudent.register_id) ?? null) : null

    parsedResults.push({
      studentId: matchedStudent ? matchedStudent.register_id : null,
      studentName: matchedStudent ? matchedStudent.name : rawName || 'Unknown Student',
      score: numericScore,
      percentage,
      matched: matchedStudent !== null,
      rawName: rawName || rawEmail || 'Respondent',
      rawScore,
      matchType,
      existingScore,
      outOfRange: numericScore < 0 || numericScore > maxScore,
    })
  }

  return parsedResults
}
