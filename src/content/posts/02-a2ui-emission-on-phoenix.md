---
title: "A2UI emission is where the engineering hides. [Part 2]"
pubDate: 2026-06-10
description: Post 1 said the spec was the easy half. This is the other half — how Phoenix gets envelopes out of Claude reliably, the two emission modes I shipped, and a validator that has to keep the model honest without making the catalog feel hostile.
tags: [a2ui, generative-ui, meldui, llm, agents, claude, phoenix, jido]
series: "Generative UI on Phoenix"
part: 2
draft: false
---

<!--
PRE-PUBLISH TODOs:
- Latency table from Phase 6 inspector once a stable trip-planner run set is captured.
-->

![A Q3 sales dashboard — four metric cards, a revenue trend chart, and a deals table — composed by Claude into A2UI envelopes and rendered against the MeldUI catalog.](/blog/02-hero-section.png)

_Part 2 of 3 — [Generative UI on Phoenix](/writing/01-generative-ui-wire-format-a2ui)._

Post 1 said the spec is the easy half. This is the other half.

There are two engineering problems on the emission side of an A2UI stack. The first is reliability — getting a model to emit valid envelopes consistently, fast enough that the rendering feels live, recovering cleanly when it doesn't. The second is validation — catching the envelopes the model gets wrong without turning the catalog into something the model dreads working against. Both problems landed on me in the order an engineer always meets them: emission first, validation second, then back to emission once validation revealed how often the first version had been silently wrong.

## Why Phoenix?

Phoenix is an unusual choice for an AI stack. The Python and TypeScript crowds run this space loudly enough that I have to defend the unusual one explicitly.

The defense isn't that Phoenix is better at LLM calls — every runtime can do an HTTP request to Anthropic. The defense is that an agent-driven UI in a chat thread needs four things underneath it, and Phoenix gives you all four in one release.

1. **A persistent, bidirectional transport.** Phoenix Channels are the websocket layer. They reconnect automatically, they survive across deploys, and they're part of the framework, not a separate service. Think Socket.IO that doesn't lose state when the connection blips.
2. **A pub/sub broadcast layer.** One process broadcasts a message; every connection subscribed to the same topic receives it. Think Redis Pub/Sub without having to stand up Redis.
3. **One supervised process per conversation.** The agent literally lives as a long-running process — one per chat, spawned in microseconds, restarted by its supervisor if it crashes. Two hundred thousand concurrent agents on a single node is a Tuesday on this runtime. Think a worker pool where the workers are nearly free and the supervision is built in.
4. **A database layer that doesn't need a separate service.** Ecto talks to Postgres with connection pooling, migrations, and changesets out of the box.

Build this on Node and you assemble Socket.IO + Redis + a worker queue + an ORM + a supervisor you write yourself, then glue them together. Build it on Python and the list is similar. Build it on Phoenix and the substrate is `mix new` plus a supervisor tree, and you spend your engineering time on the interesting part.

That's the defense. None of it requires you to know Elixir to follow this post — when I name a module below, treat it as a label. The shape of the data flow is what matters, not the syntax it lives in.

One concrete map of where things live, so the rest of the post has anchors:

- `AgenticUiWeb.ChatChannel` — the websocket endpoint. One channel per chat conversation.
- `AgenticUi.LLM.Agent` and `AgenticUi.LLM.AgentStreamedJson` — the two agent modules, one per emission mode.
- `AgenticUi.LLM.Tools.Emit` — the converging pipeline both modes go through. The post's spine.
- `AgenticUi.A2UI.Validator` — schema + catalog validation.
- `AgenticUi.LLM.JsonlInterpreter` — the line-classifier that turns a streaming response into envelopes-and-prose.
- `SurfaceSnapshot` — the Postgres-backed record of every surface, so a reconnect can replay the state.

## The data path

