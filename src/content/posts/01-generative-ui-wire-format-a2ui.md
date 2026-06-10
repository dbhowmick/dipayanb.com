---
title: "Generative UI finally has a wire format. It's called A2UI. [Part 1]"
pubDate: 2026-06-10
description: After three years of demos, generative UI is settling on a protocol. Here's what A2UI is, why the field is converging on it, and the open-source reference stack I built to prove it.
tags: [a2ui, generative-ui, meldui, llm, agents, claude, phoenix]
series: "Generative UI on Phoenix"
part: 1
draft: false
---

<!-- All pre-publish assets in place. -->

<figure>
  <video
    autoplay
    loop
    muted
    playsinline
    width="1280"
    height="720"
    poster="/blog/agentic-ui-poster.jpg"
    aria-label="A single prompt produces a filter form, an itinerary, and a budget chart. Changing the filter rewrites all three."
    style="width:100%;height:auto;border-radius:0.5rem;"
  >
    <source src="/blog/agentic-ui.mp4" type="video/mp4" />
  </video>
  <figcaption>A single prompt produces a filter form, an itinerary, and a budget chart. Changing the filter rewrites all three.</figcaption>
</figure>

_Part 1 of 3 — Generative UI on Phoenix._

I asked Claude to plan a five-day Tokyo trip on a $2k budget. It rendered me a filter form, an itinerary, and a budget chart. I dragged the slider down to $1.5k and the three surfaces rewrote themselves.

I didn't write any of that UI. I didn't define the form schema. I didn't pick the chart type. The model decided there should be a form, picked the components from a catalog, wired the data bindings, and streamed the whole thing into the chat. Then it watched me interact with what it had built, and built more.

## What's actually going on in that GIF

Three years of "look, the LLM rendered a UI" demos have papered over a real question: what is the model _emitting_? A picture? A description? A program?

Until recently the answer was "it depends on which library you picked." Now it's settling, and a wire format Google published earlier this year — [A2UI](https://a2ui.org/), v0.9 — is what most of the projects in this space are quietly building toward. Before getting into what A2UI is, it helps to be precise about what it isn't, because there are roughly three approaches in active use and they make very different tradeoffs.

### Open-ended HTML and CSS

The model writes raw markup. The client renders it inside an iframe and hopes nothing escapes — the model can paint any pixel.

This is also why every demo you've seen has the same problem: the second button looks nothing like the first. There's no design system, no shared state, no validation. Security is whatever you remembered to do that morning. It's a great party trick. It's not a product surface.

### MCP-UI

The model doesn't emit UI — it references UI _resources_ that an MCP server exposes. The server owns the catalog and the rendering; the model is reduced to "show this one." Clean, rides on a standard people already trust, and has a hard ceiling: the model can pick from the menu, but it can't invent off-menu. The first time your user asks for "a chart but with a histogram instead of bars" and your MCP server doesn't have one, the conversation breaks.

### Declarative envelopes

The model emits a structured payload — a versioned, schema-checked envelope — and the client renders it against a known catalog of components. The model composes freely, but only from vocabulary that already exists; the renderer validates everything before it mounts; state survives across turns.

This is the one that works. Forms that submit, dashboards that mutate, surfaces that follow the conversation instead of piling up like dead receipts down the thread. It's also the only approach where the agent loop and the rendering loop can be the same loop.

Models are also dramatically more consistent emitting against a spec than inventing structure from scratch. Open-ended HTML gives you a different visual hierarchy every turn — the model redraws the layout each time with no memory of what it chose before. A catalog gives it a vocabulary to compose with: the same card component lays out the same way every time, because there's only one way for it to lay out.

All three approaches will keep existing. For chat-native interactive UI, declarative is the one that scales.

## Who's playing

A handful of projects are attacking generative UI from different layers. The three I keep coming back to:

**CopilotKit + AG-UI** got the transport right before anyone else did. Agent activity as a _stream_ — the UI subscribes to a sequence of events describing what the agent is doing, the UI reacts. That's the correct primitive at that layer. The gap is one level up: the UI contract still has to live in your app. You write the components; they ship the stream.

**Tambo** is making essentially the same bet A2UI is making — catalog-as-contract, React-first — and the bet is correct. The constraint is that you're on their renderer.

**Thesys (C1)** trained a model specifically to emit structured UI — the most aggressive version of this thesis anyone is making, skipping the prompt engineering and training the model on the contract directly. The tradeoff is that the contract and the model are both hosted, so you trade end-to-end ownership for a turnkey stack.

