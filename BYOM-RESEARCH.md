# BYOM (Bring Your Own Model) — Research & Implementation Guide

**Status**: Research Document  
**Date**: March 6, 2026  
**Scope**: c9s CLI + claude-manager platform  
**Author**: Architecture Research  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Agent Spawning Architecture](#current-agent-spawning-architecture)
3. [Model Provider Landscape](#model-provider-landscape)
4. [OpenAI-Compatible API as Universal Adapter](#openai-compatible-api-as-universal-adapter)
5. [Configuration Model](#configuration-model)
6. [Streaming Format Unification](#streaming-format-unification)
7. [Tool Use Compatibility Matrix](#tool-use-compatibility-matrix)
8. [Go Implementation Strategy](#go-implementation-strategy)
9. [Agent Subprocess Architecture](#agent-subprocess-architecture)
10. [Security & Credential Management](#security--credential-management)
11. [Migration Path & Phasing](#migration-path--phasing)
12. [Risks & Tradeoffs](#risks--tradeoffs)
13. [Recommended Go Packages](#recommended-go-packages)
14. [Implementation Priority & Effort](#implementation-priority--effort-estimates)

---

## Executive Summary

The claude-manager backend currently spawns agents exclusively via the `claude` CLI subprocess with the `--print --output-format stream-json` flags. To support BYOM (Bring Your Own Model), we need to:

1. **Decouple model selection from the Claude CLI** — introduce a provider abstraction that can spawn agents with any LLM (Claude API, OpenAI, Ollama, OpenRouter, etc.)
2. **Standardize on OpenAI Chat Completions format** — most modern providers expose OpenAI-compatible APIs, reducing implementation complexity
3. **Normalize streaming output** — convert provider-specific streaming formats (SSE vs. JSONL) into a unified internal format
4. **Extend c9s configuration** — add provider setup UI + per-project/per-task model selection
5. **Build a lightweight Go agent runtime** — for non-Claude models, implement direct API calling instead of subprocess shelling

**Key insight**: Ollama, LM Studio, vLLM, and OpenRouter all support OpenAI-compatible Chat Completions APIs with tool calling. We can build a single "OpenAI-compatible" adapter that works with 80% of desired use cases, then add specialized adapters for unique providers (e.g., AWS Bedrock, Azure OpenAI).

---

## Current Agent Spawning Architecture

### How Agents Are Currently Spawned

**File**: `/Users/ayx106492/git/claude-manager/backend/broker/agent_session.py`

```python
# Current approach (Claude CLI only)
cmd = [
    CLAUDE_BIN,                        # "claude" binary from $PATH
    "--print",                         # Output to stdout
    "--output-format", "stream-json",  # JSONL event format
    "--verbose",
    "--include-partial-messages",      # Fine-grained streaming events
    "--permission-mode", "acceptEdits",
    "--model", self.model,             # Model selection (CLI handles)
    "--mcp-config", self.mcp_config_path,  # Optional MCP config
    "--", message                      # Task/prompt
]

self._proc = await asyncio.create_subprocess_exec(
    *cmd,
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.PIPE,
    cwd=cwd,
    env=_get_spawn_env(),  # Injects CLAUDE_CODE_OAUTH_TOKEN
    limit=1024 * 1024,     # 1MB buffer for large stream-json events
)
```

**Authentication**: OAuth token from `~/.claude` (macOS Keychain or file), injected via `_get_spawn_env()`.

**Model Selection**: Hardcoded at dispatch time via `ProjectConfig.model` (default: nil) or `DispatchRequest.model` override.

**Streaming Format**: 
- Event-based JSONL (one JSON object per line)
- Event types: `system`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_start`, `message_stop`, `assistant`, `user`, `result`
- Agent session parses these events and emits callbacks (`on_text_delta`, `on_tool_start`, etc.)

### Key Dependencies on Claude CLI

1. **Binary path** — requires `claude` in $PATH
2. **OAuth tokens** — depends on user's Anthropic Pro/Max account
3. **stream-json format** — parser in `agent_session.py` is hardcoded to this format
4. **Tool calling** — handled entirely by CLI; we just call tools when the CLI requests them
5. **MCP integration** — `--mcp-config` flag passes MCP server locations to CLI

### What Would Change for BYOM

- **Binary** → HTTP API client (Go or Python library)
- **OAuth** → API keys for each provider (env vars, config file, or keychain)
- **stream-json** → Normalize different streaming formats (OpenAI SSE, Anthropic API streaming, etc.)
- **Tool calling** → Different providers have different function calling schemas; need adapters
- **MCP** → Still needed; can be passed to agents via system prompt or injected separately

---

## Model Provider Landscape

### Providers to Support (Priority Order)

| Provider | Type | Streaming | Tool Use | Cost | Setup | Priority |
|----------|------|-----------|----------|------|-------|----------|
| **Anthropic Claude** (API) | API | Yes (SSE) | Yes (native) | $$$ | API key | P0 |
| **OpenAI** (GPT-4o, o1, o3) | API | Yes (SSE) | Yes (native) | $$ | API key | P0 |
| **Ollama** (local) | HTTP | Yes (SSE) | Yes (native) | Free | `ollama serve` | P1 |
| **LM Studio** (local) | HTTP | Yes (SSE) | Yes (via OpenAI compat) | Free | Desktop app | P1 |
| **vLLM** (self-hosted) | HTTP | Yes (SSE) | Yes (via OpenAI compat) | Free | `vllm serve` | P1 |
| **OpenRouter** (aggregator) | API | Yes (SSE) | Yes (native) | $$ | API key | P1 |
| **AWS Bedrock** (enterprise) | API | Yes (event stream) | Yes (for Claude) | $$$ | AWS account | P2 |
| **Azure OpenAI** (enterprise) | API | Yes (SSE) | Yes (native) | $$ | Azure account | P2 |
| **Google Gemini** (via API) | API | Yes (streaming) | Yes (tool use) | $ | API key | P2 |

### Provider-Specific Notes

**Anthropic Claude (Direct API)**
- Alternative to CLI; allows fine-grained control
- Streaming via `stream=True` returns Server-Sent Events
- Tool use via `tools` parameter with JSON schema
- Current project uses CLI; API version would give same capabilities

**OpenAI (GPT-4o, GPT-4 Turbo, o1, o3)**
- Mature tool calling (function calling) format
- Both streaming and non-streaming supported
- Recent Responses API (March 2025) is the recommended approach
- Price competitive but different from Claude

**Ollama (Local LLMs)**
- Models: Llama 3.1, Mistral, Codellama, Neural-Chat, etc.
- Runs entirely locally (no API key needed)
- Offers BOTH OpenAI-compatible AND Anthropic API-compatible endpoints
- Tool support via OpenAI endpoint for compatible models (Llama 3.1, Mistral Nemo)

**LM Studio (Local, Desktop)**
- Similar to Ollama but GUI-based discovery
- Runs local inference server on port 1234
- OpenAI-compatible endpoint `/v1/chat/completions`
- Also supports Anthropic-compatible API

**vLLM (Self-hosted, Production)**
- Optimized inference server for running models at scale
- Full OpenAI Chat Completions API compatibility
- Supports batch processing, LoRA adapters, etc.
- Best for production local inference

**OpenRouter (Aggregator)**
- Single API to access 100+ models (Claude, GPT-4o, Llama, Mistral, etc.)
- Streaming + tool calling support
- No vendor lock-in; route to different models in one codebase

---

## OpenAI-Compatible API as Universal Adapter

### The Strategy

**Key insight**: OpenAI's Chat Completions format has become the de facto standard. Ollama, LM Studio, vLLM, and even Anthropic's models can be called via OpenAI-compatible APIs.

**Implementation approach**:
1. Build a generic `OpenAICompatibleProvider` that calls any `/v1/chat/completions` endpoint
2. Add specialized providers for unique APIs (Anthropic native, AWS Bedrock, Azure OpenAI)
3. Normalize all streaming to a common internal format
4. Use provider adapters to translate tool calling schemas

### OpenAI Chat Completions Format

```python
# Request (simplified)
{
  "model": "gpt-4o",
  "messages": [
    {"role": "user", "content": "..."}
  ],
  "tools": [  # Function calling schema
    {
      "type": "function",
      "function": {
        "name": "read_file",
        "description": "...",
        "parameters": {
          "type": "object",
          "properties": {
            "file_path": {"type": "string"}
          },
          "required": ["file_path"]
        }
      }
    }
  ],
  "stream": true
}

# Streaming response (Server-Sent Events)
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text"}}
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}
data: {"type": "content_block_stop", "index": 0}
data: [DONE]

# or for tool calls
data: {"type": "content_block_start", "index": 1, "content_block": {"type": "tool_use", "id": "call_123", "name": "read_file"}}
data: {"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": "{\"file"}}
...
```

### Tool Calling Schema Normalization

Different providers use slightly different schemas:

**OpenAI function calling**:
```json
{
  "type": "function",
  "function": {
    "name": "read_file",
    "parameters": {...}  // JSON Schema
  }
}
```

**Claude/Anthropic tools**:
```json
{
  "name": "read_file",
  "description": "...",
  "input_schema": {...}  // JSON Schema
}
```

**Solution**: Define an internal `ToolDefinition` struct and convert both directions:
- Claude → internal → OpenAI
- OpenAI → internal → Claude
- Ollama (OpenAI compat) → internal → Ollama compat

---

## Configuration Model

### Proposed Config Structure

**Location**: `~/.config/c9s/config.json` (user level) + per-project overrides in `manager.json`

```json
{
  "theme": "constellation",
  
  "default_provider": "anthropic",
  "default_model": "claude-opus-4-20250514",
  
  "providers": {
    "anthropic": {
      "type": "anthropic-api",
      "api_key_env": "ANTHROPIC_API_KEY",
      "base_url": "https://api.anthropic.com",
      "models": [
        "claude-opus-4-20250514",
        "claude-sonnet-4-20250514",
        "claude-haiku-4-5-20251001"
      ],
      "default_model": "claude-sonnet-4-20250514",
      "enabled": true
    },
    
    "openai": {
      "type": "openai-api",
      "api_key_env": "OPENAI_API_KEY",
      "base_url": "https://api.openai.com/v1",
      "models": ["gpt-4o", "gpt-4-turbo", "o1-preview", "o3"],
      "enabled": true
    },
    
    "ollama": {
      "type": "openai-compatible",
      "base_url": "http://localhost:11434/v1",
      "models": ["llama3.1", "mistral", "codellama"],
      "enabled": true,
      "local": true
    },
    
    "lmstudio": {
      "type": "openai-compatible",
      "base_url": "http://localhost:1234/v1",
      "models": ["gpt-oss-instruct"],
      "enabled": false,
      "local": true
    },
    
    "vllm": {
      "type": "openai-compatible",
      "base_url": "http://inference-server:8000/v1",
      "api_key_env": "VLLM_API_KEY",
      "models": [],  // Auto-discover or list
      "enabled": false
    },
    
    "openrouter": {
      "type": "openai-compatible",
      "api_key_env": "OPENROUTER_API_KEY",
      "base_url": "https://openrouter.ai/api/v1",
      "models": [
        "anthropic/claude-3.5-sonnet",
        "openai/gpt-4o",
        "meta-llama/llama-3.1-70b-instruct"
      ],
      "enabled": true
    },
    
    "bedrock": {
      "type": "aws-bedrock",
      "region": "us-east-1",
      "models": [
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "anthropic.claude-opus-4-v1:0"
      ],
      "enabled": false
    }
  }
}
```

### Per-Project Overrides

**File**: `~/.claude/canvas/projects/<project>/manager.json`

```json
{
  "name": "research-project",
  "model_provider": "openai",
  "model": "gpt-4o",
  "parallelism": 3,
  "mcp_config": ".claude/mcp_config.json"
}
```

### Per-Task Model Selection

**Via c9s CLI**:
```bash
c9s dispatch my-project "Do X" --provider openai --model gpt-4o
c9s dispatch my-project "Do Y" --provider ollama --model llama3.1
```

**Via API** (DispatchRequest):
```json
POST /api/projects/my-project/dispatch
{
  "task": "...",
  "provider": "openai",
  "model": "gpt-4o"
}
```

---

## Streaming Format Unification

### The Problem

- **Claude CLI** emits `stream-json` (JSONL format, line-delimited JSON)
- **OpenAI API** emits Server-Sent Events (SSE) with `data: ` prefix
- **Anthropic API** emits SSE similar to OpenAI
- **Ollama** via OpenAI compat emits SSE
- **vLLM** emits SSE

**Current code** (agent_session.py) parses stream-json line-by-line:
```python
while True:
    line = await self._proc.stdout.readline()
    if not line: break
    
    raw = line.decode("utf-8", errors="replace").strip()
    if not raw: continue
    
    try:
        event = json.loads(raw)  # Assumes JSONL
    except json.JSONDecodeError:
        continue
    
    await self._handle_stream_event(event)
```

### Unified Internal Event Format

Define a common event schema that abstracts all providers:

```python
class UnifiedStreamEvent(BaseModel):
    """Universal event format for all streaming models."""
    type: str  # "message_start", "content_block_start", "content_block_delta", "content_block_stop", etc.
    index: int | None = None
    content_block: dict | None = None
    delta: dict | None = None
    message: dict | None = None
    timestamp: str | None = None
```

### Provider Adapters

Each provider gets a **stream adapter** that converts its native format to `UnifiedStreamEvent`:

**Claude API (stream-json)**:
```python
def adapt_claude_stream(raw_line: str) -> UnifiedStreamEvent:
    event = json.loads(raw_line)
    # Map Claude event format → UnifiedStreamEvent
    return UnifiedStreamEvent(
        type=event.get("type"),
        index=event.get("index"),
        ...
    )
```

**OpenAI/Ollama/vLLM (SSE)**:
```python
async def adapt_openai_stream(sse_response):
    async for line in sse_response:
        if not line.startswith("data: "):
            continue
        
        data = line[6:]  # Remove "data: " prefix
        if data == "[DONE]":
            break
        
        event = json.loads(data)
        # Map OpenAI format → UnifiedStreamEvent
        yield UnifiedStreamEvent(...)
```

**AWS Bedrock (event stream)**:
```python
async def adapt_bedrock_stream(response):
    async for event in response:
        if event["type"] == "content_block_start":
            yield UnifiedStreamEvent(...)
        ...
```

### Implementation Pattern (Go)

In c9s, each provider would have a stream adapter:

```go
// internal/broker/stream_adapter.go

type StreamAdapter interface {
    // Normalize any provider's streaming format to internal events
    ReadEvent(ctx context.Context) (*UnifiedStreamEvent, error)
}

type OpenAIStreamAdapter struct {
    resp *http.Response
    reader bufio.Reader
}

func (a *OpenAIStreamAdapter) ReadEvent(ctx context.Context) (*UnifiedStreamEvent, error) {
    // Parse SSE format, convert to UnifiedStreamEvent
}

type AnthropicStreamAdapter struct {
    // Claude API streaming
}
```

---

## Tool Use Compatibility Matrix

### Current State

Ollama, as of late 2025, now supports tool calling natively via both:
1. **OpenAI-compatible endpoint** (`/v1/chat/completions` with `tools` parameter)
2. **Anthropic-compatible endpoint** (`/api/messages` with `tools` parameter)

This is a major shift — local models can now be called with the same tool schema as API models.

### Compatibility Table

| Provider | Tools | Schema | Notes |
|----------|-------|--------|-------|
| **Claude (API)** | ✅ Yes | Anthropic `tools[]` | Native tool_use blocks |
| **OpenAI GPT-4o** | ✅ Yes | OpenAI `tools[]` with `type: "function"` | Official function calling |
| **Ollama** | ✅ Yes (partial) | OpenAI compat + Anthropic compat | Llama 3.1, Mistral Nemo, Firefunction v2 |
| **LM Studio** | ✅ Yes (partial) | OpenAI-compatible | Via `/v1/chat/completions` |
| **vLLM** | ✅ Yes (partial) | OpenAI-compatible | Full Chat Completions API |
| **OpenRouter** | ✅ Yes | OpenAI + native per model | Works with any backend model |
| **AWS Bedrock** | ✅ Yes | Bedrock SDK format | Claude models support, others vary |
| **Azure OpenAI** | ✅ Yes | OpenAI-compatible | 1:1 with OpenAI |
| **Google Gemini** | ✅ Yes (partial) | Google tool format | Via REST or gRPC |

### Known Limitations

**Ollama local models**: Not all models support tools well. Only tested/proven with:
- Llama 3.1 (recommended)
- Mistral Nemo
- Firefunction v2

Smaller models (7B, 13B) often hallucinate or ignore tool definitions. Claude and GPT-4o are vastly more reliable.

**Tool call streaming**: Some providers stream tool calls gradually (OpenAI, Claude) vs. all-at-once (some local models).

### Schema Adapter Strategy

Instead of converting schemas, use **capability detection**:
1. Try native schema first (Claude for Anthropic providers, OpenAI for OpenAI compat)
2. Fall back to the provider's supported schema
3. Document limitations in UI ("Tools may not work reliably with this model")

---

## Go Implementation Strategy

### Why Go for BYOM Support

1. **c9s is already Go** — extend existing binary instead of new subprocess language
2. **HTTP is built-in** — all modern LLM APIs are HTTP
3. **Streaming libraries** — goroutines + channels for concurrent streaming
4. **Performance** — avoid Python subprocess overhead for non-Claude models
5. **Unified binary** — no additional dependencies

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ c9s serve (Go binary)                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Agent Broker                                     │   │
│  │  - create_session(provider, model, task)       │   │
│  │  - dispatch spawner based on provider          │   │
│  └─────────────────────────────────────────────────┘   │
│         │                                               │
│         ├─→ Claude CLI (existing)                       │
│         │   └─→ subprocess `claude --print ...`        │
│         │                                               │
│         ├─→ Claude API (new)                            │
│         │   └─→ HTTP POST /messages (streaming)        │
│         │                                               │
│         ├─→ OpenAI-Compatible (new)                     │
│         │   └─→ HTTP POST /v1/chat/completions (SSE)   │
│         │       (works for: OpenAI, Ollama, LM Studio, │
│         │        vLLM, OpenRouter, Azure OpenAI)      │
│         │                                               │
│         └─→ AWS Bedrock (new)                           │
│             └─→ AWS SDK InvokeModelWithResponseStream  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Stream Adapters (normalize all to UnifiedEvent)│   │
│  │  - AdaptClaudeStream()                          │   │
│  │  - AdaptOpenAIStream()                          │   │
│  │  - AdaptBedrockStream()                         │   │
│  └─────────────────────────────────────────────────┘   │
│         │                                               │
│  ┌──────▼────────────────────────────────────────────┐ │
│  │ Unified Event Handler                             │ │
│  │  - converts all → UnifiedStreamEvent             │ │
│  │  - emits tool calls, text, phase changes        │ │
│  │  - WebSocket broadcast to frontend              │ │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Core Changes Needed in Go Code

**New packages**:
- `internal/broker/providers/` — provider implementations
  - `claude_cli.go` — spawn `claude` subprocess (existing logic ported)
  - `claude_api.go` — direct Anthropic API
  - `openai_compat.go` — OpenAI-compatible adapter
  - `bedrock.go` — AWS Bedrock
- `internal/broker/stream/` — stream normalization
  - `adapter.go` — StreamAdapter interface
  - `claude_adapter.go` — stream-json → UnifiedEvent
  - `openai_adapter.go` — SSE → UnifiedEvent
- `internal/models/` — new types
  - `unified_event.go` — UnifiedStreamEvent
  - `provider_config.go` — provider definitions

**Existing files to modify**:
- `internal/config/config.go` — add provider configuration
- `internal/broker/broker.go` — dispatch logic switches on provider type
- `internal/broker/session.go` — spawn logic becomes provider-specific

### API Client Libraries for Go

| Library | Provider | Status | Notes |
|---------|----------|--------|-------|
| `github.com/openai/openai-go` | OpenAI | Maintained | Official SDK, supports Responses API |
| `github.com/sashabaranov/go-openai` | OpenAI | Maintained | Community-maintained, comprehensive |
| `github.com/aws/aws-sdk-go-v2` | AWS Bedrock | Maintained | Standard AWS SDK, streaming support |
| `github.com/anthropics/anthropic-sdk-go` | Anthropic | Maintained (if exists) | Check Anthropic GitHub for Go SDK |
| `encoding/json` | All | Builtin | For custom HTTP clients |
| `net/http` | All | Builtin | For SSE parsing |

**Recommended approach**:
- Use official OpenAI SDK (`github.com/openai/openai-go`) for OpenAI + OpenAI-compatible
- Use AWS SDK for Bedrock
- Hand-roll Anthropic and other APIs using `net/http` + `json`

### Example: OpenAI-Compatible Provider in Go

```go
package providers

import (
    "context"
    "github.com/openai/openai-go"
    "github.com/openai/openai-go/option"
)

type OpenAICompatibleProvider struct {
    client *openai.Client
    model  string
}

func NewOpenAICompatible(baseURL, apiKey, model string) *OpenAICompatibleProvider {
    client := openai.NewClient(
        option.WithAPIKey(apiKey),
        option.WithBaseURL(baseURL),
    )
    return &OpenAICompatibleProvider{client: client, model: model}
}

func (p *OpenAICompatibleProvider) Chat(
    ctx context.Context,
    messages []*Message,
    tools []*ToolDefinition,
) (chan *UnifiedStreamEvent, error) {
    // Convert messages + tools to OpenAI format
    // Call client.Chat.Completions.New() with stream=true
    // Adapt SSE response to UnifiedStreamEvent channel
    // Return channel
}
```

---

## Agent Subprocess Architecture

### Current Approach (Claude CLI Subprocess)

```
c9s Agent Broker
       │
       └─→ fork → "claude --print --output-format stream-json --model ... -- <task>"
                │
                ├─→ CLI spawns its own Claude subprocess or connects to daemon
                ├─→ Streams back stream-json to parent
                └─→ Parent parses stream-json events

Pros:
- Handles OAuth automatically (from ~/.claude)
- Structured stream format (JSONL)
- Built-in tool calling (we just execute CLI-provided tools)
- Proven in production

Cons:
- Requires `claude` binary in PATH
- No direct control over the subprocess
- Can't customize streaming granularity
- Adds latency (shell fork + binary start time)
```

### New Approach: Direct API Calls (Go HTTP)

```
c9s Agent Broker
       │
       ├─→ Provider: Claude API
       │   └─→ HTTP client → POST /api/messages (streaming=true)
       │       ├─→ Handle SSE response
       │       ├─→ Parse tool calls
       │       ├─→ Execute tools (via MCP or built-in)
       │       └─→ Send tool results in next message
       │
       ├─→ Provider: OpenAI-Compatible
       │   └─→ HTTP client → POST /v1/chat/completions (stream=true)
       │       └─→ Same flow as above
       │
       └─→ Provider: Claude CLI (legacy)
           └─→ Subprocess (existing code, unchanged)

Pros:
- No subprocess overhead
- Direct streaming in goroutines
- Per-request customization (temperature, etc.)
- Unified tool calling interface
- Works with local models (Ollama, LM Studio)
- Easier to test and debug

Cons:
- Need to implement tool calling logic
- Handle token counting per provider
- Manage API keys and auth separately
- More complex state machine
```

### Hybrid Approach (Recommended)

Support **both** CLI subprocess and direct API:
1. **Default** → Direct API calls (faster, more control)
2. **Fallback** → CLI subprocess (backward compatible, handles complex edge cases)
3. **User choice** → Config option to force one or the other

---

## Security & Credential Management

### API Key Storage

**Hierarchy** (checked in order):
1. **Environment variable** → `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.
2. **macOS Keychain** → `security find-generic-password -l "c9s-openai-api-key"`
3. **Config file** (encrypted) → `~/.config/c9s/providers.secret.json`
4. **Prompt user** → If not found elsewhere, ask at startup

**Keychain implementation** (Go):
```go
import "github.com/99designs/keyring"

func GetAPIKey(provider string) (string, error) {
    // Try env first
    if key := os.Getenv(envVarForProvider(provider)); key != "" {
        return key, nil
    }
    
    // Try Keychain
    kr, _ := keyring.Open(keyring.Config{
        AllowedBackends: []keyring.BackendType{keyring.MacOSBackend},
        ServiceName:     "c9s",
    })
    
    item, err := kr.Get("api-key-" + provider)
    if err == nil {
        return string(item.Data), nil
    }
    
    // Try encrypted config file
    return loadFromConfigFile(provider)
}
```

### Never Log API Keys

- Redact in debug output: `api_key: "sk-****..."` (last 4 chars only)
- Filter from error messages
- Never log HTTP request/response bodies if they contain keys
- Audit who can access credential storage

### Per-Provider Considerations

| Provider | Auth Method | Key Scope | Rotation |
|----------|-------------|-----------|----------|
| **Anthropic** | API key | Single user/app | 90 days recommended |
| **OpenAI** | API key | Organization | 90 days recommended |
| **Ollama** | None | Local only | N/A |
| **LM Studio** | None | Local only | N/A |
| **AWS Bedrock** | IAM role | Account-wide | Per IAM policy |
| **Azure OpenAI** | API key | Subscription | Per Azure policy |

### Proxy/Gateway Patterns

For enterprise environments, allow specifying a custom proxy endpoint:

```json
{
  "providers": {
    "openai": {
      "type": "openai-compatible",
      "base_url": "https://proxy.acme.com/openai",
      "api_key_env": "INTERNAL_PROXY_KEY",
      "enabled": true
    }
  }
}
```

---

## Migration Path & Phasing

### Phase 1: Foundation (Week 1-2)

**Goal**: Add provider configuration + UI in c9s

**Tasks**:
1. Extend `internal/tui/config.go` to display provider list + enable/disable toggles
2. Add provider selection screen to Settings
3. Create `~/.config/c9s/providers.json` structure
4. Add validation (check connectivity to each provider on startup)

**Deliverables**:
- Settings → Providers tab showing configured providers
- Test connectivity button for each
- Display available models per provider
- Save/load provider config from disk

**Effort**: 1-2 weeks (Go TUI + HTTP health checks)

### Phase 2: Direct API Support (Week 3-5)

**Goal**: Implement direct API calling for OpenAI-compatible models

**Tasks**:
1. Create `internal/broker/providers/` package structure
2. Implement `OpenAICompatibleProvider` using `github.com/openai/openai-go`
3. Build stream adapters (SSE → UnifiedStreamEvent)
4. Implement tool calling flow (execute CLI tools or built-in MCP)
5. Modify `AgentBroker.dispatch()` to choose provider based on config

**Deliverables**:
- `c9s dispatch my-project "task" --provider ollama --model llama3.1`
- Live streaming from OpenAI-compatible endpoints
- Tool execution via MCP
- WebSocket event emission to frontend

**Effort**: 2-3 weeks (HTTP clients, SSE parsing, tool adapters)

### Phase 3: Backend Integration (Week 6-7)

**Goal**: Support BYOM in claude-manager (Python backend)

**Tasks**:
1. Port provider logic to Python FastAPI backend (or use `httpx` client library)
2. Update `DispatchRequest` to accept `provider` + `model` overrides
3. Modify `AgentBroker` to support non-CLI providers
4. Implement stream normalization in Python
5. Update WebSocket event format (ensure compatibility with existing frontend)

**Deliverables**:
- `POST /api/projects/proj/dispatch` with `provider` + `model` params
- Backend spawns agents via any configured provider
- Frontend receives unified events (no changes needed)

**Effort**: 1-2 weeks (Python HTTP client, stream adapters)

### Phase 4: Per-Project + Per-Task Selection (Week 8-9)

**Goal**: Let users override models per project and per task

**Tasks**:
1. Add `model_provider` + `model` to `ProjectConfig`
2. Add `--model` + `--provider` flags to `c9s dispatch`
3. Update frontend Dispatch modal to show provider + model pickers
4. Implement model selector logic in TUI

**Deliverables**:
- Project settings allow selecting default provider + model
- `c9s dispatch my-proj "task" --provider openai --model gpt-4o`
- Frontend UI respects project-level model selection

**Effort**: 1 week (config, UI, API params)

### Phase 5: Extended Provider Support (Week 10+)

**Goal**: Add Anthropic API, AWS Bedrock, Azure OpenAI

**Tasks**:
1. Implement `AnthropicAPIProvider` (direct API calls, not CLI)
2. Implement `AWSBedrockProvider` (use AWS SDK v2)
3. Implement `AzureOpenAIProvider` (Azure-specific auth + base URL)
4. Add provider-specific configuration UI

**Deliverables**:
- Support for 8+ providers (from table above)
- Provider-specific config panels in Settings
- Environment variable hints for API keys

**Effort**: 2-3 weeks (AWS SDK, Azure SDK, specialized streaming)

---

## Risks & Tradeoffs

### Risk: Tool Calling Quality Variance

**Issue**: Claude and GPT-4o are highly reliable at tool calling. Open-source models (Llama 3.1, Mistral) hallucinate, ignore tools, or use them incorrectly.

**Mitigation**:
- Prompt design — emphasize tool usage in system message
- Model selection warnings — mark "experimental" next to weaker models in UI
- Tool calling tests — sample calls to each model in config validation
- Fallback to text-only mode — disable tool calling for unreliable models

**Tradeoff**: Some models may not be viable for agent work. Accept lower reliability for cost savings.

### Risk: Streaming Format Fragmentation

**Issue**: Different providers emit slightly different SSE formats; edge cases cause parsing failures.

**Mitigation**:
- Thorough testing — integration tests with each provider in CI
- Lenient parser — skip malformed events instead of crashing
- Centralized adapters — all normalization in one place (easier to fix)
- Monitoring — log stream parse errors; alert on patterns

**Tradeoff**: Some edge cases may be dropped; users may see incomplete outputs.

### Risk: API Rate Limiting

**Issue**: Users switch to cheaper models (Ollama) but hit rate limits on local hardware or API quotas on cloud.

**Mitigation**:
- Config-based rate limiting — per-provider concurrency settings
- Retry logic with exponential backoff
- User documentation — set expectations for each provider
- Cost tracking — show estimated costs per dispatch

**Tradeoff**: Some tasks may queue longer; no solution for underlying resource constraints.

### Risk: Credential Compromise

**Issue**: API keys stored in config files or Keychain could leak; users may paste keys into logs.

**Mitigation**:
- Keychain-first design (not config files)
- Never log headers or bodies containing keys
- Key rotation reminders in UI
- Audit logging of API key access
- Document best practices in README

**Tradeoff**: Slight convenience loss (can't easily version/share config); better security.

### Risk: Token Counting Inaccuracy

**Issue**: Different tokenizers (Claude uses cl100k_base, OpenAI uses different versions) → estimated vs. actual costs wrong.

**Mitigation**:
- Use provider's official tokenizer library when available
- Approximate for others (rough estimate: 1 token ≈ 4 chars)
- Show token counts in UI as estimates
- Rely on actual API usage for billing

**Tradeoff**: Cost estimates may be off by 10-20%; actual billing is accurate.

### Risk: Version Lock-In

**Issue**: Each provider updates API formats; we'd need to update adapters for every breaking change.

**Mitigation**:
- Pin SDK versions to stable releases
- Use version-stable endpoints (e.g., `/v1/chat/completions` not `/v2/...`)
- Monitor provider changelogs; plan updates quarterly
- Backward compatibility testing in CI

**Tradeoff**: We're coupled to provider versioning; must allocate maintenance time.

---

## Recommended Go Packages

### HTTP & API Client Libraries

| Package | Use Case | Maintenance | Notes |
|---------|----------|-------------|-------|
| `github.com/openai/openai-go` | OpenAI + OpenAI-compatible | Official | Recommended for OpenAI |
| `github.com/aws/aws-sdk-go-v2` | AWS Bedrock | AWS-maintained | Standard choice for AWS |
| `encoding/json` | Generic JSON parsing | Builtin | Sufficient for custom APIs |
| `net/http` | Raw HTTP client | Builtin | Use for SSE streaming |
| `bufio.Scanner` | SSE parsing | Builtin | Line-by-line event reading |

### Utilities

| Package | Use Case | Rationale |
|---------|----------|-----------|
| `github.com/99designs/keyring` | OS Keychain access | Cross-platform (macOS, Linux, Windows) |
| `github.com/google/uuid` | Session/request IDs | Standard UUID generation |
| `github.com/mitchellh/mapstructure` | Config unmarshaling | Flexible struct mapping from JSON |

### Testing

| Package | Use Case |
|---------|----------|
| `net/http/httptest` | Mock HTTP servers (test providers) |
| `github.com/stretchr/testify` | Assertions and mocks |

### Avoid (keep it simple)

- LangChain Go (`github.com/tmc/langchaingo`) — adds too much abstraction; we want fine-grained control
- Gin/Echo routers — already using `chi` in existing code
- Generic LLM abstraction libraries (`any-llm`) — they're in Python; Go is fine to keep provider-specific

---

## Implementation Priority & Effort Estimates

### High Priority (MVP)

| Item | Effort | Impact | Rationale |
|------|--------|--------|-----------|
| Config UI in c9s | 1 week | Medium | Users can see + enable providers |
| OpenAI API direct calling | 2 weeks | High | Works for OpenAI, Azure, OpenRouter |
| Ollama support (via OpenAI compat) | 1 week | High | Free local inference (popular) |
| Stream adapter pattern | 2 weeks | High | Foundation for all providers |
| Tool calling adapter | 1.5 weeks | High | Agents can execute tools |

**Total MVP**: ~7-8 weeks, enables Claude → OpenAI/Ollama switching

### Medium Priority

| Item | Effort | Impact |
|------|--------|--------|
| Per-project model selection | 1 week | Medium |
| Per-task model override (CLI) | 0.5 week | Medium |
| AWS Bedrock support | 2 weeks | Medium |
| Backend (Python) BYOM support | 1-2 weeks | Low-Medium |

### Low Priority (Phase 5+)

| Item | Effort | Impact |
|------|--------|--------|
| Anthropic direct API | 1 week | Low (CLI already works) |
| Azure OpenAI | 1 week | Medium (enterprise) |
| Google Gemini | 1.5 weeks | Low (not as popular) |
| Cost tracking UI | 2 weeks | Low (nice-to-have) |
| Model comparison tests | 1.5 weeks | Medium (dev tool) |

### Go Code Lines of Code (Rough Estimates)

| Component | LOC | Notes |
|-----------|-----|-------|
| Provider interfaces | 200 | Core abstraction |
| OpenAI-compatible impl | 300 | Most comprehensive |
| Stream adapters | 400 | SSE + JSONL parsing |
| Tool calling adapter | 300 | Schema conversion |
| Config loading | 200 | TOML/JSON parsing |
| CLI commands | 150 | New flags + options |
| TUI settings panel | 400 | Provider picker UI |
| Tests | 600 | Integration + unit tests |
| **Total** | **~2,500** | ~3-4 weeks for experienced Go dev |

---

## Architecture Diagrams

### High-Level Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ c9s / claude-manager                                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User Command                                                │
│  ├─→ c9s dispatch project "task" --provider openai           │
│  │                                                           │
│  └─→ Configuration Lookup                                    │
│      └─→ ~/.config/c9s/config.json                           │
│          ├─→ provider: "openai"                              │
│          ├─→ model: "gpt-4o"                                 │
│          └─→ api_key: from env / keychain                    │
│                                                              │
│  Provider Selection                                          │
│  └─→ match provider type → instantiate correct HTTP client   │
│      ├─→ "openai-api" → OpenAI official SDK                  │
│      ├─→ "openai-compatible" → any /v1 endpoint              │
│      ├─→ "anthropic-api" → Anthropic SDK (if exists)        │
│      └─→ "claude-cli" → spawn subprocess                     │
│                                                              │
│  Agent Spawning                                              │
│  └─→ Create Session with provider                            │
│      ├─→ Spawn goroutine for provider.Chat()                │
│      ├─→ Stream responses back via channel                  │
│      └─→ Adapt to UnifiedStreamEvent                        │
│                                                              │
│  Tool Execution                                              │
│  ├─→ Receive tool call in unified event                      │
│  ├─→ Route to MCP handler or built-in tools                  │
│  └─→ Return result to provider                               │
│                                                              │
│  WebSocket Broadcast                                         │
│  └─→ Emit events to all connected clients (frontend)         │
│      ├─→ agent_spawned                                       │
│      ├─→ agent_stream (text delta)                           │
│      ├─→ agent_milestone (tool name)                         │
│      └─→ agent_done                                          │
└──────────────────────────────────────────────────────────────┘
```

### Provider Adapter Pattern

```
┌────────────────────────────────────────────────────┐
│ Agent Session (c9s/claude-manager)                │
└──────────────────────┬─────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        │              │              │              │
        ▼              ▼              ▼              ▼
    ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
    │ Claude    │ │ OpenAI-  │ │ AWS      │ │ Ollama  │
    │ CLI       │ │ Compat   │ │ Bedrock  │ │ (local) │
    │ Adapter   │ │ Adapter  │ │ Adapter  │ │ Adapter │
    └─────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘
          │            │            │            │
          │ stream-json│ SSE events │ event      │ SSE
          │            │            │ stream     │
          └────┬───────┴────┬───────┴──┬─────────┘
               │            │         │
               └────────┬───┴────┬────┘
                        │        │
                   ┌────▼───┬────▼──────┐
                   │ Parse  │ Normalize │
                   │ Events │ to        │
                   │        │ Unified   │
                   └────┬───┴───┬───────┘
                        │       │
            ┌───────────┬───────┴──────────┐
            │                              │
            ▼                              ▼
    ┌──────────────────┐          ┌─────────────────┐
    │ Unified Stream   │          │ Tool Adapter    │
    │ Event Handler    │          │ (convert        │
    │                  │          │  call schemas)  │
    │ - text_delta     │          │                 │
    │ - tool_start     │──────┬──▶│ Claude   ──┐    │
    │ - tool_stop      │      │   │ OpenAI   ──┤◀── Tool
    │ - phase_change   │      │   │ AWS SDK  ──┤    Execution
    │ - message_start  │      │   │ Custom   ──┘    │
    │ - message_stop   │      │   │                 │
    └──────┬───────────┘      │   └─────────────────┘
           │                  │
           │ Emit unified     │ Execute
           │ events           │ tool
           ▼                  ▼
    ┌──────────────────────────────┐
    │ WebSocket Broadcaster        │
    │ (to frontend clients)        │
    └──────────────────────────────┘
```

---

## Conclusion & Recommendations

### Path Forward

1. **Start with Phase 1 (Config UI)** — users can see and manage providers without code changes
2. **Parallel Phase 2 (OpenAI-Compatible)** — unblock Ollama + OpenAI users immediately
3. **Phase 3 (Backend)** — ensure backend can dispatch via any provider
4. **Phases 4+ (Extended support)** — add more providers based on user demand

### Key Decision Points

**Decision 1: CLI subprocess or direct API?**
- **Recommended**: Direct API (Go HTTP client)
- **Rationale**: Better performance, finer control, works with local models
- **Fallback**: Keep Claude CLI as option for backward compatibility

**Decision 2: Single abstraction or provider-specific code?**
- **Recommended**: Provider-specific adapters (OpenAI SDK, AWS SDK, custom HTTP)
- **Rationale**: Each provider has unique streaming/tool formats; abstraction hides too much
- **Pattern**: Small `StreamAdapter` interface + individual implementations

**Decision 3: Config location?**
- **Recommended**: `~/.config/c9s/config.json` (CLI level) + per-project `manager.json`
- **Rationale**: Mirrors how other tools (AWS CLI, kubectl) work; per-project overrides for flexibility

**Decision 4: Backward compatibility with Python backend?**
- **Recommended**: Implement BYOM in Go first; sync to Python backend later
- **Rationale**: c9s is the primary entry point; Python backend can follow

### Success Metrics

1. ✅ Users can configure + select from 3+ providers in c9s UI
2. ✅ `c9s dispatch --provider ollama --model llama3.1` works end-to-end
3. ✅ Streaming + tool calling works for OpenAI, Ollama, OpenRouter
4. ✅ No regressions in existing Claude CLI path
5. ✅ WebSocket events are backwards compatible (frontend unchanged)

---

## References

- [OpenAI Official Go SDK](https://github.com/openai/openai-go)
- [Ollama OpenAI Compatibility](https://docs.ollama.com/api/openai-compatibility)
- [Ollama Tool Support](https://ollama.com/blog/tool-support)
- [LM Studio OpenAI-Compatible Endpoints](https://lmstudio.ai/docs/developer/openai-compat)
- [vLLM OpenAI-Compatible Server](https://docs.vllm.ai/en/stable/serving/openai_compatible_server/)
- [OpenRouter Tool Calling](https://openrouter.ai/docs/guides/features/tool-calling)
- [Anthropic Streaming Documentation](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [any-llm-go: Unified LLM Interface](https://blog.mozilla.ai/run-openai-claude-mistral-llamafile-and-more-from-one-interface-now-in-go/)
- [AWS Bedrock Bedrock InvokeModelWithResponseStream](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html)
- [Azure OpenAI API Compatibility](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference)

