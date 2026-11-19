import { describe, expect, it } from 'vitest'
import { csvCell, neutralizeCsvValue, toCsv } from './csv'

describe('CSV export safety (F-44)', () => {
  it.each(['=HYPERLINK("http://x","y")', '+1+1', '-2+3', '@SUM(A1)', '\t=1'])('neutralises %j', (value) => {
    expect(neutralizeCsvValue(value).startsWith("'")).toBe(true)
  })

  it('leaves ordinary text and numbers unchanged', () => {
    expect(neutralizeCsvValue('Asha Kumar')).toBe('Asha Kumar')
    expect(neutralizeCsvValue(-12.5)).toBe('-12.5')
    expect(neutralizeCsvValue('-40')).toBe('-40')
    expect(neutralizeCsvValue(null)).toBe('')
  })

  it('quotes cells and escapes embedded quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(
      toCsv([
        ['a', 1],
        ['=b', 'c'],
      ]),
    ).toBe('"a","1"\r\n"\'=b","c"')
  })
})
