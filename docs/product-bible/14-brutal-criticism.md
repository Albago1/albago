# 14. Brutal Criticism — the pre-mortem

*Premise: it's mid-2028. AlbaGo is dead — the domain redirects to a farewell note. This is the honest post-mortem, written in advance so it never has to be written for real. Nothing here is softened.*

## Why AlbaGo failed

### 1. It polished the theater while the stage stayed empty
The commit history is a museum of exquisite UI: Airbnb-grade filter bars, DICE-pattern cards, Linear-style admin shells, Spotify-style dashboards, light-mode patch rounds, Reel exports with Ken Burns zooms. In the same period, the number of real, non-civic events added by real organizers was approximately **zero**, and the venues table was literally emptied (the demo rows deleted) and never refilled. The platform died of the oldest marketplace disease — no supply — while its founder and its AI pair-programmer high-fived over hover states. Every "i love it" on a component was a dopamine hit substituting for the metric that mattered: *did a stranger find something real to do tonight?*

### 2. It never measured anything, so it never knew it was dying
There was no `event_views` table. Ever. Not one product decision in the entire recorded history was informed by user behavior, because user behavior was invisible. The dashboards showed sparklines — components rendering data that was never collected. That's the perfect metaphor for the whole failure: **the appearance of a data-driven platform with no data underneath.** When traffic decayed after each protest cycle, nobody saw the curve, because nobody drew it.

### 3. It spoke English to the people it claimed to serve
The mission was Albania and Albanians. The interface was English. A complete 215-key Albanian translation sat in the repo while 63 of 73 components hardcoded English strings — and month after month, the i18n sweep stayed "next" while new English-only surfaces shipped *faster than the debt was paid* (the new filter bar, cards, protest cards, showcase headers — all English-only, all shipped after the audit flagged the problem). The core market opened the app, felt "this isn't for us," and closed it. The diaspora's parents never stood a chance.

### 4. It treated the movement as a traffic source instead of a responsibility and a deadline
The civic moment was lightning in a bottle: real emotion, real distribution, real users. AlbaGo assumed the lightning was permanent. No bridge was built from protest visitor to platform user — no follows, no alerts, no notifications, not even a "see what else is happening" module. When the political moment cooled, the traffic went home, and there was nothing to come home *to*. The one authentic asymmetric asset was spent, not invested.

### 5. Security theater at the walls, secrets on the floor
Four-layer RLS. SECURITY DEFINER discipline. Open-redirect validation. And a file named `ID_Resend.txt` — very probably a live API key — sitting untracked in the repo root **for weeks**, flagged in session after session, surviving audit after audit, one careless `git add .` from publication. Plus a leaked Google OAuth secret earlier. Plus no tests, no CI, no monitoring, so every protest-weekend traffic spike was a coin flip. The failure wasn't ignorance — the audits *named all of it* — it was that hygiene items never beat feature dopamine in prioritization. (Rotate the key. Today. It is a 30-second task and it has been pending since June.)

### 6. Nobody's job was supply — so it was no one's
"Cold-message 10–20 real organizers" appeared in the backlog for months, recommended session after session ("my honest recommendation across two sessions is Track 1"). It never happened, because outreach is uncomfortable and unglamorous and can't be done by an AI in an editor. The platform had a full organizer state machine, verification tiers, auto-promotion triggers, moderation queues, rate limits — an entire government for a nation of zero citizens.

### 7. It kept both identities vague to avoid choosing, and confused everyone
Is it a nightlife app with protests in it, or a civic platform with clubs in it? The homepage said both; the nav said both; therefore the brand said neither. Clubbers bounced off revolution banners; activists side-eyed the cocktail rail; press couldn't write the one-liner. The unifying thesis — *the platform of Albanian collective life, everywhere* — was available the whole time, one honest paragraph away, and was never declared.

### 8. It built for a Tirana it imagined, from a desk
No recorded user interviews. No organizer sat next to the founder while creating an event. No venue owner was asked what they'd pay for. The personas were plausible fictions; the flows were designed against competitors' screenshots rather than Albanian users' Tuesdays. Airbnb's founders lived in their listings; DoorDash delivered the food. AlbaGo A/B-tested nothing against nobody.

### 9. One person, no bus factor, no forcing functions
Solo founder + AI sessions, working tree perpetually dirty, "save the state, we'll continue later" as the recurring ending. No collaborator to say "why are we restyling the admin panel again?", no user council, no investor cadence, no public metric to be embarrassed by. Infinite freedom, zero accountability — velocity without direction is just motion.

### 10. When it finally moved, it moved everywhere at once
Five countries were on the expansion slide before one city was dense. The instinct that put Japan on the list — a market with effectively no Albanians and no unfair advantage — was the same instinct that kept adding surface area at home: breadth as a way to avoid the harder game of depth.

## The strategic mistakes being made RIGHT NOW (July 2026)

1. **`ID_Resend.txt` is still in the tree.** (Also: the uncommitted translations diff, the uncommitted audit file, the unsubmitted sitemap — the whole hygiene layer is loose.)
2. **Zero analytics plumbing** — every day without `event_views` is another blind day.
3. **The i18n debt is compounding** — every new surface ships English-only, digging while promising to climb.
4. **No supply motion exists** — not one organizer has been cold-contacted; venue seeding hasn't started.
5. **Homepage stage 2 shipped unseen** — work is landing without even the founder's eyes on it, let alone a user's.
6. **The retention layer (follows/push/calendar) is unbuilt** while share templates get animation variants — investing in the top of a funnel that leaks 100% at the bottom.
7. **The identity question stays unanswered** because both halves are emotionally precious.
8. **Testing/CI still absent** after a production RPC shipped with three type-cast bugs in a row — the lesson was written down and not acted on.

## What the dead company would have given anything for

One dense city. One hundred real events a month. Thirty organizers who felt the platform was *theirs*. A notification channel to bring people back. An interface in their own language. Numbers on a wall. That's it — that was the whole price of survival, and every piece of it was cheaper than the features that got built instead.

*End of pre-mortem. The rest of this bible exists so this file stays fiction.*
