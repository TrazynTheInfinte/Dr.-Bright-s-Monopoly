# Dr. Bright's Monopoly

A browser-based, rules-enforcing Monopoly variant themed around the SCP Foundation. This file is the glossary for the game's domain vocabulary — the fictional/rules concepts, not the software architecture.

## Language

### Currency & the Foundation

**Foundation Credits**:
The in-game currency. All players start with 1500.
_Avoid_: Rouble, dollar, cash

**The Foundation**:
The entity that confiscates a Terminated player's assets, and that receives certain payments (e.g. Site Entrance fees, Holding/Escape Fees).
_Avoid_: The State, bank, treasury, the house

**Requisition**:
The act of the Foundation confiscating a player's assets when they're Terminated.
_Avoid_: Seize, Seizure

**Holding Fee**:
Charged to a player every turn they fail to roll doubles while stuck in the Containment Chamber - the ongoing cost of staying. D-Class is exempt. After 3 turns paying it, a player is released for free.
_Avoid_: Bribe

**Escape Fee**:
A steeper, one-time payment a player in the Containment Chamber can make to leave immediately, before even trying for doubles - an alternative to the Holding Fee, not a discount on it. D-Class never pays it; Janitor's master keyring waives it once per game.
_Avoid_: Bribe, Clearance Fee

**Terminated**:
The classic Monopoly "lose" state: a player who can't cover a debt is out for good, their Rooms and Credits return to the Foundation, and they're skipped in turn order for the rest of the match. The match ends the instant only one player is left.
_Avoid_: Disappear, Bankruptcy, Eliminated, bankrupt, eliminated, die, knocked out

### Board & tiles

**Wing**:
A single ownable board tile (the old "Property") — one area of the Foundation Site the whole board represents. Wings come in color-coded Sectors.
_Avoid_: Property, Room (that word is reserved for a multiplayer session — see below), space, street

**Sector**:
A complete set of same-color Wings — owning every Wing in a Sector lets you build on them.
_Avoid_: Collection, monopoly, color group, set

**Site Entrance**:
The start tile (the old GO/STOY). Landing on or passing it collects the standard Monopoly Go payout (200 credits); no fee for passing, matching classic rules.
_Avoid_: GO, STOY

**Containment Chamber**:
The jail tile. A player sent here stays until they roll doubles, use a Get Out of Containment card, or pay the Escape Fee - otherwise they're charged the Holding Fee each turn they remain, and released for free after 3 such turns.
_Avoid_: Jail

**Reassigned**:
The "Go To Jail" tile — landing here sends a player straight to the Containment Chamber.
_Avoid_: Go To Jail

**Break Room**:
The Free Parking tile. Purely cosmetic — landing here has no game effect (no house-rule cash jackpot).
_Avoid_: Free Parking

**Maintenance Tunnels**:
The four railroad-equivalent tiles. Same classic railroad pricing/rent (scales with how many of the four a player owns).
_Avoid_: Railroad

**Site Warhead**:
One of the two utility tiles (the old Electric Company). Classic utility rent (a dice-roll multiplier).
_Avoid_: Electric Company

**Site Coolant**:
The other utility tile (the old Water Works). Classic utility rent (a dice-roll multiplier).
_Avoid_: Water Works

### Cards

**Anomalous Event**:
One of the two card decks (the old "Communist Test"/Chance-equivalent).

**Foundation Directive**:
The other card deck (the old "No Chance"/Community-Chest-equivalent).

### Personnel

**Personnel**:
One of the selectable tokens a player plays as (the old "Piece"). Each has a Title, a Special Power carried over unchanged from the old Piece it's reskinned from, and no Win Condition/Score (that system was removed).
_Avoid_: Piece, token, character, avatar, mascot

**Title**:
The in-fiction role name for a Personnel (e.g. "D-Class Personnel", "Field Researcher", "MTF Operative", "Site Director"). The full 12-Personnel roster, each with two Special Powers, is named in `data/pieces.ts`.

### Hostile Anomalies

