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
// HAND STRENGTH CALCULATOR (post-flop)
// ─────────────────────────────────────────────────────────────

export function getHandStrength(holeCards: Card[], communityCards: Card[]): number {
  if (communityCards.length === 0) {
    return preflopStrength(holeCards)
  }
  const result = bestHand(holeCards, communityCards)
  const tb = result.tiebreakers
  // Normalize hand rank to 0-1 with finer granularity using tiebreakers
  switch (result.rank) {
    case HandRank.ROYAL_FLUSH:     return 1.00
    case HandRank.STRAIGHT_FLUSH:  return 0.975 + (tb[0] ?? 0) / 1000
    case HandRank.FOUR_OF_A_KIND:  return 0.940 + (tb[0] ?? 0) / 500
    case HandRank.FULL_HOUSE:      return 0.870 + (tb[0] ?? 0) / 200   // 0.88-0.94
    case HandRank.FLUSH:           return 0.790 + (tb[0] ?? 0) / 200   // 0.80-0.86
    case HandRank.STRAIGHT:        return 0.720 + (tb[0] ?? 0) / 300   // 0.72-0.77
    case HandRank.THREE_OF_A_KIND: return 0.625 + (tb[0] ?? 0) / 180   // 0.63-0.70
    case HandRank.TWO_PAIR:        return 0.500 + (tb[0] ?? 0) / 140 + (tb[1] ?? 0) / 280  // 0.52-0.65
    case HandRank.PAIR:            return 0.300 + (tb[0] ?? 0) / 50  + (tb[1] ?? 0) / 350  // 0.34-0.62
    case HandRank.HIGH_CARD:       return 0.060 + (tb[0] ?? 0) / 90  + (tb[1] ?? 0) / 450  // 0.09-0.26
    default: return 0.20
  }
}

// Draw equity: returns approximate winning equity from the draw (0 = no draw)
function drawEquity(holeCards: Card[], communityCards: Card[]): number {
  if (communityCards.length < 3) return 0
  const all = [...holeCards, ...communityCards]
  let equity = 0
  const onTurn = communityCards.length === 3  // 1 card to come after this vs 2

  // Flush draw: 4 of same suit
  const suitCounts: Record<string, number> = {}
  for (const c of all) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
  if (Object.values(suitCounts).some(c => c === 4)) {
    equity = Math.max(equity, onTurn ? 0.35 : 0.19)
  }

  const ranks = [...new Set(all.map(c => c.rank))].sort((a, b) => a - b)
  for (let i = 0; i + 3 < ranks.length; i++) {
    const span = ranks[i + 3] - ranks[i]
    if (span === 3) {
      // Open-ended straight draw
      equity = Math.max(equity, onTurn ? 0.31 : 0.17)
    } else if (span === 4) {
      // Gutshot straight draw
      equity = Math.max(equity, onTurn ? 0.16 : 0.09)
    }
  }
  return equity
}

// ─────────────────────────────────────────────────────────────
// AI DECISION ENGINE
// ─────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

export function getAIAction(ctx: AIContext): AIAction {
  const { holeCards, communityCards, potSize, callAmount, minRaise, maxRaise,
    stackSize, position, stage, difficulty, activePlayers, bigBlind } = ctx

  const strength = getHandStrength(holeCards, communityCards)
  const drawEq = drawEquity(holeCards, communityCards)
  const canCheck = callAmount === 0
  const potOdds = callAmount > 0 ? callAmount / (potSize + callAmount) : 0
  // Use real total pot for SPR — avoids triggering all-in on under-counted pot
  const spr = potSize > 0 ? stackSize / potSize : 50

  // Multi-way penalty: need stronger hands in multi-way pots
  const multiWayPenalty = activePlayers > 2 ? (activePlayers - 2) * 0.04 : 0
  const adjustedStrength = Math.max(0, strength - multiWayPenalty)

  // Adapt to opponent tendencies: if opponents fold a lot, bluff more; if they call a lot, value-bet tighter
  const foldFreq = ctx.opponentFoldFreq ?? 0.35
  const bluffAdjust = foldFreq > 0.45 ? 1.2 : foldFreq < 0.25 ? 0.8 : 1.0

  switch (difficulty) {
    case 'easy':
      return easyAI(adjustedStrength, drawEq, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, bigBlind, stage)
    case 'medium':
      return mediumAI(adjustedStrength, drawEq, potOdds, spr, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage, bigBlind)
    case 'hard':
      return hardAI(adjustedStrength, drawEq, potOdds, spr, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage, bigBlind, bluffAdjust)
    case 'legendary':
      return legendaryAI(adjustedStrength, drawEq, potOdds, spr, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage, bigBlind, bluffAdjust)
    default:
      return mediumAI(adjustedStrength, drawEq, potOdds, spr, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage, bigBlind)
  }
}

