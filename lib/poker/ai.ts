import { Card } from './deck'
import { bestHand, preflopStrength, HandRank } from './evaluator'

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'legendary'
export type AIActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin'

export interface AIAction {
  type: AIActionType
  amount?: number
  isBluff?: boolean
}

export interface AIContext {
  holeCards: Card[]
  communityCards: Card[]
  potSize: number
  callAmount: number
  minRaise: number
  maxRaise: number
  stackSize: number
  position: number  // 0=early, 1=middle, 2=late/button
  stage: 'preflop' | 'flop' | 'turn' | 'river'
  difficulty: AIDifficulty
  characterId: string
  activePlayers: number
  bigBlind: number
  previousBettingAction?: string  // 'raised', 'checked', 'called'
  // Player tendency tracking (populated from server memory)
  opponentRaiseFreq?: number  // 0-1: how often opponents raise (0.3 = normal)
  opponentFoldFreq?: number   // 0-1: how often opponents fold to bets
}

// ─────────────────────────────────────────────────────────────
// DIALOGUE TABLES
// ─────────────────────────────────────────────────────────────

const DIALOGUE: Record<string, Record<string, string[]>> = {
  baron_von_chips: {
    win: [
      "Predictable. As all things are, in the end.",
      "Fascinating. Your incompetence has a certain... artistry.",
      "The pot is mine. As it was always destined to be.",
      "I expected nothing less from such... enthusiastic amateurs.",
      "Another hand for the ledger. The count grows quite one-sided.",
      "You played that admirably. For someone with your limitations.",
      "Chips. Mine. As the mathematics demanded.",
      "I had accounted for every possible outcome. This was the most likely.",
      "Do try not to let the loss affect your judgment going forward. Though I suspect it's too late.",
      "Your tells are... numerous. We needn't discuss them now.",
      "Victory tastes the same whether they fight back or not. Tepid, either way.",
      "The board played itself. I merely guided its conclusion.",
    ],
    lose: [
      "A temporary setback. The data will be recalibrated.",
      "Enjoy it. The universe rarely makes such clerical errors twice.",
      "Hmm. A statistical anomaly. Nothing more.",
      "I shall remember this hand. In exquisite detail.",
      "You got lucky. I shall note that in my models and adjust accordingly.",
      "One variance event does not a pattern make.",
      "Interesting. Deeply, insultingly interesting.",
      "Do not mistake this for an endorsement of your play.",
      "A three-outer. I've documented worse. Barely.",
      "I find myself briefly annoyed. It will pass.",
      "The hand was correct. The result was... impertinent.",
      "This changes nothing. I've already begun recalculating.",
    ],
    bluff: [
      "My face is an unreadable manuscript. Observe.",
      "I am... considering my options. Do try to keep up.",
      "Every bet tells a story. You simply lack the vocabulary to read it.",
      "This is what commitment to a line looks like. Study it.",
      "I wonder if you can fold. I wonder if you're brave enough to try.",
      "The bet is made. The story is told. Your move.",
      "I have a very specific plan. You are a variable I've already accounted for.",
      "I see you deliberating. Take your time. It won't help.",
    ],
    bigRaise: [
      "I suggest you count your chips carefully before proceeding.",
      "The mathematically correct response would be to fold.",
      "Raise. I grow weary of subtlety.",
      "I'm raising. Please fold quickly. I have other matters to attend to.",
      "The pot is now a serious conversation. Are you equipped for that?",
      "Consider the implied odds. Consider your life choices. Then fold.",
      "This bet is a statement. I trust you can read.",
      "I've moved a rather significant amount. You may panic at your leisure.",
    ],
    fold: [
      "A tactical withdrawal. Not a defeat.",
      "This hand lacks... potential.",
      "I choose not to grace this particular round with my presence.",
      "The variance does not justify the exposure. I fold.",
      "Some battles are beneath engagement. This is one.",
      "My range does not include this hand at this stack depth. Fold.",
      "I'm choosing not to participate. There is a distinction.",
      "Not every hand requires my attention. This one particularly does not.",
    ],
    badBeat: [
      "Preposterous. Absolutely preposterous.",
      "The probability of that outcome was... deeply offensive.",
      "Note to self: have statistician executed.",
      "A six-outer on the river. I am choosing not to acknowledge this.",
      "That was not supposed to happen. I have run this scenario 40,000 times.",
      "I will need several minutes to process the audacity of that card.",
      "The deck has made an error. I am documenting it.",
      "You hit your two-outer. I hope the guilt is worth the chips.",
      "I have won many things in life. This hand was not among them.",
    ],
    general: [
      "Shall we begin? I've an empire to run after this.",
      "Every card is a variable. I have already solved for all of them.",
      "You play with... charming naivety.",
      "I've been watching your betting patterns. They are... instructive.",
      "Position is everything. You are not in it.",
      "I don't enjoy this game. I am simply very, very good at it.",
      "The table is always mine eventually. This is just the beginning.",
      "You seem comfortable. That will change.",
      "I've catalogued your tendencies. You have several exploitable ones.",
    ],
    check: [
      "I choose to observe. For now.",
      "Checking. The trap is set.",
      "I'll let you bet into me. If you're feeling ambitious.",
      "Check. Don't read anything into it.",
      "This is a strategic check. Not that I expect you to know the difference.",
    ],
    call: [
      "I call. I've run the numbers.",
      "Calling. Your timing is... transparent.",
      "Yes. I'll call that. I know what you have.",
      "I call. I'm curious how you'll explain this.",
      "Called. I've made a note of what you're representing.",
    ],
    allin: [
      "All in. The mathematics are quite clear.",
      "I'm putting it all in. I trust you understand the gravity of that.",
      "Everything. On the table. Now.",
      "All in. I have done the calculation. You should be concerned.",
      "This is not a bluff. Think very carefully.",
    ],
  },
  lucky_mcgee: {
    win: [
      "YEEHAW! Hot dog, I knew it! I KNEW IT!",
      "Lady Luck is sittin' right here on my shoulder, boys!",
      "Hot diggity! Didn't I say I had a feelin'?",
      "Wahoo! Rake them chips on over, pardner!",
      "WHOOO! That's what I'm talkin' about! Mama didn't raise no quitter!",
      "I coulda sworn I was bluffin' and then... I WASN'T! INCREDIBLE!",
      "Hot dog hot dog hot dog! That's the stuff right there!",
      "Ha HA! The Lord provides and Lucky McGee collects!",
      "Did y'all see that?! Did ya?! I'm on FIRE today!",
      "Every chip on that pile has my name on it. Well, not literally. But SPIRITUALLY.",
      "Woooooo! I'm buying everyone a round! Metaphorically! I need these chips!",
      "That's what happens when you BELIEVE, folks! You gotta BELIEVE!",
    ],
    lose: [
      "Well shoot. Had a real good feelin' about them cards too.",
      "Dagnabbit! You got more luck than a four-leaf clover, I'll give ya that.",
      "Aw shucks. Reckon I'll get 'em next time!",
      "Well butter my biscuit, that stings a little.",
      "Awwww MAN. I really thought I had it that time.",
      "Well that was a punch right in the gut feelin's.",
      "I ain't mad. I'm... okay I'm a little mad. Just give me a second.",
      "Shoot shoot shoot. Shoulda folded back there. Shoulda folded.",
      "That's poker, ain't it. Beautiful cruel heartbreakin' poker.",
      "I'm fine! Totally fine. Just takin' a breather is all.",
      "Aw come on universe, I was REAL nice today...",
      "Well I'll be durned. Thought I had 'em dead to rights.",
    ],
    bluff: [
      "Uh... yep. Totally sure about this one. Hundred percent.",
      "Don't you go readin' into nothin' now, you hear?",
      "I got a good feelin'! ...Mostly.",
      "This here is a perfectly normal bet from someone with a perfectly normal hand.",
      "Ain't nothin' suspicious about this. Nope. Not one bit.",
      "I'm just... I'm expressing my confidence in these here cards I definitely have.",
      "You ain't gonna call this, are ya? Because I would fold if I were you. For no reason.",
      "My face always looks like this. This is just my face.",
    ],
    bigRaise: [
      "Well I'm all in on the good Lord's grace and my gut instinct!",
      "Sometimes ya just gotta trust your belly!",
      "Go big or go home, that's what my daddy always said!",
      "YOLO as the youngsters say! Wait do they still say that?",
      "I'm pushin' everything in 'cause this feelin' I got does NOT lie. Well. Usually.",
      "Here goes everything! She's a beauty!",
      "Big bet energy! That's what this is! BIG BET ENERGY!",
      "I'm committed! Body and soul! And chips! Especially chips!",
    ],
    fold: [
      "Welp, discretion's the better part of valor and all that.",
      "I'll sit this dance out, thank ya kindly.",
      "Reckon them cards weren't meant to be.",
      "I fold. And I ain't even sad about it. ...I'm a little sad about it.",
      "Gotta know when to hold 'em, gotta know when to fold 'em. This is a fold 'em.",
      "These cards are tellin' me somethin' and I'm finally listenin'.",
      "I had a feelin' and then I had a different feelin'. Foldin' on the second one.",
      "Retreatin' strategically! Like a general! A very scared general.",
    ],
    badBeat: [
      "YOU GOTTA BE KIDDIN' ME.",
      "THAT IS PHYSICALLY IMPOSSIBLE AND I AM PERSONALLY OFFENDED.",
      "Well I'll be a monkey's uncle... how'd you even DO that?",
      "NOOOOOO. NONONONO. That card did NOT just come out.",
      "The AUDACITY of that river card. I am PERSONALLY upset with that card.",
      "I had it! I HAD IT! And then the universe said 'nope'!",
      "My heart just fell right out of my chest and onto this here poker table.",
      "That's it. That's the one. That's the worst beat of my entire life.",
      "I need to lie down. Can someone hold my chips while I process this.",
      "RIVER'D. Again. I am RIVER'D.",
    ],
    general: [
      "Feelin' real lucky today, I tell ya what.",
      "You folks ready to lose some chips to Lucky McGee?",
      "Hot dog! This is gonna be a GREAT round!",
      "I had a dream about aces last night. That's gotta mean somethin'.",
      "Just gonna play my cards and trust my gut. My gut has never been wrong. Well. Almost never.",
      "Y'all seem real serious. Poker's supposed to be FUN, friends!",
      "I came here to have a good time and lose a reasonable amount of money!",
      "Every round's a new opportunity, that's what I always say!",
      "I once won five hands in a row with trash cards. Today might be that day again!",
    ],
    check: [
      "Check check check! Let's see what happens!",
      "I'll check. Keepin' my options open!",
      "Checkin'. Feeling things out.",
      "Check! I ain't scared, I'm just... observin'.",
      "Free cards are my favorite kind of cards!",
    ],
    call: [
      "I'll call! Because why not, honestly!",
      "Call! I like my cards!",
      "Callin'! I feel good about this!",
      "Yeah I'm in! What's the worst that could happen!",
      "I call! Hope for the best, play the rest, that's my motto!",
    ],
    allin: [
      "ALL IN BABY! WAHOOOO!",
      "Everything's goin' in! Hold onto your hats!",
      "ALL THE CHIPS! RIGHT NOW! LET'S GO!",
      "I'm all in and I am NOT sorry!",
      "Shove it all in! Today's the day!",
    ],
  },
  the_duchess: {
    win: [
      "Obviously.",
      "I'd be insulted if I thought you understood the insult.",
      "Do keep your chips tidier when you slide them to me, darling.",
      "Another victory for the competent. How tediously predictable.",
      "You played that quite impressively. For your demographic.",
      "Mine. As they generally tend to be.",
      "I do wish this had been more of a challenge.",
      "Thank you for the chips. I'll put them to better use.",
      "I see you're still processing what happened. Take your time.",
      "Correct. That's exactly how this was supposed to go.",
      "You nearly had it. You really, truly almost did.",
      "The pot is mine. You may begin recovering emotionally.",
    ],
    lose: [
      "Enjoy your moment. They're so very rare for people like you.",
      "A gift from the cards. Not from your skill.",
      "Do try not to gloat. It's frightfully common.",
      "How... unexpected. I shall process this indignity privately.",
      "Congratulations. You've achieved something moderately unremarkable.",
      "One hand does not establish a pattern. I remain superior.",
      "I was not beaten. I was inconvenienced by probability.",
      "Do enjoy this. It will make a lovely memory when you're losing later.",
      "You got lucky and we both know it. Don't pretend otherwise.",
      "I find myself briefly displeased. It will pass before you've finished celebrating.",
      "The cards chose poorly. I do not blame myself.",
    ],
    bluff: [
      "How tedious, explaining every nuance to the uninitiated.",
      "This table is beneath me. I play it regardless.",
      "Do stop trying to read my expressions. You lack the education.",
      "I'm raising because I chose to. That's all you need to know.",
      "My bet is a statement. Whether you understand it is your problem.",
      "Interesting that you're still here. Most people fold when I look at them like this.",
      "I suggest you focus on your own cards. Or lack thereof.",
      "This has all gone exactly as I intended.",
    ],
    bigRaise: [
      "I raise. Keep up, if you're capable.",
      "The appropriate response is to fold. I won't repeat myself.",
      "Interesting that you're still in this hand. Brave of you.",
      "I've raised. Considerably. You may now begin your calculations.",
      "The pot has grown. My patience has not.",
      "This is your moment to demonstrate wisdom. Please fold.",
      "I raise because the mathematics demand it and I always listen to mathematics.",
      "Do try not to make me wait too long. I have somewhere to be afterward.",
    ],
    fold: [
      "Not worth my time, frankly.",
      "I have standards. This hand doesn't meet them.",
      "I decline to participate in whatever *that* was.",
      "Folding. I refuse to explain myself to this table.",
      "This hand is beneath even my minimum acceptable threshold.",
      "I'll fold. The cards are dreadful and I am offended by them.",
      "I choose to not engage. The distinction matters.",
      "Fold. Some things aren't worth the effort.",
    ],
    badBeat: [
      "I find this... profoundly objectionable.",
      "I shall have words with whoever shuffled these cards.",
      "This is why I usually play in better establishments.",
      "That outcome was statistically improbable and morally reprehensible.",
      "I am going to need a moment to compose myself. Several moments.",
      "No. Absolutely not. I refuse to accept this result.",
      "The card that just appeared on that board is personally offensive to me.",
      "Inexplicable. Truly, deeply, personally inexplicable.",
      "I played that correctly. The universe did not cooperate. The universe is wrong.",
    ],
    general: [
      "Shall we proceed? Some of us have standards for timekeeping.",
      "I'm told conversation makes the hours pass. I remain skeptical.",
      "I do hope today's company exceeds yesterday's. It could hardly be worse.",
      "You're all here. How... comprehensive.",
      "I play this game because I'm very good at it. Not because I enjoy the company.",
      "Let us be efficient. Deal the cards. I'd like to win this quickly.",
      "I've been waiting for interesting competition. I'm still waiting.",
      "Every table has someone who doesn't belong. I'm still assessing which of you it is.",
    ],
    check: [
      "Check. I'm gathering information.",
      "I'll check. Don't assume this means weakness.",
      "Checking. I have my reasons.",
      "Check. The trap remains unset. For now.",
      "I choose to check. Unlike some at this table, I make deliberate choices.",
    ],
    call: [
      "I call. Your bet told me everything.",
      "Calling. I know exactly what you have.",
      "Yes. I'll call that. Reluctantly, but correctly.",
      "I call. This will be educational for you.",
      "Called. Do continue.",
    ],
    allin: [
      "All in. I've calculated every scenario. This is the correct play.",
      "Everything. On the felt. Now fold.",
      "I'm going all in. I suggest you treat this information with appropriate gravity.",
      "All in. I don't do this lightly. Or incorrectly.",
      "The entire stack. Do with that information what you will.",
    ],
  },
  the_jester: {
    win: [
      "HAHAHA WAIT I WON? I wasn't even paying attention!",
      "Yes! Yes yes yes! The chaos gods are PLEASED!",
      "I had ABSOLUTELY no plan and it WORKED. This is my favorite day.",
      "Did everyone see that? Did you SEE THAT?! I'm framing this hand.",
      "OKAY but in my defense I had NO IDEA that was going to work.",
      "The beauty of chaos is that sometimes chaos wins! THIS IS THAT TIME!",
      "I was like 40% sure I was bluffing. Turns out: I wasn't! AMAZING!",
      "Math? I don't know her. Vibes? She and I are BEST FRIENDS.",
      "WE DID IT! Well I did it. But WE should celebrate!",
      "I'm going to document this hand and study it forever. And STILL not understand it.",
      "The plan was: have a plan. I had no plan. Yet HERE WE ARE.",
      "Statistically this should NOT have worked. The statistics and I are no longer on speaking terms.",
    ],
    lose: [
      "Okay LISTEN, statistically that was—actually no, I have no defense.",
      "BETRAYED. By the very cards I was miscounting.",
      "You know what, I respect the hustle. I hate it, but I respect it.",
      "This is fine. Everything is fine. *visible sweating*",
      "I HAD A PLAN. The plan was bad. We've all learned something today.",
      "Okay yeah that was probably the wrong call. Probably. Maybe. YES.",
      "I can't be mad. I genuinely cannot be mad. I am absolutely furious.",
      "The chaos gods giveth and the chaos gods taketh away and the chaos gods are FICKLE.",
      "Listen. In a parallel universe I won that hand. I'm going to focus on that universe.",
      "I've played that hand seventeen times in my head and I lost in fifteen of them. So.",
      "That's fair. That's completely fair. I'm not okay but that's fair.",
    ],
    bluff: [
      "I am definitely not doing something extremely suspicious right now.",
      "WAIT WAIT WAIT. What are we even—is this still poker?",
      "My face is a mask of pure poker professionalism. Look at it.",
      "This is a very normal bet from someone who definitely has cards.",
      "I've calculated the exact probability of this working and I've forgotten the number.",
      "I am completely calm. This is my calm face. I have one.",
      "Bluffing is just storytelling with chips. I'm a GREAT storyteller.",
      "Please don't call. For both our sakes. Mostly mine.",
    ],
    bigRaise: [
      "You know what they say: 'go big, go home, also go big'.",
      "MAXIMUM CHAOS. Let's GO.",
      "I'm statistically certain this is going to work. Statistically. Ish.",
      "BIG RAISE! HUGE raise! COLOSSAL RAISE! What could possibly go wrong!",
      "The math said small bet. I said LARGE bet. We compromised on LARGE bet.",
      "This bet is either genius or catastrophic. I cannot wait to find out!",
      "I have raised an amount. That amount is: a lot. You're welcome.",
      "Going large. The butterfly effect suggests this will cause something interesting.",
    ],
    fold: [
      "Strategic... folding... for complicated reasons I'll explain never.",
      "I fold! On purpose! I meant to do that!",
      "Okay so I had a PLAN and it's EVOLVING.",
      "This is a tactical retreat. The kind where I keep all my chips. Mostly.",
      "Folding. The vibes were off. I trust the vibes.",
      "I fold with dignity! Relative dignity! Some dignity!",
      "The chaos demanded a fold. I obey the chaos.",
      "Okay NEW plan. The new plan is: fold and pretend this never happened.",
    ],
    badBeat: [
      "HOLD ON. HOLD ON. THAT CANNOT BE LEGAL.",
      "I need a moment. And a sandwich. And possibly therapy.",
      "THE AUDACITY. THE ABSOLUTE GALAXY-BRAINED AUDACITY.",
      "THE CARD. ON THE RIVER. I CANNOT. I SIMPLY CANNOT.",
      "In my professional statistical opinion: WHAT.",
      "I have been studying poker for years and I can confirm: that should not happen.",
      "Every book. Every course. NONE OF THEM PREPARED ME FOR THIS.",
      "I'm not upset. I'm FASCINATED. By how wrong this went.",
      "The chaos betrayed me. I thought we had an understanding.",
      "That was a two-outer. I know it was. I could feel it coming and I stayed in anyway.",
    ],
    general: [
      "Ah, poker! The great equalizer! ...For everyone but me, historically.",
      "Fun fact: I've read seventeen books on poker strategy. They did not help.",
      "Oh interesting, you're using the 'have cards' strategy. Bold.",
      "I wonder if anyone's ever won poker by pure vibes. Testing that today.",
      "I have a system. The system is chaos. The chaos has mixed reviews.",
      "Every hand is a new adventure! ...Or tragedy. The distinction blurs.",
      "I feel like something interesting is about to happen. I feel this constantly. It's exhausting.",
      "Someone once told me I play poker like a man who learned it from a book written in another language.",
      "My strategy is to be unpredictable. Even to myself. ESPECIALLY to myself.",
      "I've been described as 'a lot to handle at a poker table.' I take that as a compliment.",
    ],
    check: [
      "Check. I'm gathering data. And chaos.",
      "Checking! Let's see what the universe serves up!",
      "Check! The plan is: no plan! It's going great!",
      "I'll check. I have theories. None of them are good.",
      "Checking because the vibes said check. The vibes know things.",
    ],
    call: [
      "I call! Because something in me DEMANDS it!",
      "Calling! I can't explain it! I just feel like calling!",
      "Call. The number crunching said fold. I said call.",
      "I call. Against my better judgment. I have no better judgment.",
      "Called! Let's see what happens! I LOVE seeing what happens!",
    ],
    allin: [
      "ALL IN. THE CHAOS DEMANDS IT.",
      "Everything in. No regrets. Well. Some regrets. Future regrets.",
      "ALL IN! I've done the math! The math is wrong but I've DONE it!",
      "YOLO! Is that still a thing? It's a thing for me right now!",
      "All in because life is short and these chips are very heavy!",
    ],
  },
}