**Hostile Anomaly**:
An SCP that can breach containment and menace players directly once loose on the board, distinct from ordinary Wings and cards. Currently SCP-096 ("The Shy Guy"), SCP-173 ("The Sculpture"), SCP-106 ("The Old Man"), SCP-939 ("With Many Voices"), and SCP-049 ("The Plague Doctor") — each with its own bespoke behavior, not a shared "monster AI."
_Avoid_: monster, enemy, creature

**Containment Breach**:
The event of a Hostile Anomaly escaping containment onto the board. Happens by random chance at the end of any completed turn, or on demand via Rogue Anomaly's Induce a Breach. At most one of each Hostile Anomaly can be loose at a time; different ones can be loose simultaneously. Can't happen at all - random or induced - until someone has completed a full lap of the board, so the first lap is always guaranteed anomaly-free. SCP-939 is the one exception to "an event" - its breach is never announced at all, no log entry and no visible marker, so nobody actually witnesses it happening. The one exception to that exception: whoever it's currently approaching gets a private early warning nobody else does, in keeping with it being heard, not seen, coming.
_Avoid_: spawn, escape

**Dormant**:
A loose Hostile Anomaly's default, non-threatening state. SCP-096 stays dormant until someone views it; SCP-173 stays dormant — and safe — for as long as someone keeps watch on it, and never leaves this state the way SCP-096 does.
_Avoid_: idle, sleeping

**Hunting**:
SCP-096's state once someone views it: it locks onto that one player and steadily closes the distance every turn until it catches them. SCP-106 and SCP-939 are always in this state from the moment they breach — neither ever needs to be viewed, and both automatically re-target whoever's closest if they ever lose their current target (SCP-939's marker stays hidden the entire time it's hunting - see Containment Breach). Catching someone doesn't end SCP-939's turn in this state either, unlike SCP-096/SCP-173/SCP-106 (whose catches all Go Dormant right where it happened) - it immediately re-targets whoever's next and keeps going, staying invisible the entire time; only once literally nobody is left to hunt does it finally go dormant, and visible for the first time. Unlike every other anomaly here, SCP-939 only actually closes distance once per round (same cadence as Keep Watch below) rather than every turn - it's silent and automatic, not slow, so this keeps it a real threat without being unbeatable. SCP-173 has no equivalent locked-on state — see Keep Watch. SCP-049 has its own separate targeting state instead — see Diagnosed.
_Avoid_: chasing, aggro

**Diagnosed**:
SCP-049's own equivalent of Hunting - always active from the moment it breaches, same as SCP-106/SCP-939, but the target is a random pick completely unrelated to anyone's position on the board, and it never re-diagnoses a player currently Cured. It also moves toward its target directly (whichever direction around the board is actually shorter) rather than only with the flow of play like every other anomaly - its diagnosis was never about anyone's position in the first place. If its target becomes ineligible, or is cured, it re-diagnoses a new random one immediately rather than pausing - preferring someone not currently Cured, but re-diagnosing an already-Cured player rather than freezing if that's genuinely all that's left, since that's the only way a fatal second Caught ever becomes possible again once everyone's survived a first one.
_Avoid_: hunting (reserved for the proximity-based version above), infected

**Caught**:
A player a Hostile Anomaly (or Jailbird, swung at another player instead of an anomaly) has reached. Every asset returns to the Foundation and their position resets to the Site Entrance (no Go bonus) exactly like a real Termination, though D-Class's Standard Expendability Clause and Personnel reassignment can still apply. SCP-106 has its own exception: being caught by it on the main board isn't itself a loss - it drags the player into the Pocket Dimension instead, and only failing inside that actually triggers this. SCP-049 has its own exception too - see Cured.
_Avoid_: killed, eaten

**Cured**:
SCP-049's own consequence for a first-time catch, replacing the standard seizure entirely: the target keeps everything, but rolls only one die and can't use Induce a Breach, the Janitor tunnel shortcut, Show of Force, or any Object Anomaly for a few turns, and can't be re-diagnosed while it lasts. A second catch on the same player, ever, is fatal instead - reanimated as a mindless SCP-049-2 (see below), via the same Caught consequence every other catch uses.
_Avoid_: infected, poisoned, debuffed