```
                 ┌────────────────────────────────┐
                 │   Vue client (MeldUI renderer) │
                 └────────────┬──────────────▲────┘
                              │              │
                  "user_message"     "a2ui_envelope"
                              │              │
           ┌──────────────────▼──────────────┴──────────────┐
           │  Phoenix ChatChannel  (chat:<conversation_id>) │
           └──────────┬──────────────────────────▲──────────┘
                      │                          │
                ask_stream                   PubSub broadcast
                      │                          │
                      ▼                          │
           ┌──────────────────────┐  ┌───────────┴────────────┐
           │  Jido.AI.Agent       │  │  Emit.do_emit          │
           │  → Claude            │─▶│  1. validate           │
           │  tools  OR  JSONL    │  │  2. persist (Postgres) │
           │                      │  │  3. broadcast          │
           └──────────────────────┘  └────────────────────────┘
```

The trip-planner conversation from Post 1, end to end:

1. The user types the prompt. The Vue client's `useChatChannel.ts` pushes `"user_message"` over the channel.
2. `ChatChannel.handle_in("user_message", ...)` spawns a task that calls the agent module the conversation is configured for — `AgenticUi.LLM.Agent` for tool-call mode, `AgenticUi.LLM.AgentStreamedJson` for streamed-JSON. Same model, same catalog-laden system prompt; only the output mechanics differ.
3. The model starts streaming. The channel relays the stream differently per mode:
   - **Tool-call:** each tool call (`create_surface`, `update_components`, `update_data_model`, `delete_surface`) hits a small handler that turns the parsed args into a wire envelope and feeds it into the `Emit` pipeline.
   - **Streamed-JSON:** the content stream tees through `JsonlInterpreter`. Lines that decode to a recognised envelope shape go straight into the same `Emit` pipeline. Lines that don't are forwarded to the chat panel as prose.
4. Both routes converge on `Emit.do_emit`. The pipeline is the same regardless of which mode produced the envelope: **validate** it (schema, then catalog), **persist** it to Postgres, then **broadcast** it on the `chat:<conversation_id>` topic. The order is load-bearing — the database is the source of truth, so the client can't see an envelope the DB hasn't recorded. The channel picks the broadcast back up and pushes `"a2ui_envelope"` to the Vue renderer, which mounts or mutates the corresponding MeldUI components.

The interesting things are off-screen: how the envelope was produced, what the validator catches, and what happens when the model emits two envelopes for the same surface in parallel.

## Tool-call mode

The first version of the stack used tool calls exclusively. The system prompt tells the model there are four tools — one per envelope type — and it must call them to render UI. The agent library and the Anthropic provider handle the call-and-result handshake. The model emits a tool call, Anthropic validates its shape against the schema declared on the tool definition, the call lands in our handler, and the handler converts the parsed args into a wire envelope.

The benefit is that the model never sees an envelope as raw JSON. It sees four well-typed tool signatures. Shape errors get caught at the provider before our code runs. By the time `Emit.do_emit` sees the envelope, the wire-shape pass of the validator is mostly a formality.

The cost is latency. Tool calls in the Anthropic protocol are atomic — the model emits the full call before the result is shipped back. A `update_components` envelope for a six-component card surface is hundreds of tokens, and nothing renders until the model finishes writing the call.

There's also a race I didn't expect. Anthropic lets the model issue parallel tool calls within a single assistant turn, and the model happily emits `create_surface` and `update_components` for the same surface together. The `update_components` envelope can land before the `create_surface` has persisted, which breaks the validator (it needs the surface to exist before it can resolve child references against it). The fix has two parts: a short retry window inside the pipeline that absorbs the race, and an explicit rule in the system prompt telling the model to issue tool calls for the same surface serially. The race is gone in practice; the retry is there as belt-and-braces.

## Streamed-JSON mode

The second emission mode took most of the engineering. The model has no tools registered. The system prompt tells it to write each envelope as a single JSON line in its message body, one per line, no Markdown code fences. The channel tees the streaming response through `JsonlInterpreter`, which buffers partial lines, splits on newlines, and on each complete line tries to JSON-decode it and check whether it matches one of the four known envelope shapes. Recognised envelopes go straight into the same pipeline as the tool-call path. Anything else gets forwarded as prose so the chat panel still shows it. The first envelope ships while the model is still writing the rest of its response.

Streamed-JSON mode owns everything the tool-call path used to get for free. Schema enforcement happens at our layer now, not the provider's. The interpreter has to buffer partial lines because streaming deltas don't land on newline boundaries. And the model occasionally backslides into Markdown code fences around envelopes — the interpreter quietly drops those lines rather than forwarding them as prose, because a half-empty code block rendered around a streamed envelope looks worse than nothing.