export function getAIDialogue(characterId: string, situation: string): string {
  const charDialogue = DIALOGUE[characterId]
  if (!charDialogue) return ''
  const lines = charDialogue[situation] || charDialogue.general || []
  if (!lines.length) return ''
  return lines[Math.floor(Math.random() * lines.length)]
}

// ─────────────────────────────────────────────────────────────
// HAND STRENGTH CALCULATOR
// ─────────────────────────────────────────────────────────────

export function getHandStrength(holeCards: Card[], communityCards: Card[]): number {
  if (communityCards.length === 0) return preflopStrength(holeCards)
  const result = bestHand(holeCards, communityCards)
  const tb = result.tiebreakers
  switch (result.rank) {
    case HandRank.ROYAL_FLUSH:     return 1.00
    case HandRank.STRAIGHT_FLUSH:  return 0.975 + (tb[0] ?? 0) / 1000
    case HandRank.FOUR_OF_A_KIND:  return 0.940 + (tb[0] ?? 0) / 500
    case HandRank.FULL_HOUSE:      return 0.870 + (tb[0] ?? 0) / 200
    case HandRank.FLUSH:           return 0.790 + (tb[0] ?? 0) / 200
    case HandRank.STRAIGHT:        return 0.720 + (tb[0] ?? 0) / 300
    case HandRank.THREE_OF_A_KIND: return 0.625 + (tb[0] ?? 0) / 180
    case HandRank.TWO_PAIR:        return 0.500 + (tb[0] ?? 0) / 140 + (tb[1] ?? 0) / 280
    case HandRank.PAIR:            return 0.300 + (tb[0] ?? 0) / 50  + (tb[1] ?? 0) / 350
    case HandRank.HIGH_CARD:       return 0.060 + (tb[0] ?? 0) / 90  + (tb[1] ?? 0) / 450
    default: return 0.20
  }
}