// ─── EASY: Lucky McGee ─────────────────────────────────────────
// Calls way too much, raises randomly, gets excited by anything decent
function easyAI(
  strength: number, drawEq: number, canCheck: boolean, callAmount: number,
  minRaise: number, maxRaise: number, stackSize: number, potSize: number,
  bigBlind: number, stage: string,
): AIAction {
  const rand = Math.random()

  if (canCheck) {
    // Raise fairly often with decent hands (doesn't know pot sizing)
    if (strength > 0.60 && rand < 0.55) {
      // Preflop: open-raise 2.5-4x BB — Lucky is sloppy with sizing
      const baseAmount = stage === 'preflop'
        ? bigBlind * randomBetween(2.2, 4.5)
        : potSize * randomBetween(0.4, 0.9)
      return { type: 'raise', amount: clamp(Math.floor(baseAmount), minRaise, maxRaise) }
    }
    // Random donk bet ~12% of the time regardless of hand
    if (rand < 0.12) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.25, 0.6)), minRaise, maxRaise) }
    }
    return { type: 'check' }
  }

  // Lucky barely folds — only absolute air under real pressure
  if (strength < 0.13 && drawEq < 0.08 && rand < 0.55) return { type: 'fold' }
  if (strength < 0.08) return { type: 'fold' }

  // Gets excited and raises with strong hands
  if (strength > 0.72 && rand < 0.40) {
    const baseAmount = stage === 'preflop'
      ? callAmount * randomBetween(2.5, 4.0)
      : potSize * randomBetween(0.5, 1.0)
    return { type: 'raise', amount: clamp(Math.floor(baseAmount), minRaise, maxRaise) }
  }

  // Only go all-in if it would cost entire stack to call — Lucky doesn't fold
  if (callAmount >= stackSize) return { type: 'allin' }
  return { type: 'call' }
}

// ─── MEDIUM: The Duchess ───────────────────────────────────────
// Solid fundamentals, good pot odds, position-aware, infrequent bluffs
function mediumAI(
  strength: number, drawEq: number, potOdds: number, spr: number,
  canCheck: boolean, callAmount: number, minRaise: number, maxRaise: number,
  stackSize: number, potSize: number, position: number, stage: string,
  bigBlind: number,
): AIAction {
  const posBonus = position * 0.06
  const eff = clamp(strength + posBonus, 0, 1)
  const rand = Math.random()

  // SPR adjustments: short-stack → polarize; deep → more speculative
  const sprAdjusted = spr < 3 ? eff + 0.05 : spr > 12 ? eff - 0.03 : eff

  if (canCheck) {
    if (sprAdjusted > 0.60) {
      // Preflop: standard open sizing (2.2-3x BB from late, 2.5-3.5x from early)
      if (stage === 'preflop') {
        const bbMult = position === 2 ? randomBetween(2.2, 3.0) : randomBetween(2.5, 3.5)
        return { type: 'raise', amount: clamp(Math.floor(bigBlind * bbMult), minRaise, maxRaise) }
      }
      // Post-flop: size 50-75% pot (Duchess is disciplined, no overbets)
      const sizeMult = stage === 'river' ? randomBetween(0.55, 0.80) : randomBetween(0.50, 0.75)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise) }
    }
    // Semi-bluff with strong draws from position
    if (drawEq > 0.20 && position === 2 && rand < 0.30) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * 0.60), minRaise, maxRaise), isBluff: true }
    }
    // Late-position steal ~15%
    if (position === 2 && stage !== 'river' && rand < 0.15) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * 0.55), minRaise, maxRaise), isBluff: true }
    }
    return { type: 'check' }
  }

  // Pot odds + draw: call when draw equity covers the odds
  if (drawEq > potOdds + 0.04 && rand < 0.80) {
    if (callAmount >= stackSize) return { type: 'allin' }
    return { type: 'call' }
  }

  // Fold weak hands when pot odds don't justify
  if (sprAdjusted < 0.28 && potOdds > 0.22) return { type: 'fold' }
  if (sprAdjusted < 0.20) return { type: 'fold' }

  // Low SPR commit: only all-in with genuinely strong hands and very committed pot
  // Threshold tightened: spr < 1.2 (was 2.5) and strength > 0.72 (was 0.55)
  if (spr < 1.2 && sprAdjusted > 0.72) return { type: 'allin' }

  // Value raise: preflop 3-bet sizing, postflop pot-based
  if (sprAdjusted > 0.72) {
    if (stage === 'preflop') {
      // 3-bet sizing: ~3x the open raise
      const amount = clamp(Math.floor(callAmount * 3 + potSize * 0.5), minRaise, maxRaise)
      return { type: 'raise', amount }
    }
    const sizeMult = stage === 'river' ? randomBetween(0.65, 0.90) : randomBetween(0.60, 0.85)
    return { type: 'raise', amount: clamp(Math.floor((potSize + callAmount) * sizeMult), minRaise, maxRaise) }
  }

  // Semi-bluff raise with draws in position
  if (drawEq > 0.25 && position >= 1 && rand < 0.28) {
    return { type: 'raise', amount: clamp(Math.floor(potSize * 0.60), minRaise, maxRaise), isBluff: true }
  }

  if (callAmount >= stackSize) return { type: 'allin' }
  return { type: 'call' }
}

