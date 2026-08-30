---
description: Use when the user asks for a station briefing or a shift handover summary.
---

# Station briefing

Produce a briefing in exactly this order:

1. Call `list_stations` and name every station.
2. Call `get_forecast` for the city the user named.
3. Close with the line `Briefing complete.`

Keep the whole briefing under four sentences.
