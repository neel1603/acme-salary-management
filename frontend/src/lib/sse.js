// One frame is `event: <type>\ndata: <json>\n\n`, matching the backend's own frame builder
// (app/routers/ai_query.py's _sse_event). A network read can land mid-frame, so this takes
// accumulated decoded text and returns whatever complete frames it found plus the leftover tail
// -- the caller prepends that tail to the next chunk and calls this again.
const KNOWN_EVENT_TYPES = new Set(['grounding', 'chunk', 'error'])

export function parseSseEvents(buffer) {
  const blocks = buffer.split('\n\n')
  const remainder = blocks.pop()
  const events = blocks.map(parseBlock).filter(Boolean)

  return { events, remainder }
}

function parseBlock(block) {
  const eventLine = block.split('\n').find((line) => line.startsWith('event: '))
  const dataLine = block.split('\n').find((line) => line.startsWith('data: '))
  if (!eventLine || !dataLine) return null

  const event = eventLine.slice('event: '.length)
  if (!KNOWN_EVENT_TYPES.has(event)) return null

  try {
    return { event, data: JSON.parse(dataLine.slice('data: '.length)) }
  } catch {
    return null
  }
}
