;(function(){
  // Unified live evaluator: prefer GTO-live preflop, otherwise use equity pipeline (PokerEyeOdds worker or EquityCalculator)
  // Exposes: window.PokerEyeEvaluator.getRecommendation({ heroHand, board, players, potSize, toCall, raiseSize, context })

  function softmax(values, temp = 1) {
    const max = Math.max(...values);
    const exps = values.map(v => Math.exp((v - max) / temp));
    const sum = exps.reduce((a,b) => a+b, 0);
    return exps.map(e => e / sum);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Estimate a single opponent's probability to continue (call or raise) given a bet
  function estimateOpponentContinueProbability(villain, board, betSize, potSize, street = 'flop') {
    // Base respond by street
    const baseByStreet = { preflop: 0.6, flop: 0.5, turn: 0.45, river: 0.4 };
    let base = baseByStreet[street] || 0.5;

    // Board texture factor - try to read global BOARD_RESPOND_FACTOR
    let boardFactor = 1.0;
    try {
      const texture = (window.HandEvaluator && typeof window.HandEvaluator.analyzeBoardTexture === 'function') ? (window.HandEvaluator.analyzeBoardTexture(board) || {}).texture : null;
      if (texture && window.BOARD_RESPOND_FACTOR && window.BOARD_RESPOND_FACTOR[texture]) boardFactor = window.BOARD_RESPOND_FACTOR[texture];
    } catch (e) {}

    // Multiway mode factor
    let mwFactor = 1.0;
    try { if (window.MULTIWAY_MODE_FACTOR && window.MULTIWAY_RESPOND_MODE) mwFactor = window.MULTIWAY_MODE_FACTOR[window.MULTIWAY_RESPOND_MODE] || 1.0; } catch (e) {}

    // Villain aggression factor
    let aggrFactor = 1.0;
    try {
      if (villain && window.VillainProfiler && typeof window.VillainProfiler.analyzeVillain === 'function') {
        const stats = window.VillainProfiler.analyzeVillain(villain);
        const af = stats.aggressionFreq || 0.25;
        // map aggression 0..1 to factor ~0.7..1.3
        aggrFactor = 1 + (af - 0.25) * 0.9;
      }
    } catch (e) {}

    // Pot odds effect: bigger bets reduce continue probability
    const potOdds = betSize <= 0 ? 0 : (betSize / (potSize + betSize));
    const oddsPenalty = 1 - clamp(potOdds, 0, 0.9); // reduce continue when potOdds are small for caller

    let p = base * boardFactor * mwFactor * aggrFactor * oddsPenalty;
    p = clamp(p, 0.02, 0.98);
    return p;
  }

  // Compute combined probability that ALL opponents fold to a bet (multiplicative model)
  function computeAllFoldProbability(villains, board, betSize, potSize, street) {
    if (!villains || villains.length === 0) return 0;
    let prod = 1;
    for (const v of villains) {
      const pCont = estimateOpponentContinueProbability(v, board, betSize, potSize, street);
      const pFold = 1 - pCont;
      prod *= pFold;
    }
    return prod; // probability all fold
  }

  // Enforce MDF: when facing a bet (toCall > 0) ensure call frequency >= MDF
  function enforceMDF(distribution, toCall, potSize) {
    if (!toCall || toCall <= 0) return distribution;
    const potOdds = toCall / (potSize + toCall);
    const MDF = 1 - potOdds; // minimum defense frequency
    const callIdx = distribution.findIndex(a => a.action === 'call');
    if (callIdx === -1) return distribution;
    const currentCall = distribution[callIdx].prob;
    if (currentCall >= MDF) return distribution;

    // Increase call probability to MDF by proportionally reducing fold/raise
    const deficit = MDF - currentCall;
    const otherIdxs = distribution.map((a,i)=>i).filter(i=>i!==callIdx);
    const otherTotal = otherIdxs.reduce((s,i)=>s+distribution[i].prob,0);
    if (otherTotal <= 0) return distribution;
    const scale = (otherTotal - deficit) / otherTotal;
    for (const i of otherIdxs) distribution[i].prob = Math.max(0.001, distribution[i].prob * scale);
    distribution[callIdx].prob = MDF;
    // renormalize
    const sum = distribution.reduce((s,a)=>s + a.prob, 0);
    for (const d of distribution) d.prob = d.prob / sum;
    return distribution;
  }

  async function computeEquity(heroHand, board, numOpponents, iterations) {
    // Prefer workerized PokerEyeOdds if available
    try {
      if (window.PokerEyeOdds && typeof window.PokerEyeOdds.calculate === 'function') {
        const iters = iterations || (numOpponents === 1 ? 5000 : (numOpponents === 2 ? 10000 : 20000));
        const res = await window.PokerEyeOdds.calculate({ hero: heroHand, numOpponents }, board, 'full', iters, null);
        // Normalize to a single equity number
        if (res && res.results && res.results[0] && typeof res.results[0].equity === 'number') {
          return { equity: res.results[0].equity, method: res.method || 'PokerEyeOdds' };
        }
      }
    } catch (e) {
      console.warn('[Evaluator] PokerEyeOdds failed, falling back to EquityCalculator', e);
    }

    // Fallback to EquityCalculator.getSmartEquity
    if (window.EquityCalculator && typeof window.EquityCalculator.getSmartEquity === 'function') {
      const r = await window.EquityCalculator.getSmartEquity(heroHand, board, numOpponents, [], [], {});
      return { equity: Number(r.equity || r.winPct || 0), method: r.method || 'EquityCalculator' };
    }

    // Last fallback: 50%
    return { equity: 50, method: 'fallback' };
  }

  async function getRecommendation({ heroHand, board = [], players = [], potSize = 1, toCall = 0, raiseSize = 2, context = {} } = {}) {
    // Normalize inputs
    try { heroHand = (window.PokerEyeCards && window.PokerEyeCards.normalizeHand) ? window.PokerEyeCards.normalizeHand(heroHand) : heroHand; } catch (e) {}
    try { board = (window.PokerEyeCards && window.PokerEyeCards.normalizeBoard) ? window.PokerEyeCards.normalizeBoard(board) : board; } catch (e) {}

    const numOpponents = (Array.isArray(players) && players.length > 0) ? players.filter(p => p && !p.isHero).length : Math.max(1, (players.length || 0) - 1);

    // 1) Preflop: try GTO-live (use preflop table lookup)
    if (!board || board.length === 0) {
      // Preflop quick table
      try {
        if (window.EquityCalculator && typeof window.EquityCalculator._getPreflopEquityFromTable === 'function') {
          const handKey = (window.PositionStrategy && typeof window.PositionStrategy.handToRangeFormat === 'function')
            ? window.PositionStrategy.handToRangeFormat(heroHand)
            : (window.PokerEyeCards && window.PokerEyeCards.handToRangeFormat ? window.PokerEyeCards.handToRangeFormat(heroHand) : null);

          const tableEquity = window.EquityCalculator._getPreflopEquityFromTable(handKey, numOpponents);
          if (tableEquity !== null && typeof tableEquity !== 'undefined') {
            // Build simple EVs from table equity and map to action probs
            const equity = tableEquity; // 0-100
            const evFold = 0;
            const evCall = (equity/100) * (potSize + toCall) - toCall;
            const evRaise = (equity/100) * (potSize + raiseSize) - raiseSize;
            const values = [evFold, evCall, evRaise];
            const probs = softmax(values.map(v => v), 0.5); // tighter softmax
            return {
              actions: [
                { action: 'fold', prob: probs[0], ev: evFold },
                { action: 'call', prob: probs[1], ev: evCall },
                { action: 'raise', prob: probs[2], ev: evRaise }
              ],
              meta: { method: 'GTO-live-preflop', equity }
            };
          }
        }
      } catch (e) {
        // continue to equity pipeline
      }
    }

    // 2) Postflop / fallback: compute equity via worker or calculator
    const eqRes = await computeEquity(heroHand, board, Math.max(1, numOpponents), context.iterations);
    const equity = Number(eqRes.equity || 50);

    // ---- Improved EV→Action model ----
    const evFold = 0;
    const evCall = (equity/100) * (potSize + toCall) - toCall; // expected value if we call

    // Estimate fold equity for a bet/raise
    // Build villains list from players argument where possible
    const villains = Array.isArray(players) ? players.filter(p => p && !p.isHero) : new Array(Math.max(0, numOpponents)).fill(null);
    const street = (board && board.length === 0) ? 'preflop' : (board.length === 3 ? 'flop' : (board.length === 4 ? 'turn' : 'river'));

    const allFoldProb = computeAllFoldProbability(villains, board, raiseSize, potSize, street);

    // Approximate showdown EV when at least one continues: use effective opponent count
    const expectedContinues = villains.reduce((s,v)=> s + estimateOpponentContinueProbability(v, board, raiseSize, potSize, street), 0);
    const effectiveOpp = Math.max(1, Math.round(expectedContinues));
    const showdownEst = await computeEquity(heroHand, board, effectiveOpp, context.iterations);
    const showdownEquity = Number(showdownEst.equity || equity);

    // When we bet/raise, we invest raiseSize; if all fold we win potSize
    const evRaise = allFoldProb * (potSize) + (1 - allFoldProb) * ( (showdownEquity/100) * (potSize + raiseSize) - raiseSize );

    // Compose values and map to probabilities via softmax
    // Use temperature scaled by number of opponents to avoid overconfidence multiway
    const temp = 0.6 + Math.min(0.8, numOpponents * 0.15);
    let values = [evFold, evCall, evRaise];
    let probs = softmax(values, temp);

    // Enforce MDF if we're facing a bet (toCall > 0)
    let distribution = [
      { action: 'fold', prob: probs[0], ev: evFold },
      { action: 'call', prob: probs[1], ev: evCall },
      { action: 'raise', prob: probs[2], ev: evRaise }
    ];
    distribution = enforceMDF(distribution, toCall, potSize);

    // Decision safety: ensure minimum probability mass for exploration
    for (const d of distribution) d.prob = Math.max(0.005, d.prob);
    const sumP = distribution.reduce((s,d)=>s+d.prob,0);
    for (const d of distribution) d.prob = d.prob / sumP;

    // If there's nothing to call (toCall === 0), a 'fold' is semantically a 'check'.
    // Convert evaluator's 'fold' action into 'check' so clients receive the correct UX-level option.
    try {
      if (!toCall || Number(toCall) === 0) {
        for (const d of distribution) {
          if (d.action === 'fold') {
            d.action = 'check';
            // A reasonable EV for checking when no bet is to use the 'call' EV (which assumes zero toCall)
            d.ev = typeof evCall === 'number' ? evCall : d.ev;
            // Ensure probability mass preserved; leave d.prob as-is
          }
        }
      }
    } catch (e) {
      // swallow
    }

    return { actions: distribution, meta: { method: showdownEst.method || eqRes.method || 'equity', equity, numOpponents, allFoldProb, effectiveOpp } };
  }

  window.PokerEyeEvaluator = {
    getRecommendation
  };

})();