_(Vercel AI SDK and the MCP-UI proposals also belong in this conversation; I left them out because the Vercel piece is Next.js-coupled enough to be its own discussion, and MCP-UI is early enough that there isn't much to say yet beyond "watch this space.")_

The pattern across all three: each project owns a vertical slice — catalog and renderer, or model and contract, or transport and components. That's a reasonable way to build a company. It's not the shape that produces an open protocol, because open protocols tend to ship from places that don't need to monetize either end of them.

## The missing piece

Read the docs for these projects back-to-back and the same thesis shows up everywhere: the model should emit structured UI, not text the client has to interpret on its way to a screen.

What nobody had agreed on, until recently, was the wire format itself — the actual JSON the model produces and the renderer consumes. Every team shipped its own envelope shape, its own update semantics, its own choices about replace-versus-mutate and surface-versus-component. Adopting one was a multi-year commitment to one vendor's stack.

This is roughly where REST was in 2010 — the data shape was settled but interop wasn't, and what eventually fixed it was OpenAPI: a neutral description any client could consume and any server could produce. The analogy isn't perfect (OpenAPI describes existing APIs; A2UI defines the wire itself), but the role A2UI is filling is the same one — giving your renderer and your catalog a common thing to talk about, without replacing either.

## What A2UI actually is

A2UI is a protocol Google published, v0.9, openly specced — anyone can read it, anyone can implement it. Four envelope types in the wire format and that's the whole surface area:

`createSurface` declares a new surface — a named container that will hold a component tree, backed by a data model, referencing a component catalog. `updateComponents` swaps or mutates the tree inside that surface. `updateDataModel` mutates bound values (form fields, chart series, anything reactive) without rebuilding the tree. `deleteSurface` makes it go away.

Here's what those primitives look like on the wire — a coffee-order receipt rendered as three envelopes in stream order:

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "s1",
      "catalogId": "https://meldui.dipayanb.com/a2ui/v1/catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateDataModel": {
      "surfaceId": "s1",
      "path": "/",
      "value": {
        "storeName": "Sunrise Coffee",
        "items": [
          {
            "name": "Oat Milk Latte",
            "size": "Grande, Extra Shot",
            "price": 6.45
          },
          { "name": "Chocolate Croissant", "size": "Warmed", "price": 4.25 }
        ],
        "subtotal": 10.7,
        "tax": 0.96,
        "total": 11.66
      }
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "s1",
      "components": [
        { "id": "root", "component": "Card", "child": "main-column" },
        {
          "id": "main-column",
          "component": "Column",
          "children": ["header", "items-list", "divider", "totals", "actions"],
          "align": "stretch"
        },
        {
          "id": "store-name",
          "component": "Text",
          "text": { "path": "/storeName" },
          "variant": "h3"
        },
        {
          "id": "items-list",
          "component": "Column",
          "children": { "path": "/items", "componentId": "order-item-template" }
        },
        {
          "id": "order-item-template",
          "component": "Row",
          "children": ["item-name", "item-price"],
          "justify": "spaceBetween"
        },
        {
          "id": "item-price",
          "component": "Text",
          "text": {
            "call": "formatCurrency",
            "args": { "value": { "path": "price" }, "currency": "USD" }
          }
        },
        {
          "id": "purchase-btn",
          "component": "Button",
          "child": "purchase-btn-text",
          "variant": "primary",
          "action": { "event": { "name": "purchase" } }
        }
        // ...divider, totals, more text/button nodes elided
      ]
    }
  }
]
```

`createSurface` opens the surface against the catalog. `updateDataModel` seeds the store name, line items, and totals. `updateComponents` lays out the tree — a `Card` wrapping a `Column` of rows, with `{"path": "/storeName"}` bindings pulling values from the data model and a `formatCurrency` call shaping the prices. A later `updateDataModel` would update the bound text nodes without touching the tree. (More worked examples, including the full payload above, live in the [MeldUI A2UI gallery](https://meldui.dipayanb.com/docs/a2ui/gallery/).)

The spec says nothing about how the model is hosted, what framework runs your renderer, or what your transport looks like. Hand it a MeldUI catalog and you get Vue components; hand it a shadcn catalog and you'd get React ones. A model fine-tuned for it — the Thesys-shaped bet — could render into either. CopilotKit could speak it on the wire and keep its UX. Two different generative-UI apps from two different vendors could _share_ a surface state.

A2UI is becoming the de-facto standard for fairly mechanical reasons. Google was the only well-resourced player in this space whose business model didn't depend on capturing your catalog or your renderer — they could afford to publish a neutral protocol because they don't need to monetize either end of it. Neutral protocols almost always ship from that position.

## The catalog, the renderer, and the rest of the stack

A spec by itself doesn't render anything. To wire A2UI into a real app you need three things: a component catalog the model can compose against, schema bindings that tell the renderer how each catalog entry maps to a real component, and a renderer that mounts components from envelopes. [MeldUI](https://meldui.dipayanb.com) is all three.

I didn't build MeldUI for this PoC. [Tarasankar](https://www.linkedin.com/in/tarasankar-kundu-031257a/) and I built it as the component library underneath our own project work — Vue 3, Tailwind v4, opinionated where it had to be, neutral everywhere else. Adding A2UI support was the natural next step: publish the catalog as JSON, formalize the prop schemas as A2UI bindings, ship a renderer that consumes envelopes and mounts components from them. The same library that handles our day-job UI is now also a complete A2UI implementation for Vue. It's open source; the catalog _is_ the contract, so forking it and bending it for your own domain is how you change what your model is allowed to compose with.

Around MeldUI I built the rest of the stack. [agentic-ui-poc](https://github.com/dbhowmick/agentic-ui-poc) uses Claude as the model and [Jido.AI](https://github.com/agentjido/jido_ai) as the agent loop, with Phoenix carrying everything — Channels for transport, Ecto for surface persistence, Oban for whatever background work the agent eventually spawns. There's a two-pass validator sitting at the catalog boundary and an envelope inspector I built because debugging streamed envelopes blind nearly broke me. `mix setup && mix phx.server` and the whole thing runs locally; ask it to plan a Tokyo trip and the conversation from the top of this post replays.

![The envelope inspector running against the trip-planner conversation — 1 createSurface, 8 updateComponents, and 23 updateDataModel updates streamed so far, newest first, with the rendered surface visible behind it.](/blog/envelop_inspector.png)

Phoenix is an unusual choice for an AI stack — most of the noise in this space is Python or TypeScript. The longer defense goes in Post 2; the short version is that Phoenix Channels already do most of what an agent-UI transport needs, and rebuilding that on another runtime is a lot of accidental work.

## What the spec doesn't tell you

The spec itself reads in an afternoon. The rest of the stack — none of which is in the protocol document — is where the real engineering hides.

MeldUI started life as a one-way component library — you hand it props, it renders. Plugging it into A2UI meant rethinking how the renderer mounts and unmounts surfaces from envelope deltas, how components subscribe to a shared surface state instead of receiving frozen props, and how data bindings update without rebuilding the tree underneath them. Each one reads as a small problem until you start writing it and the edge cases pile up. Most of the renderer work was making the three compose cleanly without stepping on each other.

The transport was the other half. The model emits envelopes as it streams — `createSurface`, then `updateComponents`, then a handful of `updateDataModel` updates as values land. The user can interact with a rendered surface before the model has even finished its turn, and the action has to flow back into the agent loop without racing the envelopes still arriving from the same turn. Phoenix Channels handle the bare wire of that easily. What took the time was the protocol on top — making A2UI behave correctly on a stream that runs both ways at once, ordering events so the agent sees a coherent timeline, deciding what counts as "the latest version of this surface" when both sides are still writing.

Then the charts. The model could compose forms, cards, itinerary blocks, and markdown sections cleanly from the catalog description alone. Charts were the exception. The first few attempts came out lopsided — wrong axis types, data fields plumbed to the wrong series, pie charts asked for a single number. The fix was unceremonious: I one-shot a handful of complete chart envelopes into the system prompt — real `updateComponents` payloads, with realistic data, exactly the shape I wanted back — and the rest of the chart vocabulary fell into place. Some catalog entries are too structural for the model to infer from prop shape alone. The description tells it what's possible; it takes an example to show what's expected.

Then the surfaces. The first version of the chat thread pinned every surface to the message that created it. The user would scroll back up to interact with a dashboard from twelve turns ago, while the latest version of the same dashboard sat at the bottom of the thread, unreachable. It looked correct on paper. It felt wrong.

Then actions. The renderer fires an event when the user submits a form, and that event has to get back to the model. The agent framework I'm using doesn't expose a "synthesize a tool result from the client" API, so I'm wrapping the action as a user-role turn with a `[a2ui_action]` prefix and teaching the model to recognize it. It works. It is also obviously a workaround.

None of that is in the A2UI spec, and it can't be — the spec describes the wire, not what's plugged into either end of it. Every team adopting A2UI is going to hit some version of these same problems. The next two posts are the answers I landed on, written down so the next person doesn't have to find them from scratch.

## What's next

**Post 2** is the emission side: how Phoenix actually gets envelopes out of Claude, the two emission modes I shipped (tool-call and streamed-JSON), when each is the right call with real latency numbers, and what I learned writing a validator that has to keep the model honest without making it feel hostile.

**Post 3** is the rendering side: how surfaces stop piling up as dead receipts and start following the conversation, how the action round-trip closes the bidirectional loop, and what's still left to fix — a tool-result injection API in Jido.AI being the big one.

If you're picking a wire format right now, pick this one. And if you've already picked something else, the repo is there — clone it, read what worked and what didn't, tell me where I got it wrong. I'd genuinely like to know.

---

_Repo: [github.com/dbhowmick/agentic-ui-poc](https://github.com/dbhowmick/agentic-ui-poc). MeldUI: [meldui.dipayanb.com](https://meldui.dipayanb.com). I'm Dipayan Bhowmick — questions, corrections and disagreements all welcome._
