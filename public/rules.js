// ---------- Rules ----------
const RULES = {
  party: [
    { h: "Party Mode", p: ["Regular golf with a challenge card on every hole. Points win, not strokes, so one bad hole won't sink you. It'll just follow you around in the chat."] },
    { h: "Hole points", p: ["Every hole, you get 1 point for finishing it, plus 1 point for each player who took more strokes than you. Ties don't beat each other."],
      list: ["Example with four players who shoot 4, 5, 5 and 7: the 4 gets 4 points, both 5s get 2, and the 7 gets 1.",
             "In a tournament, you're compared against everyone in the round, not just your group.",
             "11+ counts as 11."] },
    { h: "Challenges", p: ["The wheel picks one challenge per hole. Bonus challenges are worth +1 to +3. Curses cost whoever gets stuck with them 1 point."],
      list: ["One winner per group, per hole, except club challenges.",
             "The party leader picks the winner, or the group's co-leader in a tournament.",
             "Club challenges (putter, driver or irons only) are optional. Play the whole hole, tee to cup, with only that club and you get +2. Anyone can try, so there can be more than one winner.",
             "Ties go to whoever's picking. Lobbying is encouraged."] },
    { h: "The deck", deck: true },
    { h: "Winning", p: ["Most total points (hole points plus challenges) wins. The top three get the podium. With 4 or more players, last place gets a special mention."] },
  ],
  stroke: [
    { h: "Stroke Play", p: ["Regular golf rules, lowkey boring but so is your personality."] },
    { h: "Scoring", list: ["Every stroke counts. Lowest total wins.",
                           "No challenges, no curses, no mercy.",
                           "Mid-round, the leaderboard ranks by average strokes per hole, so nobody gets ahead just by being behind.",
                           "11+ counts as 11."] },
  ],
  wolf: [
    { h: "Wolf", p: ["Groups of 3 or 4. Every hole, one player is the Wolf and decides who they trust. Usually nobody."] },
    { h: "The rotation", list: ["The Wolf rotates every hole and always tees off last. The app shows the tee order.",
                                "In groups of 4, on holes 17 and 18, whoever's in last place in the group is the Wolf. One last shot at redemption."] },
    { h: "Picking a partner", list: ["After each drive, the Wolf can claim that player as a partner. Pass on someone and they're gone for the hole.",
                                     "Don't like anyone? Go Lone Wolf after all the drives: you against the other three.",
                                     "Feeling bold? Declare Blind Wolf before anyone tees off.",
                                     "The Wolf, the party leader or the group's co-leader taps the pick in the app."] },
    { h: "Scoring (groups of 4)", p: ["Each team counts its best ball, the lowest single score on the team (after strokes if handicaps are on)."],
      list: ["Wolf and partner win: 2 points each", "The other two win: 3 points each",
             "Lone Wolf wins: 4 points", "Lone Wolf loses: 1 point each to the other three",
             "Blind Wolf wins: 6 points", "Blind Wolf loses: 2 points each to the other three",
             "Tie: nobody scores and the hole pushes.", "No pick before everyone scores? The hole pushes too."] },
    { h: "Playing with 3", p: ["Same idea, with one twist: picking a partner makes it 2 vs 1, so the Wolf is really choosing who plays solo. The Wolf rotates straight through all 18 holes, 6 turns each."],
      list: ["Wolf and partner win: 1 point each", "The solo player beats the pair: 3 points",
             "Lone Wolf wins: 4 points", "Lone Wolf loses: 1 point each to the other two",
             "Blind Wolf wins: 6 points", "Blind Wolf loses: 2 points each to the other two",
             "Tie: push, no points."] },
    { h: "Winning", p: ["Most points after 18 wins. There\'s no challenge wheel in Wolf. The drama writes itself."] },
  ],
  skins: [
    { h: "Skins", p: ["Every hole is worth one skin. Win the hole outright, with the lowest score all by yourself, and it's yours. Unlike Match Play, a tie doesn't just cancel out. The skin rolls over and stacks onto the next hole, so one hole can be worth a pile."] },
    { h: "Carryovers", list: [
      "Tie for the lowest score and nobody wins. The skin carries over, so the next hole is worth 2. Then 3. Then things get tense.",
      "Whoever finally wins a hole alone takes every skin riding on it.",
      "Skins still riding after 18 go unclaimed.",
      "The hole card and the hole reveal show how many skins are on the line."] },
    { h: "Fine print", list: [
      "In a tournament, everyone in the round plays for the same skins, not just your group. A hole is decided once everyone has scored it.",
      "With handicaps on, skins are decided on net scores.",
      "Most skins wins."] },
  ],
  match: [
    { h: "Match Play", p: ["Every hole is its own mini match. The lowest score in your group, all by itself, wins the hole and a point. Tie for low and the hole is halved. Nobody scores. Unlike Skins, nothing carries over. Every hole is worth exactly 1, so steady beats streaky."] },
    { h: "Keeping score", list: [
      "With 2 players it's classic match play: \"Mike 2 UP\" means Mike has won 2 more holes. \"All square\" means it's tied.",
      "Dormie means you're up by exactly the number of holes left. The other side has to win every hole just to tie.",
      "\"Wins 3&2\" means 3 up with 2 to play. The app keeps scoring every hole anyway.",
      "With 3 or more, the app shows who's leading and by how many.",
      "Once the leader can't be caught, the app calls it, but every hole still counts toward holes won. Keep playing."] },
    { h: "Fine print", list: [
      "In a tournament, each group plays its own match, but everyone lands on one leaderboard by holes won.",
      "With handicaps on, each hole is decided on net scores.",
      "Tied after 18? The match is halved."] },
  ],
  caddy: [
    { h: "Cart Caddy", p: ["Golfers golf. Caddies call the shots, literally. Every hole, each caddy gets a prediction card for their golfer and scores Caddy Points for getting it right."] },
    { h: "The cards", list: [
      "Club Call: guess the club your golfer hits off the tee.",
      "Shot Prediction: fairway, rough, bunker, water or green.",
      "Distance Guess: how far the tee shot goes, in yards.",
      "Disaster Prediction: will they hit something they absolutely shouldn't?",
      "Trash Talk: write your own prediction for the hole."] },
    { h: "Caddy Points", list: [
      "Club, shot, disaster or trash talk comes true: +3",
      "Distance within 10 yards: +3",
      "Distance within 25 yards: +1",
      "Wrong call: 0",
      "Granting a mulligan: -2. One per golfer on each 9."] },
    { h: "How it works", list: [
      "The caddy locks in the call before the tee shot. No changing it after.",
      "After the shot, the golfer (or the party leader) taps what actually happened. Honor system.",
      "Golfers enter strokes like normal. Caddies don't have a score, so holes move on once the golfers are done.",
      "With 3 players, one caddy can work for two golfers, or two caddies can fight over one golfer."] },
    { h: "Winning", p: ["Caddies are ranked by Caddy Points, golfers by strokes. At the end, somebody's crowned Best Caddy. Somebody else gets Worst Caddy."] },
  ],
  bbb: [
    { h: "Bingo Bango Bongo", p: ["Three points up for grabs on every hole, one point each. It's about who gets there first, not who shoots the lowest, so anyone can steal points."] },
    { h: "The three points", list: [
      "Bingo: first ball on the green.",
      "Bango: closest to the pin once everyone's ball is on the green.",
      "Bongo: first ball in the cup."] },
    { h: "How it works", list: [
      "Play in normal golf order: whoever's furthest from the hole hits first. That's what keeps it fair.",
      "The party leader (or the group's co-leader) taps who won each point.",
      "Everyone still enters their strokes. They show up in parentheses on the leaderboard for bragging rights.",
      "In a tournament, each group plays for its own three points per hole.",
      "Handicaps don't apply. The format already levels the field."] },
    { h: "Winning", p: ["Most points after 18 wins. The results screen breaks down everyone's Bingos, Bangos and Bongos."] },
  ],
  bestball: [
    { h: "Best Ball", p: ["2 vs 2. Everyone plays their own ball, but only the best score on each team counts. One of you just has to show up on each hole."] },
    { h: "Scoring", list: [
      "Each hole, compare the two teams' best scores.",
      "Lower best score wins the hole, and each player on that team gets 1 point.",
      "Same best score? Tie, no points.",
      "With handicaps on, the best net score counts."] },
    { h: "Setup", list: [
      "Needs 4 players, or bigger groups split into foursomes.",
      "The party leader sets Team A and Team B in the lobby, or taps Randomize teams.",
      "Every group must be split 2 and 2 before the game starts."] },
    { h: "Winning", p: ["Most points after 18 wins. Teammates usually tie, so the tiebreaker is who carried who. Settle that in the chat."] },
  ],
  vegas: [
    { h: "Vegas", p: ["2 vs 2, with math. Each hole, your team's two scores get mashed together into one number, low score first. A 4 and a 5 makes 45."] },
    { h: "Scoring", list: [
      "Lower team number wins the hole.",
      "Each player on the winning team gets the difference as points. 45 vs 57 is +12 each.",
      "Same number? Push, no points.",
      "The big-number penalty: if anyone on a team scores 10 or more, the high score goes first. A 4 and an 11 makes 114. Big swings live here.",
      "With handicaps on, each score is rounded to the nearest whole net stroke before combining."] },
    { h: "Setup", list: [
      "Needs 4 players, or bigger groups split into foursomes.",
      "The party leader sets Team A and Team B in the lobby, or taps Randomize teams."] },
    { h: "Winning", p: ["Most points after 18 wins. One blow-up hole can flip the whole round, so nobody's safe."] },
  ],
  wad: [
    { h: "Wad", p: ["A putting game that pays the clutch. Every time someone drains their first putt on the green from long range, the pot grows. Whoever makes the last one of the round takes it all."] },
    { h: "What counts as a Wad", list: [
      "Your first putt on the green, from at least the length of the flagstick, that drops. Any score counts, even a triple.",
      "Chip-ins count. Putts from the fringe only count if they go in.",
      "Each Wad adds the per-Wad amount to the pot. Made for birdie or better? It counts double.",
      "The party leader, the group's co-leader, or the player who made it logs it on the hole card."] },
    { h: "Winning", list: [
      "Whoever makes the last Wad of the round collects the full pot from every other player in the group. In a foursome, that's three payouts.",
      "The closing rule: on holes 16 to 18, a Wad only takes the pot if it's for net par or better. It still grows the pot either way.",
      "Nobody makes a qualifying one late? The last earlier Wad still wins.",
      "Early Wads mostly fatten the pot for whoever makes the next one. Keep the putter hot all day.",
      "In a tournament, each group plays for its own pot."] },
  ],
  round: [
    { h: "How a round works", list: [
      "The party leader creates the round, shares the link, picks a mode and starts it.",
      "Once the game starts, the doors close. No new players.",
      "Tap your score each hole. When everyone in your group has scored, you all move to the next hole. Future holes stay locked.",
      "You can go back and fix a score on any hole you've already played.",
      "Only one phone out? The party leader can switch on Scorekeeper (top left) and enter everyone's scores.",
      "One Device Mode lets the party leader add everyone by name in the lobby and run the whole round from one phone. Anyone added that way can still claim their spot later with the link.",
      "Playing in groups with One Device Mode? One device per group. Each group's co-leader claims their name on their own phone and keeps score for that group.",
      "Playing for money? Parcade only keeps track. Buy-in pots pay the places the party leader set, and ties split those prizes. Per-point games settle the difference with everyone. The results screen shows who pays who.",
      "Lost your spot? Open the round link and tap \"I'm already in this round\".",
      "The party leader taps Finish round at the end. Scores lock and the results go up."] },
    { h: "Tournaments", p: ["With 5 or more players, the party leader can split everyone into groups and name a co-leader for each. Co-leaders pick the challenge winners for their own group."] },
    { h: "Handicaps (optional)", p: ["The party leader can switch handicaps on when creating the round or in the room. Everyone types in their handicap. Don't know it? Tap \"I don't know my handicap\" and enter what you usually shoot instead."],
      list: ["The best player in the round plays straight up. Everyone else gets strokes based on the gap. If you usually shoot 18 more than the best player, you get 1 stroke per hole.",
             "You get whole strokes on specific holes, spread evenly through the round. 9 strokes means one on every other hole, 18 means one on every hole. The hole card tells you when you're getting one.",
             "Gold dots in the hole strip mark your stroke holes, and the Leaderboard tab lists everyone's.",
             "In Party Mode, hole points compare scores after strokes. Challenges don't use handicaps, so the long hitter still wins Longest Drive.",
             "In Stroke Play, the lowest score after strokes wins.",
             "The party leader can edit anyone's usual score in the lobby. Parcades, you've been warned."] },
  ],
  seasons: [
    { h: "What's a season", p: ["A season strings rounds together into one long-running grudge match. Built for trips, leagues, and settling old arguments."] },
    { h: "Who can do what", list: ["You need an account to start or join a season. Guests can still play in the rounds.",
                                   "Whoever starts the season is the commissioner. Only the commissioner adds or removes rounds.",
                                   "The commissioner can add any round they played in."] },
    { h: "Season points", p: ["Each round in the season hands out points by finishing position:"],
      list: ["1st place: 5 points", "2nd place: 3 points", "3rd place: 1 point", "Everyone else: 0 points, plus character development"] },
    { h: "The fine print", list: ["Every game mode counts the same. In Cart Caddy, caddies and golfers are ranked separately, so there are two 1st places.",
                                  "Ties share the same place and the same points.",
                                  "Most season points wins. Round wins break ties.",
                                  "Playing for money? The season tracks everyone's net, biggest win and loss, and side bet record.",
                                  "Players are matched by account. Guests are matched by the name they played under, so pick one and stick with it."] },
  ],
};

