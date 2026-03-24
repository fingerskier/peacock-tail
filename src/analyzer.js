import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function createAnalyzer() {
  let state = {
    summary: '',
    trends: [],
    keyValues: {},
    iteration: 0,
    lastUpdated: null,
  };

  async function analyze(newLines) {
    state.iteration++;

    const prompt = buildPrompt(state, newLines);

    try {
      const result = await callClaude(prompt);
      const parsed = parseResponse(result);

      state = {
        ...state,
        summary: parsed.summary,
        trends: parsed.trends,
        keyValues: parsed.keyValues,
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`Analysis error (iteration ${state.iteration}):`, err.message);
      state.summary = `*Error during analysis:* ${err.message}\n\n**Raw log tail:**\n\`\`\`\n${newLines.slice(-500)}\n\`\`\``;
      state.lastUpdated = new Date().toISOString();
    }

    return state;
  }

  function getState() {
    return state;
  }

  return { analyze, getState };
}

function buildPrompt(priorState, newLines) {
  const priorContext = priorState.iteration > 1
    ? `## Prior Analysis (iteration ${priorState.iteration - 1})
Summary: ${priorState.summary}
Trends: ${JSON.stringify(priorState.trends)}
Key-Values: ${JSON.stringify(priorState.keyValues)}
---`
    : '(This is the first iteration — no prior analysis.)';

  return `You are a log analysis assistant. Analyze the following log tail and produce a structured JSON response.

${priorContext}

## New Log Lines
\`\`\`
${newLines.slice(-8000)}
\`\`\`

Respond with ONLY valid JSON (no markdown fences) in this exact format:
{
  "summary": "A concise markdown summary of what is happening in these logs, notable events, warnings, errors, and overall health.",
  "trends": [
    {"label": "descriptive name", "values": [numbers], "timestamps": ["ISO strings or relative labels"]}
  ],
  "keyValues": {
    "key": "value (string or number)"
  }
}

For trends: extract any numeric patterns (request rates, error counts, response times, memory usage, etc). Each trend should have a label, an array of recent numeric values, and corresponding timestamp labels.

For keyValues: extract notable key-value pairs like status codes, hostnames, versions, error types, etc.

Keep the summary concise (3-5 sentences). Use markdown formatting.`;
}

async function callClaude(prompt) {
  try {
    const { stdout } = await execFileAsync('claude', ['-p', prompt], {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code');
    }
    throw err;
  }
}

function parseResponse(text) {
  // Strip markdown code fences if present
  let cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || '',
      trends: Array.isArray(parsed.trends) ? parsed.trends : [],
      keyValues: parsed.keyValues && typeof parsed.keyValues === 'object' ? parsed.keyValues : {},
    };
  } catch {
    // If JSON parse fails, treat the whole response as summary
    return {
      summary: text,
      trends: [],
      keyValues: {},
    };
  }
}
