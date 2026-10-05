# 4-minute judge demo

1. Open JeevikaSetu and choose Hindi (or one of the six supported languages). Point out that the preference is retained in localStorage.
2. Open Voice Conversation and tap the big orange **बात शुरू करें** button once. That single tap unlocks audio and starts things hands-free: the agent greets, the mic re-opens by itself after every question, and the answer is sent as soon as the beneficiary stops speaking. Say: “मैं खेती करता हूं, पुणे के पास रहता हूं, और सिर्फ पांच किलोमीटर तक जा सकता हूं।” Show the Listening → Processing → Speaking states and the live transcript. Tapping the mic while the agent is talking interrupts it (barge-in) — just like a real phone call.
3. Continue the interview. Call out the family-work question: the assistant asks whether the work is traditional or independent before asking the occupation. Then take a detour — ask *“ट्रेनिंग में कितना पैसा लगेगा?”*, say *“फिर से बोलिए”*, or tap the quick-reply chips (🔁 😕 ✅ ❌). The agent answers, then slides straight back to the pending question: genuinely two-way, not a scripted form.
4. Complete the interview. Open the profile and show that only agriculture/location/mobility actually stated by the user appear; no default computer or data-entry skills are inserted.
5. Generate recommendations. Show the nearby training-center map and explain the Haversine radius filter.
6. Open Officials Dashboard. Show beneficiaries, recommendation sets, average skill match, GIA links, district distribution, top pathways, and recent activity.
7. Open IVR Simulation to demonstrate phone-number entry, ringing, connected timer, keypad language selection, and the same voice flow.

For an API-backed demo, set `OPENAI_API_KEY` before starting. For an offline rehearsal, leave it empty: the deterministic flow and browser audio fallback remain available.