function renderRules(container, keys) {
  container.classList.add("rules");
  keys.forEach(k => (RULES[k] || []).forEach(sec => {
    const h = document.createElement("h4");
    h.textContent = sec.h;
    container.append(h);
    (sec.p || []).forEach(text => {
      const p = document.createElement("p");
      p.textContent = text;
      container.append(p);
    });
    const items = sec.deck
      ? CHALLENGES.map(([t, pts, m]) => (m ? t : t + " (" + (pts > 0 ? "+" : "") + pts + ")"))
      : sec.list;
    if (items) {
      const ul = document.createElement("ul");
      items.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        ul.append(li);
      });
      container.append(ul);
    }
  }));
}

function showRulesModal(title, keys) {
  const wrap = document.createElement("div");
  wrap.className = "modal";
  const panel = document.createElement("div");
  panel.className = "modal-panel rules-panel";
  const h = document.createElement("h2");
  h.textContent = title;
  const body = document.createElement("div");
  renderRules(body, keys);
  const ok = document.createElement("button");
  ok.textContent = "Got it";
  ok.style.cssText = "width:100%;margin-top:12px";
  const close = () => wrap.remove();
  ok.onclick = close;
  wrap.onclick = e => { if (e.target === wrap) close(); };
  panel.append(h, body, ok);
  wrap.append(panel);
  document.body.append(wrap);
  ok.focus();
}

function infoDot() {
  const d = document.createElement("span");
  d.className = "info-dot";
  d.textContent = "i";
  d.setAttribute("aria-hidden", "true");
  return d;
}

function infoBtn(label, onclick) {
  const b = document.createElement("button");
  b.className = "info-btn";
  b.setAttribute("aria-label", label);
  b.append(infoDot());
  b.onclick = onclick;
  return b;
}

function infoLink(text, onclick) {
  const b = document.createElement("button");
  b.className = "info-link";
  b.append(infoDot(), text);
  b.onclick = onclick;
  return b;
}