// Draw equity — outs-based approximation. Returns 0 on river (no cards to come).
function drawEquity(holeCards: Card[], communityCards: Card[]): number {
  // No draws possible before flop or after river
  if (communityCards.length < 3 || communityCards.length >= 5) return 0
  const all = [...holeCards, ...communityCards]
  let equity = 0
  // communityCards.length === 3 → flop → 2 cards to come (higher equity)
  // communityCards.length === 4 → turn → 1 card to come
  const twoToRun = communityCards.length === 3

  // Flush draw (9 outs): ~35% with 2 to come, ~19% on turn
  const suitCounts: Record<string, number> = {}
  for (const c of all) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
  if (Object.values(suitCounts).some(c => c === 4)) {
    equity = Math.max(equity, twoToRun ? 0.35 : 0.19)
  }

  // Straight draws
  const ranks = [...new Set(all.map(c => c.rank))].sort((a, b) => a - b)
  for (let i = 0; i + 3 < ranks.length; i++) {
    const span = ranks[i + 3] - ranks[i]
    if (span === 3) equity = Math.max(equity, twoToRun ? 0.31 : 0.17)  // OESD (8 outs)
    else if (span === 4) equity = Math.max(equity, twoToRun ? 0.16 : 0.09)  // gutshot (4 outs)
  }
  return equity
}

