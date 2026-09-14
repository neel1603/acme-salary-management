import { describe, expect, it } from 'vitest'
import { parseSseEvents } from './sse'

describe('parseSseEvents', () => {
  it('parses a single well-formed frame', () => {
    const { events, remainder } = parseSseEvents('event: grounding\ndata: {"grounding":[]}\n\n')

    expect(events).toEqual([{ event: 'grounding', data: { grounding: [] } }])
    expect(remainder).toBe('')
  })

  it('parses multiple frames in one buffer, in order', () => {
    const buffer =
      'event: grounding\ndata: {"grounding":[]}\n\n' +
      'event: chunk\ndata: {"text":"Hello "}\n\n' +
      'event: chunk\ndata: {"text":"there"}\n\n'

    const { events, remainder } = parseSseEvents(buffer)

    expect(events).toEqual([
      { event: 'grounding', data: { grounding: [] } },
      { event: 'chunk', data: { text: 'Hello ' } },
      { event: 'chunk', data: { text: 'there' } },
    ])
    expect(remainder).toBe('')
  })

  it('holds a frame split across two reads', () => {
    const firstRead = parseSseEvents('event: chunk\ndata: {"text":"Hel')

    expect(firstRead.events).toEqual([])
    expect(firstRead.remainder).toBe('event: chunk\ndata: {"text":"Hel')

    const secondRead = parseSseEvents(`${firstRead.remainder}lo"}\n\n`)

    expect(secondRead.events).toEqual([{ event: 'chunk', data: { text: 'Hello' } }])
    expect(secondRead.remainder).toBe('')
  })

  it('skips malformed JSON in a data line', () => {
    const buffer = 'event: chunk\ndata: not-json\n\nevent: chunk\ndata: {"text":"ok"}\n\n'

    const { events } = parseSseEvents(buffer)

    expect(events).toEqual([{ event: 'chunk', data: { text: 'ok' } }])
  })

  it('ignores an unrecognized event type', () => {
    const buffer = 'event: ping\ndata: {}\n\nevent: chunk\ndata: {"text":"ok"}\n\n'

    const { events } = parseSseEvents(buffer)

    expect(events).toEqual([{ event: 'chunk', data: { text: 'ok' } }])
  })
})
