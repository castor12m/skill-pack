'use strict';

const Anthropic = require('@anthropic-ai/sdk');

class ApiKeyMissingError extends Error {
  constructor() {
    super(
      '\u2717 ANTHROPIC_API_KEY is not set.\n  export ANTHROPIC_API_KEY=sk-ant-...'
    );
    this.name = 'ApiKeyMissingError';
  }
}

function createClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.trim().length === 0) {
    throw new ApiKeyMissingError();
  }
  return new Anthropic({ apiKey: key });
}

async function call(client, params) {
  const { model, system, user, maxTokens = 4096, temperature = 0 } = params;

  const messages = [{ role: 'user', content: user }];

  const reqParams = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (system) {
    reqParams.system = system;
  }

  const response = await client.messages.create(reqParams);

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    stop_reason: response.stop_reason,
  };
}

module.exports = { createClient, call, ApiKeyMissingError };
