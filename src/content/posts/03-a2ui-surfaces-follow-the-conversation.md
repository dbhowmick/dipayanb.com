---
title: "A2UI surfaces should follow the conversation. [Part 3]"
pubDate: 2026-06-10
description: Post 3 of the series. How rendered surfaces survive multiple turns, how the action round-trip closes the loop, what's still missing from the agent framework underneath, and where the MeldUI catalog goes next.
tags: [a2ui, generative-ui, meldui, llm, agents, claude, phoenix, jido, vue]
series: "Generative UI on Phoenix"
part: 3
draft: false
---

<!-- All pre-publish assets in place. -->

_Part 3 of 3 — [Generative UI on Phoenix](/writing/01-generative-ui-wire-format-a2ui)._

[Post 1](/writing/01-generative-ui-wire-format-a2ui) set up the protocol. [Post 2](/writing/02-a2ui-emission-on-phoenix) was about getting envelopes out of the model. This post is about what happens once they land — how rendered surfaces survive multiple turns, how user actions on those surfaces flow back into the agent loop, and what's missing from the agent framework underneath to make the round-trip clean.

Generative UI in a chat thread is a continuity problem nobody else's product UI has. Every app you've ever used is _the_ UI — you go to it, it stays there, you mutate it. Generative UI inverts that. Each assistant turn can produce a new surface, mutate an old one, or both at once. The chat thread becomes a sequence of UI states instead of a single one, and the user can scroll back at any moment to a surface from twelve turns ago and try to interact with it. What does "live" mean when there are eight versions of the same dashboard up the page? Which version owns the user's next click?

## The continuity problem

The first version of the chat thread pinned each surface to the message that created it. The user would scroll to a `trip-itinerary` from twelve turns ago, change the budget on its companion form, and the new itinerary would render at the _bottom_ of the thread — twelve turns down. The old surface sat there unreachable, still happily showing the original data because the renderer had no reason to update it. Two versions of the same UI, both technically correct, both wrong.

The opposite mistake is to re-render every surface on every turn. That solves the stale-UI problem and creates a worse one: any client-side state in the rendered surface — form input the user is still typing, a scroll position deep in a long card list, an unsaved selection — gets blown away every time the model emits an envelope for anything else on the page. The surface "lives" by losing its own state.

The answer that works is in between. Each surface has one current version, and that version lives at the most recent assistant turn that actually touched it. Older messages render the prose they always rendered. The surface migrates downward as the conversation continues to mutate it.

## Surfaces follow the conversation

The mechanism is small. The backend stamps every assistant message's row with the surface IDs that turn touched. The frontend computes a `surfaceOwner` map by walking messages forward and recording, for each surface, the latest assistant message ID that touched it:

```ts
const surfaceOwner = computed(() => {
  const owner = new Map<string, string>();
  for (const msg of props.messages) {
    if (msg.role !== "assistant") continue;
    for (const sid of msg.surface_ids ?? []) {
      owner.set(sid, msg.id);
    }
  }
  return owner;
});
```

In the message-list template, each surface renders inline at the assistant message whose ID matches its current owner. Twelve turns later, when the user submits the form and the model emits `updateComponents` on the same `trip-itinerary` surface, the backend stamps the new assistant row's `surface_ids`. The streaming composable updates the messages array. The `surfaceOwner` map recomputes. Vue's keyed list diff moves the rendered `A2UISurface` from message #N to message #N+1 — physically migrating it down the page. The form is still mounted, the data model the chart is bound to gets a new `updateDataModel`, and the user watches the dashboard _they just acted on_ rewrite itself at the bottom of the thread.

There is no animation, no scroll trickery. The component instance literally moves because Vue's diff sees it under a new parent. The single source of truth — "which message owns this surface right now" — is six lines of TypeScript and a stamped column on the messages table.

## The action round-trip

When the user submits a form or clicks an actionable button, the renderer fires an `A2uiClientAction` event. The shape is in the A2UI spec — `name`, `surfaceId`, `sourceComponentId`, `timestamp`, and a `context` map carrying the resolved data-binding values. The channel receives it as an `"a2ui_action"` payload, validates it through `AgenticUi.A2UI.ClientAction`, and now has to feed it back into the agent loop.

