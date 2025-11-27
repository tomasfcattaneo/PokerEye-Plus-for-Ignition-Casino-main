const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// This runner opens a headless browser, injects a lightweight Monte Carlo equity
// implementation and the evaluator, then runs scenarios to get realistic equities
// without requiring the whole extension bootstrapped.

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Inject helpers and a simple EquityCalculator that runs Monte Carlo in-page
  await page.evaluateOnNewDocument(() => {
    // Minimal PokerEyeCards
    window.PokerEyeCards = {
      normalizeHand: (h) => Array.isArray(h) ? h.map(c => c.replace(/10/, 'T')) : h,
      normalizeBoard: (b) => Array.isArray(b) ? b.map(c => c.replace(/10/, 'T')) : b,
      handToRangeFormat: (hand) => {
        if (!Array.isArray(hand) || hand.length !== 2) return null;
        const r1 = hand[0].replace(/10/, 'T').slice(0, -1);
        const r2 = hand[1].replace(/10/, 'T').slice(0, -1);
        const s1 = hand[0].slice(-1), s2 = hand[1].slice(-1);
        const sortOrder = 'AKQJT98765432';
        const sorted = [r1, r2].sort((a,b)=> sortOrder.indexOf(a) - sortOrder.indexOf(b));
        const suffix = (r1 === r2) ? '' : (s1 === s2 ? 's' : 'o');
        return `${sorted[0]}${sorted[1]}${suffix}`;
      }
    };

    window.VillainProfiler = {
      analyzeVillain: (v) => ({ aggressionFreq: (v && v.aggression) || 0.25, isTight: !!v.isTight, isAggressive: !!v.isAggressive })
    };

    // Simple Monte Carlo equity function in page context
    window.EquityCalculator = {
      getSmartEquity: async (heroHand, board, numOpponents, deadCards = []) => {
        // Monte Carlo: simulate many random runouts and random opponent hands (no ranges)
        const iterations = 2000; // reasonable for headless quick runs
        const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
        const suits = ['h','d','c','s'];
        function makeCard(r,s){return r + s}

        // Build deck excluding known
        const known = new Set([...(heroHand||[]), ...(board||[]), ...(deadCards||[])]);
        const deck = [];
        for (const r of ranks) for (const s of suits) {
          const c = r + s;
          if (!known.has(c)) deck.push(c);
        }

        function shuffle(a){
          for (let i=a.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];
          }
        }

        let wins=0,ties=0,losses=0;
        for (let it=0; it<iterations; it++){
          const d = deck.slice(); shuffle(d);
          // deal opponents
          const opps = [];
          for (let o=0;o<numOpponents;o++){ opps.push([d.pop(), d.pop()]); }
          // complete board
          const needed = 5 - (board?board.length:0);
          const runout = [];
          for (let r=0;r<needed;r++) runout.push(d.pop());
          const fullBoard = (board||[]).concat(runout);
          // simple evaluator: high card score by ranks only (fast but crude)
          function score(cards){
            const vals = cards.map(c=>c[0]);
            const idx = vals.map(v=>ranks.indexOf(v));
            idx.sort((a,b)=>b-a);
            return idx.join(',');
          }
          const heroScore = score([...heroHand, ...fullBoard]);
          const oppScores = opps.map(h=>score([...h, ...fullBoard]));
          const better = oppScores.some(s=> s > heroScore);
          const equal = oppScores.some(s=> s === heroScore);
          if (!better && !equal) wins++; else if (!better && equal) ties++; else losses++;
        }
        const total = wins+ties+losses;
        const equity = (wins + ties*0.5)/total*100;
        return { equity: equity, winPct: wins/total*100, tiePct: ties/total*100, lossPct: losses/total*100, method: 'monte_headless' };
      }
    };
  });

  // Read evaluator.js and inject it into the page
  const evaluatorPath = path.join(__dirname, '..', 'evaluator.js');
  let code = fs.readFileSync(evaluatorPath, 'utf8');
  code = code.replace(/^```(?:\w+)?\n/, '').replace(/\n```$/, '');
  await page.evaluate(code);

  // Define scenarios similar to scenario_runner
  // Generate random preflop scenarios
  function getRandomCard(exclude=[]) {
    const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    const suits = ['h','d','c','s'];
    let card;
    do {
      card = ranks[Math.floor(Math.random()*ranks.length)] + suits[Math.floor(Math.random()*suits.length)];
    } while (exclude.includes(card));
    return card;
  }

  function getRandomHand(exclude=[]) {
    const c1 = getRandomCard(exclude);
    const c2 = getRandomCard([...exclude, c1]);
    return [c1, c2];
  }

  function getRandomScenario(idx) {
    const numPlayers = Math.floor(Math.random()*4)+2; // 2-5 players
    const hero = getRandomHand();
    const players = Array(numPlayers-1).fill({});
    const potSize = numPlayers;
    const toCall = Math.floor(Math.random()*3)+1;
    const raiseSize = toCall + Math.floor(Math.random()*4)+1;
    return {
      name: `Preflop #${idx+1}: ${hero.join(' ')} vs ${numPlayers-1} players`,
      hero,
      board: [],
      players,
      potSize,
      toCall,
      raiseSize
    };
  }

  const scenarios = [
  // Array para guardar los resultados de cada escenario
    // Preflop vs tipos de jugadores
    { name: 'HU: AKs vs Tight', hero:['Ah','Kh'], board:[], players:[{name:'Tight', isTight:true}], potSize:2, toCall:1, raiseSize:3 },
    { name: 'HU: 22 vs Loose', hero:['2h','2d'], board:[], players:[{name:'Loose', isTight:false}], potSize:2, toCall:1, raiseSize:3 },
    { name: 'HU: JTs vs Aggressive', hero:['Jh','Ts'], board:[], players:[{name:'Aggressive', isAggressive:true}], potSize:2, toCall:1, raiseSize:3 },
    { name: 'HU: A5s vs Passive', hero:['Ah','5h'], board:[], players:[{name:'Passive', isAggressive:false}], potSize:2, toCall:1, raiseSize:3 },
    // Multiway con tipos variados
    { name: '3way: AA vs Tight & Loose', hero:['Ac','Ad'], board:[], players:[{name:'Tight', isTight:true},{name:'Loose', isTight:false}], potSize:3, toCall:1, raiseSize:4 },
    { name: '3way: 76s vs Aggressive & Passive', hero:['7h','6h'], board:[], players:[{name:'Aggressive', isAggressive:true},{name:'Passive', isAggressive:false}], potSize:3, toCall:1, raiseSize:4 },
    { name: '4way: KQo vs Tight, Loose, Aggressive', hero:['Ks','Qd'], board:[], players:[{name:'Tight', isTight:true},{name:'Loose', isTight:false},{name:'Aggressive', isAggressive:true}], potSize:4, toCall:1, raiseSize:5 },
    // Postflop ejemplo
    { name: 'Multiway wet flop vs Loose', hero:['9h','9d'], board:['Jh','Th','8s'], players:[{name:'Loose', isTight:false},{name:'Loose', isTight:false},{name:'Loose', isTight:false}], potSize:8, toCall:2, raiseSize:10 }
  ];

  // Array para guardar los resultados de cada escenario
  const results = [];

  for (const s of scenarios) {

    console.log('Running scenario in headless browser:', s.name);
    const result = await page.evaluate(async (sc) => {
      try {
        const rec = await window.PokerEyeEvaluator.getRecommendation({ heroHand: sc.hero, board: sc.board, players: sc.players, potSize: sc.potSize, toCall: sc.toCall, raiseSize: sc.raiseSize, context: { iterations: 2000 } });
        return rec;
      } catch (e) { return { error: String(e) }; }
    }, s);

    results.push({
      name: s.name,
      equity: result.equity || (result.result && result.result.equity) || 0,
      actions: result.actions || [],
      error: result.error || null
    });
    console.log('Result:', result);
  }

  // Guardar resultados en puppeteer_results.json
  fs.writeFileSync(path.join(__dirname, 'puppeteer_results.json'), JSON.stringify(results, null, 2));

  await browser.close();
  console.log('Puppeteer run complete. Resultados guardados en puppeteer_results.json');
})();
