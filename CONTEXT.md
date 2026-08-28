# SCP-opoly

A browser-based, rules-enforcing Monopoly variant themed around the SCP Foundation. This file is the glossary for the game's domain vocabulary — the fictional/rules concepts, not the software architecture. (Working title — rename freely once you land on one you like.)

## Language

### Currency & the Foundation

**Foundation Credits**:
The in-game currency. All players start with 1500.
_Avoid_: Rouble, dollar, cash

**The Foundation**:
The entity that confiscates a Terminated player's assets, and that receives certain payments (e.g. Site Entrance fees, Clearance Fees).
_Avoid_: The State, bank, treasury, the house

**Requisition**:
The act of the Foundation confiscating a player's assets when they're Terminated.
_Avoid_: Seize, Seizure

**Clearance Fee**:
The payment a player in the Containment Chamber must make to get released early, before rolling doubles resolves it naturally.
_Avoid_: Bribe

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
The jail tile. A player sent here stays until they roll doubles, use a Get Out of Containment card, or pay the Clearance Fee.
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
The in-fiction role name for a Personnel (e.g. "D-Class Personnel", "Field Researcher", "MTF Operative", "Site Director"). The full 12-Personnel roster is named in `data/pieces.ts`; two (Janitor, Containment Specialist) have no Special Power yet — see that file's comments.

### Multiplayer

**Room**:
A single multiplayer game session, identified by a Room Code, that players join by entering a display name — no account required. Kept as "Room" rather than renamed, since it's already this in the existing codebase we're reusing and isn't a fictional/theming concept — see Wing above for the (unrelated) board-tile term.

**Room Code**:
The short shareable code identifying a Room.
