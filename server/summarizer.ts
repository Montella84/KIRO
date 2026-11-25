import { formatPage as deterministicFormat, sanitize } from '../src/core/pageFormatter';
import type { IncomingEvent } from '../src/core/types';

const LLM_TIMEOUT_MS = 2000;

/**
 * Format an authorized interrupt event into a pager message (<= 80 chars).
 *
 * When aiOffline is true or no API key is configured, delegates immediately to
 * the deterministic pageFormatter. When a key is available, calls the
 * OpenAI-compatible endpoint with a 2 000 ms timeout, falling back to the
 * deterministic formatter on any error.
 *
 * The result always passes through sanitize + slice(0, 80) before returning.
 */
export async function formatPage(
  event: IncomingEvent,
  aiOffline: boolean
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com';

  if (aiOffline || !apiKey) {
    return finish(deterministicFormat(event));
  }

  try {
    const result = await callLlm(event, apiKey, baseUrl);
    return finish(result);
  } catch (err) {
    console.error('[summarizer] LLM call failed, using fallback:', err);
    return finish(deterministicFormat(event));
  }
}

function finish(raw: string): string {
  return sanitize(raw).slice(0, 80);
}

async function callLlm(
  event: IncomingEvent,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 30,
        messages: [
          {
            role: 'system',
            content:
              'You are a pager message compressor. Respond with ONLY the compressed message, ' +
              'no explanation. The message must be under 80 characters and use only printable ASCII.',
          },
          {
            role: 'user',
            content: `Compress this alert into a pager message under 80 chars:\n` +
              `From: ${event.sender} | Source: ${event.source} | ${event.body}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('Empty LLM response');
    return content;
  } finally {
    clearTimeout(timer);
  }
}