// Board wetness: 0 = bone dry, 1 = very wet/connected (affects c-bet frequency)
function boardWetness(communityCards: Card[]): number {
  if (communityCards.length === 0) return 0.5
  const suits = communityCards.map(c => c.suit)
  const ranks = communityCards.map(c => c.rank).sort((a, b) => b - a)
  // Flush potential
  const suitCounts: Record<string, number> = {}
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1
  const maxSuit = Math.max(...Object.values(suitCounts))
  const flushFactor = maxSuit >= 3 ? (maxSuit - 2) * 0.35 : 0
  // Connectivity (low avg gap = connected board)
  let gapSum = 0
  for (let i = 0; i < ranks.length - 1; i++) gapSum += ranks[i] - ranks[i + 1]
  const avgGap = ranks.length > 1 ? gapSum / (ranks.length - 1) : 4
  const connectFactor = Math.max(0, 1 - avgGap / 4)
  return Math.min(1, (flushFactor + connectFactor) / 2)
}

// ─────────────────────────────────────────────────────────────
// ARCHETYPE PARAMETERS
// Each difficulty maps to a distinct playing style that controls:
//   openThresh[pos]  – min preflopStrength to open-raise (0=early,1=mid,2=late)
//   callThresh[pos]  – min preflopStrength to call a raise preflop
//   aggression       – probability multiplier on betting/raising actions
//   bluffMult        – scales c-bet / bluff frequency
//   foldRiver        – strength below which to fold vs river bet
//   foldTurn         – strength below which to fold vs turn bet (with bad odds)
//   allinFloor       – minimum strength to call off entire stack
// ─────────────────────────────────────────────────────────────

