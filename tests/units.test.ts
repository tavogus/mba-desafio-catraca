import { describe, expect, test } from 'vitest'
import { formatReais, parseReaisToCents } from '../src/money.js'
import { formatStartsAtIso, parseSaoPauloDateTimeLocal } from '../src/time.js'

describe('dinheiro e horário', () => {
  test('interpreta reais e formata o painel', () => {
    expect(parseReaisToCents('100')).toBe(10000)
    expect(parseReaisToCents('100,00')).toBe(10000)
    expect(parseReaisToCents('100.00')).toBe(10000)
    expect(parseReaisToCents('R$ 150,00')).toBe(15000)
    expect(parseReaisToCents('1.234,56')).toBe(123456)
    expect(parseReaisToCents('0')).toBeNull()
    expect(parseReaisToCents('-1')).toBeNull()
    expect(formatReais(35000)).toBe('R$ 350,00')
    expect(formatReais(0)).toBe('R$ 0,00')
    expect(formatReais(123456)).toBe('R$ 1.234,56')
  })

  test('grava o início em America/Sao_Paulo', () => {
    expect(parseSaoPauloDateTimeLocal('2026-02-31T10:00')).toBeNull()
    expect(parseSaoPauloDateTimeLocal('ontem')).toBeNull()
    const parsed = parseSaoPauloDateTimeLocal('2028-06-15T21:00')
    expect(parsed).not.toBeNull()
    expect(formatStartsAtIso(parsed as Date)).toBe('2028-06-15T21:00:00-03:00')
    expect(formatStartsAtIso(new Date('2028-06-15T21:00:00-03:00'))).toBe('2028-06-15T21:00:00-03:00')
  })
})
