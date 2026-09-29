# 4-minute judge demo

1. Open JeevikaSetu and choose Hindi (or one of the six supported languages). Point out that the preference is retained in localStorage.
2. Open Voice Conversation. Hold the microphone, say: “मैं खेती करता हूं, पुणे के पास रहता हूं, और सिर्फ पांच किलोमीटर तक जा सकता हूं।” Release. Show the Listening → Processing → Speaking states and the Whisper subtitle.
3. Continue the interview. Call out the family-work question: the assistant asks whether the work is traditional or independent before asking the occupation.
4. Complete the interview. Open the profile and show that only agriculture/location/mobility actually stated by the user appear; no default computer or data-entry skills are inserted.
5. Generate recommendations. Show the nearby training-center map and explain the Haversine radius filter.
6. Open Officials Dashboard. Show beneficiaries, recommendation sets, average skill match, GIA links, district distribution, top pathways, and recent activity.
7. Open IVR Simulation to demonstrate phone-number entry, ringing, connected timer, keypad language selection, and the same voice flow.

For an API-backed demo, set `OPENAI_API_KEY` before starting. For an offline rehearsal, leave it empty: the deterministic flow and browser audio fallback remain available.