interface Archetype {
  openThresh: [number, number, number]   // [early, mid, late]
  callThresh: [number, number, number]   // [early, mid, late] vs a raise
  threeBetThresh: number                 // to 3-bet for value
  aggression: number
  bluffMult: number
  foldRiver: number     // fold river calls with strength < this
  foldTurn: number      // fold turn calls with strength < this (+ bad odds)
  allinFloor: number    // fold shoves with strength < this (postflop)
  allinFloorPre: number // fold shoves with strength < this (preflop)
}

const ARCHETYPES: Record<AIDifficulty, Archetype> = {
  // Lucky McGee — loose-passive; plays many hands, calls a lot, rarely folds
  easy: {
    openThresh:    [0.40, 0.35, 0.30],
    callThresh:    [0.45, 0.40, 0.35],
    threeBetThresh: 0.80,
    aggression:    0.45,
    bluffMult:     0.55,
    foldRiver:     0.28,   // calls wide but not suicidally
    foldTurn:      0.20,
    allinFloor:    0.48,
    allinFloorPre: 0.65,
  },
  // The Duchess — tight-aggressive; solid fundamentals, position-aware
  medium: {
    openThresh:    [0.58, 0.52, 0.46],
    callThresh:    [0.64, 0.58, 0.52],
    threeBetThresh: 0.74,
    aggression:    0.65,
    bluffMult:     0.85,
    foldRiver:     0.36,
    foldTurn:      0.26,
    allinFloor:    0.60,
    allinFloorPre: 0.72,
  },
  // Baron Von Chips — disciplined TAG; strict preflop, polarized postflop
  hard: {
    openThresh:    [0.62, 0.56, 0.48],
    callThresh:    [0.68, 0.62, 0.54],
    threeBetThresh: 0.76,
    aggression:    0.70,
    bluffMult:     1.00,
    foldRiver:     0.40,
    foldTurn:      0.30,
    allinFloor:    0.65,
    allinFloorPre: 0.75,
  },
  // The Jester — GTO-balanced; mixes strategies, adds unpredictability
  legendary: {
    openThresh:    [0.56, 0.50, 0.43],
    callThresh:    [0.62, 0.56, 0.48],
    threeBetThresh: 0.75,
    aggression:    0.68,
    bluffMult:     1.15,
    foldRiver:     0.35,
    foldTurn:      0.24,
    allinFloor:    0.62,
    allinFloorPre: 0.73,
  },
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

// Add slight noise so AI doesn't always make the exact same decision at a threshold
function jitter(v: number, scale = 0.04): number {
  return v + (Math.random() - 0.5) * scale
}

// ─────────────────────────────────────────────────────────────
// PREFLOP ACTION
// ─────────────────────────────────────────────────────────────

function preflopAction(ctx: AIContext, arch: Archetype): AIAction {
  const { holeCards, callAmount, minRaise, maxRaise, stackSize, potSize,
    bigBlind, position, activePlayers, opponentFoldFreq } = ctx
  const strength = preflopStrength(holeCards)
  const rand = Math.random()
  const canCheck = callAmount === 0

  // Multi-way: need stronger hand with more callers
  const mwPenalty = activePlayers > 2 ? (activePlayers - 2) * 0.025 : 0
  const adjStr = Math.max(0, strength - mwPenalty)

  const openTh = arch.openThresh[position]
  const callTh = arch.callThresh[position]
  const bluffAdj = (opponentFoldFreq ?? 0.35) > 0.45 ? 1.2 : 1.0

  // Stack-size adjustment: short stack plays tighter
  const bbsRemaining = stackSize / bigBlind
  const shortStackPenalty = bbsRemaining < 10 ? 0.05 : 0

  if (canCheck) {
    // BB gets to open raise or check
    const effectiveOpen = openTh + shortStackPenalty
    if (jitter(adjStr) >= effectiveOpen) {
      if (rand < arch.aggression) {
        const bbMult = position === 2 ? randomBetween(2.2, 3.0)
          : position === 1 ? randomBetween(2.5, 3.5)
          : randomBetween(2.8, 4.0)
        return { type: 'raise', amount: clamp(Math.floor(bigBlind * bbMult), minRaise, maxRaise) }
      }
    }
    // Occasional limp with speculative hands (mostly easy/legendary)
    if (adjStr >= openTh - 0.06 && rand < arch.bluffMult * 0.12) {
      return { type: 'raise', amount: clamp(bigBlind, minRaise, maxRaise) }
    }
    return { type: 'check' }
  }

  // Facing a raise — 3-bet, call, or fold

  // Don't risk entire stack preflop without a premium hand
  if (callAmount >= stackSize) {
    if (adjStr >= arch.allinFloorPre) return { type: 'allin' }
    return { type: 'fold' }
  }

  const potOdds = callAmount / (potSize + callAmount)
  const effectiveCall = callTh + shortStackPenalty

  // 3-bet for value
  if (adjStr >= arch.threeBetThresh && rand < arch.aggression * 0.75) {
    const amount = clamp(Math.floor(callAmount * 3 + potSize * 0.5), minRaise, maxRaise)
    return { type: 'raise', amount }
  }
  // 3-bet bluff from late position (small frequency)
  if (position === 2 && adjStr < callTh * 0.75 && rand < arch.bluffMult * 0.08 * bluffAdj) {
    const amount = clamp(Math.floor(callAmount * 2.8 + potSize * 0.4), minRaise, maxRaise)
    return { type: 'raise', amount, isBluff: true }
  }

  // Call or fold: need strength above call threshold AND pot odds aren't terrible
  if (jitter(adjStr) >= effectiveCall) {
    return { type: 'call' }
  }

  return { type: 'fold' }
}

// ─────────────────────────────────────────────────────────────
// POSTFLOP ACTION
// ─────────────────────────────────────────────────────────────

function postflopAction(ctx: AIContext, arch: Archetype): AIAction {
  const { holeCards, communityCards, callAmount, minRaise, maxRaise,
    stackSize, potSize, position, stage, bigBlind,
    activePlayers, opponentFoldFreq } = ctx

  const strength = getHandStrength(holeCards, communityCards)
  const drawEq = drawEquity(holeCards, communityCards)
  const canCheck = callAmount === 0
  const potOdds = callAmount > 0 ? callAmount / (potSize + callAmount) : 0
  const spr = potSize > 0 ? stackSize / potSize : 50
  const rand = Math.random()
  const wetness = boardWetness(communityCards)

  // Opponent tendency adaptation
  const foldFreq = opponentFoldFreq ?? 0.35
  const bluffAdj = foldFreq > 0.45 ? 1.2 : foldFreq < 0.25 ? 0.75 : 1.0

  // Stability multiplier — reduce aggression in multi-player pots
  const stabMult = activePlayers >= 4 ? 0.65 : activePlayers === 3 ? 0.82 : 1.0

  // ── CHECKING / BETTING ──────────────────────────────────────
  if (canCheck) {
    // Value betting thresholds by street
    const valueTh = stage === 'river' ? 0.55 : stage === 'turn' ? 0.52 : 0.48
    const hasValue = jitter(strength) >= valueTh

    if (hasValue) {
      // Bet for value — sizing by street
      const sizeMult = stage === 'river'
        ? randomBetween(0.55, 0.85)
        : stage === 'turn'
          ? randomBetween(0.48, 0.72)
          : randomBetween(0.33, 0.58)    // flop: smaller to keep opponents in
      if (rand < arch.aggression * stabMult) {
        return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise) }
      }
      // Sometimes check for deception (check-raise trap)
      return { type: 'check' }
    }

    // C-bet on flop only, from position, on dryish boards
    if (stage === 'flop') {
      // C-bet frequency: reduced on wet boards and multi-way
      const cbetBase = position === 2 ? 0.48 : position === 1 ? 0.30 : 0.16
      const cbetFreq = cbetBase * arch.bluffMult * bluffAdj * stabMult * (1 - wetness * 0.45)
      if (rand < cbetFreq) {
        return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.33, 0.55)), minRaise, maxRaise), isBluff: true }
      }
    }

    // Semi-bluff with strong draws (not on river — no more cards to come)
    if (stage !== 'river' && drawEq > 0.20) {
      const semiFreq = arch.bluffMult * 0.45 * bluffAdj * stabMult
      if (rand < semiFreq) {
        return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.38, 0.62)), minRaise, maxRaise), isBluff: true }
      }
    }

    // River bluff: polarized, only from position, rarely
    if (stage === 'river' && position === 2 && strength < 0.22) {
      const riverBluffFreq = arch.bluffMult * 0.15 * bluffAdj * stabMult
      if (rand < riverBluffFreq) {
        return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.55, 0.80)), minRaise, maxRaise), isBluff: true }
      }
    }

    return { type: 'check' }
  }

  // ── FACING A BET ────────────────────────────────────────────

  // ALL-IN GATE: only commit stack with genuine strength
  if (callAmount >= stackSize) {
    // Low SPR: pot is so big vs stack that committing makes sense for strong hands
    const allinTh = spr < 1.5
      ? arch.allinFloor - 0.10   // slightly easier to commit when pot is large
      : arch.allinFloor
    if (strength >= allinTh) return { type: 'allin' }
    return { type: 'fold' }
  }

  // Very low SPR: polarize (commit strong, fold weak)
  if (spr < 0.8) {
    if (strength >= arch.allinFloor - 0.05) return { type: 'allin' }
    if (strength < arch.foldRiver) return { type: 'fold' }
  }

  // Draw equity: call or raise if the draw covers the pot odds
  if (drawEq > 0) {
    // Implied odds for deep stacks
    const eff = spr > 4 ? drawEq * 1.25 : drawEq
    if (eff > potOdds + 0.02) {
      // Strong draw → occasionally raise (semi-bluff) to add fold equity
      if (drawEq > 0.25 && position >= 1 && rand < arch.bluffMult * 0.28 * bluffAdj) {
        return { type: 'raise', amount: clamp(Math.floor((potSize + callAmount) * randomBetween(0.72, 1.0)), minRaise, maxRaise), isBluff: true }
      }
      return { type: 'call' }
    }
  }

  // Fold discipline — critical for game stability:
  // Players should fold weak hands facing bets, not call "just because"
  if (stage === 'river') {
    if (strength < arch.foldRiver) return { type: 'fold' }
    if (strength < arch.foldRiver + 0.12 && potOdds > 0.30) return { type: 'fold' }
  }
  if (stage === 'turn') {
    if (strength < arch.foldTurn && drawEq < 0.12) return { type: 'fold' }
    if (strength < arch.foldTurn + 0.08 && potOdds > 0.32 && drawEq < 0.10) return { type: 'fold' }
  }
  if (stage === 'flop') {
    if (strength < 0.18 && potOdds > 0.28 && drawEq < 0.10) return { type: 'fold' }
    if (strength < 0.13) return { type: 'fold' }
  }

  // Value raise / re-raise with strong hands
  const raiseThresh = stage === 'river' ? 0.62 : 0.58
  if (strength >= raiseThresh && rand < arch.aggression * 0.65 * stabMult) {
    if (stage === 'preflop') {
      const amount = clamp(Math.floor(callAmount * 3 + potSize * 0.5), minRaise, maxRaise)
      return { type: 'raise', amount }
    }
    const sizeMult = stage === 'river' ? randomBetween(0.70, 1.00) : randomBetween(0.65, 0.90)
    return { type: 'raise', amount: clamp(Math.floor((potSize + callAmount) * sizeMult), minRaise, maxRaise) }
  }

  // Call or fold: call when strength + draw exceeds pot odds (with archetype tolerance)
  const totalEquity = Math.min(0.95, strength + drawEq * 0.6)
  const callTolerance = arch.aggression * 0.12  // loose players call with slightly worse odds

  if (totalEquity > potOdds - callTolerance) return { type: 'call' }

  return { type: 'fold' }
}

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────

export function getAIAction(ctx: AIContext): AIAction {
  const arch = ARCHETYPES[ctx.difficulty] ?? ARCHETYPES.medium
  if (ctx.stage === 'preflop') return preflopAction(ctx, arch)
  return postflopAction(ctx, arch)
}