// ─── HARD: Baron Von Chips ─────────────────────────────────────
// Position play, heavy c-betting, polarized 3-bets, SPR-aware commitment
function hardAI(
  strength: number, drawEq: number, potOdds: number, spr: number,
  canCheck: boolean, callAmount: number, minRaise: number, maxRaise: number,
  stackSize: number, potSize: number, position: number, stage: string,
  bigBlind: number, bluffAdjust = 1.0,
): AIAction {
  const posBonus = position * 0.09
  const eff = clamp(strength + posBonus, 0, 1)
  const rand = Math.random()

  // C-bet frequencies by position and street (Baron is aggressive in position)
  const cbetFreq = position === 2 ? 0.75 : position === 1 ? 0.52 : 0.32

  if (canCheck) {
    if (eff > 0.58) {
      // Preflop: precise open-raise sizing (2.5-4x BB based on position)
      if (stage === 'preflop') {
        const bbMult = position === 2 ? randomBetween(2.5, 3.5) : randomBetween(3.0, 4.0)
        return { type: 'raise', amount: clamp(Math.floor(bigBlind * bbMult), minRaise, maxRaise) }
      }
      // Post-flop: size up on later streets for value extraction
      const sizeMult = stage === 'river' ? randomBetween(0.65, 0.95)
        : stage === 'turn' ? randomBetween(0.55, 0.80)
        : randomBetween(0.45, 0.70)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise) }
    }
    // C-bet probe (semi-bluff)
    if (rand < cbetFreq * bluffAdjust && stage !== 'river') {
      const isBluffBet = eff < 0.40
      const sizeMult = randomBetween(0.40, 0.65)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise), isBluff: isBluffBet }
    }
    // River bluff with polarized range
    if (stage === 'river' && eff < 0.30 && position === 2 && rand < 0.32 * bluffAdjust) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.60, 0.90)), minRaise, maxRaise), isBluff: true }
    }
    return { type: 'check' }
  }

  // Draw semi-bluff call/raise
  if (drawEq > potOdds + 0.06) {
    if (drawEq > 0.28 && position === 2 && rand < 0.40) {
      return { type: 'raise', amount: clamp(Math.floor((potSize + callAmount) * 0.85), minRaise, maxRaise), isBluff: true }
    }
    if (callAmount < stackSize) return { type: 'call' }
  }

  // Fold weak hands without sufficient odds
  if (eff < 0.22 && potOdds > 0.20 && drawEq < 0.15) return { type: 'fold' }
  if (eff < 0.16) return { type: 'fold' }

  // Low SPR polarization — tightened: was spr<2.0, now spr<1.0; strength raised from 0.50 to 0.62
  if (spr < 1.0) {
    if (eff > 0.62) return { type: 'allin' }
    if (eff < 0.40) return { type: 'fold' }
  }

  // 3-bet / 4-bet with strong hands
  if (eff > 0.75) {
    if (rand < 0.72) {
      // Preflop: standard 3-bet sizing (3x + dead money)
      if (stage === 'preflop') {
        const amount = clamp(Math.floor(callAmount * 3 + potSize * 0.5), minRaise, maxRaise)
        return { type: 'raise', amount }
      }
      const amount = clamp(Math.floor((potSize + callAmount * 2.5) * 0.85), minRaise, maxRaise)
      return { type: 'raise', amount }
    }
    // Commit with very strong hand facing large bet
    if (callAmount > stackSize * 0.55) return { type: 'allin' }
  }

  // Light 3-bet bluff from button preflop
  if (position === 2 && stage === 'preflop' && eff < 0.30 && rand < 0.15 * bluffAdjust) {
    const amount = clamp(Math.floor(callAmount * 2.8 + potSize * 0.4), minRaise, maxRaise)
    return { type: 'raise', amount, isBluff: true }
  }

  if (callAmount >= stackSize) return { type: 'allin' }
  return { type: 'call' }
}