Here is where the post earns its callback to Post 2. The agent framework I'm using has no public API for injecting a tool result for a tool the model never called. There is no clean way to say "the user clicked Submit, treat this as a result you should react to." So the action gets wrapped as a synthesised _user-role turn_ with an `[a2ui_action]` prefix:

```
[a2ui_action] surface=trip-form source=submit-btn name=submit
context:
{
  "budget": 1500,
  "interests": ["food", "design"]
}
```

The system prompt teaches the model to recognise that prefix and react by mutating the same surface — preferring `updateDataModel` against bound paths, only emitting `updateComponents` if the structure itself needs to change. The model responds as if the user had typed a description of the action. The chat thread reads naturally because the renderer recognises the prefix on persisted messages and shows them as compact action chips rather than the raw synthesised text.

It works. It is also obviously a workaround. A cleaner version of this loop — a first-class "synthesise a tool result from the client" API — hasn't been built into any agent framework I've used. The model pays for a full user turn on every click, when conceptually a click is closer to a tool result than a new turn. Someone with skin in an agent framework should build the cleaner version. Until then, the prefix trick is the most obvious workaround in the repo.

## What's still rough

The MeldUI catalog the model composes against is large and granular. Roughly ninety component definitions, each with its full prop schema and bindings. The slim catalog the model sees in the system prompt is around twenty thousand tokens _after_ the description strip — most of an Anthropic prompt budget, even cached. Composing a dashboard from primitives means a non-trivial token tax on every cold turn.

Two things are coming for this.

The first is a **catalog generator**. Today you hand-write the JSON for new catalog entries — describe the component, its props, its bindings, which props accept `ComponentId` references. That's tedious, error-prone, and how the catalog drifts from the actual component implementations. The generator will parse a MeldUI component (or any Vue component with typed props) and emit the matching catalog entry. The Vue source becomes the contract; the JSON is downstream.

The second is **higher-order composition**. The catalog doesn't have to be MeldUI primitives. You can compose MeldUI primitives into your own higher-level components — a `PricingCard` built out of `Card` + `Column` + `Text` + `Button` — and publish _that_ in your catalog. The model composes against your higher-level vocabulary; the primitives are an implementation detail you own. The token cost drops because the model is gluing a handful of high-level things instead of dozens of low-level ones. Visual coherence rises because every dashboard the model emits uses the same `PricingCard` you built once. The catalog is JSON, so this path is already open — write your own entries against your own components and the renderer will mount them. The catalog generator just makes it ergonomic.

Both shifts collapse the catalog from "the full kitchen sink" to "the components you actually want the model to compose with, expressed at the level you want it to compose at." That's where the project goes next.

## Closing the trilogy

Three posts. The protocol is settling — A2UI is the wire format, and the field is converging on it. Emitting it cleanly is a substrate problem more than a model problem — Phoenix does the boring work so the interesting work has somewhere to sit. Rendering it well is a chat-thread problem more than a component problem — surfaces have to follow the conversation, actions have to round-trip, and the agent framework underneath has to grow an API the spec can't write.

The repo is [agentic-ui-poc](https://github.com/dbhowmick/agentic-ui-poc). MeldUI lives [here](https://meldui.dipayanb.com) and is open source. The catalog is JSON; fork it, extend it, write your own. The pieces I haven't shipped yet — the catalog generator, the cleaner action-round-trip API — will land in the repo as separate releases; both are open to PRs if you want to push them along.

If you've read all three posts: thank you. Tell me where I got it wrong — me@dipayanb.com, or open an issue on the repo. The protocol is real, the stack is real, the gaps are real, and the work of standing this up properly is a conversation, not a manifesto.

---

_Repo: [github.com/dbhowmick/agentic-ui-poc](https://github.com/dbhowmick/agentic-ui-poc). MeldUI: [meldui.dipayanb.com](https://meldui.dipayanb.com)._