**SCP-049-2**:
What a fatal SCP-049 catch leaves behind on the board - an independent, physical entity in its own right, not just flavor text, that keeps existing regardless of whether SCP-049 itself is still loose or has since been purged. Roams aimlessly and slowly (1-2 spaces a turn, no aim or hunting behavior of its own). Colliding with a player, either direction, immediately hands SCP-049 a forced new Diagnosed target, interrupting whatever it was already doing - and if that new target is far from SCP-049's current position, SCP-049 also gets a temporary speed boost to actually close the gap, rather than the designation being a hollow threat.
_Avoid_: zombie (as a mechanic name - fine as flavor), corpse

**Pocket Dimension**:
SCP-106's own Hostile Anomaly mechanic: a separate 9-tile track that the player it caught, and SCP-106 itself, both enter together. The player advances along it each of their own turns instead of acting on the main board; SCP-106 creeps after them a little each time. Landing on a Fracture Point escapes back to the main board; running out of Credits on a Decaying Passage, or SCP-106 actually reaching the player's tile, both Get the player Caught for real. Either way the ordeal ending recontains SCP-106. Its tile order (past the fixed neutral entry tile) is reshuffled fresh every time someone's dragged in.
_Avoid_: sub-board, mini-game, side-board

**Fracture Point**:
A Pocket Dimension tile - landing on one instantly and freely returns the trapped player to the main board.
_Avoid_: exit tile, escape hatch

**Decaying Passage**:
A Pocket Dimension tile - landing on one costs the trapped player Credits, paid to the Foundation like any other fee. Enough of them (or one landed on that they can't afford) is what actually gets a player Caught inside the Pocket Dimension.
_Avoid_: damage tile, trap tile

**Keep Watch**:
SCP-173's own defense against being caught: it only ever moves once per round, on whichever player's turn it happened to breach on. Since everyone's a potential target, any player may spend their own turn during the round watching it instead of acting normally, freezing it for that round. If nobody keeps watch, it closes in hard on whoever's nearest — fast enough to often catch them outright, though someone far enough away can outrun it.
_Avoid_: guard, observe

**Purge**:
The Site Warhead's owner spending a large sum to instantly recontain every currently loose Hostile Anomaly at once. Can't reach SCP-106 while it's inside its own Pocket Dimension mid-chase - only anomalies actually out on the main board.
_Avoid_: nuke (as a verb), detonate

### Object Anomalies

**Object Anomaly**:
An anomalous item, distinct from a Hostile Anomaly - inert rather than a threat that roams the board, acquired by drawing a card (same as an ordinary Anomalous Event/Foundation Directive draw, and "Clearance Revoked"'s Get Out of the Containment Chamber Free) and kept as a held card until its holder chooses to use it. The launch roster is deliberately mixed - some are safely beneficial, some are dangerous to use at all, and a holder can't tell which just by holding one. Each Object Anomaly defines its own rule for when it can be used - there's no single shared trigger condition the way "Get Out of the Containment Chamber Free" only offers its Use button while jailed. Some (Micro H.I.D., Jailbird) can recontain a single nearby loose Hostile Anomaly directly - a personal, free, single-target counterpart to a Purge that doesn't require owning the Site Warhead. Jailbird can also be swung at another player entirely, applying the exact same consequence as a Hostile Anomaly catch (Countermeasure included) rather than anything anomaly-specific.
_Avoid_: item, artifact, powerup, relic

### Multiplayer

**Room**:
A single multiplayer game session, identified by a Room Code, that players join by entering a display name — no account required. Kept as "Room" rather than renamed, since it's already this in the existing codebase we're reusing and isn't a fictional/theming concept — see Wing above for the (unrelated) board-tile term.

**Room Code**:
The short shareable code identifying a Room.
