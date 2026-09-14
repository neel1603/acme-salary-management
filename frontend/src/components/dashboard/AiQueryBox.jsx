import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAiQuery } from '@/hooks/useAiQuery'
import { useAiQueryStatus } from '@/hooks/useAiQueryStatus'

export function AiQueryBox() {
  const { data } = useAiQueryStatus()
  const { status, answer, grounding, errorMessage, ask } = useAiQuery()
  const [question, setQuestion] = useState('')

  // Undefined while useAiQueryStatus is still loading, so this one check covers both
  // "not configured" and "haven't heard back yet" -- neither should announce the feature exists.
  if (!data?.available) return null

  const isPending = status === 'pending'

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed) return
    ask(trimmed)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask a question</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="ai-query-question">Question</Label>
            <Input
              id="ai-query-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              placeholder="e.g. what's the average salary in Engineering?"
              disabled={isPending}
            />
          </div>
          <Button type="submit" disabled={isPending}>
            Ask
          </Button>
        </form>

        {isPending && answer === '' && <p className="text-sm text-muted-foreground">Thinking…</p>}

        {answer && <p className="text-sm whitespace-pre-wrap">{answer}</p>}

        {status === 'done' && grounding.length > 0 && (
          <ul className="text-xs text-muted-foreground">
            {grounding.map((item, index) => (
              <li key={index}>
                {item.tool}({JSON.stringify(item.arguments)})
              </li>
            ))}
          </ul>
        )}

        {status === 'error' && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