// ─── LEGENDARY: The Jester ────────────────────────────────────
// Near-GTO mixed strategies, balanced value/bluff ratios, polarized river play
function legendaryAI(
  strength: number, drawEq: number, potOdds: number, spr: number,
  canCheck: boolean, callAmount: number, minRaise: number, maxRaise: number,
  stackSize: number, potSize: number, position: number, stage: string,
  bigBlind: number, bluffAdjust = 1.0,
): AIAction {
  const rand = Math.random()
  const posBonus = position * 0.10
  const eff = clamp(strength + posBonus, 0, 1)

  // GTO bluff frequency varies by street (balanced ranges)
  const bluffFreq = (stage === 'river' ? 0.28 : stage === 'turn' ? 0.33 : 0.38) * bluffAdjust

  // Value threshold
  const valueThresh = stage === 'river' ? 0.58 : 0.55

  if (canCheck) {
    if (eff > valueThresh) {
      if (stage === 'preflop') {
        // GTO-sized opens: 2.5x BTN, 3x MP, 3.5x UTG (tighter from early)
        const bbMult = position === 2 ? randomBetween(2.3, 3.0) : position === 1 ? randomBetween(2.8, 3.5) : randomBetween(3.0, 4.0)
        return { type: 'raise', amount: clamp(Math.floor(bigBlind * bbMult), minRaise, maxRaise) }
      }
      // Post-flop: balanced sizing — smaller on flop to induce, larger on river
      const sizeMult = stage === 'river' ? randomBetween(0.65, 1.05)
        : stage === 'turn' ? randomBetween(0.50, 0.80)
        : randomBetween(0.28, 0.60)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise) }
    }
    // Polarized bluff with air (GTO balance)
    if (eff < 0.28 && rand < bluffFreq) {
      const sizeMult = stage === 'river' ? randomBetween(0.70, 1.0) : randomBetween(0.45, 0.80)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise), isBluff: true }
    }
    // Semi-bluff with strong draws
    if (drawEq > 0.18 && rand < 0.60 && stage !== 'river') {
      const sizeMult = drawEq > 0.28 ? randomBetween(0.55, 0.85) : randomBetween(0.35, 0.60)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise), isBluff: true }
    }
    return { type: 'check' }
  }

  // Call with draws when getting correct odds (include implied odds for deep stacks)
  const impliedOdds = spr > 5 ? drawEq * 1.3 : drawEq
  if (impliedOdds > potOdds + 0.02 && rand < 0.85) {
    if (drawEq > 0.22 && rand < 0.35) {
      const amount = clamp(Math.floor((potSize + callAmount) * randomBetween(0.75, 1.05)), minRaise, maxRaise)
      return { type: 'raise', amount, isBluff: true }
    }
    if (callAmount < stackSize) return { type: 'call' }
  }

  // Fold weak air when facing bets (balanced — not always fold)
  if (eff < 0.16 && potOdds > 0.22) {
    if (rand > bluffFreq) return { type: 'fold' }
  }
  if (eff < 0.10) return { type: 'fold' }

  // Low SPR: commit or fold — tightened from spr<1.8/eff>0.48 to spr<1.0/eff>0.60
  if (spr < 1.0) {
    if (eff > 0.60) return { type: 'allin' }
    if (eff < 0.38 && drawEq < 0.20) return { type: 'fold' }
  }

  // Value 3-bet / 4-bet with top of range
  if (eff > 0.78) {
    if (stage === 'preflop') {
      // GTO 3-bet: roughly 3x the raise + dead money
      const amount = clamp(Math.floor(callAmount * 3 + potSize * 0.5), minRaise, maxRaise)
      if (rand < 0.72) return { type: 'raise', amount }
    } else {
      const sizeMult = stage === 'river' ? randomBetween(0.90, 1.40) : randomBetween(0.80, 1.15)
      const amount = clamp(Math.floor((callAmount + potSize) * sizeMult), minRaise, maxRaise)
      if (rand < 0.68) return { type: 'raise', amount }
    }
    if (callAmount > stackSize * 0.70) return { type: 'allin' }
  }

  // Bluff-raise with bottom of range (polarized 3-bet)
  if (eff < 0.26 && rand < bluffFreq * 0.55 && stage !== 'river') {
    if (stage === 'preflop') {
      const amount = clamp(Math.floor(callAmount * 2.8 + potSize * 0.4), minRaise, maxRaise)
      return { type: 'raise', amount, isBluff: true }
    }
    const amount = clamp(Math.floor(potSize * randomBetween(0.55, 0.85)), minRaise, maxRaise)
    return { type: 'raise', amount, isBluff: true }
  }

  if (callAmount >= stackSize) return { type: 'allin' }
  return { type: 'call' }
}