The interpreter is strict by design — line-based splitting, no tolerant partial-JSON parsing across newlines. Tolerant parsing is on the follow-ups list if the model ever produces envelopes that span more than one line. So far it hasn't, and the strict version has caught a few model regressions a tolerant parser would have silently papered over.

## Picking a mode

Both modes go through the same `Emit.do_emit` pipeline, so the choice is purely about how envelopes get produced upstream.

- **Tool-call mode** ships valid envelopes by construction. Time-to-first-envelope is high because tool calls are atomic. Error rate per turn is essentially zero on the shape pass.
- **Streamed-JSON mode** ships the first envelope as soon as the first line completes. Time-to-first-envelope drops dramatically. Error rate per turn is higher because the validator now does the work the provider used to — but the same validator pipeline catches everything.

The right call depends on what the surface actually looks like. A trip-planner that streams three surfaces over twenty seconds wants streamed-JSON; the first surface starts rendering as soon as the first envelope line lands, instead of waiting for the model to finish writing the whole tool call. A one-shot card with a single small surface is fine in tool-call mode — the latency difference is barely perceptible and you get the provider's shape enforcement for free.

(The Phase 6 envelope inspector tracks time-to-first-envelope and total turn time per mode; I'll publish a full trip-planner comparison once I have a stable set of runs. Numbers without a stable baseline lie.)

## The validator

The validator runs two passes.

**Schema pass.** JSON Schema validation against the vendored A2UI v0.9 wire schema, with a small amount of adapter boilerplate so an upstream schema written for a newer draft works against the library we have.

**Catalog pass.** This is where the real work happens. For each `updateComponents` envelope, the validator walks the components list and checks:

1. Every `component` name exists in the loaded MeldUI catalog.
2. The catalog's `required` props are present on the component object.
3. Every child reference resolves to a known component ID — either inside this envelope, or among the surface's previously-persisted IDs.

Step 3 is the one with a story. The naive implementation picks a fixed set of "child-shaped" prop names (`child`, `children`, `slot`) and treats every string in those props as a referenced ID. This works until you hit `Markdown`, whose `content` prop is a string that _looks_ like an ID but is the prose itself. Every Markdown-containing envelope gets rejected, the model retries the same shape, and the conversation spirals. The fix is to drive the child-field set from the catalog itself — only props the catalog declares as `ComponentId` count as references. `Markdown.content` is declared as a `string`, so it's never checked. The catalog has to be the schema; heuristics that drift from it get hostile to edge cases.

## The slim catalog

The full MeldUI catalog is 76 KB of JSON. Embedding it raw in the system prompt would burn most of the prompt budget every turn, so the build strips every `description` field before embedding — descriptions are for the human reading the docs, not for the model deciding which component to use. The slim version is roughly 25 % smaller. The full descriptive catalog stays loaded at runtime for the validator, which still needs the structural detail.

The catalog also gets Anthropic-prompt-cached. The first turn pays full price for the catalog tokens; subsequent turns within the cache window pay about a tenth of that. For any conversation longer than a couple of exchanges, the 20K-token catalog is effectively free.

## What's next

Post 3 is the rendering side: how surfaces stop piling up as dead receipts and start following the conversation, how the action round-trip closes the bidirectional loop, and the tool-result injection API the agent framework is still missing — the workaround I wrote for it is the most obvious workaround in the repo.

If you're standing up an emission pipeline against A2UI, the code that matters lives under `lib/agentic_ui/a2ui/` and `lib/agentic_ui/llm/` in the repo. Read `Emit.do_emit`, `Validator.validate`, and `JsonlInterpreter.feed` in that order — those three functions are this post in code. The [README](https://github.com/dbhowmick/agentic-ui-poc#readme) walks through setup, the catalog wiring, and how each phase of the build maps to the files it touched.

---

_Repo: [github.com/dbhowmick/agentic-ui-poc](https://github.com/dbhowmick/agentic-ui-poc). MeldUI: [meldui.dipayanb.com](https://meldui.dipayanb.com). Questions, corrections, disagreements all welcome — me@dipayanb.com or [GitHub issues](https://github.com/dbhowmick/agentic-ui-poc/issues)._
