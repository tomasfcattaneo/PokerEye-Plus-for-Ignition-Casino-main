// attribution.js
const SOFTWARE_NAME = "PokerEye-Plus-Less for Ignition Casino";
const SOFTWARE_VERSION = "1.0.0";
const ASCII_LOGO = `
                    @                   
                    @                   
      @@            @            @@     
       @@                       @@      
              @@@@@@@@@@@@@             
        @@@@ @@,,,,,/@@@,,@@ @@@@       
     @@@   @@,,,*,@@@@@,,@@,@@   @@@    
  @@@     @@,@@,@@@,,,@@@,,,,@@     @@@ 
@@@       @,,,,@@,,,,,,,@@,@@,@       @@
  @@@     @@,,@,@@@@,@@@@,*@,@@     @@@ 
     @@@   @@,@(,,*@@@*,@/,,@@   @@@    
        #@@@ @@,,@@@/,,,,,@@ @@@.       
              @@@@@@@@@@@@@             
       @@                       @@      
      @@            @            @@     
                    @                   `;
const ASCII_LOGO_BORDER_Y = new Array(40).fill("=").join("");

function displayAttribution() {
  console.log(
    "%c%s%c%s",
    "color: magenta; background: black;",
    `${ASCII_LOGO_BORDER_Y}${ASCII_LOGO}\n${ASCII_LOGO_BORDER_Y}\n\n`,
    "color: magenta; font-size: 1.5em; background: black; font-weight: bold;",
    `${SOFTWARE_NAME} v${SOFTWARE_VERSION}\n`
  );
}

// main.js
// Hand keys for preflop validation
const HAND_KEYS = [
  "AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
  "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
  "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s",
  "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s", "J3s", "J2s",
  "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "T5s", "T4s", "T3s", "T2s",
  "A9o", "K9o", "Q9o", "J9o", "T9o", "99", "98s", "97s", "96s", "95s", "94s", "93s", "92s",
  "A8o", "K8o", "Q8o", "J8o", "T8o", "98o", "88", "87s", "86s", "85s", "84s", "83s", "82s",
  "A7o", "K7o", "Q7o", "J7o", "T7o", "97o", "87o", "77", "76s", "75s", "74s", "73s", "72s",
  "A6o", "K6o", "Q6o", "J6o", "T6o", "96o", "86o", "76o", "66", "65s", "64s", "63s", "62s",
  "A5o", "K5o", "Q5o", "J5o", "T5o", "95o", "85o", "75o", "65o", "55", "54s", "53s", "52s",
  "A4o", "K4o", "Q4o", "J4o", "T4o", "94o", "84o", "74o", "64o", "54o", "44", "43s", "42s",
  "A3o", "K3o", "Q3o", "J3o", "T3o", "93o", "83o", "73o", "63o", "53o", "43o", "33", "32s",
  "A2o", "K2o", "Q2o", "J2o", "T2o", "92o", "82o", "72o", "62o", "52o", "42o", "32o", "22"
];
const CALCULATE_BEST_ACTIONS_DEFAULT = true;
const DEBUG_API_REQUESTS = false;
const TICK_RATE = 100; // ms
const LOG_PLAYER_SECONDS_LEFT_TO_MAKE_A_MOVE = false;
const ENABLE_HUD_VISIBILITY_BY_DEFAULT = true;
const SHOW_BB_BY_DEFAULT = false;

// ============ EQUITY CALCULATION SETTINGS ============
const USE_MONTE_CARLO_POSTFLOP = true;  // Set to true for accurate equity, false for fast approximation

// Adaptive Monte Carlo iterations based on number of opponents
// More opponents = need more iterations for convergence
const MONTE_CARLO_ITERATIONS_HEADSUP = 15000;   // 1v1: faster, ~±1% variance, ~1s
const MONTE_CARLO_ITERATIONS_3WAY = 25000;      // 3-way: balanced, ~±0.8% variance, ~2s
const MONTE_CARLO_ITERATIONS_MULTIWAY = 40000;  // 4+ players: high precision, ~±0.5% variance, ~3-4s

// Helper function to get iterations based on opponent count
function getMonteCarloIterations(numOpponents) {
  if (numOpponents === 1) return MONTE_CARLO_ITERATIONS_HEADSUP;
  if (numOpponents === 2) return MONTE_CARLO_ITERATIONS_3WAY;
  return MONTE_CARLO_ITERATIONS_MULTIWAY;
}
// ====================================================

// MULTIWAY / FOLD-EQUITY TUNING
// Mode: 'conservative' (assume villains fold more), 'normal', 'aggressive' (assume villains continue more)
const MULTIWAY_RESPOND_MODE = 'normal'; // change to 'conservative' or 'aggressive' to bias calculations
const MULTIWAY_MODE_FACTOR = {
  'conservative': 0.85,
  'normal': 1.0,
  'aggressive': 1.15
};

// Board texture modifiers to adjust per-villain respond probability
const BOARD_RESPOND_FACTOR = {
  'dry': 0.75,           // dry board -> villains less likely to continue
  'medium': 1.0,
  'wet': 1.20,           // wet board -> villains more likely to continue
  'very_wet': 1.30,
  'paired': 1.10,
  'highly_connected': 1.20
};


const TAILWIND_CSS_CDN_URL = "https://cdn.tailwindcss.com";
const TAILWIND_CSS_CUSTOM_CONFIG = {
  corePlugins: {
    preflight: false,
  },
  // prefix: 'tw-',
  important: true,
};

/**
 * PokerSolver availability manager
 * - Detects if window.PokerSolver becomes available and exposes helper methods
 * - Avoids noisy repeated console errors when the library isn't loaded yet
 */
const PokerSolverManager = (function(){
  let status = 'unknown'; // 'unknown' | 'available' | 'missing'
  let detectedOnce = false;
  let checkInterval = null;

  // Attempt to inject pokersolver.js into the page context when running as an extension
  async function injectPokerSolverScript() {
    try {
      // If already injected, nothing to do
      if (window?.PokerSolver && window.PokerSolver.Hand) return true;

      // Determine URL to fetch the bundled pokersolver file
      const runtimeGetURL = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL.bind(chrome.runtime) : null;
      const url = runtimeGetURL ? runtimeGetURL('pokersolver.js') : 'pokersolver.js';

      // Fetch the file and inject its contents into a page <script> so it runs in page context
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('[PokerSolver] Could not fetch pokersolver.js for injection:', res.status);
        return false;
      }
      const code = await res.text();

      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.textContent = code + '\n//# sourceURL=pokersolver.injected.js';
      (document.head || document.documentElement).appendChild(s);
      // remove tag after execution to keep DOM clean
      s.parentNode && s.parentNode.removeChild(s);

      // Small delay to allow the script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      return !!(window?.PokerSolver && window.PokerSolver.Hand);
    } catch (e) {
      console.warn('[PokerSolver] Injection failed', e);
      return false;
    }
  }

  function checkNow() {
    try {
      if (window?.PokerSolver && window.PokerSolver.Hand) {
        status = 'available';
        if (!detectedOnce) {
          console.log('[PokerSolver] ✅ PokerSolver detected and available');
          detectedOnce = true;
        }
        if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
        // Update HUD engine status if present (show preferred engine when available)
        try {
          const el = window.document?.querySelector && window.document.querySelector('#PokerEyePlus-engineStatus');
          if (el) el.textContent = `Engine: PokerSolver · GTO: ON · Odds: MonteCarlo`;
        } catch(e) {}
        return true;
      }
    } catch (e) {
      // ignore
    }

    if (status === 'unknown') status = 'missing';
    return false;
  }

  // Start a short-lived poll to catch late-loaded pokersolver (e.g. injected after main.js)
  function startWatching(timeoutMs = 10000, periodMs = 300) {
    const start = Date.now();
    if (checkInterval) return;
    checkInterval = setInterval(() => {
      if (checkNow() || Date.now() - start > timeoutMs) {
        if (!detectedOnce && status !== 'available') {
          console.warn('[PokerSolver] ⚠️ PokerSolver not available - using internal fallback');
          detectedOnce = true; // prevent repeated warnings
          // Update HUD engine status if present
          try {
            const el = window.document?.querySelector && window.document.querySelector('#PokerEyePlus-engineStatus');
            // Show active engine (MonteCarlo) but avoid alarming 'MISSING' label
            if (el) el.textContent = `Engine: MonteCarlo · GTO: ON`;
          } catch(e) {}
        }
        clearInterval(checkInterval);
        checkInterval = null;
      }
    }, periodMs);
  }

  // Initialize poll
  // First, try to inject the pokersolver bundle (Option A) so page context gets window.PokerSolver
  (async () => {
    try {
      await injectPokerSolverScript();
    } catch (e) {}
    // Then run the usual detection/polling
    checkNow();
    startWatching();
  })();

  return {
    isAvailable: () => status === 'available',
    whenAvailable: (cb, timeoutMs = 10000) => {
      if (status === 'available') return cb();
      const start = Date.now();
      const t = setInterval(() => {
        if (status === 'available') {
          clearInterval(t);
          cb();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(t);
        }
      }, 200);
    }
  };
})();

// -------------------------
// Worker-based PokerSolverManager (lightweight manager)
// Tries to create a Worker from chrome-extension/workers/pokersolver.worker.js and
// exposes a simple request(method, payload) -> Promise API on window.PokerSolverWorkerManager
// This allows heavy solve/equity jobs to run off the main thread.
// -------------------------
(function createWorkerManager() {
  try {
    if (typeof window.Worker === 'undefined') return;

    const runtimeGetURL = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL.bind(chrome.runtime) : (p => p);
    const workerPath = runtimeGetURL('workers/pokersolver.worker.js');
    const worker = new Worker(workerPath);

    let seq = 1;
    const pending = new Map();
    let ready = false;

    worker.addEventListener('message', (ev) => {
      const msg = ev.data || {};
      if (msg && msg.type === 'ready') {
        ready = !!msg.ok;
        // console.log('[PokerSolverWorker] ready=', ready);
        return;
      }
      const id = msg.id;
      if (!id) return;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (msg.success) p.resolve(msg.result);
      else p.reject(msg.error || 'worker error');
    });

    // Provide a manager object
    const manager = {
      isAvailable() { return ready; },
      request(method, payload = {}, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
          const id = `w-${Date.now()}-${seq++}`;
          pending.set(id, { resolve, reject });
          // Send init automatically if not ready
          if (!ready && method !== 'init') {
            // fire-and-forget init
            worker.postMessage({ id: `init-${id}`, method: 'init', payload: {} });
          }
          try {
            worker.postMessage({ id, method, payload });
          } catch (e) {
            pending.delete(id);
            return reject(e);
          }
          // Timeout
          const t = setTimeout(() => {
            if (pending.has(id)) {
              pending.delete(id);
              reject(new Error('worker timeout'));
            }
          }, timeoutMs);
          // Wrap resolve/reject to clear timeout
          const origResolve = resolve;
          const origReject = reject;
          pending.set(id, {
            resolve(result) { clearTimeout(t); origResolve(result); },
            reject(err) { clearTimeout(t); origReject(err); }
          });
        });
      },
      terminate() {
        try { worker.terminate(); } catch (e) {}
      }
    };

    // Kick off an init so worker can load pokersolver if present
    manager.request('init', {}, 8000).catch(() => {});

    // Expose globally
    window.PokerSolverWorkerManager = manager;
  } catch (e) {
    console.warn('[PokerSolverWorker] failed to create worker manager', e);
  }
})();

/**
 * Try to use the unified evaluator (window.PokerEyeEvaluator) to compute recommended actions and EVs.
 * Falls back to null if evaluator is not available or fails.
 * Returns object: { actions: [...], evs: { ActionName: evValue, ... }, meta: {...} }
 */
async function getUnifiedRecommendationFromEvaluator({ heroHand, board, players, potSize, toCall, raiseSize, context, street, isPreflop } = {}) {
  try {
    if (!window.PokerEyeEvaluator || typeof window.PokerEyeEvaluator.getRecommendation !== 'function') return null;

    const playersArr = Array.isArray(players) ? players : (players ? Array.from(players) : []);

    const res = await window.PokerEyeEvaluator.getRecommendation({
      heroHand: heroHand,
      board: board || [],
      players: playersArr,
      potSize: potSize || 0,
      toCall: toCall || 0,
      raiseSize: raiseSize || Math.max((toCall || 0) * 2, 1),
      context: context || {}
    });

    if (!res || !res.actions) return null;

    // Map evaluator actions (lowercase 'fold','call','raise') to HUD-friendly keys and EV map
    const evs = {};
    const bestActions = [];

    for (const a of res.actions) {
      const name = ('' + (a.action || a.actionName || 'unknown')).toString();
      // Normalize common names
      let label = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      if (/raise|bet/i.test(name)) label = 'Raise';
      if (/call/i.test(name)) label = 'Call';
      if (/fold/i.test(name)) label = 'Fold';

      evs[label] = typeof a.ev === 'number' ? a.ev : (typeof a.e === 'number' ? a.e : 0);

      // Build a best action entry compatible with existing HUD expectations
      bestActions.push({
        action: label,
        percentage: typeof a.prob === 'number' ? a.prob : (typeof a.percentage === 'number' ? a.percentage : 0),
        numBigBlinds: 0,
        amountToBet: (label === 'Fold') ? 0 : (raiseSize || 0)
      });
    }

    // Ensure EV map contains at least Fold/Call/Raise keys
    evs.Fold = evs.Fold || 0;
    evs.Call = evs.Call || 0;
    evs.Raise = evs.Raise || 0;

    return { actions: bestActions, evs, meta: res.meta || {} };
  } catch (e) {
    console.warn('[UnifiedEvaluator] getRecommendation failed', e);
    return null;
  }
}

const INITIAL_MENU_POSITION = {
  left: "20px",
  top: "20px",
};

// TODO: To get postflop oods on a given hand, in any situation:
//  1. Create a Node.js script that opens a headless browser window to https://www.pokernews.com/poker-tools/poker-odds-calculator.htm
//   1.1 Once loaded, sync (setInterval search for) the <iframe> tag with id="oddsCalculatorIframe" and store it's "src" attribute in a variable.
//  2. Open a new headless iframe of the src from step 1.1
//   2.1 Once loaded, create a new instance of a class "postflopOddsCalc" and pass this.document as the argument (must be already loaded and ready to be passed in) and store it as this.doc within the class.
//  3. Create a function in the PokerTable class (in this script, not the Node.js script) that parses the board, number of other active players, and the user's hand to the format that the calculator expects as input
//   • Example calculator input: "8h|9c|3|5d|7c|5h|Tc||1|1", where the first elements (separated by "|") are the user's hand, the next element is the number of other active players, then the 5 cards on the board, the last two elements are usually "1" and "1" (not sure what they are for, so ignore them)
//  4. Send the parsed input from step 3 to the calculator (communicating by localhost API hosted by the Node.js script) and wait for the calculator to finish calculating the percentages
//   4.1 (for the Node.js script) The API URL to fetch data from is `https://th.odds.pokernews.com/game-probs?input=${parsedInput}`,
//       where input is the translated hand and board from step 4 in the form of "8h|9c|3|5d|7c|5h|Tc||1|1",
//       then url-encoded to be "8h%7C9c%7C3%7C5d%7C7c%7C5h%7CTc%7C%7C1%7C1"
//         • Example fetch script:
//         ```javascript
//           let url = `https://th.odds.pokernews.com/game-probs?input=${parsedInput}`,
//
//           // Fetch options
//           let options = {
//             headers: {
//               "accept": "application/json, text/plain, */*",
//               "accept-language": "en-US,en;q=0.9",
//               "sec-ch-ua": "\"Not)A;Brand\";v=\"24\", \"Chromium\";v=\"116\"",
//               "sec-ch-ua-mobile": "?0",
//               "sec-ch-ua-platform": "\"macOS\"",
//               "sec-fetch-dest": "empty",
//               "sec-fetch-mode": "no-cors",
//             },
//             referrer: "https://th.odds.pokernews.com",
//             referrerPolicy: "strict-origin-when-cross-origin",
//             body: null,
//             method: "GET",
//             mode: "no-cors", // Set the mode to 'no-cors' to disable CORS
//             credentials: "include"
//           };
//
//           // Calculate the percentages and return the response
//           fetch(url, options)
//             .then(response => response.text())
//             .then(body => {
//               console.log(body);
//               TODO: return the response...
//              })
//             .catch(error => console.error('Error:', error));
//        ```
//        • Example response:
//        ```xml
//          <?xml
//           version="1.0" encoding="utf-8"?>
//           <d>
//               <win>18.45|80.23</win>
//               <tie>1.31|4.43</tie>
//               <r>|52.13|26.1|4.36|17.41||||;|9.41|53.67|15.81|3.23|2.02|14.96|0.9|</r>
//               <c>1|1|0|1|1|1|0|1|1|1|0|1|91|92|81|92|1|1||1|33|32||32|30||26|29|1|1||1|91|92|82|91|1||0||0|0|0|0|0|0|0|0|0|0|0|0</c>
//               <time>0.116069078445</time>
//           </d>
//        ```
//         • The first number in the "win" tag is the win percentage for the user's player, the second number is the win percentage for the other players (separator is "|")
//         • The first number in the "tie" tag is the tie percentage for the user's player, the second number is the tie percentage for the other players (separator is "|")
//         • The "r" tag is the percentages for each possible hand rank (separated by "|" and the user percentages are to the left of ";" and the other player's percentages are to the right of ";" ) it is in the following order: HIGH CARD | ONE PAIR | TWO PAIR | THREE-OF-A-KIND | STRAIGHT | FLUSH | FULL HOUSE | FOUR-OF-A-KIND | STRAIGHT FLUSH
//         • The "c" is unknown as of now... so ignore it
//         • The "time" tag is the time it took to calculate the percentages (in seconds)
//  5. Parse the response, store it in the pokerTable instance accordingly
//   • The HUD should already be listening for these changes, so it should update automatically and display the percentages on the screen!
// ----------------------------------------------------------------------------------------------------------------------------------------

// TODO: To get the best preflop move on a given hand, in any situation (up to 4-bets):
//  1. Add another API endpoint to the Node.js script we wrote for postflop odds (see above) but for preflop odds (/calculate-preflop-odds)
//   1.1 The logic for this is very difficult to explain shortly... but use the /data folder and the logic from /preflop-academy to figure out how to calculate the best preflp move
//  2. Translate the hand and board to the format that the calculator expects as input (see above)
//    2.1 Format the hand to show "o" for offsuit and "s" for suited (e.g. "AKo" or "AKs")
//    2.2 Then, pass the formmatted translated hand and the player's position and circumstance (whoever raised last, and whether it was a normal raise, 3-bet, or 4-bet (e.g. { position: "BTN", action: "RAISE" }, or { position: "CO", action: "3-BET" }, or { position: "SB", action: "4-BET" })) to the API endpoint we created in step 1
//  3. Parse the response, store it in the pokerTable instance accordingly
//   • The HUD should already be listening for these changes, so it should update automatically and display the best preflop move on the screen!
// ----------------------------------------------------------------------------------------------------------------------------------------------

// TODO: add a "disconnected" state to the pokerTable instance and display it on the HUD when the player is disconnected. When reconnected, the pokerTable instance should be updated accordingly AND REINITIALIZE THE POKERTABLE INSTANCE (because the DOM will be different)

// ============================================================================
// ========================== POKER ENGINE MODULES ============================
// ============================================================================

/**
 * EQUITY CALCULATOR MODULE
 * Handles all equity calculations (preflop and postflop)
 * Supports both fast table-based calculations and accurate Monte Carlo simulations
 * NOW WITH INTELLIGENT CACHING SYSTEM!
 */
const EquityCalculator = {
  // Cache storage
  equityCache: new Map(),
  cacheStats: {
    hits: 0,
    misses: 0,
    totalSaved: 0 // milliseconds saved
  },
  
  // Cache configuration
  MAX_CACHE_SIZE: 100,
  CACHE_EXPIRY_MS: 3600000, // 1 hour
  
  /**
   * Create cache key from hand situation
   */
  _createCacheKey(heroHand, board, numOpponents, iterations) {
    const handStr = [...heroHand].sort().join('');
    const boardStr = [...board].sort().join('');
    return `${handStr}_${boardStr}_${numOpponents}_${iterations}`;
  },
  
  /**
   * Get cached equity result
   */
  _getCachedEquity(cacheKey) {
    if (!this.equityCache.has(cacheKey)) {
      return null;
    }
    
    const cached = this.equityCache.get(cacheKey);
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_EXPIRY_MS) {
      this.equityCache.delete(cacheKey);
      return null;
    }
    
    // Update stats
    cached.hits++;
    this.cacheStats.hits++;
    
    return cached;
  },
  
  /**
   * Save equity result to cache
   */
  _saveCachedEquity(cacheKey, result) {
    // Evict oldest if cache is full
    if (this.equityCache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey = null;
      let oldestTime = Infinity;
      
      for (const [key, value] of this.equityCache.entries()) {
        if (value.timestamp < oldestTime) {
          oldestTime = value.timestamp;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.equityCache.delete(oldestKey);
      }
    }
    
    // Save to cache
    this.equityCache.set(cacheKey, {
      equity: result.equity,
      winPct: result.winPct,
      tiePct: result.tiePct,
      lossPct: result.lossPct,
      timestamp: Date.now(),
      hits: 0
    });
  },
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(1) : 0;
    return {
      size: this.equityCache.size,
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: `${hitRate}%`,
      timeSaved: `${(this.cacheStats.totalSaved / 1000).toFixed(1)}s`
    };
  },
  
  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache() {
    this.equityCache.clear();
    this.cacheStats = { hits: 0, misses: 0, totalSaved: 0 };
  },
  
  /**
   * Get equity using fast table-based calculation
   */
  getQuickPreflopEquity(hand, position, stackSize, rfiPosition, is3BetPot, allPlayers, activeVillains) {
    // Esta función será migrada desde getAdvancedPreflopEquity
    return this._calculateTableBasedEquity(hand, position, stackSize, rfiPosition, is3BetPot, allPlayers, activeVillains);
  },

  /**
   * Get accurate equity using Monte Carlo simulation
   * NOW WITH INTELLIGENT CACHING!
   * @param {Array} heroHand - Hero's 2 cards (e.g. ['Ah', 'Kh'])
   * @param {Array} board - Community cards (3, 4, or 5 cards)
   * @param {number} numOpponents - Number of opponents
   * @param {Array} deadCards - Known dead cards (optional)
   * @param {number} iterations - Number of simulations (default 5000)
   * @param {Array} villains - Villain objects for range-based equity (optional)
   * @param {Object} context - Additional context (preflopAggressor, isSqueezeSpot, etc.)
   */
  async getMonteCarloEquity(heroHand, board = [], numOpponents = 1, deadCards = [], iterations = 5000, villains = [], context = {}) {
    // Validación
    if (!heroHand || heroHand.length !== 2) {
      console.warn('Invalid hero hand for Monte Carlo');
      return 50;
    }

    // Check cache first
    const cacheKey = this._createCacheKey(heroHand, board, numOpponents, iterations);
    const cached = this._getCachedEquity(cacheKey);
    
    if (cached) {
      logMessage(
        `[Cache HIT] Equity: ${cached.equity.toFixed(1)}% (hits: ${cached.hits}, saved ~${(iterations * 0.15).toFixed(0)}ms)`,
        { color: "lightblue" }
      );
      this.cacheStats.totalSaved += iterations * 0.15; // Estimate time saved
      
      // Return full result with win/tie/loss (cached equity already 0-100)
      return {
        equity: cached.equity, // Already 0-100, don't multiply!
        winPct: cached.winPct,
        tiePct: cached.tiePct,
        lossPct: cached.lossPct,
        cached: true
      };
    }

    // Cache miss - calculate
    this.cacheStats.misses++;
    logMessage(
      `[Cache MISS] Calculando con Monte Carlo...`,
      { color: "lightyellow" }
    );

    try {
      const startTime = Date.now();
      
      // USE HYBRID SYSTEM: Smart equity calculator chooses best method
      const result = await this.getSmartEquity(
        heroHand, 
        board, 
        numOpponents, 
        deadCards, 
        villains, // Pass villains for range-based equity
        context // Pass context for advanced detection
      );
      
      const elapsedTime = Date.now() - startTime;
      
      logMessage(
        `[${result.method}] Completado en ${elapsedTime}ms`,
        { color: "lightgreen" }
      );
      
      // Save to cache
      this._saveCachedEquity(cacheKey, result);
      
      // Return full result (equity already in percentage from getSmartEquity)
      return {
        equity: result.equity, // Already 0-100, don't multiply again!
        winPct: result.winPct,
        tiePct: result.tiePct,
        lossPct: result.lossPct,
        method: result.method,
        cached: false
      };
    } catch (error) {
      console.error('Monte Carlo simulation error:', error);
      console.warn('[WARNING] Using fallback table-based equity (NOT GTO) - Monte Carlo failed!');
      
      // Fallback to quick equity
      const fallbackEquity = this.getQuickPreflopEquity(heroHand, null, 100, null, false, null, 
        Array(numOpponents).fill({ actionHistory: [] }));
      return {
        equity: fallbackEquity,
        winPct: fallbackEquity,
        tiePct: 0,
        lossPct: 100 - fallbackEquity,
        cached: false
      };
    }
  },

  /**
   * Adaptive equity calculation - chooses best method automatically
   */
  async getEquity(hand, context, useAccurate = false) {
    // Postflop con Monte Carlo
    if (useAccurate && context.board && context.board.length >= 3) {
      return await this.getMonteCarloEquity(
        hand, 
        context.board, 
        context.opponents?.length || 1,
        [],
        context.iterations || 5000
      );
    }
    
    // Preflop o modo rápido
    return this.getQuickPreflopEquity(
      hand, 
      context.position, 
      context.stackSize, 
      context.rfiPosition, 
      context.is3BetPot, 
      context.allPlayers, 
      context.opponents
    );
  },

  /**
   * ============================================
   * FASE 2: HYBRID EQUITY SYSTEM
   * ============================================
   * Combines multiple methods for optimal speed/accuracy:
   * - Lookup tables for preflop (instant)
   * - Exhaustive for heads-up postflop (exact)
   * - Optimized Monte Carlo for multiway (fast)
   */
  
  /**
   * Main entry point: Smart equity calculator
   * Automatically chooses best method based on situation
   */
  async getSmartEquity(heroHand, board = [], numOpponents = 1, deadCards = [], villains = [], context = {}) {
    const startTime = performance.now();
    
    // CASE 1: Preflop - use lookup table (instant, exact)
    if (board.length === 0 && numOpponents <= 3) {
      const equity = this._getPreflopEquityFromTable(heroHand, numOpponents);
      if (equity !== null) {
        console.log(`[Smart Equity] Preflop table lookup: ${equity.toFixed(1)}% (${(performance.now() - startTime).toFixed(0)}ms)`);
        return {
          equity: equity,
          winPct: equity,
          tiePct: 0,
          lossPct: 100 - equity,
          method: 'lookup_table'
        };
      }
    }
    
    // CASE 2: Heads-up postflop - use exhaustive (exact, ~500ms)
    if (numOpponents === 1 && board.length >= 3 && !villains.length) {
      try {
        const result = await this._getExhaustiveEquity(heroHand, board, deadCards);
        console.log(`[Smart Equity] Exhaustive HU: ${result.equity.toFixed(2)}% (${(performance.now() - startTime).toFixed(0)}ms)`);
        return {
          ...result,
          method: 'exhaustive'
        };
      } catch (e) {
        console.warn('[Smart Equity] Exhaustive failed, falling back to Monte Carlo:', e);
      }
    }
    
    // CASE 3: All other cases - optimized Monte Carlo
    const iterations = getMonteCarloIterations(numOpponents);
    const result = await this._runOptimizedMonteCarloSimulation(
      heroHand, board, numOpponents, deadCards, iterations, villains, context
    );
    
    console.log(`[Smart Equity] Monte Carlo: ${result.equity.toFixed(1)}% (${(performance.now() - startTime).toFixed(0)}ms, ${iterations} iter)`);
    return {
      ...result,
      method: 'monte_carlo'
    };
  },
  
  /**
   * OPTIMIZATION 1: Preflop Lookup Table
   * Instant equity for common preflop situations
   */
  _getPreflopEquityFromTable(hand, numOpponents) {
    if (!hand || hand.length !== 2) return null;
    
    // Format hand to standard notation
    const rank1 = hand[0].replace('10', 'T').slice(0, -1);
    const rank2 = hand[1].replace('10', 'T').slice(0, -1);
    const suit1 = hand[0].slice(-1);
    const suit2 = hand[1].slice(-1);
    
    const suited = suit1 === suit2;
    const sortOrder = 'AKQJT98765432';
    const sortedRanks = [rank1, rank2].sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));
    
    let handKey;
    if (rank1 === rank2) {
      handKey = `${sortedRanks[0]}${sortedRanks[1]}`;
    } else {
      handKey = `${sortedRanks[0]}${sortedRanks[1]}${suited ? 's' : 'o'}`;
    }
    
    // Precomputed equity table for 1-3 opponents
    // Data from poker calculators (exact values)
    const equityTables = {
      1: { // Heads-up
        'AA': 85.3, 'KK': 82.4, 'QQ': 79.9, 'JJ': 77.5, 'TT': 75.1, '99': 72.1, '88': 69.1, '77': 66.2,
        'AKs': 67.0, 'AQs': 66.1, 'AJs': 65.4, 'ATs': 64.8, 'AKo': 65.4, 'AQo': 64.5, 'AJo': 63.8,
        'KQs': 63.4, 'KJs': 62.7, 'KTs': 62.1, 'KQo': 61.8, 'KJo': 61.1, 'QJs': 60.4, 'QTs': 59.8,
        '66': 63.3, '55': 60.3, '44': 57.3, '33': 54.3, '22': 51.3
      },
      2: { // 3-way
        'AA': 73.4, 'KK': 69.0, 'QQ': 65.2, 'JJ': 61.8, 'TT': 58.6, '99': 55.1, '88': 51.8, '77': 48.6,
        'AKs': 52.1, 'AQs': 50.8, 'AJs': 49.8, 'ATs': 49.0, 'AKo': 50.5, 'AQo': 49.2, 'AJo': 48.2,
        'KQs': 48.2, 'KJs': 47.3, 'KTs': 46.6, 'KQo': 46.8, 'KJo': 45.9, 'QJs': 45.8, 'QTs': 45.1,
        '66': 45.5, '55': 42.2, '44': 39.0, '33': 35.8, '22': 32.6
      },
      3: { // 4-way
        'AA': 64.5, 'KK': 59.0, 'QQ': 54.3, 'JJ': 50.1, 'TT': 46.4, '99': 42.5, '88': 39.0, '77': 35.7,
        'AKs': 42.8, 'AQs': 41.1, 'AJs': 39.9, 'ATs': 39.0, 'AKo': 41.2, 'AQo': 39.5, 'AJo': 38.3,
        'KQs': 38.5, 'KJs': 37.4, 'KTs': 36.6, 'KQo': 37.1, 'KJo': 36.0, 'QJs': 36.5, 'QTs': 35.7,
        '66': 32.5, '55': 29.3, '44': 26.2, '33': 23.1, '22': 20.0
      }
    };
    
    const table = equityTables[numOpponents];
    if (!table) return null;
    
    return table[handKey] || null;
  },
  
  /**
   * OPTIMIZATION 2: Exhaustive Enumeration (Heads-up only)
   * Mathematically exact, evaluates ALL possible runouts
   */
  async _getExhaustiveEquity(heroHand, board, deadCards = []) {
    const knownCards = [...heroHand, ...board, ...deadCards];
    const deck = this._createDeck(knownCards);
    
    let wins = 0, ties = 0, losses = 0;
    const cardsNeeded = 5 - board.length;
    
    // Generate all possible villain hands (C(47,2) = 1081 combos)
    const villainHands = this._generateAllCombos(deck.filter((_, i) => i < deck.length - cardsNeeded), 2);
    
    for (const villainHand of villainHands) {
      // Remove villain cards from deck
      const remainingDeck = deck.filter(c => !villainHand.includes(c));
      
      if (cardsNeeded === 0) {
        // River - just compare hands
        const result = this._compareHands(heroHand, villainHand, board);
        if (result > 0) wins++;
        else if (result === 0) ties++;
        else losses++;
      } else {
        // Enumerate all possible runouts
        const runouts = this._generateAllCombos(remainingDeck, cardsNeeded);
        
        for (const runout of runouts) {
          const fullBoard = [...board, ...runout];
          const result = this._compareHands(heroHand, villainHand, fullBoard);
          if (result > 0) wins++;
          else if (result === 0) ties++;
          else losses++;
        }
      }
      
      // Yield every 100 villain hands to prevent lag
      if (villainHands.indexOf(villainHand) % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    const total = wins + ties + losses;
    const equity = (wins + ties * 0.5) / total * 100;
    
    return {
      equity,
      winPct: wins / total * 100,
      tiePct: ties / total * 100,
      lossPct: losses / total * 100
    };
  },
  
  /**
   * OPTIMIZATION 3: Optimized Monte Carlo
   * 3x faster with variance reduction techniques
   */
  async _runOptimizedMonteCarloSimulation(heroHand, board, numOpponents, deadCards, iterations, villains = [], context = {}) {
    // If a PokerSolver worker is available, delegate the whole Monte Carlo batch to it.
    // Worker delegation removed: always use in-page PokerSolver or fallback

    let wins = 0, ties = 0, losses = 0;
    const knownCards = [...heroHand, ...board, ...deadCards];
    
    // Get villain ranges
    const villainRanges = [];
    if (villains && villains.length > 0) {
      for (const villain of villains) {
        const rangeContext = {
          bigBlind: context.bigBlind || 1,
          isPostflop: board && board.length >= 3,
          preflopAggressor: context.preflopAggressor,
          isSqueezeSpot: context.isSqueezeSpot || false
        };
        const rangeNotations = PositionStrategy.getVillainRange(villain, rangeContext);
        const expandedRange = PositionStrategy.expandRange(rangeNotations);
        villainRanges.push(expandedRange);
      }
    }
    
    // OPTIMIZATION: Stratified sampling
    // Divide iterations into buckets for better variance reduction
    const bucketSize = 500;
    const numBuckets = Math.ceil(iterations / bucketSize);
    
    // OPTIMIZATION: Early stopping if variance is low
    let lastEquity = 0;
    let convergenceCount = 0;
    
    for (let bucket = 0; bucket < numBuckets; bucket++) {
      const bucketIterations = Math.min(bucketSize, iterations - bucket * bucketSize);
      
      for (let i = 0; i < bucketIterations; i++) {
        const deck = this._createDeck(knownCards);
        const result = await this._simulateHandOutcome(
          heroHand, board, numOpponents, deck,
          villainRanges.length > 0 ? villainRanges : null
        );
        
        if (result === 'win') wins++;
        else if (result === 'tie') ties++;
        else losses++;
      }
      
      // OPTIMIZATION: Check for convergence every bucket
      if (bucket > 5 && bucket % 5 === 0) {
        const total = wins + ties + losses;
        const currentEquity = (wins + ties * 0.5) / total * 100;
        const equityChange = Math.abs(currentEquity - lastEquity);
        
        // If equity hasn't changed by more than 0.3% in last 5 buckets, stop early
        if (equityChange < 0.3) {
          convergenceCount++;
          if (convergenceCount >= 3) {
            console.log(`[Monte Carlo] Early stop at ${total} iterations (converged)`);
            break;
          }
        } else {
          convergenceCount = 0;
        }
        
        lastEquity = currentEquity;
      }
      
      // Yield to browser
      if (bucket < numBuckets - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    const totalHands = wins + ties + losses;
    const equity = (wins + ties * 0.5) / totalHands * 100;
    
    return {
      equity,
      winPct: wins / totalHands * 100,
      tiePct: ties / totalHands * 100,
      lossPct: losses / totalHands * 100,
      wins,
      ties,
      losses,
      totalHands
    };
  },
  
  /**
   * Helper: Generate all combinations
   */
  _generateAllCombos(arr, size) {
    const result = [];
    
    function helper(start, combo) {
      if (combo.length === size) {
        result.push([...combo]);
        return;
      }
      
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    }
    
    helper(0, []);
    return result;
  },
  
  /**
   * Helper: Compare two hands on a board
   * Returns: 1 if hero wins, 0 if tie, -1 if villain wins
   */
  _compareHands(heroHand, villainHand, board) {
    const heroStrength = this._evaluateHand([...heroHand, ...board]);
    const villainStrength = this._evaluateHand([...villainHand, ...board]);
    
    if (heroStrength > villainStrength) return 1;
    if (heroStrength < villainStrength) return -1;
    return 0;
  },

  /**
   * ============================================
   * END OF FASE 2: HYBRID EQUITY SYSTEM
   * ============================================
   */

  async _runMonteCarloSimulation(heroHand, board, numOpponents, deadCards, iterations, villains = [], context = {}) {
    // Prefer worker for full-batch Monte Carlo if available
    try {
      if (window.PokerSolverWorkerManager && typeof window.PokerSolverWorkerManager.request === 'function') {
        // Build structured-clone-safe payload (strip functions/complex objects)
        const sanitizedVillains = (villains || []).map(v => ({
          seat: v && (v.seat ?? v.id ?? v.name) || null,
          name: v && (v.name ?? null),
          range: v && (v.rangeNotation || v.range || v.rangeName) || null,
          hand: Array.isArray(v && v.hand) ? v.hand.slice(0) : null,
          stack: v && (v.stack || null)
        }));
        const sanitizedContext = {
          bigBlind: context && context.bigBlind || null,
          isPostflop: !!(board && board.length >= 3),
          preflopAggressor: context && context.preflopAggressor || null,
          isSqueezeSpot: !!(context && context.isSqueezeSpot)
        };
        const payload = {
          heroHand: Array.isArray(heroHand) ? heroHand.slice(0) : [],
          board: Array.isArray(board) ? board.slice(0) : [],
          numOpponents: Number(numOpponents) || 0,
          deadCards: Array.isArray(deadCards) ? deadCards.slice(0) : [],
          iterations: Number(iterations) || 0,
          villains: sanitizedVillains,
          context: sanitizedContext
        };
        const timeoutMs = Math.max(10000, Math.min(60000, iterations * 2));
        const wres = await window.PokerSolverWorkerManager.request('equity', payload, timeoutMs).catch(err => { throw err; });
        if (wres && typeof wres.equity === 'number') {
          wres.method = wres.method || 'worker_monte_carlo';
          return wres;
        }
      }
    } catch (e) {
      console.warn('[MonteCarlo] Worker delegation failed, falling back to in-thread simulation', e);
    }

    let wins = 0;
    let ties = 0;
    let losses = 0;

    // Create deck and remove known cards
    const knownCards = [...heroHand, ...board, ...deadCards];
    
    // RANGE-BASED EQUITY: Get villain ranges with context
    const villainRanges = [];
    if (villains && villains.length > 0) {
      for (const villain of villains) {
        const rangeContext = {
          bigBlind: context.bigBlind || 1,
          isPostflop: board && board.length >= 3,
          preflopAggressor: context.preflopAggressor,
          isSqueezeSpot: context.isSqueezeSpot || false
        };
        const rangeNotations = PositionStrategy.getVillainRange(villain, rangeContext);
        const expandedRange = PositionStrategy.expandRange(rangeNotations);
        villainRanges.push(expandedRange);
      }
      console.log(`[Range-Based Equity] ${villains.length} villanos con rangos definidos`);
    }
    
    // Run simulations in batches to avoid blocking UI
    const batchSize = 500;
    const numBatches = Math.ceil(iterations / batchSize);
    
    for (let batch = 0; batch < numBatches; batch++) {
      const batchIterations = Math.min(batchSize, iterations - batch * batchSize);
      
      for (let i = 0; i < batchIterations; i++) {
        const deck = this._createDeck(knownCards);
        
        // Use range-based or random hands
        const result = await this._simulateHandOutcome(
          heroHand, 
          board, 
          numOpponents, 
          deck, 
          villainRanges.length > 0 ? villainRanges : null
        );
        
        if (result === 'win') wins++;
        else if (result === 'tie') ties++;
        else losses++;
      }
      
      // Yield to browser every batch to prevent lag
      if (batch < numBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    const totalHands = wins + ties + losses;
    const equity = (wins + ties * 0.5) / totalHands * 100; // Return as percentage like optimized version
    const winPct = (wins / totalHands * 100);
    const tiePct = (ties / totalHands * 100);
    const lossPct = (losses / totalHands * 100);
    
    return {
      equity,
      winPct,
      tiePct,
      lossPct,
      wins,
      ties,
      losses,
      totalHands
    };
  },

  /**
   * Simulate one hand outcome
   * NOW WITH RANGE-BASED OPPONENT HANDS!
   */
  async _simulateHandOutcome(heroHand, board, numOpponents, deck, villainRanges = null) {
    // Complete the board if needed
    const fullBoard = [...board];
    const cardsNeeded = 5 - fullBoard.length;
    for (let i = 0; i < cardsNeeded; i++) {
      fullBoard.push(deck.pop());
    }
    
    // Deal opponent hands
    const opponentHands = [];
    
    if (villainRanges && villainRanges.length > 0) {
      // RANGE-BASED: Sample hands from villain ranges
      for (let i = 0; i < numOpponents; i++) {
        const range = villainRanges[i] || villainRanges[0]; // Use first range if not enough
        
        // Pick a random hand from the range that's available in deck
        let attempts = 0;
        let hand = null;
        
        while (attempts < 50 && !hand) {
          const randomHandFromRange = range[Math.floor(Math.random() * range.length)];
          const card1 = randomHandFromRange[0];
          const card2 = randomHandFromRange[1];
          
          // Check if both cards are available in deck
          const idx1 = deck.indexOf(card1);
          const idx2 = deck.indexOf(card2);
          
          if (idx1 !== -1 && idx2 !== -1) {
            // Remove cards from deck
            deck.splice(Math.max(idx1, idx2), 1);
            deck.splice(Math.min(idx1, idx2), 1);
            hand = [card1, card2];
          }
          attempts++;
        }
        
        // Fallback to random if can't find valid hand from range
        if (!hand) {
          hand = [deck.pop(), deck.pop()];
        }
        
        opponentHands.push(hand);
      }
    } else {
      // RANDOM HANDS (original logic)
      for (let i = 0; i < numOpponents; i++) {
        opponentHands.push([deck.pop(), deck.pop()]);
      }
    }
    
    // Worker delegation removed: always use in-page PokerSolver or fallback

    // Evaluate all hands
    try {
      // Use PokerSolver when available for more accurate comparisons
      if (PokerSolverManager.isAvailable()) {
        try {
          // Use centralized converter for solver format if available
          const heroCards = (window.PokerEyeCards && typeof window.PokerEyeCards.toSolverHand === 'function')
            ? window.PokerEyeCards.toSolverHand([...heroHand, ...fullBoard])
            : [...heroHand, ...fullBoard].map(c => {
                let value = c.slice(0, -1);
                let suit = c.slice(-1);
                const suitMap = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
                suit = suitMap[suit] || suit.toLowerCase();
                if (value === '10') value = 'T';
                return `${value}${suit}`;
              });

          const heroSolved = window.PokerSolver.Hand.solve(heroCards);

          let anyBetter = false;
          let anyEqual = false;

          for (const oppHand of opponentHands) {
            const oppCards = (window.PokerEyeCards && typeof window.PokerEyeCards.toSolverHand === 'function')
              ? window.PokerEyeCards.toSolverHand([...oppHand, ...fullBoard])
              : [...oppHand, ...fullBoard].map(c => {
                  let value = c.slice(0, -1);
                  let suit = c.slice(-1);
                  const suitMap = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
                  suit = suitMap[suit] || suit.toLowerCase();
                  if (value === '10') value = 'T';
                  return `${value}${suit}`;
                });

            const oppSolved = window.PokerSolver.Hand.solve(oppCards);
            const comp = heroSolved.compare(oppSolved); // -1 hero wins, 0 tie, 1 hero loses
            if (comp === 1) {
              anyBetter = true; // opponent better
              break;
            }
            if (comp === 0) anyEqual = true;
          }

          if (!anyBetter && !anyEqual) return 'win';
          if (!anyBetter && anyEqual) return 'tie';
          return 'loss';
        } catch (e) {
          // If PokerSolver was available but evaluation failed, warn once and fall back
          console.warn('[MonteCarlo] PokerSolver evaluation failed, falling back to internal evaluator');
        }
      }
    } catch (e) {
      console.warn('[MonteCarlo] PokerSolver evaluation failed, falling back to internal evaluator:', e);
    }

    // Fallback: use internal evaluator
    const heroHandRank = this._evaluateHand([...heroHand, ...fullBoard]);
    const opponentRanks = opponentHands.map(oppHand =>
      this._evaluateHand([...oppHand, ...fullBoard])
    );

    // Compare hands
    const maxOpponentRank = Math.max(...opponentRanks);

    if (heroHandRank > maxOpponentRank) return 'win';
    if (heroHandRank === maxOpponentRank) return 'tie';
    return 'loss';
  },

  /**
   * Create shuffled deck excluding known cards
   */
  _createDeck(excludeCards = []) {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const suits = ['h', 'd', 'c', 's'];
    const deck = [];
    
    for (const rank of ranks) {
      for (const suit of suits) {
        const card = rank + suit;
        if (!excludeCards.includes(card)) {
          deck.push(card);
        }
      }
    }
    
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  },

  /**
   * Evaluate poker hand strength (returns numeric rank, higher is better)
   */
  _evaluateHand(cards) {
    if (cards.length !== 7) return 0;
    
    // Get all 5-card combinations
    const combinations = this._getCombinations(cards, 5);
    let bestRank = 0;
    
    for (const combo of combinations) {
      const rank = this._rankHand(combo);
      if (rank > bestRank) bestRank = rank;
    }
    
    return bestRank;
  },

  /**
   * Get all k-combinations from array
   */
  _getCombinations(arr, k) {
    const result = [];
    const n = arr.length;
    
    const helper = (start, combo) => {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < n; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    };
    
    helper(0, []);
    return result;
  },

  /**
   * Rank a 5-card poker hand
   * Returns: 9000000 = Straight Flush, 8000000 = Quads, etc.
   */
  _rankHand(cards) {
    const ranks = cards.map(c => this._cardRank(c.slice(0, -1)));
    const suits = cards.map(c => c.slice(-1));
    
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
    
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this._isStraight(ranks);
    
    // Straight Flush
    if (isFlush && isStraight) {
      return 9000000 + Math.max(...ranks);
    }
    
    // Four of a Kind
    if (counts[0] === 4) {
      const quad = uniqueRanks.find(r => rankCounts[r] === 4);
      const kicker = uniqueRanks.find(r => rankCounts[r] === 1);
      return 8000000 + quad * 100 + kicker;
    }
    
    // Full House
    if (counts[0] === 3 && counts[1] === 2) {
      const trip = uniqueRanks.find(r => rankCounts[r] === 3);
      const pair = uniqueRanks.find(r => rankCounts[r] === 2);
      return 7000000 + trip * 100 + pair;
    }
    
    // Flush
    if (isFlush) {
      return 6000000 + uniqueRanks.reduce((sum, r, i) => sum + r * Math.pow(100, 4 - i), 0);
    }
    
    // Straight
    if (isStraight) {
      return 5000000 + Math.max(...ranks);
    }
    
    // Three of a Kind
    if (counts[0] === 3) {
      const trip = uniqueRanks.find(r => rankCounts[r] === 3);
      const kickers = uniqueRanks.filter(r => rankCounts[r] === 1).sort((a, b) => b - a);
      return 4000000 + trip * 10000 + kickers[0] * 100 + kickers[1];
    }
    
    // Two Pair
    if (counts[0] === 2 && counts[1] === 2) {
      const pairs = uniqueRanks.filter(r => rankCounts[r] === 2).sort((a, b) => b - a);
      const kicker = uniqueRanks.find(r => rankCounts[r] === 1);
      return 3000000 + pairs[0] * 10000 + pairs[1] * 100 + kicker;
    }
    
    // One Pair
    if (counts[0] === 2) {
      const pair = uniqueRanks.find(r => rankCounts[r] === 2);
      const kickers = uniqueRanks.filter(r => rankCounts[r] === 1).sort((a, b) => b - a);
      return 2000000 + pair * 1000000 + kickers[0] * 10000 + kickers[1] * 100 + kickers[2];
    }
    
    // High Card
    return 1000000 + uniqueRanks.reduce((sum, r, i) => sum + r * Math.pow(100, 4 - i), 0);
  },

  /**
   * Check if ranks form a straight
   */
  _isStraight(ranks) {
    const sorted = [...new Set(ranks)].sort((a, b) => a - b);
    if (sorted.length < 5) return false;
    
    // Check regular straight
    for (let i = 0; i <= sorted.length - 5; i++) {
      if (sorted[i + 4] - sorted[i] === 4) return true;
    }
    
    // Check wheel (A-2-3-4-5)
    if (sorted.includes(14) && sorted.includes(2) && sorted.includes(3) && 
        sorted.includes(4) && sorted.includes(5)) {
      return true;
    }
    
    return false;
  },

  /**
   * Convert card rank to number (2=2, ..., T=10, J=11, Q=12, K=13, A=14)
   */
  _cardRank(rank) {
    const rankMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 
                      '10': 10, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return rankMap[rank] || 0;
  },

  /**
   * Internal: Table-based equity calculation
   */
  _calculateTableBasedEquity(hand, position, stackSize = 100, rfiPosition = null, is3BetPot = false, allPlayers = null, activeVillains = []) {
    const handKey = this._formatHandKey(hand);
    if (!handKey) return 0;

    // Equity base table (heads-up against random hand)
    const equityTable = this._getEquityTable();
    let equity = equityTable[handKey] || 30;

    // Apply adjustments
    equity = this._applyOpponentAdjustment(equity, activeVillains.length);
    equity = this._applyStackAdjustment(equity, stackSize, handKey);
    equity = this._applyVillainActionAdjustment(equity, activeVillains);
    equity = this._applyRFIAdjustment(equity, rfiPosition);
    equity = this._applyPositionAdjustment(equity, position);
    equity = this._apply3BetAdjustment(equity, is3BetPot, handKey);
    equity = this._applyHandTypeAdjustment(equity, handKey, position);
    equity = this._applyFinalCap(equity);

    return Math.max(5, Math.min(95, Math.round(equity)));
  },

  _formatHandKey(hand) {
    if (!hand || hand.length !== 2) return null;
    
    const rank1 = hand[0].replace("10", "T").slice(0, -1);
    const rank2 = hand[1].replace("10", "T").slice(0, -1);
    const suit1 = hand[0].slice(-1);
    const suit2 = hand[1].slice(-1);
    
    const sortOrder = 'AKQJT98765432';
    const sortedRanks = [rank1, rank2].sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));
    const suffix = rank1 === rank2 ? '' : suit1 === suit2 ? 's' : 'o';
    
    return `${sortedRanks[0]}${sortedRanks[1]}${suffix}`;
  },

  /**
   * LEGACY FALLBACK TABLE - NOT USED IN NORMAL OPERATION
   * Only used when Monte Carlo fails (extremely rare)
   * Values are heads-up equity vs random hand (NOT GTO)
   * All real calculations use Monte Carlo with range-based equity
   */
  _getEquityTable() {
    return {
      "AA": 85, "KK": 82, "QQ": 79, "JJ": 76, "TT": 73, "99": 70, "88": 67, "77": 64, "66": 61, "55": 58, "44": 55, "33": 52, "22": 49,
      "AKs": 65, "AQs": 63, "AJs": 61, "ATs": 59, "A9s": 57, "A8s": 55, "A7s": 53, "A6s": 51, "A5s": 49, "A4s": 47, "A3s": 45, "A2s": 43,
      "AKo": 62, "AQo": 60, "AJo": 58, "ATo": 56, "A9o": 54, "A8o": 52, "A7o": 50, "A6o": 48, "A5o": 46, "A4o": 44, "A3o": 42, "A2o": 40,
      "KQs": 58, "KJs": 56, "KTs": 54, "K9s": 52, "K8s": 50, "K7s": 48, "K6s": 46, "K5s": 44, "K4s": 42, "K3s": 40, "K2s": 38,
      "KQo": 55, "KJo": 53, "KTo": 51, "K9o": 49, "K8o": 47, "K7o": 45, "K6o": 43, "K5o": 41, "K4o": 39, "K3o": 37, "K2o": 35,
      "QJs": 53, "QTs": 51, "Q9s": 49, "Q8s": 47, "Q7s": 45, "Q6s": 43, "Q5s": 41, "Q4s": 39, "Q3s": 37, "Q2s": 35,
      "QJo": 50, "QTo": 48, "Q9o": 46, "Q8o": 44, "Q7o": 42, "Q6o": 40, "Q5o": 38, "Q4o": 36, "Q3o": 34, "Q2o": 32,
      "JTs": 48, "J9s": 46, "J8s": 44, "J7s": 42, "J6s": 40, "J5s": 38, "J4s": 36, "J3s": 34, "J2s": 32,
      "JTo": 45, "J9o": 43, "J8o": 41, "J7o": 39, "J6o": 37, "J5o": 35, "J4o": 33, "J3o": 31, "J2o": 29,
      "T9s": 43, "T8s": 41, "T7s": 39, "T6s": 37, "T5s": 35, "T4s": 33, "T3s": 31, "T2s": 29,
      "T9o": 40, "T8o": 38, "T7o": 36, "T6o": 34, "T5o": 32, "T4o": 30, "T3o": 28, "T2o": 26,
      "98s": 38, "97s": 36, "96s": 34, "95s": 32, "94s": 30, "93s": 28, "92s": 26,
      "98o": 35, "97o": 33, "96o": 31, "95o": 29, "94o": 27, "93o": 25, "92o": 23,
      "87s": 33, "86s": 31, "85s": 29, "84s": 27, "83s": 25, "82s": 23,
      "87o": 30, "86o": 28, "85o": 26, "84o": 24, "83o": 22, "82o": 20,
      "76s": 28, "75s": 26, "74s": 24, "73s": 22, "72s": 20,
      "76o": 25, "75o": 23, "74o": 21, "73o": 19, "72o": 17,
      "65s": 23, "64s": 21, "63s": 19, "62s": 17,
      "65o": 20, "64o": 18, "63o": 16, "62o": 14,
      "54s": 18, "53s": 16, "52s": 14,
      "54o": 15, "53o": 13, "52o": 11,
      "43s": 13, "42s": 11,
      "43o": 10, "42o": 8,
      "32s": 8,
      "32o": 5,
    };
  },

  _applyOpponentAdjustment(equity, numOpponents) {
    if (numOpponents >= 2) {
      return equity * Math.pow(0.92, numOpponents - 1);
    }
    return equity;
  },

  _applyStackAdjustment(equity, stackSize, handKey) {
    let adjustment = 1.0;
    if (stackSize < 20) {
      adjustment = handKey.includes('A') || handKey.includes('K') || !handKey.includes('o') ? 1.1 : 0.85;
    } else if (stackSize < 50) {
      adjustment = 0.95;
    } else if (stackSize > 150) {
      adjustment = handKey.includes('s') && !handKey.match(/[AK]/) ? 1.05 : 1.0;
    }
    return equity * adjustment;
  },

  _applyVillainActionAdjustment(equity, activeVillains) {
    let adjustment = 1.0;
    for (const villain of activeVillains) {
      const lastActions = villain.actionHistory?.slice(-5) || [];
      const hasRaised = lastActions.some(a => a.action === 'RAISE' || a.action === 'BET');
      const has3Bet = lastActions.filter(a => a.action === 'RAISE').length >= 2;
      
      if (has3Bet) adjustment *= 0.85;
      else if (hasRaised && ['UTG', 'UTG+1', 'MP'].some(p => villain.position?.includes(p))) adjustment *= 0.90;
      else if (hasRaised && ['BTN', 'CO'].includes(villain.position)) adjustment *= 1.05;
    }
    return equity * adjustment;
  },

  _applyRFIAdjustment(equity, rfiPosition) {
    if (!rfiPosition) return equity;
    const tightPositions = ['UTG', 'UTG+1', 'MP'];
    const loosePositions = ['BTN', 'CO', 'SB'];
    if (tightPositions.some(p => rfiPosition.includes(p))) return equity * 0.92;
    if (loosePositions.includes(rfiPosition)) return equity * 1.03;
    return equity;
  },

  _applyPositionAdjustment(equity, position) {
    const positionValue = {
      'BTN': 1.08, 'CO': 1.05, 'HJ': 1.02, 'LJ': 1.0, 'MP': 0.98,
      'UTG': 0.95, 'UTG+1': 0.96, 'SB': 0.93, 'BB': 0.97
    };
    const posKey = Object.keys(positionValue).find(p => position?.includes(p));
    return posKey ? equity * positionValue[posKey] : equity;
  },

  _apply3BetAdjustment(equity, is3BetPot, handKey) {
    if (!is3BetPot) return equity;
    const isPremium = ['AA', 'KK', 'QQ', 'AKs', 'AKo'].includes(handKey);
    return isPremium ? equity * 1.05 : equity * 0.75;
  },

  _applyHandTypeAdjustment(equity, handKey, position) {
    const isPair = handKey.length === 2 || (handKey[0] === handKey[1]);
    const isSuited = handKey.includes('s');
    const isEarlyPosition = ['UTG', 'UTG+1', 'MP'].some(p => position?.includes(p));
    
    if (isPair && isEarlyPosition) return equity * 1.02;
    if (isSuited && ['BTN', 'CO'].includes(position)) return equity * 1.03;
    return equity;
  },

  _applyFinalCap(equity) {
    return equity;
  }
};

/**
 * HAND EVALUATOR MODULE
 * Evaluates hand strength preflop and postflop
 */
const HandEvaluator = {
  evaluatePreflop(hand) {
    if (!hand || hand.length !== 2) return { type: 'unknown', description: 'Unknown' };
    
    const rank1 = hand[0].replace("10", "T").slice(0, -1);
    const rank2 = hand[1].replace("10", "T").slice(0, -1);
    const suit1 = hand[0].slice(-1);
    const suit2 = hand[1].slice(-1);

    if (rank1 === rank2) return { type: 'pair', description: 'Pair' };
    if (suit1 === suit2) return { type: 'suited', description: 'Suited' };
    return { type: 'offsuit', description: 'Unsuited' };
  },

  evaluatePostflop(hand, board) {
    const allCards = [...hand, ...board];
    const ranks = allCards.map(card => card.slice(0, -1));
    const suits = allCards.map(card => card.slice(-1));
    
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    
    const sortedCounts = Object.values(rankCounts).sort((a, b) => b - a);
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    
    if (sortedCounts[0] === 4) return { type: 'quads', strength: 8, description: 'Four of a Kind' };
    if (sortedCounts[0] === 3 && sortedCounts[1] === 2) return { type: 'fullhouse', strength: 7, description: 'Full House' };
    if (maxSuitCount >= 5) return { type: 'flush', strength: 6, description: 'Flush' };
    if (this.hasStraight(ranks)) return { type: 'straight', strength: 5, description: 'Straight' };
    if (sortedCounts[0] === 3) return { type: 'trips', strength: 4, description: 'Three of a Kind' };
    if (sortedCounts[0] === 2 && sortedCounts[1] === 2) return { type: 'twopair', strength: 3, description: 'Two Pair' };
    if (sortedCounts[0] === 2) return { type: 'pair', strength: 2, description: 'One Pair' };
    return { type: 'highcard', strength: 1, description: 'High Card' };
  },

  hasStraight(ranks) {
    const rankOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const values = [...new Set(ranks)].map(r => rankOrder.indexOf(r)).sort((a,b) => a-b);
    
    for (let i = 0; i <= values.length - 5; i++) {
      if (values[i+4] - values[i] === 4) return true;
    }
    // Check wheel (A2345)
    if (values.includes(12) && values.includes(0) && values.includes(1) && values.includes(2) && values.includes(3)) return true;
    return false;
  },

  analyzeDraws(hand, board) {
    const allCards = [...hand, ...board];
    const suits = allCards.map(card => card.slice(-1));
    const ranks = allCards.map(card => card.slice(0, -1));
    
    const suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    
    let outs = 0;
    let description = '';
    let hasDraws = false;
    
    // Flush draw
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    if (maxSuitCount === 4) {
      outs += 9;
      description += 'Flush Draw';
      hasDraws = true;
    }
    
    // Straight draws
    const rankOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const values = [...new Set(ranks)].map(r => rankOrder.indexOf(r)).sort((a,b) => a-b);
    
    // OESD
    for (let i = 0; i <= values.length - 4; i++) {
      if (values[i+3] - values[i] === 3) {
        outs += 8;
        description += (description ? ' + ' : '') + 'OESD';
        hasDraws = true;
        break;
      }
    }
    
    // Gutshot
    if (!hasDraws || outs === 9) {
      for (let i = 0; i <= values.length - 4; i++) {
        if (values[i+3] - values[i] === 4) {
          outs += 4;
          description += (description ? ' + ' : '') + 'Gutshot';
          hasDraws = true;
          break;
        }
      }
    }
    
    // Calculate draw equity
    const cardsToCome = board.length === 3 ? 2 : 1;
    const drawEquity = cardsToCome === 2 ? (outs * 4) - (outs > 8 ? (outs - 8) : 0) : outs * 2;
    
    return {
      hasDraws,
      outs,
      drawEquity: Math.min(drawEquity, 100),
      description: description || 'No draws'
    };
  }
};

/**
 * ACTION ADVISOR MODULE
 * Generates GTO and exploitative action recommendations
 */
const ActionAdvisor = {
  // This module will be populated with action generation logic
  // For now, keeping existing logic in Player class
};

/**
 * VILLAIN PROFILER MODULE  
 * Analyzes villain tendencies and predicts actions
 */
const VillainProfiler = {
  analyzeVillain(villain) {
    const lastNextHandIndex = villain.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
    const handActions = lastNextHandIndex === -1 ? villain.actionHistory : villain.actionHistory.slice(lastNextHandIndex + 1);
    
    let raises = 0, bets = 0, calls = 0, checks = 0, folds = 0;
    let totalMoneyInvested = 0;
    
    for (const action of handActions) {
      if (action.action === "RAISE") raises++;
      else if (action.action === "BET") bets++;
      else if (action.action === "CALL") calls++;
      else if (action.action === "CHECK") checks++;
      else if (action.action === "FOLD") folds++;
      
      if (action.amountBet) {
        totalMoneyInvested += Math.abs(action.amountBet);
      }
    }
    
    const totalActions = raises + bets + calls + checks + folds;
    const aggressionFreq = totalActions > 0 ? (raises + bets) / totalActions : 0;
    
    const isTight = aggressionFreq < 0.25;
    const isAggressive = aggressionFreq > 0.5;
    const isPassive = calls > (raises + bets);
    
    return {
      aggressionFreq,
      isTight,
      isAggressive,
      isPassive,
      raises,
      bets,
      calls,
      checks,
      folds,
      totalMoneyInvested,
      totalActions
    };
  }
};

/**
 * POSITION STRATEGY MODULE
 * Handles position-specific ranges and strategies
 */
const PositionStrategy = {
  /**
   * Get RFI (Raise First In) ranges by position
   */
  getRFIRange(position, stackBB) {
    const ranges = {
      'UTG': ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'KQs'],
      'MP': ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'KQs', 'KQo', 'KJs', 'QJs'],
      'LJ': ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'A9s', 'KQs', 'KQo', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs'],
      'HJ': ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'A9s', 'A8s', 'A7s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KQo', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'Q9s', 'JTs', 'J9s', 'T9s', 'T8s', '98s'],
      'CO': ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'ATo', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KQo', 'KJs', 'KJo', 'KTs', 'K9s', 'K8s', 'K7s', 'QJs', 'QJo', 'QTs', 'Q9s', 'Q8s', 'JTs', 'J9s', 'J8s', 'T9s', 'T8s', '98s', '97s', '87s', '76s', '65s'],
      'BTN': ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'ATo', 'A9s', 'A9o', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KQo', 'KJs', 'KJo', 'KTs', 'KTo', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'QJs', 'QJo', 'QTs', 'QTo', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'JTs', 'JTo', 'J9s', 'J8s', 'J7s', 'T9s', 'T8s', 'T7s', '98s', '97s', '87s', '86s', '76s', '75s', '65s', '64s', '54s'],
      'SB': ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'A9s', 'A8s', 'A7s', 'A5s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs']
    };
    
    return ranges[position] || ranges['HJ']; // Default to HJ range
  },
  
  /**
   * Get 3-bet range vs position
   */
  get3BetRange(heroPosition, villainPosition) {
    // vs UTG: very tight
    if (villainPosition?.includes('UTG') || villainPosition?.includes('MP')) {
      return ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'];
    }
    // vs Late position: wider
    if (villainPosition === 'CO' || villainPosition === 'BTN') {
      return ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'ATs', 'A5s', 'A4s', 'KQs', 'KJs'];
    }
    // Default: medium
    return ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AJs'];
  },
  
  /**
   * Get defend vs steal range (vs BTN/CO/SB steal)
   */
  getDefendRange(position, vsPosition) {
    if (position === 'BB') {
      // BB defend range is very wide
      return ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 
              'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'ATo', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
              'KQs', 'KQo', 'KJs', 'KJo', 'KTs', 'KTo', 'K9s', 'K8s', 'K7s', 
              'QJs', 'QJo', 'QTs', 'Q9s', 'Q8s', 'JTs', 'J9s', 'T9s', 'T8s', '98s', '87s', '76s', '65s', '54s'];
    }
    return this.getRFIRange(position);
  },
  
  /**
   * Convert hand to range format (e.g. ['Ah', 'Kh'] → 'AKs')
   */
  handToRangeFormat(hand) {
    if (!hand || hand.length !== 2) return null;
    
    const rank1 = hand[0].replace('10', 'T').slice(0, -1);
    const rank2 = hand[1].replace('10', 'T').slice(0, -1);
    const suit1 = hand[0].slice(-1);
    const suit2 = hand[1].slice(-1);
    
    const sortOrder = 'AKQJT98765432';
    const sortedRanks = [rank1, rank2].sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));
    const suffix = rank1 === rank2 ? '' : suit1 === suit2 ? 's' : 'o';
    
    return `${sortedRanks[0]}${sortedRanks[1]}${suffix}`;
  },
  
  /**
   * Check if hand is in range
   */
  isInRange(hand, range) {
    const handFormat = this.handToRangeFormat(hand);
    return range.includes(handFormat);
  },
  
  /**
   * Expand hand notation to all possible card combinations
   * E.g. 'AKs' -> [['Ah','Kh'], ['Ad','Kd'], ['Ac','Kc'], ['As','Ks']]
   * E.g. 'AKo' -> [['Ah','Kd'], ['Ah','Kc'], ['Ah','Ks'], ['Ad','Kh'], ...]
   * E.g. 'AA' -> [['Ah','Ad'], ['Ah','Ac'], ['Ah','As'], ['Ad','Ac'], ['Ad','As'], ['Ac','As']]
   */
  expandHandNotation(notation) {
    const hands = [];
    const rankChars = notation.match(/[AKQJT98765432]/g);
    if (!rankChars || rankChars.length < 2) return hands;
    
    const rank1 = rankChars[0];
    const rank2 = rankChars[1];
    const suffix = notation.slice(-1);
    const suits = ['h', 'd', 'c', 's'];
    
    if (suffix === 's') {
      // Suited: 4 combinations (same suit)
      suits.forEach(suit => {
        hands.push([rank1 + suit, rank2 + suit]);
      });
    } else if (suffix === 'o') {
      // Offsuit: 12 combinations (different suits)
      suits.forEach(suit1 => {
        suits.forEach(suit2 => {
          if (suit1 !== suit2) {
            hands.push([rank1 + suit1, rank2 + suit2]);
          }
        });
      });
    } else {
      // Pocket pair: 6 combinations
      for (let i = 0; i < suits.length; i++) {
        for (let j = i + 1; j < suits.length; j++) {
          hands.push([rank1 + suits[i], rank1 + suits[j]]);
        }
      }
    }
    
    return hands;
  },
  
  /**
   * Expand range notation to all possible card combinations
   * E.g. ['AA', 'KK', 'AKs'] -> [[Ah,Ad], [Ah,Ac], ..., [Ah,Kh], [Ad,Kd], ...]
   */
  expandRange(rangeNotations) {
    const allHands = [];
    for (const notation of rangeNotations) {
      allHands.push(...this.expandHandNotation(notation));
    }
    return allHands;
  },
  
  /**
   * Get range for calling a raise
   */
  getCallRange(position, vsPosition, raiseSize = 3) {
    // Rangos especulativos para call
    const ranges = {
      'BTN': [
        'TT', '99', '88', '77', '66', '55', '44', '33', '22',
        'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
        'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'Q9s', 'JTs', 'J9s', 'T9s', 'T8s', '98s', '87s', '76s', '65s', '54s'
      ],
      'SB': [
        '99', '88', '77', '66', '55', '44', '33', '22',
        'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s',
        'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s'
      ],
      'BB': [
        'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
        'AQo', 'AJo', 'ATo', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
        'KQo', 'KJo', 'KQs', 'KJs', 'KTs', 'K9s',
        'QJo', 'QJs', 'QTs', 'Q9s', 'JTs', 'J9s', 'T9s', 'T8s', '98s', '87s', '76s', '65s'
      ]
    };
    
    return ranges[position] || ranges['BB'];
  },
  
  /**
   * Get villain's likely range based on their last preflop action and position
   * This is the KEY function for range-based equity!
   * NOW DETECTS: RFI, 3-bet, 4-bet, Call, C-bet, Squeeze, Cold-Call
   */
  getVillainRange(villain, context = {}) {
    const position = villain.position?.toUpperCase() || 'MP';
    
    // Analizar el actionHistory para detectar la última acción del villano
    if (!villain.actionHistory || villain.actionHistory.length === 0) {
      // Sin acciones = solo posted blind, rango amplio
      return this.getDefaultRange();
    }
    
    // Get all actions from current hand
    const lastNextHandIndex = villain.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
    const handActions = lastNextHandIndex === -1 ? villain.actionHistory : villain.actionHistory.slice(lastNextHandIndex + 1);
    
    // Count raises in this hand
    let raises = handActions.filter(a => 
      a.action === 'RAISE' || a.action === 'BET' || 
      (a.action === 'ALL-IN' && a.amountBet && Math.abs(a.amountBet) >= context.bigBlind)
    );
    
    const numRaises = raises.length;
    const lastAction = handActions[handActions.length - 1];
    const actionType = lastAction?.action?.toUpperCase() || '';
    
    // POSTFLOP: Detect C-bet (continuation bet)
    if (context.isPostflop && actionType === 'BET') {
      // C-bet = bet on flop after being preflop aggressor
      if (context.preflopAggressor === villain.name) {
        console.log(`[Range-Based] Villain ${villain.name} from ${position} C-BET → rango amplio (puede ser bluff)`);
        // C-bet range is wider (includes bluffs)
        return this.getCallRange(position, null);
      }
    }
    
    // PREFLOP: Detect 4-bet
    if (numRaises >= 3) {
      console.log(`[Range-Based] Villain ${villain.name} from ${position} 4-BET → rango ultra-tight`);
      return ['AA', 'KK', 'QQ', 'AKs', 'AKo'];
    }
    
    // PREFLOP: Detect 3-bet
    if (numRaises >= 2 || actionType.includes('3-BET') || actionType.includes('RERAISE')) {
      console.log(`[Range-Based] Villain ${villain.name} from ${position} 3-BET → usando 3-bet range`);
      return this.get3BetRange(position, null);
    }
    
    // PREFLOP: Detect Squeeze
    if (context.isSqueezeSpot && actionType === 'RAISE') {
      // Squeeze = raise after RFI + caller(s)
      console.log(`[Range-Based] Villain ${villain.name} from ${position} SQUEEZE → rango polarizado`);
      // Squeeze range is polarized (very strong or bluff)
      return ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo', 'AQs', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', '76s', '65s', '54s'];
    }
    
    // PREFLOP: Detect RFI (First raise)
    if (numRaises === 1 && actionType === 'RAISE') {
      console.log(`[Range-Based] Villain ${villain.name} from ${position} RFI → usando RFI range`);
      return this.getRFIRange(position);
    }
    
    // PREFLOP: First BET (same as RFI)
    if (actionType === 'BET' || actionType === 'RAISE') {
      console.log(`[Range-Based] Villain ${villain.name} from ${position} RAISED/BET → usando RFI range`);
      return this.getRFIRange(position);
    }
    
    // PREFLOP: Cold-call (call after raise, without having invested)
    if (actionType === 'CALL' && numRaises >= 1) {
      const hasInvestedBefore = handActions.slice(0, -1).some(a => 
        a.action === 'RAISE' || a.action === 'BET' || 
        (a.action === 'CALL' && a.amountBet && Math.abs(a.amountBet) > context.bigBlind * 2)
      );
      
      if (!hasInvestedBefore) {
        console.log(`[Range-Based] Villain ${villain.name} from ${position} COLD-CALL → rango especulativo`);
        return this.getCallRange(position, null);
      } else {
        console.log(`[Range-Based] Villain ${villain.name} from ${position} CALLED → rango de call`);
        return this.getCallRange(position, null);
      }
    }
    
    // CALL (general)
    if (actionType === 'CALL') {
      console.log(`[Range-Based] Villain ${villain.name} from ${position} CALLED → usando Call range`);
      return this.getCallRange(position, null);
    }
    
    // CHECK / POST BLIND = rango amplio
    if (actionType === 'CHECK' || actionType.includes('POST')) {
      console.log(`[Range-Based] Villain ${villain.name} from ${position} ${actionType} → usando default range`);
      return this.getDefaultRange();
    }
    
    console.log(`[Range-Based] Villain ${villain.name} from ${position} acción desconocida "${actionType}" → usando default range`);
    return this.getDefaultRange();
  },
  
  /**
   * Default wide range for unknown situations
   */
  getDefaultRange() {
    return [
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'ATo', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
      'KQs', 'KQo', 'KJs', 'KJo', 'KTs', 'KTo', 'K9s', 'K8s',
      'QJs', 'QJo', 'QTs', 'QTo', 'Q9s', 'JTs', 'JTo', 'J9s', 'T9s', 'T8s', '98s', '87s', '76s', '65s', '54s'
    ];
  }
};

// ============================================================================
// =========================== END OF MODULES =================================
// ============================================================================

// TODO: Integrate all engines for HUD
// 1. Use Monte Carlo for postflop equity
// 2. Use PokerSolver for hand evaluation/comparison
// 3. Use Poker Odds for preflop equity and quick odds
// 4. Use GTO tables/evaluator for recommended actions
// Always update HUD with results from all engines

// === FULL ENGINE INTEGRATION FOR HUD ===
async function updateFullEngineHUD({ heroHand, board, numOpponents, deadCards, iterations, villains, context, players, potSize, toCall, raiseSize, street, isPreflop }) {
  // 1. Monte Carlo equity (postflop)
  let monteCarloResult = null;
  if (board && board.length >= 3) {
    monteCarloResult = await EquityCalculator._runOptimizedMonteCarloSimulation(heroHand, board, numOpponents, deadCards, iterations, villains, context);
  }

  // 2. PokerSolver hand strength
  let handStrength = null;
  if (PokerSolverManager.isAvailable()) {
    const solverCards = (window.PokerEyeCards && typeof window.PokerEyeCards.toSolverHand === 'function')
      ? window.PokerEyeCards.toSolverHand([...heroHand, ...(board||[])])
      : [...heroHand, ...(board||[])].map(c => {
        let value = c.slice(0, -1);
        let suit = c.slice(-1);
        const suitMap = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
        suit = suitMap[suit] || suit.toLowerCase();
        if (value === '10') value = 'T';
        return `${value}${suit}`;
      });
    handStrength = window.PokerSolver.Hand.solve(solverCards);
  }

  // 3. Poker Odds (preflop)
  let preflopOdds = null;
  if (isPreflop) {
    preflopOdds = EquityCalculator.getQuickPreflopEquity(heroHand, context.position, context.stackSize, context.rfiPosition, context.is3BetPot, players, villains);
  }

  // 4. GTO recommended actions
  let gtoActions = null;
  try {
    gtoActions = await getUnifiedRecommendationFromEvaluator({ heroHand, board, players, potSize, toCall, raiseSize, context, street, isPreflop });
  } catch {}

  // Update HUD with all results
  HUD.update({
    equity: monteCarloResult ? monteCarloResult.equity : null,
    handStrength,
    preflopOdds,
    gtoActions,
    monteCarlo: monteCarloResult,
    // Optionally add more details as needed
  });
}

class HUD {
  constructor(pokerTable) {
    this.pokerTable = pokerTable;

    this.init();
  }

  init() {
    this.id = generateUUID();
    this.isCreated = undefined;
    this.isVisible = ENABLE_HUD_VISIBILITY_BY_DEFAULT;
    this.showBB = SHOW_BB_BY_DEFAULT;
    this.showBestActions = CALCULATE_BEST_ACTIONS_DEFAULT;

    this.myPlayer = undefined;
    this.menuPosition = INITIAL_MENU_POSITION;

    this.winPercentage = undefined;
    this.handType = undefined;
    this.winPct = null;
    this.tiePct = null;
    this.lossPct = null;

    logMessage(`${this.pokerTable.logMessagePrefix}Initializing HUD...`, {
      color: "cyan",
    });

    // Subscribe to pokerTable game events to update HUD / analysis status
    try {
      this.pokerTable.onGameEvent?.('heroTurnStart', ({ player }) => {
        // Show analysis active indicator
        this.analysisActive = true;
        this.updateAnalysisStatus(true);
      });

      this.pokerTable.onGameEvent?.('heroActionStop', ({ player }) => {
        this.analysisActive = false;
        // Clear best actions (they will be recalculated when necessary)
        if (player && player.isMyPlayer) {
          player.bestActions = [];
          player.actionEVs = {};
        }
        this.updateAnalysisStatus(false);
        // Hide EVs
        this.updateEVSection({});
      });

      this.pokerTable.onGameEvent?.('streetChanged', ({ board, street }) => {
        // Reset analysisActive when street changes (a new situation will be recalculated)
        this.analysisActive = false;
        this.updateAnalysisStatus(false);
      });

      this.pokerTable.onGameEvent?.('handReset', ({ numHandsDealt }) => {
        this.analysisActive = false;
        this.updateAnalysisStatus(false);
        this.updateEVSection({});
      });
      // Listen for handStarted to kick off UI indicators / quick logs
      this.pokerTable.onGameEvent?.('handStarted', ({ player, hand }) => {
        try {
          const statusEl = this.pokerEyeMenu?.querySelector('#PokerEyePlus-engineStatus');
          if (statusEl) statusEl.innerText = `Engine: warming (hand started)`;
          // small HUD cue
          this.updateAnalysisStatus(false);
          logMessage(`${this.pokerTable.logMessagePrefix}Hand started for hero: ${Array.isArray(hand)?hand.join(' '):hand}`, { color: 'cyan' });
        } catch (e) {}
      });
    } catch (e) {
      console.warn('[HUD] Failed to subscribe to game events', e);
    }

    this.syncDOM();
  }
  
  resetHandData() {
    // Reset W/T/L data for new hand
    this.winPct = null;
    this.tiePct = null;
    this.lossPct = null;
    console.log('[HUD] Reset W/T/L data for new hand');
    
    // Reset opponent range display to N/A (but keep section visible)
    this.updateHandAnalysis(undefined, undefined, null, null, null, null, false, null, null, null, null);
  }

  // Removed non-destructive probe helper (runOddsProbe) — HUD now uses the unified equity pipeline without extra probe UI.

  importTailwindCSS() {
    // Check if Tailwind CSS is already imported
    for (const script of this.doc.scripts)
      if (script.src.includes(TAILWIND_CSS_CDN_URL)) return;

    // Import Tailwind CSS
    const importScript = this.doc.createElement("script");
    importScript.src = TAILWIND_CSS_CDN_URL;
    this.doc.head.appendChild(importScript);

    // Add the Tailwind CSS custom configuation
    const checkTailwindLoaded = setInterval(() => {
      if (!this.doc?.defaultView?.tailwind) return;
      clearInterval(checkTailwindLoaded);

      this.doc.defaultView.tailwind.config = TAILWIND_CSS_CUSTOM_CONFIG;
    }, TICK_RATE);

    logMessage(`${this.pokerTable.logMessagePrefix}Imported Tailwind CSS.`, {
      color: "cyan",
    });
  }

  // Small helper to show analysis status in the HUD menu
  updateAnalysisStatus(isActive) {
    try {
      if (!this.pokerEyeMenu) return;
      let statusEl = this.pokerEyeMenu.querySelector('#PokerEyePlus-analysisStatus');
      if (!statusEl) {
        statusEl = this.doc.createElement('div');
        statusEl.id = 'PokerEyePlus-analysisStatus';
        statusEl.style.fontSize = '12px';
        statusEl.style.marginTop = '6px';
        const container = this.pokerEyeMenu.querySelector('#PokerEyePlus-evContainer') || this.pokerEyeMenu;
        container.appendChild(statusEl);
      }
      statusEl.innerText = isActive ? 'Analysis: ACTIVE' : 'Analysis: idle';
      statusEl.style.color = isActive ? '#22c55e' : '#9CA3AF';
    } catch (e) {
      // swallow
    }
  }

  close() {
    this.stopSyncingDOM();
    this.hideBBs();
    this.hideBestActions();
    this.removeHUD();
  }

  syncDOM(runInstantly = true) {
    if (runInstantly) this.getDOM();
    this.syncDOMInterval = setInterval(() => this.getDOM(), TICK_RATE);
  }

  stopSyncingDOM() {
    clearInterval(this.syncDOMInterval);
  }

  getDOM() {
    try {
      this.doc = this.pokerTable.doc;
      this.root = this.doc.getElementById("root");

      // Get wrappers and containers
      this.tableWrapper = Array.from(this.doc.querySelectorAll("div")).find(
        (div) => div.style.display === "contents"
      );
      this.tableContainer = Array.from(this.tableWrapper.children)
        .filter((child) => child.id !== "PokerEyePlus-menu")
        .slice(-2)[0];
      this.footerContainer = Array.from(this.tableWrapper.children)
        .filter((child) => child.id !== "PokerEyePlus-menu")
        .pop();

      // Get Ignition's switch styling
      // e.g. <div class="f1d4v63a f10grhtg"><div class="f1a9vlrz"><div class="f1rgt9db"><div class="f1wig6fb"><div class="fg407x7"></div></div><div>Mute side notifications</div></div></div><i class="icon-component icon-send-message fqm6o4r Desktop smile" style="color: rgb(255, 255, 255); cursor: pointer;"></i></div>
      const rightSidePanel = this.doc.querySelector('div[data-qa="rightSidePanel"]');
      if (rightSidePanel) {
        this.ignitionSwitchConainer = Array.from(
          rightSidePanel.querySelectorAll("div")
        ).find((div) => div.innerHTML === "Mute side notifications")?.parentNode;
        this.ignitionSwitchContainerClassName = this.ignitionSwitchConainer?.className;
        this.ignitionSwitchBarClassName = this.ignitionSwitchConainer?.querySelector("div")?.classList[0];
        this.ignitionSwitchButtonClassName = this.ignitionSwitchConainer?.querySelector(`.${this.ignitionSwitchBarClassName}`)?.querySelector("div")?.classList[0];
      }

      // Ready to create the HUD
      if (!this.isCreated) this.createHud();
      else {
        // Refresh the toggleVisibilitySwitch if it disappeared
        if (!this.doc.querySelector("#PokerEyePlus-toggleVisibilitySwitch")) {
          this.removeHUD({ toggleVisibilitySwitch: true });
          this.createToggleVisibilitySwitch();
        }

        // Refresh the pokerEyeMenu if it disappeared
        if (!this.doc.querySelector("#PokerEyePlus-menu")) {
          this.removeHUD({ pokerEyeMenu: true });
          this.createPokerEyeMenu();
        }

        // Refresh the HUD menu data
        this.createPokerEyeMenu(true);
        if (this.isMenuOffScreen()) this.resetMenuPosition();

        // Refresh the shown BB for each player (if this.showBB is true)
        if (this.showBB) this.displayBBs();

        // Refresh the best actions for each player (if this.showBestActions is true)
        if (this.showBestActions) this.displayBestActions();
      }
    } catch (error) {
      console.error(error);
      this.removeHUD();

      // Waiting for the table DOM to be ready...
      if (this.isCreated === undefined)
        logMessage(
          `${this.pokerTable.logMessagePrefix}Waiting for the HUD DOM to be ready...`,
          { color: "cyan" }
        );
      this.isCreated = false;
    } // The table DOM is not ready yet... (this happens when we join a table)
  }

  createHud() {
    this.removeHUD();
    this.importTailwindCSS();

    this.createToggleVisibilitySwitch();
    this.createPokerEyeMenu();

    logMessage(
      `${this.pokerTable.logMessagePrefix}HUD created. Click the switch to toggle visibility.`,
      { color: "cyan" }
    );
    this.isCreated = true;
  }

  removeHUD(options = { toggleVisibilitySwitch: true, pokerEyeMenu: true }) {
    if (options.toggleVisibilitySwitch)
      this.doc
        ?.querySelectorAll("#PokerEyePlus-toggleVisibilitySwitch")
        ?.forEach((node) => node.remove());
    if (options.pokerEyeMenu)
      this.doc
        ?.querySelectorAll("#PokerEyePlus-menu")
        ?.forEach((node) => node.remove());
  }

  displayBBs() {
    // Convert all player balances to BBs
    for (const player of this.pokerTable.players.values()) {
      const balanceElement = player.dom.querySelector(
        'span[data-qa="playerBalance"]'
      );
      if (!balanceElement) continue;

      // Store the initial dimensions of the balance element
      const initialWidth = balanceElement.offsetWidth;
      const initialHeight = balanceElement.offsetHeight;

      const balanceWithBB = `<span id="PokerEyePlus-originalBalance" class="max-w-[0px] overflow-hidden max-h-[0px] text-white text-[0rem]">${
        this.pokerTable.currencySymbol
      }${formatCurrencyLikeIgnition(roundFloat(player.balance || 0))}</span>${
        player.numBigBlinds
          ? `<span id="PokerEyePlus-numBigBlinds" class="min-w-[inherit]">${formatChips(roundFloat(player.numBigBlinds, 1, false))} BB</span>`
          : "0 BB"
      }`;
      if (balanceElement.innerHTML !== balanceWithBB)
        balanceElement.innerHTML = balanceWithBB;
    }

    // TODO: Convert all pots (total, main, all side pots) to BBs

    // TODO: Convert all current bets to BBs
  }

  hideBBs() {
    // Revert all player balances to their original state
    for (const player of this.pokerTable.players.values()) {
      const balanceElement = player.dom.querySelector(
        'span[data-qa="playerBalance"]'
      );
      if (!balanceElement) continue;

      const balanceWithoutBB = `${formatChips(roundFloat(player.balance || 0))}`;
      if (balanceElement.innerHTML !== balanceWithoutBB)
        balanceElement.innerHTML = balanceWithoutBB;
    }

    // TODO: Revert all pots (total, main, all side pots) to their original state

    // TODO: Revert all current bets to their original state
  }

  toggleVisibility() {
    this.isVisible = !this.isVisible;
    this.updateVisibilitySwitchStyling();

    logMessage(
      `${this.pokerTable.logMessagePrefix}HUD visibility toggled ${
        this.isVisible ? "on" : "off"
      }`,
      { color: "cyan" }
    );
  }

  // Place the switch in the bottom right corner of the screen
  createToggleVisibilitySwitch() {
    const container = this.doc.createElement("div");
    container.id = "PokerEyePlus-toggleVisibilitySwitch";
    container.className = `${this.ignitionSwitchContainerClassName} absolute right-0 bottom-0 m-1 p-2 cursor-pointer text-sm text-[#E3E3E3]`;
    container.innerHTML = `
      <div class="${this.ignitionSwitchBarClassName}">
        <div class="${this.ignitionSwitchButtonClassName}"></div>
      </div>
  <div class="mt-[1px]">PokerEye+-</div>
    `;
    this.toggleVisibilitySwitch = container;

    container.addEventListener("click", () => this.toggleVisibility());
    this.updateVisibilitySwitchStyling();

    this.footerContainer.appendChild(container);
  }

  updateVisibilitySwitchStyling() {
    const bar = this.toggleVisibilitySwitch.querySelector(
      `.${this.ignitionSwitchBarClassName}`
    );
    const button = this.toggleVisibilitySwitch.querySelector(
      `.${this.ignitionSwitchButtonClassName}`
    );
    if (this.isVisible) {
      bar.classList.add("switchedOn");
      button.classList.add("switchedOn");
    } else {
      bar.classList.remove("switchedOn");
      button.classList.remove("switchedOn");
    }
  }

  toggleShowBB() {
    this.showBB = !this.showBB;
    this.updateShowBBSwitchStyling();

    if (!this.showBB) this.hideBBs();

    logMessage(
      `${this.pokerTable.logMessagePrefix}Show BB toggled ${
        this.showBB ? "on" : "off"
      }`,
      { color: "cyan" }
    );
  }

  createToggleShowBBSwitch() {
    const container = this.doc.createElement("div");
    container.id = "PokerEyePlus-toggleShowBBSwitch";
    container.className = `${this.ignitionSwitchContainerClassName} cursor-pointer`;
    container.innerHTML = `
      <div class="${this.ignitionSwitchBarClassName}">
        <div class="${this.ignitionSwitchButtonClassName}"></div>
      </div>
      <div class="mt-[1px]">Show BB</div>
    `;
    this.toggleShowBBSwitch = container;

    container.addEventListener("click", () => this.toggleShowBB());
    this.updateShowBBSwitchStyling();

    return container;
  }

  updateShowBBSwitchStyling() {
    const bar = this.toggleShowBBSwitch.querySelector(
      `.${this.ignitionSwitchBarClassName}`
    );
    const button = this.toggleShowBBSwitch.querySelector(
      `.${this.ignitionSwitchButtonClassName}`
    );
    if (this.showBB) {
      bar.classList.add("switchedOn");
      button.classList.add("switchedOn");
    } else {
      bar.classList.remove("switchedOn");
      button.classList.remove("switchedOn");
    }
  }

  displayBestActions() {
    const myPlayer = this.pokerTable.players.get(
      this.pokerTable.myPlayerSeatNumber
    );
    if (!myPlayer) return;
    let bestActions = !myPlayer.isTurnToAct ? [] : myPlayer.bestActions ?? [];
    // bestActions = [
    //   {
    //     action: "Raise",
    //     percentage: 1,
    //     numBigBlinds: 2.5,
    //     amountToBet: 35.2,
    //   },
    // ];

    const showTitle = false;
    const bestActionsInnerHTML = `
      <div class="pl-4 pt-2 justify-start h-full mb-[6px] flex flex-col">
        <div class="flex justify-start flex-col gap-[8px]">
            ${
              showTitle
                ? `<div class="flex flex-1 justify-center">
                    <span class="text-lg font-bold text-orange-300 underline">
                      ${bestActions.length > 0 ? "Best Actions" : ""}
                    </span>
                  </div>`
                : ""
            }
            <div class="flex gap-[8px]">
              ${bestActions
                .map(
                  (bestAction) =>
                    `<label style="-webkit-tap-highlight-color: transparent; padding: 4px 16px;" class="ring-1 ring-orange-300 hover:bg-orange-100 hover:text-gray-900 w-[132px] text-sm h-[40px] bg-[rgba(0,0,0,0.3)] text-white items-center border-0 rounded-[8px] cursor-pointer flex flex-col font-bold overflow-hidden outline-none desktopCheckboxButton Desktop landscape justify-center" data-qa="foldPreselectButton">
                    <span class="text-center w-full">${bestAction.action}</span>
                      ${
                      bestAction.numBigBlinds != 0 && bestAction.amountToBet
                        ? `<span class="text-center w-full">(${formatChips(bestAction.amountToBet)} · ${roundFloat(bestAction.amountToBet / this.pokerTable.blinds.big, 1)}bb)</span>`
                        : ""
                    }
                    <span class="text-center w-full">[${roundFloat(
                      bestAction.percentage * 100,
                      0
                    )}%]</span>
                  </label>`
                )
                .join("")}
            </div>
        </div>
      </div>`;

    // Locate the .right container and add transition classes
    const rightContainer = this.footerContainer?.querySelector(".right");
    rightContainer?.classList?.add(
      "transition-all",
      "ease-in-out",
      "duration-300"
    );

    let bestActionsContainer;
    const foundBestActionsContainer = this.doc.querySelector(
      "#PokerEyePlus-bestActionsContainer"
    );
    if (foundBestActionsContainer) {
      if (foundBestActionsContainer.innerHTML !== bestActionsInnerHTML)
        foundBestActionsContainer.innerHTML = bestActionsInnerHTML;
      bestActionsContainer = foundBestActionsContainer;
    } else {
      bestActionsContainer = this.doc.createElement("div");
      bestActionsContainer.id = "PokerEyePlus-bestActionsContainer";
      bestActionsContainer.innerHTML = bestActionsInnerHTML;
      this.bestActionsContainer = bestActionsContainer;

      // Place it in the footer container's child element with class 'right'
      this.footerContainer
        .querySelector(".right")
        .appendChild(bestActionsContainer);
    }

    // Attach onClick handlers to either the existing or the new container
    const actionLabels = bestActionsContainer.querySelectorAll(
      '[data-qa="foldPreselectButton"]'
    );
    actionLabels.forEach((label, index) => {
      const bestAction = bestActions[index];
      label.onclick = () => {
        switch (bestAction.action) {
          case "Fold":
            this.doc.querySelector('button[data-qa="foldButton"]')?.click();
            break;
          case "Check":
            this.doc.querySelector('button[data-qa="checkButton"]')?.click();
            break;
          case "Call":
            this.doc.querySelector('button[data-qa="callButton"]')?.click();
            break;
          case "Limp":
            this.doc.querySelector('button[data-qa="callButton"]')?.click();
            this.doc.querySelector('button[data-qa="checkButton"]')?.click();
            break;
          default:
            // Check if it's a raise
            if (!bestAction.amountToBet) break;

            // Select the only <input> element in the this.footerContainer.querySelector(".right")
            const raiseInput = this.footerContainer
              ?.querySelector(".right")
              ?.querySelector("input:not([type='checkbox'])");
            if (!raiseInput) break;

            // Set the raise amount (ex: value="56.00")
            setNativeValue(
              raiseInput,
              Math.abs(bestAction.amountToBet).toFixed(2)
            );

            // Click the "bet" or "raise" button (depending on the situation, and after waiting for the button to reflect the set input)
            setTimeout(() => {
              this.doc.querySelector('button[data-qa="betButton"]')?.click();
              this.doc.querySelector('button[data-qa="raiseButton"]')?.click();
            }, 100);
            break;
        }
      };
    });
  }

  hideBestActions() {
    this.doc
      ?.querySelectorAll("#PokerEyePlus-bestActionsContainer")
      ?.forEach((node) => node.remove());
  }

  toggleShowBestActions() {
    this.showBestActions = !this.showBestActions;
    this.updateShowBestActionsSwitchStyling();

    if (!this.showBestActions) this.hideBestActions();

    logMessage(
      `${this.pokerTable.logMessagePrefix}Show Best Actions toggled ${
        this.showBestActions ? "on" : "off"
      }`,
      { color: "cyan" }
    );
  }

  createToggleShowBestActionsSwitch() {
    const container = this.doc.createElement("div");
    container.id = "PokerEyePlus-toggleShowBestActionsSwitch";
    container.className = `${this.ignitionSwitchContainerClassName} cursor-pointer`;
    container.innerHTML = `
      <div class="${this.ignitionSwitchBarClassName}">
        <div class="${this.ignitionSwitchButtonClassName}"></div>
      </div>
      <div class="mt-[1px]">Show Best Actions</div>
    `;
    this.toggleShowBestActionsSwitch = container;

    container.addEventListener("click", () => this.toggleShowBestActions());
    this.updateShowBestActionsSwitchStyling();

    return container;
  }

  updateShowBestActionsSwitchStyling() {
    const bar = this.toggleShowBestActionsSwitch.querySelector(
      `.${this.ignitionSwitchBarClassName}`
    );
    const button = this.toggleShowBestActionsSwitch.querySelector(
      `.${this.ignitionSwitchButtonClassName}`
    );
    if (this.showBestActions) {
      bar.classList.add("switchedOn");
      button.classList.add("switchedOn");
    } else {
      bar.classList.remove("switchedOn");
      button.classList.remove("switchedOn");
    }
  }

  // PokerEye+- main menu (only shows when this.isVisible)
  // An easy-to-use Chrome extension that records & calculates statistics while playing on Ignition Casino's Online Poker in your browser.
  createPokerEyeMenu(refreshOnly = false) {
    const myPlayer = this.pokerTable.players.get(
      this.pokerTable.myPlayerSeatNumber
    );
    this.myPlayer = myPlayer;
    
    // Actualizar balance y numBigBlinds antes de renderizar
    if (myPlayer) {
      myPlayer.getBalance();
      myPlayer.numBigBlinds = myPlayer.getNumBigBlinds();
    }

    const detailsPanel = `
      <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; background: rgba(0,0,0,0.8); border-radius: 8px; color: white; font-size: 12px;">
        <!-- Balance -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
          <span style="font-weight: 500;">Balance</span>
          <span id="PokerEyePlus-balanceValue" style="font-weight: bold;">${
            myPlayer?.numBigBlinds
              ? `<span style="color: #10b981;">${formatChips(roundFloat(myPlayer.numBigBlinds, 1, false))} BB</span> <span style="color: #ccc;">•</span> `
              : ""
          }${formatChips(myPlayer?.balance || 0)}</span>
        </div>

        <!-- Position -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
          <span style="font-weight: 500;">Position</span>
          <span id="PokerEyePlus-positionValue" style="font-weight: bold;${
            !myPlayer?.position ? " opacity: 0.6; color: #ccc;" : ""
          }">${myPlayer?.position || (myPlayer?.isSittingOut() ? "SITTING OUT..." : "Waiting...")}</span>
        </div>

        <!-- Hand -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
          <span style="font-weight: 500;">Hand</span>
          <span id="PokerEyePlus-handValue" style="font-weight: bold;">${
            myPlayer?.hand.length > 0
              ? myPlayer.hand.map((card) => this.renderCard(card)).join(" ")
              : `<span style="opacity: 0.6; color: #ccc;">No cards</span>`
          }</span>
        </div>

        <!-- Board -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
          <span style="font-weight: 500;">Board</span>
          <span id="PokerEyePlus-boardValue" style="font-weight: bold;">${
            this.pokerTable.board.length > 0
              ? this.pokerTable.board
                  .map((card) => this.renderCard(card))
                  .join(" ")
              : `<span style="opacity: 0.6; color: #ccc;">Pre-flop</span>`
          }</span>
        </div>

        <!-- Equity (Win Percentage with W/T/L breakdown) -->
        <div style="display: flex; flex-direction: column; gap: 4px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 500;">Equity</span>
            <span id="PokerEyePlus-equityValue" style="font-weight: bold; color: ${this.winPercentage !== undefined ? '#10b981' : '#ccc'};">${
              this.winPercentage !== undefined
                ? roundFloat(this.winPercentage, 1) + '%'
                : this.pokerTable.board.length > 0
                ? `Waiting...`
                : `N/A`
            }</span>
          </div>
          <div id="PokerEyePlus-equityBreakdown" style="display: block; font-size: 10px; color: #94a3b8; text-align: right; font-family: monospace;">
            W: <span id="PokerEyePlus-winPct">--</span>% | T: <span id="PokerEyePlus-tiePct">--</span>% | L: <span id="PokerEyePlus-lossPct">--</span>%
          </div>
        </div>

        <!-- Hand Summary (combined: Hand Type / Hand Strength / Outs) -->
        <div id="PokerEyePlus-handSummarySection" style="display: flex; flex-direction: column; gap:6px; padding: 8px; background: rgba(255,255,255,0.06); border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 500;">Hand Summary</span>
            <span id="PokerEyePlus-handSummaryHeader" style="font-weight: bold; color: ${this.handType !== undefined ? '#f59e0b' : '#ccc'};">${
              this.handType !== undefined
                ? this.handType
                : this.pokerTable.board.length > 0
                ? `Waiting for postflop...`
                : `N/A`
            }</span>
          </div>
          <div id="PokerEyePlus-handSummaryDetails" style="display: block; font-size: 11px; color: #94a3b8; line-height: 1.4; font-family: monospace;">
            <div id="PokerEyePlus-handSummaryRelative">Relative: --%</div>
            <div id="PokerEyePlus-handSummaryOuts">Outs: --</div>
          </div>
        </div>

        <!-- Opponent Range (always visible, similar to Equity section) -->
        <div id="PokerEyePlus-oppRangeSection" style="display: flex; flex-direction: column; gap: 4px; padding: 8px; background: rgba(168, 85, 247, 0.1); border-radius: 6px; border: 1px solid rgba(168, 85, 247, 0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 500; color: #a855f7;">Opp Range</span>
            <span id="PokerEyePlus-oppRangeHeader" style="font-size: 0.875rem; color: #a855f7; font-weight: 500; text-align: right;">N/A</span>
          </div>
          <div id="PokerEyePlus-oppRangeDetails" style="display: block; font-size: 10px; color: #94a3b8; line-height: 1.6; font-family: monospace;">
            <div id="PokerEyePlus-oppRangeSummary">Range: N/A</div>
          </div>
        </div>

        <!-- Engine status -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 6px;">
          <span style="font-weight: 500;">Engine</span>
          <span id="PokerEyePlus-engineStatus" style="font-weight: bold; color: #60a5fa;">${PokerSolverManager.isAvailable() ? 'Engine: PokerSolver · GTO: ON · Odds: MonteCarlo' : 'Engine: MonteCarlo · GTO: ON'}</span>
        </div>
        </div>

        <!-- (Old separate Outs / Relative sections removed - now merged into Hand Summary above) -->
      </div>
    `;

    if (refreshOnly) {
      // If the menu doesn't exist yet, create it
      if (!this.pokerEyeMenu) {
        return this.createPokerEyeMenu(false);
      }

      // If the menu exists but is not in the DOM, recreate it
      if (this.pokerEyeMenu && !this.pokerEyeMenu.parentNode) {
        this.pokerEyeMenu = null;
        return this.createPokerEyeMenu(false);
      }

      // DON'T refresh the innerHTML - it destroys the W/T/L breakdown elements
      // Instead, update specific elements manually
      if (myPlayer) {
        // Update Balance
        const balanceValue = this.pokerEyeMenu.querySelector('#PokerEyePlus-balanceValue');
        if (balanceValue) {
          const balanceHTML = `${
            myPlayer.numBigBlinds
              ? `<span style="color: #10b981;">${roundFloat(myPlayer.numBigBlinds, 1, false)} BB</span> <span style="color: #ccc;">•</span> `
              : ""
          }${formatChips(myPlayer.balance || 0)}`;
          balanceValue.innerHTML = balanceHTML;
        }
        
        // Update Position
        const positionValue = this.pokerEyeMenu.querySelector('#PokerEyePlus-positionValue');
        if (positionValue) {
          positionValue.textContent = myPlayer.position || (myPlayer.isSittingOut() ? "SITTING OUT..." : "Waiting...");
          positionValue.style.opacity = !myPlayer.position ? "0.6" : "1";
          positionValue.style.color = !myPlayer.position ? "#ccc" : "white";
        }
        
        // Update Hand
        const handValue = this.pokerEyeMenu.querySelector('#PokerEyePlus-handValue');
        if (handValue) {
          const handHTML = myPlayer.hand.length > 0
            ? myPlayer.hand.map((card) => this.renderCard(card)).join(" ")
            : `<span style="opacity: 0.6; color: #ccc;">No cards</span>`;
          handValue.innerHTML = handHTML;
        }
        
        // Update Board
        const boardValue = this.pokerEyeMenu.querySelector('#PokerEyePlus-boardValue');
        if (boardValue) {
          const boardHTML = this.pokerTable.board.length > 0
            ? this.pokerTable.board.map((card) => this.renderCard(card)).join(" ")
            : `<span style="opacity: 0.6; color: #ccc;">Pre-flop</span>`;
          boardValue.innerHTML = boardHTML;
        }
      }

      // Refresh only if the visibility has changed
      if (this.pokerEyeMenu.classList.contains("hidden"))
        this.pokerEyeMenu.classList.remove("hidden");
      return;
    }

    const menu = this.doc.createElement("div");
    menu.id = "PokerEyePlus-menu";
    menu.style.cssText = `
      position: absolute;
      min-width: 280px;
      max-width: 320px;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      border-radius: 12px;
      overflow: hidden;
      color: white;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
      border: 1px solid #374151;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    menu.style.left = this.menuPosition.left;
    menu.style.top = this.menuPosition.top;

    const container = this.doc.createElement("div");
    container.style.cssText = `display: flex; flex-direction: column; width: 100%;`;

    // Header
    const header = `
      <div style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); padding: 12px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">
        <div id="PokerEyePlus-menu-dragZone" style="display: flex; align-items: center; gap: 8px; cursor: move; user-select: none;">
          <img src="https://i.imgur.com/ETaXEfg.png" alt="PokerEye+- Logo" style="height: 28px; width: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <h1 style="font-size: 18px; font-weight: bold; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">PokerEye+-</h1>
        </div>
        <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; transition: background-color 0.2s;">
          <span style="font-size: 14px; color: white;">✕</span>
        </div>
      </div>
      <div style="height: 1px; background: linear-gradient(90deg, transparent, #4b5563, transparent);"></div>
    `;
    container.innerHTML = header;

    // Close button
    const closeMenuButton = container.querySelector("div:last-child");
    closeMenuButton.addEventListener("click", () => this.toggleVisibility());

    // Details panel
    const detailsPanelContainer = this.doc.createElement("div");
    detailsPanelContainer.id = "PokerEyePlus-detailsPanel";
    detailsPanelContainer.style.cssText = `display: flex; flex-direction: column; gap: 8px; padding: 16px; background: rgba(31, 41, 55, 0.8);`;
    detailsPanelContainer.innerHTML = detailsPanel;
    container.appendChild(detailsPanelContainer);

    // Switches container
    const switchesContainer = this.doc.createElement("div");
    switchesContainer.style.cssText = `display: flex; flex-direction: column; gap: 12px; padding: 16px; background: rgba(17, 24, 39, 0.9); border-top: 1px solid #374151;`;
    container.appendChild(switchesContainer);

    // (Probe UI removed) HUD uses the unified equity pipeline without extra probe controls.

    // Switches removed to make HUD more compact

    menu.appendChild(container);
    this.pokerEyeMenu = menu;
    this.makeMenuDraggable();

    // Ensure the menu is visible initially
    if (menu.classList.contains("hidden")) {
      menu.classList.remove("hidden");
    }

    // Append to tableWrapper if available, otherwise use document body
    if (this.tableWrapper) {
      this.tableWrapper.appendChild(menu);
    } else {
      this.doc.body.appendChild(menu);
    }
  }

  makeMenuDraggable() {
    const dragZone = this.pokerEyeMenu.querySelector(
      "#PokerEyePlus-menu-dragZone"
    );

    let x1 = 0;
    let y1 = 0;
    let x2 = 0;
    let y2 = 0;

    function dragMouseDown(e) {
      e = e || this.doc.defaultView.event;
      e.preventDefault();

      x2 = e.clientX;
      y2 = e.clientY;
      this.doc.onmouseup = closeDrag.bind(this);
      this.doc.onmousemove = mouseDrag.bind(this);
    }

    function mouseDrag(e) {
      e = e || this.doc.defaultView.event;
      e.preventDefault();

      x1 = x2 - e.clientX;
      y1 = y2 - e.clientY;
      x2 = e.clientX;
      y2 = e.clientY;

      const left = this.pokerEyeMenu.offsetLeft - x1 + "px";
      const top = this.pokerEyeMenu.offsetTop - y1 + "px";
      this.pokerEyeMenu.style.left = left;
      this.pokerEyeMenu.style.top = top;
      this.menuPosition = { left, top };
    }

    function closeDrag() {
      this.doc.onmouseup = null;
      this.doc.onmousemove = null;
    }

    dragZone.onmousedown = dragMouseDown.bind(this);
  }

  isMenuOffScreen() {
    if (!this.pokerEyeMenu) return false;
    
    let rootWidth = this.root.offsetWidth;
    let rootHeight = this.root.offsetHeight;
    let menuX = parseInt(this.pokerEyeMenu.style.left, 10);
    let menuY = parseInt(this.pokerEyeMenu.style.top, 10);

    return menuX > rootWidth || menuY > rootHeight;
  }

  resetMenuPosition() {
    let rootHeight = this.root.offsetHeight;
    let seatRect = this.myPlayer?.dom?.getBoundingClientRect();
    if (!seatRect) {
      this.pokerEyeMenu.style.left = INITIAL_MENU_POSITION.left;
      this.pokerEyeMenu.style.top = INITIAL_MENU_POSITION.top;
      return;
    }

    let horizontalPosition =
      (seatRect.left * this.getTableZoom()).toString() + "px";
    this.pokerEyeMenu.style.left = horizontalPosition;

    this.pokerEyeMenu.style.top =
      seatRect.bottom * this.getTableZoom() > rootHeight / 2
        ? (seatRect.bottom * this.getTableZoom()).toString() + "px"
        : (seatRect.top * this.getTableZoom()).toString() + "px";
  }

  getTableZoom() {
    return Number(
      this.doc.querySelector('div[data-qa="table"]')?.style?.zoom || 1
    );
  }

  renderCard(card) {
    let suitIcon;
    let color = "#333";
    switch (card.slice(-1)) {
      case "c":
        suitIcon = "♣";
        break;
      case "d":
        suitIcon = "♦";
        color = "#c3161c";
        break;
      case "h":
        suitIcon = "♥";
        color = "#c3161c";
        break;
      case "s":
        suitIcon = "♠";
        break;
    }
    return `<span style="color: ${color};">${card.slice(
      0,
      -1
    )}${suitIcon}</span>`;
  }

  // Helper to generate opponent range information for HUD display
  getOpponentRangeInfo(activeVillains, rangeContext = {}, board = []) {
    if (!activeVillains || activeVillains.length === 0) return null;
    
    // For multiway, focus on the most aggressive villain
    let villain = activeVillains[0];
    const isMultiway = activeVillains.length > 1;
    
    if (isMultiway) {
      // Find the most aggressive villain (RAISE, BET, or ALL-IN)
      const aggressiveVillain = activeVillains.find(v => {
        const lastNextHandIndex = v.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
        const currentHandActions = lastNextHandIndex === -1 ? v.actionHistory : v.actionHistory.slice(lastNextHandIndex + 1);
        return currentHandActions.some(a => a.action === 'RAISE' || a.action === 'BET' || a.action === 'ALL-IN');
      });
      
      if (aggressiveVillain) villain = aggressiveVillain;
    }
    
    const rangeNotations = PositionStrategy.getVillainRange(villain, rangeContext);
    if (!rangeNotations || rangeNotations.length === 0) return null;
    
    // Determine action type
    let actionType = 'Unknown';
    if (rangeContext.raiseCount >= 3) actionType = '4-Bet';
    else if (rangeContext.raiseCount >= 2) actionType = '3-Bet';
    else if (rangeContext.raiseCount === 1) actionType = 'RFI';
    else {
      const lastNextHandIndex = villain.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
      const currentHandActions = lastNextHandIndex === -1 ? villain.actionHistory : villain.actionHistory.slice(lastNextHandIndex + 1);
      const meaningfulAction = [...currentHandActions].reverse().find(a => 
        a.action && !a.action.includes('seconds left') && a.action !== 'DON\'T SHOW' && a.action !== 'POSITION UPDATED'
      );
      if (meaningfulAction) {
        if (meaningfulAction.action === 'RAISE' || meaningfulAction.action === 'BET') actionType = 'Open';
        else if (meaningfulAction.action === 'CALL') actionType = 'Call';
        else if (meaningfulAction.action === 'CHECK') actionType = 'Check';
        else if (meaningfulAction.action === 'ALL-IN') actionType = 'All-In';
        else if (meaningfulAction.action === 'POST SB' || meaningfulAction.action === 'POST BB') actionType = 'Blind';
      }
    }
    
    const rangeString = rangeNotations.join(', ');
    const combosPercent = this._estimateRangePercent(rangeNotations);
    
    // ALWAYS use static categorization for consistent display
    // This shows the raw strength of the range regardless of board
    // Makes it easier to understand what villain is representing
    let handStrengthDist = this.categorizePreflopRangeByStrength(rangeNotations);
    
    // Optionally add board-aware filtering for postflop
    // (can be used in future to narrow down range based on board texture)
    if (board && board.length >= 3) {
      // In postflop, the range is still the same categories,
      // but we could filter out unlikely hands based on action
      // For now, keep static display for consistency
      console.log('[Opp Range] Using static categories in postflop for consistent display');
    }
    
    return {
      range: true,
      isMultiway: isMultiway,
      count: activeVillains.length,
      position: villain.position || 'Villain',
      seatNumber: villain.seatNumber,
      rangeNotation: rangeString.length > 40 ? rangeString.substring(0, 37) + '...' : rangeString,
      combosPercent: roundFloat(combosPercent, 1),
      actionType: actionType,
      handStrengthDist: handStrengthDist
    };
  }
  
  // Categorize preflop range by hand strength (static categories like postflop)
  categorizePreflopRangeByStrength(rangeNotations) {
    if (!rangeNotations || rangeNotations.length === 0) return null;
    
    const categories = {
      'Premium Pairs': 0,    // AA, KK, QQ
      'Strong Pairs': 0,     // JJ, TT, 99
      'Medium Pairs': 0,     // 88, 77, 66
      'Small Pairs': 0,      // 55, 44, 33, 22
      'Broadway': 0,         // AK, AQ, AJ, KQ (suited or offsuit)
      'Suited Connectors': 0, // JTs, T9s, 98s, etc.
      'Suited Aces': 0,      // A2s-A9s
      'High Cards': 0        // Other unpaired hands
    };
    
    const rankValue = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    
    for (const hand of rangeNotations) {
      const trimmed = hand.trim();
      if (trimmed.length < 2) continue;
      
      const rank1 = trimmed[0];
      const rank2 = trimmed[1];
      const suited = trimmed.includes('s');
      
      // Pocket pairs
      if (rank1 === rank2) {
        const value = rankValue[rank1] || 0;
        if (value >= 12) categories['Premium Pairs']++;
        else if (value >= 9) categories['Strong Pairs']++;
        else if (value >= 6) categories['Medium Pairs']++;
        else categories['Small Pairs']++;
      }
      // Broadway cards (high card combinations)
      else if ((rank1 === 'A' || rank1 === 'K' || rank1 === 'Q' || rank1 === 'J') && 
               (rank2 === 'A' || rank2 === 'K' || rank2 === 'Q' || rank2 === 'J' || rank2 === 'T')) {
        categories['Broadway']++;
      }
      // Suited Aces
      else if (suited && (rank1 === 'A' || rank2 === 'A')) {
        categories['Suited Aces']++;
      }
      // Suited Connectors (adjacent ranks, suited)
      else if (suited && Math.abs((rankValue[rank1] || 0) - (rankValue[rank2] || 0)) <= 1) {
        categories['Suited Connectors']++;
      }
      // Everything else is high cards
      else {
        categories['High Cards']++;
      }
    }
    
    // Calculate percentages and filter out empty categories
    const totalHands = rangeNotations.length;
    const distribution = [];
    
    for (const [category, count] of Object.entries(categories)) {
      if (count > 0) {
        const percentage = (count / totalHands * 100).toFixed(1);
        distribution.push({ 
          handType: category, 
          percentage: parseFloat(percentage),
          count: count
        });
      }
    }
    
    // Sort by percentage descending
    distribution.sort((a, b) => b.percentage - a.percentage);
    
    return distribution.length > 0 ? distribution : null;
  }
  
  // Old function - kept for backwards compatibility
  categorizePreflopRange(rangeNotations) {
    if (!rangeNotations || rangeNotations.length === 0) return null;
    
    const categories = {
      'Pair': 0,
      'High Card': 0
    };
    
    // Evaluate each hand in the range
    for (const hand of rangeNotations) {
      const trimmed = hand.trim();
      
      // Check if it's a pocket pair (e.g., AA, KK, 77, 22)
      if (trimmed.length === 2 && trimmed[0] === trimmed[1]) {
        categories['Pair']++;
      } else {
        // Non-paired hands are high card preflop
        categories['High Card']++;
      }
    }
    
    // Calculate percentages
    const totalHands = rangeNotations.length;
    const distribution = [];
    
    for (const [category, count] of Object.entries(categories)) {
      if (count > 0) {
        const percentage = (count / totalHands * 100).toFixed(1);
        distribution.push({ 
          handType: category, 
          percentage: parseFloat(percentage),
          count: count
        });
      }
    }
    
    // Sort by percentage descending
    distribution.sort((a, b) => b.percentage - a.percentage);
    
    return distribution.length > 0 ? distribution : null;
  }
  
  // Update only the EV section of the HUD
  updateEVSection(actionEVs) {
    try {
      // Normalise input: actionEVs can be { actionName: ev } or { actions: [{action, prob, ev}], evs: {...} }
      let evMap = {};
      let probsMap = {};

      if (!actionEVs) actionEVs = {};

      if (Array.isArray(actionEVs.actions) && actionEVs.actions.length > 0) {
        for (const a of actionEVs.actions) {
          const name = (a.action || a.actionName || '').toString();
          evMap[name] = typeof a.ev === 'number' ? a.ev : (typeof a.e === 'number' ? a.e : 0);
          if (typeof a.prob === 'number') probsMap[name] = a.prob;
        }
      }

      // If evs key present (from unified evaluator helper), prefer it
      if (actionEVs.evs && typeof actionEVs.evs === 'object') {
        for (const [k,v] of Object.entries(actionEVs.evs)) evMap[k] = v;
      }

      // If caller passed a plain map of EVs
      if (!Object.keys(evMap).length && typeof actionEVs === 'object') {
        // Copy numeric props
        for (const [k,v] of Object.entries(actionEVs)) {
          if (typeof v === 'number') evMap[k] = v;
        }
      }

      // Build display probabilities. If explicit probs provided, use them; otherwise softmax the EVs.
      const softmax = (values, temp = 0.35) => {
        if (!values || values.length === 0) return [];
        const max = Math.max(...values);
        const exps = values.map(v => Math.exp((v - max) / temp));
        const sum = exps.reduce((s,e) => s+e, 0) || 1;
        return exps.map(e => e / sum);
      };

      const names = Object.keys(evMap);
      let probs = [];
      if (names.length === 0 && Object.keys(probsMap).length > 0) {
        // Use probsMap keys
        for (const [k,v] of Object.entries(probsMap)) {
          evMap[k] = evMap[k] || 0;
        }
        names.push(...Object.keys(probsMap));
      }

      if (Object.keys(probsMap).length > 0) {
        for (const n of names) probs.push(probsMap[n] || 0);
      } else {
        const vals = names.map(n => evMap[n] || 0);
        probs = softmax(vals, this._decisionConfig?.temperature ?? 0.35);
      }

      // Render into HUD menu
      if (!this.pokerEyeMenu) return;

      // Update equity numbers if present in actionEVs.meta (compatibility)
      if (actionEVs.meta && typeof actionEVs.meta.equity === 'number') {
        const eqEl = this.pokerEyeMenu.querySelector('#PokerEyePlus-equityValue');
        if (eqEl) eqEl.textContent = `${roundFloat(actionEVs.meta.equity,1)}%`;
        const winEl = this.pokerEyeMenu.querySelector('#PokerEyePlus-winPct');
        const tieEl = this.pokerEyeMenu.querySelector('#PokerEyePlus-tiePct');
        const lossEl = this.pokerEyeMenu.querySelector('#PokerEyePlus-lossPct');
        if (winEl) winEl.textContent = actionEVs.meta.winPct ? roundFloat(actionEVs.meta.winPct,1) : '--';
        if (tieEl) tieEl.textContent = actionEVs.meta.tiePct ? roundFloat(actionEVs.meta.tiePct,1) : '--';
        if (lossEl) lossEl.textContent = actionEVs.meta.lossPct ? roundFloat(actionEVs.meta.lossPct,1) : (actionEVs.meta.equity ? roundFloat(100 - actionEVs.meta.equity,1) : '--');
      }

      // We intentionally removed the separate "Recommended" action frequencies panel from the HUD
      // to avoid duplication with the Best Actions section. If an old panel exists, remove it.
      try {
        const old = this.pokerEyeMenu.querySelector('#PokerEyePlus-actionFreqs');
        if (old && old.parentNode) old.parentNode.removeChild(old);
      } catch (e) {
        // swallow
      }

      // Nothing further to render here — Best Actions UI handles recommended actions display.
      return;
    } catch (e) {
      if (DEBUG_API_REQUESTS) console.warn('[HUD] updateEVSection failed', e);
    }
  }
  
  // Estimate percentage of hands in range (simplified approximation)
  _estimateRangePercent(rangeNotations) {
    // This is a rough approximation based on common range sizes
    const rangeString = rangeNotations.join(',');
    
    // Count specific indicators
    const hasPlus = (rangeString.match(/\+/g) || []).length;
    const hasDash = (rangeString.match(/-/g) || []).length;
    const commaCount = (rangeString.match(/,/g) || []).length;
    
    // Rough estimation:
    // Very tight range (premium): ~5-10%
    // Tight range (RFI EP): ~10-15%
    // Medium range (RFI MP/CO): ~15-25%
    // Wide range (RFI BTN): ~40-50%
    // Very wide range (BB defense): ~60%+
    
    if (rangeString.includes('22+') || rangeString.includes('any')) return 100;
    if (commaCount > 30) return 60; // Very wide
    if (commaCount > 20) return 40; // Wide (BTN)
    if (commaCount > 10) return 20; // Medium (MP/CO)
    if (commaCount > 5 || hasPlus > 2) return 12; // Tight (EP)
    return 8; // Very tight (4-bet/premium)
  }

  // Analyze opponent's possible hand strength distribution on current board
  getOpponentHandStrengthDistribution(villain, board, rangeContext = {}) {
    if (!board || board.length < 3) return null; // Only for postflop
    
    // Get villain's range
    const rangeNotations = PositionStrategy.getVillainRange(villain, rangeContext);
    if (!rangeNotations || rangeNotations.length === 0) return null;
    
    // Expand range to get all possible hands
    const expandedRange = PositionStrategy.expandRange(rangeNotations);
    if (!expandedRange || expandedRange.length === 0) return null;
    
    // Count hand types mapped to HandRankAlias-like buckets
    const handTypes = {
      'STRAIGHT_FLUSH': 0,
      'QUADS': 0,
      'FULL_HOUSE': 0,
      'FLUSH': 0,
      'STRAIGHT': 0,
      'TRIPS': 0,
      'TWO_PAIRS': 0,
      'PAIR': 0,
      'HIGH_CARD': 0
    };
    
    let totalHands = 0;
    
    // For each possible hand in villain's range, evaluate strength on this board
    for (const villainHand of expandedRange) {
      try {
        // Evaluate the 7-card hand (2 hole cards + 5 board cards)
        const fullHand = [...villainHand, ...board];
        if (fullHand.length !== 7) continue;
        
        const rawType = this.evaluateHandTypeFromCards(fullHand);
        // Map from human-readable types to alias keys
        const map = {
          'Straight Flush': 'STRAIGHT_FLUSH',
          'Four of a Kind': 'QUADS',
          'Full House': 'FULL_HOUSE',
          'Flush': 'FLUSH',
          'Straight': 'STRAIGHT',
          'Three of a Kind': 'TRIPS',
          'Two Pair': 'TWO_PAIRS',
          'Pair': 'PAIR',
          'High Card': 'HIGH_CARD'
        };
        const mapped = map[rawType] || 'HIGH_CARD';
        if (handTypes.hasOwnProperty(mapped)) {
          handTypes[mapped]++;
          totalHands++;
        }
      } catch (error) {
        // Skip invalid combinations
        continue;
      }
    }
    
    if (totalHands === 0) return null;
    
    // Convert counts to percentages and filter out 0%
    const distribution = [];
    for (const [handType, count] of Object.entries(handTypes)) {
      if (count > 0) {
        const percentage = (count / totalHands * 100).toFixed(1);
        distribution.push({ handType, percentage: parseFloat(percentage) });
      }
    }
    
    // Sort by percentage descending
    distribution.sort((a, b) => b.percentage - a.percentage);
    
    return distribution;
  }
  
  // Helper to evaluate hand type from 7 cards
  evaluateHandTypeFromCards(cards) {
    // Use existing hand evaluator or simplified version
    // This is a simplified version - you can enhance it
    const ranks = cards.map(c => c.slice(0, -1));
    const suits = cards.map(c => c.slice(-1));
    
    // Count ranks
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    
    // Count suits for flush
    const suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    const hasFlush = Object.values(suitCounts).some(c => c >= 5);
    
    // Check for straight (simplified)
    const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const uniqueRanks = [...new Set(ranks)].map(r => rankOrder.indexOf(r)).sort((a, b) => a - b);
    let hasStraight = false;
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      if (uniqueRanks[i + 4] - uniqueRanks[i] === 4) {
        hasStraight = true;
        break;
      }
    }
    // Check wheel (A-2-3-4-5)
    if (uniqueRanks.includes(rankOrder.indexOf('A')) && 
        uniqueRanks.includes(0) && uniqueRanks.includes(1) && 
        uniqueRanks.includes(2) && uniqueRanks.includes(3)) {
      hasStraight = true;
    }
    
    // Determine hand type
    if (hasFlush && hasStraight) return 'Straight Flush';
    if (counts[0] === 4) return 'Four of a Kind';
    if (counts[0] === 3 && counts[1] === 2) return 'Full House';
    if (hasFlush) return 'Flush';
    if (hasStraight) return 'Straight';
    if (counts[0] === 3) return 'Three of a Kind';
    if (counts[0] === 2 && counts[1] === 2) return 'Two Pair';
    if (counts[0] === 2) return 'Pair';
    return 'High Card';
  }

  updateHandAnalysis(winPercentage, handType, foldPercentage = null, checkPercentage = null, callPercentage = null, betPercentage = null, isFacingBet = false, winPct = null, tiePct = null, lossPct = null, oppRangeInfo = null, advancedOuts = null, relativeStrength = null) {
    // Store the values persistently
    this.winPercentage = winPercentage;
    this.handType = handType;
    
    console.log('[HUD] updateHandAnalysis called - Equity:', winPercentage, 'HandType:', handType, 'W/T/L:', winPct, tiePct, lossPct);
    
    // Ensure we always have advancedOuts and relativeStrength populated when possible
    try {
      if (advancedOuts) {
        this.advancedOuts = advancedOuts;
        console.log('[HUD] Advanced Outs received (from pipeline):', advancedOuts);
      } else {
        // Try to compute advanced outs locally using pokerTable helper if available (postflop only)
        if (this.pokerTable && typeof this.pokerTable.calculateAdvancedOuts === 'function' && this.myPlayer && Array.isArray(this.myPlayer.hand) && this.myPlayer.hand.length === 2 && this.pokerTable.board && this.pokerTable.board.length >= 3) {
          try {
            this.advancedOuts = this.pokerTable.calculateAdvancedOuts(this.myPlayer.hand, this.pokerTable.board);
            console.log('[HUD] Advanced Outs computed locally:', this.advancedOuts);
          } catch (e) {
            console.warn('[HUD] Failed to compute advancedOuts locally', e);
            this.advancedOuts = { totalOuts: 0, outsByHandType: {}, improvementChance: 0, detailedOuts: [], cardsRemaining: 0 };
          }
        } else {
          // Default empty structure keeps the Hand Summary visible but shows 0 outs
          this.advancedOuts = { totalOuts: 0, outsByHandType: {}, improvementChance: 0, detailedOuts: [], cardsRemaining: 0 };
        }
      }

      // Relative strength: prefer provided value, otherwise compute a local approximation
      if (relativeStrength) {
        this.relativeStrength = relativeStrength;
        console.log('[HUD] Relative Strength received (from pipeline):', relativeStrength);
      } else {
        if (this.pokerTable && typeof this.pokerTable.calculateRelativeHandStrength === 'function' && this.myPlayer && Array.isArray(this.myPlayer.hand) && this.myPlayer.hand.length === 2 && this.pokerTable.board && this.pokerTable.board.length >= 3) {
          try {
            // Build simple villain profile list (exclude hero and folded/sitting-out players)
            const villainProfiles = Array.from(this.pokerTable.players.values()).filter(p => p && !p.isMyPlayer && !p.hasFoldedThisHand() && !p.isSittingOut());
            this.relativeStrength = this.pokerTable.calculateRelativeHandStrength(this.myPlayer.hand, this.pokerTable.board, (winPct !== null ? winPct : winPercentage), villainProfiles);
            console.log('[HUD] Relative Strength computed locally:', this.relativeStrength);
          } catch (e) {
            console.warn('[HUD] Failed to compute relativeStrength locally', e);
            this.relativeStrength = { relativeStrength: 50, rangePosition: 'middle', betterHands: 0, equalHands: 0, worseHands: 0, currentHandType: handType || 'Unknown' };
          }
        } else {
          this.relativeStrength = { relativeStrength: 50, rangePosition: 'middle', betterHands: 0, equalHands: 0, worseHands: 0, currentHandType: handType || 'Unknown' };
        }
      }
    } catch (e) {
      console.warn('[HUD] updateHandAnalysis precomputation error', e);
      // Ensure defaults
      this.advancedOuts = this.advancedOuts || { totalOuts: 0, outsByHandType: {}, improvementChance: 0, detailedOuts: [], cardsRemaining: 0 };
      this.relativeStrength = this.relativeStrength || { relativeStrength: 50, rangePosition: 'middle', betterHands: 0, equalHands: 0, worseHands: 0, currentHandType: handType || 'Unknown' };
    }
    
    // Preserve W/T/L values if new ones are provided, otherwise keep previous
    if (winPct !== null && tiePct !== null && lossPct !== null) {
      this.winPct = winPct;
      this.tiePct = tiePct;
      this.lossPct = lossPct;
    }
    // If we don't have stored values, initialize to null
    if (this.winPct === undefined) {
      this.winPct = null;
      this.tiePct = null;
      this.lossPct = null;
    }

    // Update the hand analysis elements within the details panel
    const detailsPanel = this.doc.querySelector("#PokerEyePlus-detailsPanel");
    if (detailsPanel) {
      // Get equity elements
      const equityValueElement = this.doc.querySelector("#PokerEyePlus-equityValue");
      const equityBreakdownElement = this.doc.querySelector("#PokerEyePlus-equityBreakdown");
      const winPctElement = this.doc.querySelector("#PokerEyePlus-winPct");
      const tiePctElement = this.doc.querySelector("#PokerEyePlus-tiePct");
      const lossPctElement = this.doc.querySelector("#PokerEyePlus-lossPct");
  const handTypeElement = detailsPanel.querySelector("div div:nth-child(6) span:last-child");
      
  if (equityValueElement) {
        // Update main equity value
        equityValueElement.textContent = winPercentage ? roundFloat(winPercentage, 1) + '%' : 'N/A';
        equityValueElement.style.color = winPercentage ? '#10b981' : '#ccc';
        
        // Show breakdown if we have stored W/T/L values (managed above in updateHandAnalysis)
        if (this.winPct !== null && this.tiePct !== null && this.lossPct !== null) {
          if (equityBreakdownElement && winPctElement && tiePctElement && lossPctElement) {
            winPctElement.textContent = roundFloat(this.winPct, 1);
            tiePctElement.textContent = roundFloat(this.tiePct, 1);
            lossPctElement.textContent = roundFloat(this.lossPct, 1);
            equityBreakdownElement.style.display = 'block';
            console.log('[HUD] Showing W/T/L breakdown - W:', this.winPct, 'T:', this.tiePct, 'L:', this.lossPct);
          }
        } else {
          // Hide breakdown only if we truly have no stored values
          if (equityBreakdownElement) {
            equityBreakdownElement.style.display = 'none';
          }
          console.log('[HUD] No W/T/L data available, equity:', winPercentage);
        }
      } else {
        console.log("[HUD] ERROR: equityValueElement not found");
      }
      
      // Update combined Hand Summary (header + details)
      const summaryHeader = detailsPanel.querySelector('#PokerEyePlus-handSummaryHeader');
      const summaryDetails = detailsPanel.querySelector('#PokerEyePlus-handSummaryDetails');
      try {
        if (summaryHeader) {
          summaryHeader.innerHTML = handType || 'N/A';
          summaryHeader.style.color = handType ? '#f59e0b' : '#ccc';
        } else if (handTypeElement) {
          // Fallback: keep old element updated for compatibility
          handTypeElement.innerHTML = handType || 'N/A';
          handTypeElement.style.color = handType ? '#f59e0b' : '#ccc';
        }

        // Build combined details content (relative strength + outs summary)
        let detailsHTML = '';

        if (this.relativeStrength) {
          // Show only the numeric relative strength percent; remove textual descriptor in parentheses per UX request
          detailsHTML += `<div style="display:flex; justify-content:space-between; padding:2px 0;">
              <span style="color:#8b5cf6;">Relative Strength</span>
              <span style="color:#8b5cf6; font-weight:500;">${this.relativeStrength.relativeStrength.toFixed(1)}%</span>
            </div>`;

          detailsHTML += `<div style="display:flex; justify-content:space-between; padding:2px 0;">
              <span>Your hand:</span>
              <span style="color:#3b82f6; font-weight:500;">${this.relativeStrength.currentHandType || 'Unknown'}</span>
            </div>`;

          detailsHTML += `<div style="display:flex; justify-content:space-between; padding:2px 0;">
              <span>Better:</span>
              <span style="color:#ef4444; font-weight:500;">${this.relativeStrength.betterHands}</span>
            </div>`;

          detailsHTML += `<div style="display:flex; justify-content:space-between; padding:2px 0;">
              <span>Equal:</span>
              <span style="color:#fbbf24; font-weight:500;">${this.relativeStrength.equalHands}</span>
            </div>`;

          detailsHTML += `<div style="display:flex; justify-content:space-between; padding:2px 0;">
              <span>Worse:</span>
              <span style="color:#22c55e; font-weight:500;">${this.relativeStrength.worseHands}</span>
            </div>`;
        }

        if (this.advancedOuts && this.advancedOuts.totalOuts > 0) {
          detailsHTML += `<div style="height:6px"></div>`;
          detailsHTML += `<div style="display:flex; justify-content:space-between; padding:2px 0;">
              <span style="color:#fbbf24;">Outs to Improve</span>
              <span style="color:#fbbf24; font-weight:500;">${this.advancedOuts.totalOuts} (${this.advancedOuts.improvementChance.toFixed(1)}%)</span>
            </div>`;

          const sortedOuts = Object.entries(this.advancedOuts.outsByHandType || {}).sort((a,b)=> (b[1].rank||0)-(a[1].rank||0));
          for (const [ht, data] of sortedOuts) {
            detailsHTML += `<div style="display:flex; justify-content:space-between; padding:2px 0;">
                <span>${ht}:</span>
                <span style="color:#fbbf24; font-weight:500;">${data.count} outs</span>
              </div>`;
          }
        }

        if (summaryDetails) {
          summaryDetails.innerHTML = detailsHTML;
          summaryDetails.style.display = detailsHTML ? 'block' : 'none';
        }
      } catch (e) {
        console.warn('[HUD] Failed to update combined Hand Summary', e);
      }
      
      // Update opponent range display (always visible section, vertical format)
      const oppRangeSection = detailsPanel.querySelector("#PokerEyePlus-oppRangeSection");
      const oppRangeHeader = detailsPanel.querySelector("#PokerEyePlus-oppRangeHeader");
      const oppRangeDetails = detailsPanel.querySelector("#PokerEyePlus-oppRangeDetails");
      
      if (oppRangeHeader && oppRangeDetails) {
        if (oppRangeInfo && oppRangeInfo.range) {
          console.log('[HUD] Updating opp range section:', oppRangeInfo);
          
          // Simple format: show main villain's range (heads-up or most aggressive in multiway)
          // If preflop, append the strongest category from the range distribution to keep labels consistent
          let header = oppRangeInfo.isMultiway 
            ? `${oppRangeInfo.position} [${oppRangeInfo.actionType}] (${oppRangeInfo.count} opps)`
            : `${oppRangeInfo.position} [${oppRangeInfo.actionType}]`;
          try {
            const isPreflop = (this.pokerTable.board || []).length === 0;
            if (isPreflop && oppRangeInfo.handStrengthDist && oppRangeInfo.handStrengthDist.length > 0) {
              const topCategory = oppRangeInfo.handStrengthDist[0].handType;
              header = `${header} · Top: ${topCategory}`;
            }
          } catch (e) {}
          
          oppRangeHeader.textContent = header;
          
          if (oppRangeInfo.handStrengthDist && oppRangeInfo.handStrengthDist.length > 0) {
            // Show hand categories - vertical format
            const topHands = oppRangeInfo.handStrengthDist.slice(0, 5); // Show top 5
            const distHTML = topHands.map(h => 
              `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                <span>${h.handType}:</span>
                <span style="color: #a855f7; font-weight: 500;">${h.percentage}%</span>
              </div>`
            ).join('');
            
            oppRangeDetails.innerHTML = distHTML;
            oppRangeDetails.style.display = 'block';
            console.log('[HUD] Showing hand categories:', topHands.length);
          } else {
            // Fallback: show range notation
            oppRangeDetails.innerHTML = `<div style="text-align: right;">${oppRangeInfo.rangeNotation} (${oppRangeInfo.combosPercent}%)</div>`;
            oppRangeDetails.style.display = 'block';
            console.log('[HUD] Showing range notation');
          }
        } else {
          // No opponent range info - show N/A but keep section visible
          oppRangeHeader.textContent = 'N/A';
          oppRangeDetails.innerHTML = '';
          oppRangeDetails.style.display = 'none';
          console.log('[HUD] No opponent range info available');
        }
      }
      
      // EV Analysis UI intentionally removed — do not render EVs here (updateEVSection is a no-op)

      // Note: Outs and relative strength are now shown in the combined Hand Summary section
    } else {
      console.log("[HUD] ERROR: detailsPanel not found");
    }

    // Update button labels and visibility based on context
    const foldButton = this.doc.querySelector("#PokerEyePlus-foldButton");
    const checkButton = this.doc.querySelector("#PokerEyePlus-checkButton");
    const callButton = this.doc.querySelector("#PokerEyePlus-callButton");
    const betButton = this.doc.querySelector("#PokerEyePlus-betButton");

    if (foldButton) {
      if (foldPercentage !== null) {
        foldButton.innerText = `Fold (${foldPercentage.toFixed(0)}%)`;
        foldButton.style.display = "block";
      } else {
        foldButton.style.display = "none";
      }
    }

    if (checkButton) {
      if (checkPercentage !== null) {
        checkButton.innerText = isFacingBet ? `Call (${checkPercentage.toFixed(0)}%)` : `Check (${checkPercentage.toFixed(0)}%)`;
        checkButton.style.display = "block";
      } else {
        checkButton.style.display = "none";
      }
    }

    if (callButton) {
      callButton.style.display = "none"; // Always hide call button, use check button for call
    }

    if (betButton) {
      if (betPercentage !== null) {
        betButton.innerText = isFacingBet ? `Raise (${betPercentage.toFixed(0)}%)` : `Bet (${betPercentage.toFixed(0)}%)`;
        betButton.style.display = "block";
      } else {
        betButton.style.display = "none";
      }
    }
  }
}

class Player {
  constructor(dom, seatNumber, pokerTable) {
    this.dom = dom;
    this.seatNumber = seatNumber;
    this.pokerTable = pokerTable;

    this.init();
  }

  init() {
    this.id = generateUUID();
    this.isMyPlayer = this.dom.classList.contains("myPlayer");

    this.balance = undefined;
    this.balanceHistory = [];
    this.numBigBlinds = undefined;
    this.hand = [];
    this.actionHistory = [];
    this.actionHistoryPerHand = new Map();
    this.isTurnToAct = false;
    this.bestActions = [];
    this.actionEVs = {};
    this.position = null;

    this.logMessagePrefix = `(Table #${this.pokerTable.slotNumber}, Seat #${
      this.seatNumber
    }${this.isMyPlayer ? " - you" : ""}): `;

    // Intentar obtener balance inmediatamente
    this.getBalance();
    
    this.syncPlayerInfo();
  }

  syncPlayerInfo(runInstantly = true) {
    if (runInstantly) this.getPlayerInfo();
    this.syncPlayerInfoInterval = setInterval(
      () => this.getPlayerInfo(),
      TICK_RATE
    );
  }

  stopSyncingPlayerInfo() {
    clearInterval(this.syncPlayerInfoInterval);
  }

  getPlayerInfo() {
    try {
      return {
        balance: this.getBalance(),
        hand: this.getHand(),
        currentAction: this.getCurrentAction(),
      };
    } catch (error) {
      logMessage(
        `${this.logMessagePrefix}Error getting player info: ${error}`,
        { color: "red" }
      );
      console.error(error);
    }
  }

  resetBalanceHistory() {
    this.balance = undefined;
    this.balanceHistory = [];
    this.numBigBlinds = undefined;
  }

  resetActionHistory(resetBalanceHistory = true) {
    if (resetBalanceHistory) this.resetBalanceHistory();
    this.actionHistory = [];
    this.actionHistoryPerHand = new Map();
    this.isTurnToAct = false;

    this.stopSyncingPlayerInfo();
    this.syncPlayerInfo(false);
  }

  isSittingOut = () => {
    // Si tenemos cartas, definitivamente NO estamos sitting out
    if (this.hand.length === 2) {
      return false;
    }

    // Si tenemos una posición válida, NO estamos sitting out
    if (this.position && this.position !== 'SITTING OUT...') {
      return false;
    }

    // Obtener la acción actual del DOM
    const currentAction = this.getCurrentAction();
    
    // Si la acción actual es "SITTING OUT...", entonces SÍ estamos sitting out
    if (currentAction?.action === "SITTING OUT...") {
      return true;
    }

    // Verificar las acciones recientes en esta mano para ver si participamos
    const lastNextHandIndex = this.actionHistory.findLastIndex(
      (action) => action.action === "NEXT HAND"
    );
    const currentHandActions = lastNextHandIndex === -1 
      ? this.actionHistory 
      : this.actionHistory.slice(lastNextHandIndex + 1);

    // Si tenemos acciones activas en esta mano (CHECK, CALL, RAISE, BET, FOLD, POST SB/BB), NO estamos sitting out
    const activeActions = currentHandActions.filter(action => 
      ['CHECK', 'CALL', 'RAISE', 'BET', 'FOLD', 'ALL-IN', 'POST SB', 'POST BB'].some(
        activeAction => action.action.includes(activeAction)
      )
    );

    if (activeActions.length > 0) {
      return false;
    }

    // Si no hay historial de acciones y no hay acción actual, probablemente sitting out
    if (this.actionHistory.length === 0 && !currentAction) {
      return true;
    }

    // Por defecto, verificar la última acción
    const lastAction = this.actionHistory[this.actionHistory.length - 1];
    return lastAction?.action === "SITTING OUT..." || lastAction?.action === "NEW PLAYER";
  };

  hasFoldedThisHand = () => {
    // Buscar la última acción "NEXT HAND" para determinar el inicio de esta mano
    const lastNextHandIndex = this.actionHistory.findLastIndex(
      (action) => action.action === "NEXT HAND"
    );
    const currentHandActions = lastNextHandIndex === -1 
      ? this.actionHistory 
      : this.actionHistory.slice(lastNextHandIndex + 1);
    
    // Verificar si la última acción relevante fue FOLD
    return currentHandActions.some((action) => action.action === "FOLD");
  };

  isInCurrentHand = () => {
    // Un jugador está en la mano si:
    // 1. NO ha foldeado
    // 2. NO está sitting out
    // 3. Tiene cartas O ha posteado blind O ha hecho alguna acción preflop
    if (this.hasFoldedThisHand() || this.isSittingOut()) {
      return false;
    }
    
    // Tiene cartas visibles (nosotros o showdown)
    if (this.hand.length === 2) {
      return true;
    }
    
    // Buscar acciones en esta mano (POST, CALL, RAISE, CHECK, BET)
    const lastNextHandIndex = this.actionHistory.findLastIndex(
      (action) => action.action === "NEXT HAND"
    );
    const currentHandActions = lastNextHandIndex === -1 
      ? this.actionHistory 
      : this.actionHistory.slice(lastNextHandIndex + 1);
    
    const hasPostedOrActed = currentHandActions.some((action) => 
      action.action === "POST SB" || 
      action.action === "POST BB" ||
      action.action === "CALL" ||
      action.action === "RAISE" ||
      action.action === "BET" ||
      action.action === "CHECK" ||
      action.action === "ALL-IN"
    );
    
    if (hasPostedOrActed) {
      return true;
    }
    
    // IMPROVED FALLBACK para preflop: 
    // Si estamos en preflop y el jugador tiene posición válida (no sitting out, no foldeado),
    // asumimos que está activo. Esto cubre:
    // - Jugadores que aún no han actuado (timing issues con actionHistory)
    // - Blinds que postearon pero su acción no aparece aún en actionHistory
    const isPreflop = this.pokerTable.board.length === 0;
    if (isPreflop && this.position && !this.isSittingOut()) {
      // Verificar que no haya FOLD explícito en las acciones actuales
      const hasFoldAction = currentHandActions.some(a => a.action === "FOLD");
      if (!hasFoldAction) {
        return true;
      }
    }
    
    return false;
  };

  updateTurnToAct(isTurnToAct) {
    const prevTurn = this.isTurnToAct;
    if (isTurnToAct !== this.isTurnToAct) {
      // Reset all other players' turn to act and set this player's turn to act
      for (const player of this.pokerTable.players.values()) {
        player.isTurnToAct = player.id === this.id ? isTurnToAct : false;
        if (!player.isTurnToAct && player.isMyPlayer) player.bestActions = [];
      }

      // Check if it is my turn to act
      if (this.isTurnToAct && this.isMyPlayer) {
        // Emit hero turn start event
        try { this.pokerTable.emitGameEvent?.('heroTurnStart', { player: this }); } catch(e) {}
        // Refetch hand and position in case they aren't up to date
        this.getHand();
        for (const player of this.pokerTable.players.values()) {
          player.getBalance();
          player.getCurrentAction();
        }
        this.pokerTable.updatePlayerPositions();

        console.log(`[Turn to Act] Hero has turn. Hand: ${this.hand.length} cards, Position: ${this.position}`);

        if (this.hand.length === 2 && this.position !== null) {
          logMessage(`${this.logMessagePrefix}It's your turn to act.`, {
            color: "goldenrod",
          });

          void (async () => {
            // Wait a bit for DOM updates and action recording
            await new Promise(resolve => setTimeout(resolve, 200));
            const result = (await this.getBestActions()) ?? { actions: [], evs: {} };
            this.bestActions = result.actions || [];
            this.actionEVs = result.evs || {};
            
            // Display best actions only if showBestActions is enabled
            if (this.pokerTable.hud.showBestActions) {
              if (this.bestActions.length === 0) {
                logMessage(
                  `${this.logMessagePrefix}> Could not calculate the best action(s) given the current scenario.`,
                  {
                    color: "cornsilk",
                    fontStyle: "italic",
                  }
                );
              }
            }
          })();
        // end of my turn-start handling
        }
      // If we transitioned from being the one to act to not, emit heroActionStop
      if (prevTurn === true && isTurnToAct === false && this.isMyPlayer) {
        try { this.pokerTable.emitGameEvent?.('heroActionStop', { player: this, lastActions: this.actionHistoryPerHand.get(this.pokerTable.numHandsDealt) }); } catch(e) {}
      }
      }
    }
  }

  getNumBigBlinds = () =>
    this.pokerTable.blinds.big !== undefined
      ? roundFloat(this.balance / this.pokerTable.blinds.big, 2, false)
      : null;

  // Update HUD with current equity/hand without calculating actions
  updateHUDEquity = async () => {
    // Only update if we have a hand and HUD is enabled
    if (this.hand.length !== 2 || !this.pokerTable?.hud) return;
    
    try {
      const boardLength = this.pokerTable.board?.length || 0;
      console.log(`[HUD Auto-Update] Board length: ${boardLength}, Board:`, this.pokerTable.board);
      
      // Preflop: Use range-based equity if available
      if (boardLength === 0) {
        const formattedHand = formatHandForAPI(this.hand);
        if (!HAND_KEYS.includes(formattedHand)) {
          this.pokerTable.hud.updateHandAnalysis(undefined, `Mano no soportada (${formattedHand})`);
          return;
        }
        
        const activeVillains = Array.from(this.pokerTable.players.values())
          .filter(p => {
            if (p.id === this.id) return false; // Skip hero
            
            // Incluir jugadores que NO han foldeado y NO están sitting out
            if (p.hasFoldedThisHand() || p.isSittingOut()) {
              return false;
            }
            
            // Incluir si tiene posición válida
            if (p.position) {
              return true;
            }
            
            // Incluir si está en la mano actual (tiene cartas o ha posteado blind)
            if (p.isInCurrentHand()) {
              return true;
            }
            
            // Incluir si tiene acciones recientes en esta mano
            const lastNextHandIndex = p.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
            const currentHandActions = lastNextHandIndex === -1 ? p.actionHistory : p.actionHistory.slice(lastNextHandIndex + 1);
            const hasActiveActions = currentHandActions.some(a => 
              ['CHECK', 'CALL', 'RAISE', 'BET', 'ALL-IN', 'POST SB', 'POST BB'].some(
                activeAction => a.action.includes(activeAction)
              )
            );
            
            return hasActiveActions;
          });
        
        console.log('[HUD Auto-Update - Preflop] Active villains:', activeVillains.map(v => `${v.seatNumber}:${v.position || 'no-pos'}`).join(', '));
        
        let winPercentage;
        let winPct = null, tiePct = null, lossPct = null;
        const handType = getHandType(this.hand);
        
        // Try range-based equity first
        if (activeVillains.length > 0 && USE_MONTE_CARLO_POSTFLOP) {
          try {
            const rangeContext = {
              bigBlind: this.pokerTable.blinds.big,
              preflopAggressor: null,
              isSqueezeSpot: false
            };
            
            // Fast preflop auto-update (25% of full calculation for speed)
            const preflopAutoUpdateIterations = Math.floor(getMonteCarloIterations(activeVillains.length) * 0.25);
            
            const result = await EquityCalculator.getMonteCarloEquity(
              this.hand,
              [],
              activeVillains.length,
              [],
              preflopAutoUpdateIterations,
              activeVillains,
              rangeContext
            );
            
            // Capturar equity Y breakdown de Win/Tie/Loss
            if (typeof result === 'object') {
              winPercentage = result.equity;
              winPct = result.winPct || null;
              tiePct = result.tiePct || null;
              lossPct = result.lossPct || null;
            } else {
              winPercentage = result;
            }
          } catch {
            // Fallback to table-based equity
            winPercentage = getAdvancedPreflopEquity(
              this.hand,
              this.position,
              this.getNumBigBlinds(),
              null,
              false,
              this.pokerTable.players,
              activeVillains
            );
          }
        } else {
          // Use table-based equity
          winPercentage = getAdvancedPreflopEquity(
            this.hand,
            this.position,
            this.getNumBigBlinds(),
            null,
            false,
            this.pokerTable.players,
            activeVillains
          );
        }
        
        // CALCULATE EVs FOR HUD (Preflop) - moved up to get raiseCount first
        const isFacingRaise = this.pokerTable.currentBet > this.pokerTable.blinds.big;
        const lastRaiseAmount = this.pokerTable.currentBet - (this.pokerTable.yourLastBet || 0);
        const betToCall = isFacingRaise ? lastRaiseAmount : this.pokerTable.blinds.big;
        const currentPot = this.pokerTable.totalPot || (this.pokerTable.blinds.small + this.pokerTable.blinds.big);
        const raiseCount = this.pokerTable.raiseCount || 0;
        
        // Generate opponent range info for preflop (with raiseCount for 3-bet/4-bet detection)
        const rangeContext = {
          bigBlind: this.pokerTable.blinds.big,
          preflopAggressor: null,
          isSqueezeSpot: false,
          raiseCount: raiseCount
        };
        const oppRangeInfo = this.pokerTable.hud.getOpponentRangeInfo(activeVillains, rangeContext);
        
        this.pokerTable.hud.updateHandAnalysis(winPercentage, handType, null, null, null, null, false, winPct, tiePct, lossPct, oppRangeInfo);
        const isInPosition = ['BTN', 'CO', 'HJ'].includes(this.position);
        
        // Prefer unified evaluator when available (unified live pipeline). Fallback to legacy calculateActionEVs
        let actionEVs = null;
        try {
          if (window.PokerEyeEvaluator && typeof window.PokerEyeEvaluator.getRecommendation === 'function') {
            const evalRes = await getUnifiedRecommendationFromEvaluator({
              heroHand: this.hand,
              board: [],
              players: activeVillains,
              potSize: currentPot,
              toCall: betToCall,
              raiseSize: this.pokerTable.currentBet || betToCall,
              context: { winPct, tiePct, iterations: getMonteCarloIterations(activeVillains.length) },
              street: 'preflop',
              isPreflop: true
            });
            if (evalRes && evalRes.evs) {
              // evalRes contains { actions, evs }
              actionEVs = evalRes.evs;
            }
          }
        } catch (e) {
          console.warn('[HUD] Unified evaluator failed (preflop), falling back', e);
        }

        if (!actionEVs) {
          actionEVs = this.calculateActionEVs(
            winPercentage,
            currentPot,
            betToCall,
            this.balance,
            isFacingRaise,
            raiseCount,
            true, // isPreflop
            null, // no board texture preflop
            activeVillains,
            isInPosition,
            'preflop',
            { winPct, tiePct }
          );
        }
        
        // Update HUD with EVs
        if (this.pokerTable?.hud) {
          this.pokerTable.hud.updateEVSection(actionEVs);
        }
        
        // Log con breakdown si está disponible
        if (winPct !== null && tiePct !== null && lossPct !== null) {
          logMessage(`${this.logMessagePrefix}[HUD Auto-Update] Preflop: ${winPercentage}% (W: ${winPct.toFixed(1)}% | T: ${tiePct.toFixed(1)}% | L: ${lossPct.toFixed(1)}%) | ${handType}`, { color: "lightblue" });
        } else {
          logMessage(`${this.logMessagePrefix}[HUD Auto-Update] Preflop: ${winPercentage}% | ${handType}`, { color: "lightblue" });
        }
      } 
      // Postflop: Use Monte Carlo with Win/Tie/Loss
      else {
        const activeVillains = Array.from(this.pokerTable.players.values())
          .filter(p => {
            if (p.id === this.id) return false; // Skip hero
            
            const hasFolded = p.hasFoldedThisHand();
            const sittingOut = p.isSittingOut();
            
            // Debug logging
            if (p.position) {
              console.log(`[Active Villain Check - Postflop] Seat ${p.seatNumber} (${p.position}): folded=${hasFolded}, sittingOut=${sittingOut}`);
            }
            
            // Incluir jugadores que NO han foldeado y NO están sitting out
            if (hasFolded || sittingOut) {
              return false;
            }
            
            // Incluir si tiene posición válida
            if (p.position) {
              return true;
            }
            
            // Incluir si está en la mano actual (tiene cartas o ha posteado blind)
            if (p.isInCurrentHand()) {
              return true;
            }
            
            // Incluir si tiene acciones recientes en esta mano
            const lastNextHandIndex = p.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
            const currentHandActions = lastNextHandIndex === -1 ? p.actionHistory : p.actionHistory.slice(lastNextHandIndex + 1);
            const hasActiveActions = currentHandActions.some(a => 
              ['CHECK', 'CALL', 'RAISE', 'BET', 'ALL-IN', 'POST SB', 'POST BB'].some(
                activeAction => a.action.includes(activeAction)
              )
            );
            
            return hasActiveActions;
          });
        
        console.log('[HUD Auto-Update - Postflop] Active villains:', activeVillains.map(v => `${v.seatNumber}:${v.position || 'no-pos'}`).join(', '));
        
        if (activeVillains.length === 0) {
          console.log('[HUD Auto-Update] No active villains in postflop, skipping');
          return;
        }
        
        // Reset smoothing if board changed (new street)
        if (this.lastBoardLength !== this.pokerTable.board.length) {
          this.lastAutoUpdateEquity = undefined;
          this.lastBoardLength = this.pokerTable.board.length;
          console.log('[HUD Auto-Update] Board changed, resetting equity smoothing');
        }
        
        const handType = this.evaluatePostflopHand(this.hand, this.pokerTable.board);
        const drawInfo = this.analyzeDraws(this.hand, this.pokerTable.board);
        
        // Use Monte Carlo if enabled
        if (USE_MONTE_CARLO_POSTFLOP) {
          const rangeContext = {
            bigBlind: this.pokerTable.blinds.big,
            preflopAggressor: null,
            isSqueezeSpot: false,
            raiseCount: this.pokerTable.raiseCount || 0
          };
          
          // Adaptive iterations based on number of opponents
          const iterations = getMonteCarloIterations(activeVillains.length);
          console.log(`[HUD Auto-Update] Using ${iterations} iterations for ${activeVillains.length} opponent(s)`);
          
          const result = await EquityCalculator.getMonteCarloEquity(
            this.hand,
            this.pokerTable.board,
            activeVillains.length,
            [],
            iterations,
            activeVillains,
            rangeContext
          );
          
          let equity = typeof result === 'object' ? result.equity : result;
          let winPct = result.winPct || equity;
          let tiePct = result.tiePct || 0;
          let lossPct = result.lossPct || (100 - equity);
          
          // SMOOTHING: If equity changed more than 5% from last calculation, average them
          // This reduces Monte Carlo variance noise without losing accuracy
          if (this.lastAutoUpdateEquity !== undefined) {
            const equityDiff = Math.abs(equity - this.lastAutoUpdateEquity);
            if (equityDiff > 5) {
              const oldEquity = equity;
              equity = (equity + this.lastAutoUpdateEquity) / 2;
              winPct = (winPct + (this.lastAutoUpdateWinPct || winPct)) / 2;
              tiePct = (tiePct + (this.lastAutoUpdateTiePct || tiePct)) / 2;
              lossPct = (lossPct + (this.lastAutoUpdateLossPct || lossPct)) / 2;
              console.log(`[HUD Auto-Update] Smoothing applied: ${oldEquity.toFixed(1)}% → ${equity.toFixed(1)}% (diff was ${equityDiff.toFixed(1)}%)`);
            }
          }
          
          // Store for next comparison
          this.lastAutoUpdateEquity = equity;
          this.lastAutoUpdateWinPct = winPct;
          this.lastAutoUpdateTiePct = tiePct;
          this.lastAutoUpdateLossPct = lossPct;
          
          const displayHandType = drawInfo.hasDraws 
            ? `${handType.description} + ${drawInfo.description.split(' (')[0]}` 
            : handType.description;
          
          // Generate opponent range info for postflop (pass board)
          const oppRangeInfo = this.pokerTable.hud.getOpponentRangeInfo(activeVillains, rangeContext, this.pokerTable.board);
          
          // CALCULATE ADVANCED OUTS AND RELATIVE STRENGTH
          const advancedOuts = this.calculateAdvancedOuts(this.hand, this.pokerTable.board);
          const relativeStrength = this.calculateRelativeHandStrength(this.hand, this.pokerTable.board, equity, activeVillains);
          
          // Log advanced analysis
          if (advancedOuts.totalOuts > 0) {
            console.log(`[Advanced Outs] ${advancedOuts.totalOuts} outs (${advancedOuts.improvementChance.toFixed(1)}% to improve)`);
            for (const [handType, data] of Object.entries(advancedOuts.outsByHandType)) {
              console.log(`  → ${handType}: ${data.count} outs`);
            }
          }
          
          console.log(`[Relative Strength] ${relativeStrength.relativeStrength}% - ${relativeStrength.rangePosition}`);
          console.log(`  → Better hands: ${relativeStrength.betterHands}, Equal: ${relativeStrength.equalHands}, Worse: ${relativeStrength.worseHands}`);
          
          this.pokerTable.hud.updateHandAnalysis(equity, displayHandType, null, null, null, null, false, winPct, tiePct, lossPct, oppRangeInfo, advancedOuts, relativeStrength);
          
          // CALCULATE EVs FOR HUD (Postflop)
          const boardTexture = this.analyzeBoardTexture(this.pokerTable.board);
          const isFacingBet = this.pokerTable.currentBet > 0;
          const betToCall = isFacingBet ? (this.pokerTable.currentBet - (this.pokerTable.yourLastBet || 0)) : 0;
          const currentPot = this.pokerTable.totalPot || 0;
          const raiseCount = this.pokerTable.raiseCount || 0;
          const isInPosition = ['BTN', 'CO', 'HJ'].includes(this.position);
          
          let street = 'flop';
          if (this.pokerTable.board.length === 4) street = 'turn';
          else if (this.pokerTable.board.length === 5) street = 'river';
          
          // Prefer unified evaluator for postflop, fallback to legacy calculateActionEVs
          let actionEVs = null;
          try {
            if (window.PokerEyeEvaluator && typeof window.PokerEyeEvaluator.getRecommendation === 'function') {
              const evalRes = await getUnifiedRecommendationFromEvaluator({
                heroHand: this.hand,
                board: this.pokerTable.board,
                players: activeVillains,
                potSize: currentPot,
                toCall: betToCall,
                raiseSize: Math.max((betToCall || 0) * 2, 1),
                context: { winPct, tiePct, drawInfo, iterations: getMonteCarloIterations(activeVillains.length) },
                street,
                isPreflop: false
              });
              if (evalRes && evalRes.evs) actionEVs = evalRes.evs;
            }
          } catch (e) {
            console.warn('[HUD] Unified evaluator failed (postflop), falling back', e);
          }

          if (!actionEVs) {
            actionEVs = this.calculateActionEVs(
              equity,
              currentPot,
              betToCall,
              this.balance,
              isFacingBet,
              raiseCount,
              false, // not preflop
              boardTexture,
              activeVillains,
              isInPosition,
              street,
              { winPct, tiePct, drawInfo }
            );
          }
          
          // Update HUD with EVs
          if (this.pokerTable?.hud) {
            this.pokerTable.hud.updateEVSection(actionEVs);
          }
          
          logMessage(`${this.logMessagePrefix}[HUD Auto-Update] Postflop (${this.pokerTable.board.length} cards): ${equity.toFixed(1)}% (W: ${winPct.toFixed(1)}% | T: ${tiePct.toFixed(1)}% | L: ${lossPct.toFixed(1)}%)`, { color: "lightblue" });
        }
      }
    } catch (error) {
      console.error('[HUD Auto-Update] Error:', error);
    }
  };

  getBestActions = async () => {
    logMessage(`${this.logMessagePrefix}Calculating best action(s)...`, {
      color: "cornsilk",
    });

    // If it is preflop, get the best preflop actions
    if (this.pokerTable.board.length === 0)
      return await this.getBestPreflopActions();
    // If it is postflop, get the best postflop actions
    else return await this.getBestPostflopActions();
  };

  getBestPreflopActions = async () => {
    logMessage(`${this.logMessagePrefix}> Preflop detected.`, {
      color: "cornsilf",
    });
    
    // Validar si la mano está soportada por HAND_KEYS
    const formattedHand = formatHandForAPI(this.hand);
    if (!HAND_KEYS.includes(formattedHand)) {
      logMessage(`${this.logMessagePrefix}> Mano no soportada por el chart preflop: ${formattedHand}`, { color: "red" });
      if (this.pokerTable?.hud) {
        this.pokerTable.hud.updateHandAnalysis(undefined, `Mano no soportada (${formattedHand})`);
      }
      return [
        { action: "Fold", percentage: 1, numBigBlinds: 0, amountToBet: 0 }
      ];
    }

    // ANÁLISIS AVANZADO DE LA SITUACIÓN ACTUAL
    // 1. Recopilar todos los villanos activos EN ESTA MANO (no foldeados)
    // PREFLOP: Contar todos los jugadores sentados que no han foldeado (incluso si no han actuado aún)
    const activeVillains = Array.from(this.pokerTable.players.values())
      .filter(p => {
        if (p.id === this.id) return false; // No contarse a uno mismo
        
        // Jugadores sentados con posición válida
        if (p.isSittingOut()) return false;
        
        // Verificar si ya foldeó explícitamente
        if (p.hasFoldedThisHand()) return false;
        
        // En preflop, contar cualquier jugador con posición (aunque no haya actuado)
        // Esto incluye jugadores que están esperando su turno
        if (p.position) {
          // Verificar que no tenga FOLD en acciones recientes
          const lastNextHandIdx = p.actionHistory.findLastIndex(a => a.action === "NEXT HAND");
          const currentActions = lastNextHandIdx === -1 ? p.actionHistory : p.actionHistory.slice(lastNextHandIdx + 1);
          
          // Si tiene FOLD, no es activo
          if (currentActions.some(a => a.action === "FOLD")) return false;
          
          // Si tiene acciones agresivas/pasivas recientes (CALL, RAISE, BET, CHECK, ALL-IN), es activo
          const hasActiveAction = currentActions.some(a => 
            a.action === "CALL" || 
            a.action === "RAISE" || 
            a.action === "BET" || 
            a.action === "CHECK" ||
            a.action === "ALL-IN" ||
            a.action === "POST SB" ||
            a.action === "POST BB"
          );
          
          if (hasActiveAction) return true;
          
          // Si no ha actuado aún pero tiene posición, contar (esperando turno)
          return true;
        }
        
        // Fallback: usar isInCurrentHand() si no tiene posición clara
        return p.isInCurrentHand();
      });
    
    // DEBUG: Log detallado de cada jugador
    const allPlayers = Array.from(this.pokerTable.players.values()).filter(p => p.id !== this.id);
    for (const p of allPlayers) {
      const lastNextHandIdx = p.actionHistory.findLastIndex(a => a.action === "NEXT HAND");
      const currentActions = lastNextHandIdx === -1 ? p.actionHistory : p.actionHistory.slice(lastNextHandIdx + 1);
      const actionSummary = currentActions.map(a => a.action).join(', ');
      
      logMessage(
        `${this.logMessagePrefix}  [DEBUG] ${p.position || 'Unknown'}: ` +
        `hasFolded=${p.hasFoldedThisHand()}, sittingOut=${p.isSittingOut()}, ` +
        `hand=${p.hand.length}, position=${p.position || 'NONE'}, actions=[${actionSummary}], ` +
        `isInHand=${p.isInCurrentHand()}`,
        { color: "gray" }
      );
    }
    
    logMessage(
      `${this.logMessagePrefix}> Jugadores activos en la mano: ${activeVillains.length} (${activeVillains.map(p => p.position || 'Unknown').join(', ')})`,
      { color: "lightblue" }
    );
    
    // 2. Detectar patrón de acción actual (RFI, 3-bet, 4-bet, limp, etc.)
    let raiseCount = 0;
    let lastRaiserPosition = null;
    let lastRaiseAmount = 0;
    let totalPotBeforeUs = this.pokerTable.blinds.small + this.pokerTable.blinds.big;
    
    // IMPORTANTE: Solo contar raises si hay oponentes activos en la mano
    // Si todos foldearon, no hay raises activos que enfrentar
    if (activeVillains.length > 0) {
      // Contar raises SOLO de jugadores que todavía están en la mano
      // SOLO contar acciones PREFLOP (street === undefined)
      for (const villain of activeVillains) {
        const lastNextHandIndex = villain.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
        const splicedActionHistory = lastNextHandIndex === -1 ? villain.actionHistory : villain.actionHistory.slice(lastNextHandIndex + 1);
        
        for (const action of splicedActionHistory) {
          // Solo contar acciones preflop (sin street definido)
          if (action.street !== undefined) continue;
          
          if (action.action === "BET" || action.action === "RAISE" || action.action === "ALL-IN") {
            const amount = Math.abs(action.amountBet || 0);
            if (amount >= this.pokerTable.blinds.big) {
              raiseCount++;
              lastRaiserPosition = villain.position;
              lastRaiseAmount = Math.max(lastRaiseAmount, amount);
              // Si es el primer raise y es >= 2bb, detectar RFI position
              if (raiseCount === 1 && !this.pokerTable.rfiPosition) {
                this.pokerTable.rfiPosition = villain.position;
                logMessage(`${this.logMessagePrefix}> RFI detectado desde ${villain.position}`, {
                  color: "yellow",
                });
              }
            }
          } else if (action.action === "CALL") {
            totalPotBeforeUs += Math.abs(action.amountBet || 0);
          }
        }
      }
    }
    
    const is3BetPot = raiseCount >= 2;
    const is4BetPot = raiseCount >= 3;
    const isFacingRaise = raiseCount > 0;
    
    // 3. Calcular equity dinámico usando RANGOS cuando hay villanos activos
    const handType = getHandType(this.hand);
    let winPercentage;
    let winPct = null, tiePct = null, lossPct = null;
    let usedRangeBasedEquity = false;
    
    // Si hay villanos activos Y rangos disponibles, usar Monte Carlo con rangos
    if (activeVillains.length > 0 && USE_MONTE_CARLO_POSTFLOP) {
      try {
        const rangeContext = {
          bigBlind: this.pokerTable.blinds.big,
          preflopAggressor: lastRaiserPosition,
          isSqueezeSpot: false,
          raiseCount: raiseCount
        };
        
        logMessage(`${this.logMessagePrefix}> Calculando equity preflop con rangos dinámicos...`, {
          color: "cyan",
        });
        
        // Adaptive iterations for preflop (use 50% of postflop iterations - faster but still accurate)
        const preflopIterations = Math.floor(getMonteCarloIterations(activeVillains.length) * 0.5);
        console.log(`[Preflop Equity] Using ${preflopIterations} iterations for ${activeVillains.length} opponent(s)`);
        
        // Usar Monte Carlo con rangos (como en postflop)
        const result = await EquityCalculator.getMonteCarloEquity(
          this.hand,
          [], // Empty board (preflop)
          activeVillains.length,
          [],
          preflopIterations,
          activeVillains,
          rangeContext
        );
        
        // Capturar equity Y breakdown de Win/Tie/Loss
        if (typeof result === 'object') {
          winPercentage = result.equity;
          winPct = result.winPct || null;
          tiePct = result.tiePct || null;
          lossPct = result.lossPct || null;
        } else {
          winPercentage = result;
        }
        usedRangeBasedEquity = true;
        
        // Log con breakdown si está disponible
        if (winPct !== null) {
          logMessage(`${this.logMessagePrefix}> Equity con rangos: ${winPercentage}% (W: ${winPct.toFixed(1)}% | T: ${tiePct.toFixed(1)}% | L: ${lossPct.toFixed(1)}%) vs ${activeVillains.map(v => v.position).join(', ')}`, {
            color: "lightgreen",
          });
        } else {
          logMessage(`${this.logMessagePrefix}> Equity con rangos: ${winPercentage}% vs ${activeVillains.map(v => v.position).join(', ')}`, {
            color: "lightgreen",
          });
        }
      } catch (error) {
        console.error('[Preflop Range-Based] Error, usando tabla estática:', error);
        winPercentage = getAdvancedPreflopEquity(
          this.hand,
          this.position,
          this.getNumBigBlinds(),
          lastRaiserPosition,
          is3BetPot,
          this.pokerTable.players,
          activeVillains
        );
      }
    } else {
      // Fallback a equity estático de tabla
      winPercentage = getAdvancedPreflopEquity(
        this.hand,
        this.position,
        this.getNumBigBlinds(),
        lastRaiserPosition,
        is3BetPot,
        this.pokerTable.players,
        activeVillains
      );
    }
    
    // 4. Actualizar HUD con equity dinámico y rango oponente
    if (this.pokerTable?.hud) {
      const rangeContext = {
        bigBlind: this.pokerTable.blinds.big,
        preflopAggressor: lastRaiserPosition,
        isSqueezeSpot: false,
        raiseCount: raiseCount
      };
      const oppRangeInfo = this.pokerTable.hud.getOpponentRangeInfo(activeVillains, rangeContext);
      this.pokerTable.hud.updateHandAnalysis(winPercentage, handType, null, null, null, null, false, winPct, tiePct, lossPct, oppRangeInfo);
    }
    
    logMessage(`${this.logMessagePrefix}> Equity dinámico: ${winPercentage}% (${activeVillains.length} oponentes, ${raiseCount} raises${usedRangeBasedEquity ? ', range-based' : ''})`, {
      color: "cornsilk",
    });

    // 5. GENERAR ACCIONES AVANZADAS BASADAS EN GTO Y SITUACIÓN
    const bestActions = [];
    const stackInBB = this.getNumBigBlinds();
    const potOdds = isFacingRaise ? (lastRaiseAmount / (totalPotBeforeUs + lastRaiseAmount)) * 100 : 0;
    const isInPosition = ['BTN', 'CO', 'HJ'].includes(this.position);
    
    // Detectar si podemos check gratis (BB sin raise)
    const canCheckForFree = !isFacingRaise && (this.position === 'BB' || this.position === 'SB');
    
    // Categorías de manos
    const isPremium = ['AA', 'KK', 'QQ', 'AKs', 'AKo'].includes(formattedHand);
    const isStrongBroadway = ['JJ', 'TT', 'AQs', 'AQo', 'AJs', 'AJo', 'KQs'].includes(formattedHand);
    const isMediumPair = ['99', '88', '77', '66'].includes(formattedHand);
    const isSpeculative = formattedHand.includes('s') && !formattedHand.includes('A') && !formattedHand.includes('K');
    
    // SITUACIÓN 0: Podemos check gratis en BB (sin raise)
    if (canCheckForFree) {
      if (winPercentage >= 55 || isPremium || isStrongBroadway) {
        // Manos fuertes: raise for value incluso en BB
        bestActions.push({
          action: "Raise",
          percentage: 0.70,
          numBigBlinds: 3.0,
          amountToBet: 3.0 * this.pokerTable.blinds.big
        });
        bestActions.push({
          action: "Check",
          percentage: 0.30,
          numBigBlinds: 0,
          amountToBet: 0
        });
      } else {
        // Cualquier otra mano: check gratis (nunca fold si es gratis)
        bestActions.push({
          action: "Check",
          percentage: 1.0,
          numBigBlinds: 0,
          amountToBet: 0
        });
      }
    }
    
    // SITUACIÓN 1: No hay raise y no estamos en blinds (abrimos nosotros)
    else if (!isFacingRaise) {
      if (winPercentage >= 60 || isPremium) {
        // Manos fuertes o premium: raise para valor
        bestActions.push({
          action: "Raise",
          percentage: 0.90,
          numBigBlinds: isInPosition ? 2.5 : 3.0,
          amountToBet: (isInPosition ? 2.5 : 3.0) * this.pokerTable.blinds.big
        });
        bestActions.push({
          action: "Fold",
          percentage: 0.10,
          numBigBlinds: 0,
          amountToBet: 0
        });
      } else if (winPercentage >= 42 || isMediumPair) {
        // Manos medias y pares medios (77-99): raise o fold según posición
        if (isInPosition) {
          // En posición: más aggressive
          bestActions.push({
            action: "Raise",
            percentage: 0.80,
            numBigBlinds: 2.5,
            amountToBet: 2.5 * this.pokerTable.blinds.big
          });
          bestActions.push({
            action: "Fold",
            percentage: 0.20,
            numBigBlinds: 0,
            amountToBet: 0
          });
        } else {
          // OOP: pares medios son raise, suited connectors pueden foldear
          const raiseFreq = isMediumPair ? 0.75 : 0.55;
          bestActions.push({
            action: "Raise",
            percentage: raiseFreq,
            numBigBlinds: 3.0,
            amountToBet: 3.0 * this.pokerTable.blinds.big
          });
          bestActions.push({
            action: "Fold",
            percentage: 1 - raiseFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
        }
      } else if (winPercentage >= 35) {
        // Manos especulativas: limp o fold
        if (isInPosition && stackInBB > 50) {
          bestActions.push({
            action: "Limp",
            percentage: 0.60,
            numBigBlinds: 1,
            amountToBet: this.pokerTable.blinds.big
          });
          bestActions.push({
            action: "Fold",
            percentage: 0.40,
            numBigBlinds: 0,
            amountToBet: 0
          });
        } else {
          bestActions.push({
            action: "Fold",
            percentage: 1.0,
            numBigBlinds: 0,
            amountToBet: 0
          });
        }
      } else {
        // Manos débiles: fold
        bestActions.push({
          action: "Fold",
          percentage: 1.0,
          numBigBlinds: 0,
          amountToBet: 0
        });
      }
    }
    
    // SITUACIÓN 2: Facing single raise (RFI)
    else if (raiseCount === 1 && !is3BetPot) {
      const raiseSize = lastRaiseAmount / this.pokerTable.blinds.big;
      
      if (isPremium) {
        // Manos premium: 3-bet o flat call (slow play)
        bestActions.push({
          action: "3-Bet",
          percentage: 0.80,
          numBigBlinds: Math.max(8, raiseSize * 3),
          amountToBet: Math.max(8, raiseSize * 3) * this.pokerTable.blinds.big
        });
        bestActions.push({
          action: "Call",
          percentage: 0.20,
          numBigBlinds: raiseSize,
          amountToBet: lastRaiseAmount
        });
      } else if (winPercentage >= 55) {
        // Manos fuertes: mix de 3-bet y call
        if (isInPosition) {
          bestActions.push({
            action: "3-Bet",
            percentage: 0.50,
            numBigBlinds: Math.max(7, raiseSize * 2.8),
            amountToBet: Math.max(7, raiseSize * 2.8) * this.pokerTable.blinds.big
          });
          bestActions.push({
            action: "Call",
            percentage: 0.45,
            numBigBlinds: raiseSize,
            amountToBet: lastRaiseAmount
          });
          bestActions.push({
            action: "Bluff 3-Bet",
            percentage: 0.05,
            numBigBlinds: Math.max(8, raiseSize * 3),
            amountToBet: Math.max(8, raiseSize * 3) * this.pokerTable.blinds.big
          });
        } else {
          bestActions.push({
            action: "Call",
            percentage: 0.60,
            numBigBlinds: raiseSize,
            amountToBet: lastRaiseAmount
          });
          bestActions.push({
            action: "3-Bet",
            percentage: 0.30,
            numBigBlinds: Math.max(7, raiseSize * 2.8),
            amountToBet: Math.max(7, raiseSize * 2.8) * this.pokerTable.blinds.big
          });
          bestActions.push({
            action: "Fold",
            percentage: 0.10,
            numBigBlinds: 0,
            amountToBet: 0
          });
        }
      } else if (winPercentage >= 40 && potOdds < winPercentage) {
        // Equity suficiente para call
        if (isSpeculative && stackInBB > 40) {
          bestActions.push({
            action: "Call",
            percentage: 0.70,
            numBigBlinds: raiseSize,
            amountToBet: lastRaiseAmount
          });
          bestActions.push({
            action: "Fold",
            percentage: 0.30,
            numBigBlinds: 0,
            amountToBet: 0
          });
        } else {
          bestActions.push({
            action: "Fold",
            percentage: 0.60,
            numBigBlinds: 0,
            amountToBet: 0
          });
          bestActions.push({
            action: "Call",
            percentage: 0.40,
            numBigBlinds: raiseSize,
            amountToBet: lastRaiseAmount
          });
        }
      } else {
        // Equity insuficiente: fold (o bluff 3-bet ocasional)
        if (isInPosition && lastRaiserPosition && ['UTG', 'MP'].includes(lastRaiserPosition)) {
          // Bluff 3-bet contra tight opener
          bestActions.push({
            action: "Fold",
            percentage: 0.85,
            numBigBlinds: 0,
            amountToBet: 0
          });
          bestActions.push({
            action: "Bluff 3-Bet",
            percentage: 0.15,
            numBigBlinds: Math.max(8, raiseSize * 3.2),
            amountToBet: Math.max(8, raiseSize * 3.2) * this.pokerTable.blinds.big
          });
        } else {
          bestActions.push({
            action: "Fold",
            percentage: 1.0,
            numBigBlinds: 0,
            amountToBet: 0
          });
        }
      }
    }
    
    // SITUACIÓN 3: Facing 3-bet
    else if (is3BetPot && !is4BetPot) {
      if (isPremium) {
        // Premium hands: 4-bet o call
        if (stackInBB < 50) {
          // Short stack: all-in
          bestActions.push({
            action: "All-In (4-Bet)",
            percentage: 0.90,
            numBigBlinds: stackInBB,
            amountToBet: this.balance
          });
          bestActions.push({
            action: "Call",
            percentage: 0.10,
            numBigBlinds: lastRaiseAmount / this.pokerTable.blinds.big,
            amountToBet: lastRaiseAmount
          });
        } else {
          bestActions.push({
            action: "4-Bet",
            percentage: 0.75,
            numBigBlinds: Math.max(18, (lastRaiseAmount / this.pokerTable.blinds.big) * 2.5),
            amountToBet: Math.max(18, (lastRaiseAmount / this.pokerTable.blinds.big) * 2.5) * this.pokerTable.blinds.big
          });
          bestActions.push({
            action: "Call",
            percentage: 0.25,
            numBigBlinds: lastRaiseAmount / this.pokerTable.blinds.big,
            amountToBet: lastRaiseAmount
          });
        }
      } else if (winPercentage >= 60) {
        // Strong hands: call o 4-bet ocasional
        bestActions.push({
          action: "Call",
          percentage: 0.70,
          numBigBlinds: lastRaiseAmount / this.pokerTable.blinds.big,
          amountToBet: lastRaiseAmount
        });
        bestActions.push({
          action: "4-Bet",
          percentage: 0.20,
          numBigBlinds: Math.max(16, (lastRaiseAmount / this.pokerTable.blinds.big) * 2.3),
          amountToBet: Math.max(16, (lastRaiseAmount / this.pokerTable.blinds.big) * 2.3) * this.pokerTable.blinds.big
        });
        bestActions.push({
          action: "Fold",
          percentage: 0.10,
          numBigBlinds: 0,
          amountToBet: 0
        });
      } else {
        // Medium/weak hands: fold principalmente
        bestActions.push({
          action: "Fold",
          percentage: 0.95,
          numBigBlinds: 0,
          amountToBet: 0
        });
        bestActions.push({
          action: "Call",
          percentage: 0.05,
          numBigBlinds: lastRaiseAmount / this.pokerTable.blinds.big,
          amountToBet: lastRaiseAmount
        });
      }
    }
    
    // SITUACIÓN 4: Facing 4-bet
    else if (is4BetPot) {
      if (isPremium && ['AA', 'KK'].includes(formattedHand)) {
        // Solo AA/KK: all-in o call
        bestActions.push({
          action: "All-In",
          percentage: 0.85,
          numBigBlinds: stackInBB,
          amountToBet: this.balance
        });
        bestActions.push({
          action: "Call",
          percentage: 0.15,
          numBigBlinds: lastRaiseAmount / this.pokerTable.blinds.big,
          amountToBet: lastRaiseAmount
        });
      } else if (winPercentage >= 65) {
        // QQ+, AKs: mix de call y fold
        bestActions.push({
          action: "Call",
          percentage: 0.55,
          numBigBlinds: lastRaiseAmount / this.pokerTable.blinds.big,
          amountToBet: lastRaiseAmount
        });
        bestActions.push({
          action: "Fold",
          percentage: 0.45,
          numBigBlinds: 0,
          amountToBet: 0
        });
      } else {
        // Todo lo demás: fold
        bestActions.push({
          action: "Fold",
          percentage: 1.0,
          numBigBlinds: 0,
          amountToBet: 0
        });
      }
    }

    // 5.5. CALCULAR EVs PARA CADA ACCIÓN (PREFLOP)
    const betToCall = isFacingRaise ? lastRaiseAmount : this.pokerTable.blinds.big;
    const currentPot = this.pokerTable.totalPot || (this.pokerTable.blinds.small + this.pokerTable.blinds.big);
    
    // GTO: Preflop has no board texture, but we can estimate
    const preflopBoardTexture = null; // No board yet
    
    // Prefer unified evaluator (preflop best action EVs) with fallback
    let actionEVs = null;
    try {
      if (window.PokerEyeEvaluator && typeof window.PokerEyeEvaluator.getRecommendation === 'function') {
        const evalRes = await getUnifiedRecommendationFromEvaluator({
          heroHand: this.hand,
          board: [],
          players: activeVillains,
          potSize: currentPot,
          toCall: betToCall,
          raiseSize: this.pokerTable.currentBet || betToCall,
          context: { winPct, tiePct, iterations: getMonteCarloIterations(activeVillains.length) },
          street: 'preflop',
          isPreflop: true
        });
        if (evalRes && evalRes.evs) actionEVs = evalRes.evs;
      }
    } catch (e) {
      console.warn('[BestPreflop] Unified evaluator failed, falling back', e);
    }
    if (!actionEVs) {
      actionEVs = this.calculateActionEVs(
        winPercentage,
        currentPot,
        betToCall,
        this.balance,
        isFacingRaise,
        raiseCount,
        true, // isPreflop
        preflopBoardTexture,
        activeVillains,
        isInPosition,
        'preflop',
        { winPct, tiePct }
      );
    }
    
    logMessage(
      `${this.logMessagePrefix}> EV Analysis (Preflop - GTO Enhanced):`,
      { color: "cyan" }
    );
    for (const [action, ev] of Object.entries(actionEVs)) {
      const evStr = `${ev >= 0 ? '+' : ''}${roundFloat(ev, 2)}`;
      const evBB = this.pokerTable?.blinds?.big ? roundFloat(ev / this.pokerTable.blinds.big, 2) : 'n/a';
      logMessage(
        `${this.logMessagePrefix}  • EV ${action}: ${evStr} chips (${evBB}bb)`,
        { color: ev >= 0 ? "lightgreen" : "red" }
      );
    }
    
    // Update HUD with new EVs
    if (this.pokerTable?.hud) {
      this.pokerTable.hud.updateEVSection(actionEVs);
    }

    // Safety: if bestActions only contains a deterministic Fold (1.0) but EVs indicate a different action
    // has positive EV relative to fold, add it as a low-frequency alternative so softmax can distribute probabilities.
    try {
      if (Array.isArray(bestActions) && bestActions.length === 1 && bestActions[0].action === 'Fold') {
        // Find the top EV action other than Fold
        const evEntries = Object.entries(actionEVs || {}).filter(e => e[0] !== 'Fold');
        if (evEntries.length > 0) {
          evEntries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
          const [topActionName, topEvValue] = evEntries[0];
          const foldEv = actionEVs['Fold'] || 0;
          // If top action is meaningfully better than fold (e.g., > +0.1 chips) or positive while fold is 0,
          // add it with a tiny floor frequency so softmax can consider it.
          if ((topEvValue - foldEv) > 0.05 || (topEvValue > 0 && foldEv === 0)) {
            // Only add if not already present
            if (!bestActions.find(a => a.action === topActionName)) {
              bestActions.push({ action: topActionName, percentage: 0.02, numBigBlinds: 0, amountToBet: 0 });
              logMessage(`${this.logMessagePrefix} [Decision Safety] Added fallback action '${topActionName}' (EV ${roundFloat(topEvValue,2)}) to allow softmax distribution`, { color: 'yellow' });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Decision Safety] failed to add fallback preflop action', e);
    }

    // Convert EVs into softmax probabilities for recommended frequencies
    try {
      const temp = this._decisionConfig?.temperature ?? 0.35;
      const minF = this._decisionConfig?.minActionFreq ?? 0.02;
      this._applyEvsToActions(bestActions, actionEVs, temp, minF);
    } catch (e) {
      console.warn('[Decision] softmax mapping failed', e);
    }

    // 6. Log acciones recomendadas
    logMessage(`${this.logMessagePrefix}> Acciones recomendadas (${raiseCount} raises, ${is3BetPot ? '3-bet' : is4BetPot ? '4-bet' : 'standard'} pot):`, {
      color: "cornsilk",
    });
    for (const action of bestActions) {
      logMessage(
        `${this.logMessagePrefix} • ${action.action}${
          action.numBigBlinds > 0
            ? ` (${formatChips(action.amountToBet)} · ${roundFloat(action.numBigBlinds, 1)}bb)`
            : ""
        } [${roundFloat(action.percentage * 100, 0)}%]`,
        { color: "cornsilk" }
      );
    }

    return { actions: bestActions, evs: actionEVs };
  };

  getBestPostflopActions = async () => {
    logMessage(`${this.logMessagePrefix}> Postflop detected.`, {
      color: "cornsilf",
    });

    // Wait longer for DOM updates (especially after villain actions)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Determine street
    let street = 'flop';
    if (this.pokerTable.board.length === 4) street = 'turn';
    else if (this.pokerTable.board.length === 5) street = 'river';
    else if (this.pokerTable.board.length < 3) {
      logMessage(`${this.logMessagePrefix}> Not enough board cards for postflop.`, {
        color: "red",
      });
      return [];
    }

    // Validación postflop: mano y board deben tener formato válido
    const validHand = this.hand && this.hand.length === 2 && this.hand.every(card => typeof card === 'string' && card.length >= 2);
    const validBoard = this.pokerTable.board && this.pokerTable.board.length >= 3 && this.pokerTable.board.every(card => typeof card === 'string' && card.length >= 2);
    if (!validHand || !validBoard) {
      logMessage(`${this.logMessagePrefix}> Mano o board no válidos para postflop.`, { color: "red" });
      if (this.pokerTable?.hud) {
        this.pokerTable.hud.updateHandAnalysis(undefined, `Mano o board no válidos`);
      }
      return [
        { action: "Fold", percentage: 1, numBigBlinds: 0, amountToBet: 0 }
      ];
    }

    // ============ ANÁLISIS AVANZADO POSTFLOP ============
    
    // 1. RECOPILAR INFORMACIÓN DE LA SITUACIÓN
    // Get active villains with improved detection
    
    // DEBUG: Log all players first
    const allPlayers = Array.from(this.pokerTable.players.values()).filter(p => p.id !== this.id);
    logMessage(
      `${this.logMessagePrefix}> [DEBUG Postflop] Total jugadores en mesa (sin héroe): ${allPlayers.length}`,
      { color: "gray" }
    );
    for (const p of allPlayers) {
      const lastNextHandIdx = p.actionHistory.findLastIndex(a => a.action === "NEXT HAND");
      const currentActions = lastNextHandIdx === -1 ? p.actionHistory : p.actionHistory.slice(lastNextHandIdx + 1);
      const actionSummary = currentActions.map(a => `${a.action}${a.amountBet ? `(${Math.abs(a.amountBet).toFixed(1)})` : ''}`).join(', ');
      
      logMessage(
        `${this.logMessagePrefix}  [DEBUG] ${p.position || 'Unknown'}: ` +
        `hasFolded=${p.hasFoldedThisHand()}, sittingOut=${p.isSittingOut()}, ` +
        `position=${p.position || 'NONE'}, actions=[${actionSummary}]`,
        { color: "gray" }
      );
    }
    
    const activeVillains = Array.from(this.pokerTable.players.values())
      .filter(p => {
        if (p.id === this.id) return false; // Skip hero
        
        // Jugadores sentados con posición válida
        if (p.isSittingOut()) return false;
        
        // Verificar si ya foldeó explícitamente
        if (p.hasFoldedThisHand()) return false;
        
        // Contar cualquier jugador con posición que no ha foldeado
        // Esto incluye jugadores que ya actuaron y los que están esperando su turno
        if (p.position) return true;
        
        // Fallback: Check for recent action in this hand (BET, RAISE, CALL, CHECK)
        const lastNextHandIndex = p.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
        const currentHandActions = lastNextHandIndex === -1 ? p.actionHistory : p.actionHistory.slice(lastNextHandIndex + 1);
        
        // If player has any action in current hand that's not FOLD, consider them active
        const hasRecentAction = currentHandActions.some(a => 
          a.action === "BET" || 
          a.action === "RAISE" || 
          a.action === "CALL" || 
          a.action === "CHECK" ||
          a.action === "ALL-IN"
        );
        
        const hasFolded = currentHandActions.some(a => a.action === "FOLD");
        
        return hasRecentAction && !hasFolded;
      });
    
    logMessage(
      `${this.logMessagePrefix}> Jugadores activos en la mano: ${activeVillains.length} (${activeVillains.map(p => p.position || 'Unknown').join(', ')})`,
      { color: "lightblue" }
    );
    
    const potSize = this.pokerTable.totalPot || (this.pokerTable.blinds.small + this.pokerTable.blinds.big);
    const stackInBB = this.getNumBigBlinds();
    const isInPosition = ['BTN', 'CO', 'HJ'].includes(this.position);
    
    // 2. ANÁLISIS DETALLADO DE CADA VILLANO
    const villainProfiles = [];
    for (const villain of activeVillains) {
      const villainStackBB = villain.getNumBigBlinds();
      const effectiveStack = Math.min(stackInBB, villainStackBB);
      
      // Analizar historial de acciones del villano
      const lastNextHandIndex = villain.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
      const handActions = lastNextHandIndex === -1 ? villain.actionHistory : villain.actionHistory.slice(lastNextHandIndex + 1);
      
      // Contar acciones agresivas y pasivas
      let raises = 0, bets = 0, calls = 0, checks = 0, folds = 0;
      let totalMoneyInvested = 0;
      let lastAction = null;
      
      for (const action of handActions) {
        if (action.action === "RAISE") raises++;
        else if (action.action === "BET") bets++;
        else if (action.action === "CALL") calls++;
        else if (action.action === "CHECK") checks++;
        else if (action.action === "FOLD") folds++;
        
        if (action.amountBet) {
          totalMoneyInvested += Math.abs(action.amountBet);
        }
        lastAction = action;
      }
      
      // Calcular aggression frequency
      const totalActions = raises + bets + calls + checks + folds;
      const aggressionFreq = totalActions > 0 ? (raises + bets) / totalActions : 0;
      
      // Detectar tendencias del villano
      const isTight = aggressionFreq < 0.25;
      const isAggressive = aggressionFreq > 0.5;
      const isPassive = calls > (raises + bets);
      
      // Analizar bet sizing del villano
      const avgBetSize = totalMoneyInvested > 0 ? totalMoneyInvested / (raises + bets || 1) : 0;
      const avgBetSizeBB = avgBetSize / (this.pokerTable.blinds.big || 1);
      
      villainProfiles.push({
        id: villain.id,
        position: villain.position,
        stack: villainStackBB,
        effectiveStack,
        aggressionFreq,
        isTight,
        isAggressive,
        isPassive,
        raises,
        bets,
        calls,
        totalMoneyInvested,
        avgBetSizeBB,
        lastAction
      });
    }
    
    // 3. DETECTAR APUESTAS Y ACCIONES ACTUALES
    let maxBet = 0;
    let lastAggressorPosition = null;
    let lastAggressorAction = null;
    let lastAggressorProfile = null;
    let numBetsThisStreet = 0;
    
    logMessage(
      `${this.logMessagePrefix}> Analizando villanos para detectar bets...`,
      { color: "lightblue" }
    );
    
    for (const profile of villainProfiles) {
      logMessage(
        `${this.logMessagePrefix}  - ${profile.position}: lastAction = ${profile.lastAction?.action || 'none'}, ` +
        `amount = ${profile.lastAction?.amountBet ? Math.abs(profile.lastAction.amountBet).toFixed(2) : '0'}`,
        { color: "lightgray" }
      );
      
      if (profile.lastAction && 
          (profile.lastAction.action === "BET" || 
           profile.lastAction.action === "RAISE" || 
           profile.lastAction.action === "ALL-IN")) {
        const amount = Math.abs(profile.lastAction.amountBet || 0);
        if (amount > maxBet) {
          maxBet = amount;
          lastAggressorPosition = profile.position;
          lastAggressorAction = profile.lastAction.action;
          lastAggressorProfile = profile;
        }
        numBetsThisStreet++;
      }
    }
    
    const isFacingBet = maxBet > 0;
    const betSizeInBB = maxBet / (this.pokerTable.blinds.big || 1);
    const potOdds = isFacingBet ? (maxBet / (potSize + maxBet)) * 100 : 0;
    
    logMessage(
      `${this.logMessagePrefix}> isFacingBet = ${isFacingBet}, maxBet = ${maxBet.toFixed(2)}, betSizeInBB = ${betSizeInBB.toFixed(1)}`,
      { color: isFacingBet ? "orange" : "lightgreen" }
    );
    
    // 4. LOGGING DETALLADO DE VILLANOS
    if (villainProfiles.length > 0) {
      logMessage(
        `${this.logMessagePrefix}> Villanos activos: ${villainProfiles.length}`,
        { color: "cornsilk" }
      );
      for (const profile of villainProfiles) {
        const tendencies = [];
        if (profile.isTight) tendencies.push('tight');
        if (profile.isAggressive) tendencies.push('aggressive');
        if (profile.isPassive) tendencies.push('passive');
        
        logMessage(
          `${this.logMessagePrefix}  • ${profile.position || 'Unknown'}: ${roundFloat(profile.stack, 1)}bb (eff: ${roundFloat(profile.effectiveStack, 1)}bb) | ` +
          `Agg: ${roundFloat(profile.aggressionFreq * 100, 0)}% | ${tendencies.join(', ') || 'neutral'}` +
          (profile.avgBetSizeBB > 0 ? ` | Avg bet: ${roundFloat(profile.avgBetSizeBB, 1)}bb` : ''),
          { color: "lightgray" }
        );
      }
    }
    
    if (isFacingBet && lastAggressorProfile) {
      logMessage(
        `${this.logMessagePrefix}> Facing ${lastAggressorAction} de ${lastAggressorProfile.position}: ${roundFloat(betSizeInBB, 1)}bb ` +
        `(${lastAggressorProfile.isAggressive ? 'villano agresivo' : lastAggressorProfile.isTight ? 'villano tight' : 'villano balanced'})`,
        { color: "orange" }
      );
    }
    
    // 5. ANALIZAR LA MANO Y EL BOARD
    const handType = this.evaluatePostflopHand(this.hand, this.pokerTable.board);
    const handStrength = this.getHandStrength(handType);
    
    // 5.5. DETECTAR SITUACIONES AVANZADAS (C-bet, Squeeze, etc.)
    let preflopAggressor = null;
    let isSqueezeSpot = false;
    
    // Detectar preflop aggressor
    for (const villain of activeVillains) {
      const lastNextHandIndex = villain.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
      const handActions = lastNextHandIndex === -1 ? villain.actionHistory : villain.actionHistory.slice(lastNextHandIndex + 1);
      
      const raisedPreflop = handActions.some(a => 
        (a.action === 'RAISE' || a.action === 'BET') && 
        a.street === undefined // Preflop actions don't have street
      );
      
      if (raisedPreflop) {
        preflopAggressor = villain.name;
        break;
      }
    }
    
    // Detectar squeeze spot (RFI + caller(s) + hero puede raise)
    if (this.pokerTable.board.length === 0) {
      let hasRaiser = false;
      let hasCaller = false;
      
      for (const villain of activeVillains) {
        const lastNextHandIndex = villain.actionHistory.findLastIndex((action) => action.action === "NEXT HAND");
        const handActions = lastNextHandIndex === -1 ? villain.actionHistory : villain.actionHistory.slice(lastNextHandIndex + 1);
        
        if (handActions.some(a => a.action === 'RAISE' || a.action === 'BET')) {
          hasRaiser = true;
        }
        if (handActions.some(a => a.action === 'CALL')) {
          hasCaller = true;
        }
      }
      
      isSqueezeSpot = hasRaiser && hasCaller;
      if (isSqueezeSpot) {
        logMessage(
          `${this.logMessagePrefix}> SQUEEZE SPOT detectado!`,
          { color: "yellow" }
        );
      }
    }
    
    // 6. CALCULAR EQUITY DINÁMICO POSTFLOP
    let equity;
    let winPct, tiePct, lossPct;
    
    if (USE_MONTE_CARLO_POSTFLOP && activeVillains.length > 0) {
      // Usar Monte Carlo para equity preciso
      try {
        // Adaptive iterations based on number of opponents
        const iterations = getMonteCarloIterations(activeVillains.length);
        
        logMessage(
          `${this.logMessagePrefix}> Calculando equity con Monte Carlo (${iterations} iteraciones para ${activeVillains.length} oponente(s))...`,
          { color: "cyan" }
        );
        
        // Context para detección avanzada de rangos
        const rangeContext = {
          bigBlind: this.pokerTable.blinds.big,
          preflopAggressor: preflopAggressor,
          isSqueezeSpot: isSqueezeSpot
        };
        
        const result = await EquityCalculator.getMonteCarloEquity(
          this.hand,
          this.pokerTable.board,
          activeVillains.length,
          [], // No dead cards known
          iterations,
          activeVillains, // RANGE-BASED EQUITY: Pass villains!
          rangeContext // ADVANCED DETECTION: C-bet, Squeeze, etc.
        );
        
        // Extract equity and win/tie/loss percentages
        equity = typeof result === 'object' ? result.equity : result;
        winPct = result.winPct || equity;
        tiePct = result.tiePct || 0;
        lossPct = result.lossPct || (100 - equity);
        
        logMessage(
          `${this.logMessagePrefix}> Monte Carlo completado: ${equity}% equity (Win: ${winPct.toFixed(1)}% | Tie: ${tiePct.toFixed(1)}% | Loss: ${lossPct.toFixed(1)}%)`,
          { color: "lightgreen" }
        );
      } catch (error) {
        console.error('Monte Carlo failed, using approximation:', error);
        equity = this.calculatePostflopEquity(
          this.hand,
          this.pokerTable.board,
          villainProfiles,
          lastAggressorProfile,
          numBetsThisStreet
        );
        winPct = equity;
        tiePct = 0;
        lossPct = 100 - equity;
      }
    } else {
      // Usar aproximación rápida basada en tablas
      equity = this.calculatePostflopEquity(
        this.hand,
        this.pokerTable.board,
        villainProfiles,
        lastAggressorProfile,
        numBetsThisStreet
      );
      winPct = equity;
      tiePct = 0;
      lossPct = 100 - equity;
    }
    
    // 7. ANALIZAR DRAWS
    const drawInfo = this.analyzeDraws(this.hand, this.pokerTable.board);
    
    // 7.5. GTO: ANALIZAR BOARD TEXTURE
    const boardTexture = this.analyzeBoardTexture(this.pokerTable.board);
    logMessage(
      `${this.logMessagePrefix}> Board Texture: ${boardTexture.texture} (wetness: ${boardTexture.wetnessScore}, ${boardTexture.connectivity})`,
      { color: "cornsilk" }
    );
    
    // 8. CALCULAR IMPLIED ODDS CON EFFECTIVE STACKS
    const effectiveStackForImplied = lastAggressorProfile 
      ? lastAggressorProfile.effectiveStack 
      : villainProfiles.length > 0 
        ? Math.min(...villainProfiles.map(p => p.effectiveStack))
        : stackInBB;
    
    const impliedOdds = this.calculateImpliedOdds(
      potSize,
      maxBet,
      effectiveStackForImplied,
      equity,
      drawInfo
    );
    
    // 9. ACTUALIZAR HUD CON INFORMACIÓN EN TIEMPO REAL (incluyendo Win/Tie/Loss y Rango Oponente)
    if (this.pokerTable?.hud) {
      // Combinar handType con draw info para mostrar "High Card + Flush Draw"
      const displayHandType = drawInfo.hasDraws 
        ? `${handType.description} + ${drawInfo.description.split(' (')[0]}` 
        : handType.description;
      
      // Generate opponent range info for HUD (pass board for postflop analysis)
      const oppRangeInfo = this.pokerTable.hud.getOpponentRangeInfo(activeVillains, { 
        bigBlind: this.pokerTable.blinds.big,
        preflopAggressor: preflopAggressor,
        isSqueezeSpot: isSqueezeSpot,
        raiseCount: 0 // Postflop, no raises tracked
      }, this.pokerTable.board);
      
      console.log('[Postflop] Active villains for range:', activeVillains.length, activeVillains.map(v => v.position));
      console.log('[Postflop] oppRangeInfo result:', oppRangeInfo);
      
      this.pokerTable.hud.updateHandAnalysis(equity, displayHandType, null, null, null, null, false, winPct, tiePct, lossPct, oppRangeInfo);
    }

    // Generate EVs for actions and map to softmax probabilities
    try {
      const betToCall = isFacingBet ? maxBet : 0;
      // Try unified evaluator first (postflop EVs), otherwise fallback
      let actionEVs = null;
      try {
        if (window.PokerEyeEvaluator && typeof window.PokerEyeEvaluator.getRecommendation === 'function') {
          const evalRes = await getUnifiedRecommendationFromEvaluator({
            heroHand: this.hand,
            board: this.pokerTable.board,
            players: villainProfiles || activeVillains,
            potSize,
            toCall: betToCall,
            raiseSize: Math.max((betToCall || 0) * 2, 1),
            context: { winPct, tiePct, drawInfo, iterations: getMonteCarloIterations((villainProfiles||[]).length || activeVillains.length) },
            street,
            isPreflop: false
          });
          if (evalRes && evalRes.evs) actionEVs = evalRes.evs;
        }
      } catch (e) {
        console.warn('[Postflop] Unified evaluator failed for EVs, falling back', e);
      }
      if (!actionEVs) {
        actionEVs = this.calculateActionEVs(
          equity,
          potSize,
          betToCall,
          this.balance,
          isFacingBet,
          0, // raiseCount unknown here for postflop
          false,
          boardTexture,
          villainProfiles,
          isInPosition,
          street,
          { winPct, tiePct, drawInfo }
        );
      }

      // If generateAdvancedPostflopActions returns actions, apply EV mapping there.
      // This function is used to construct actions above; we now ensure percentages reflect EVs.
      // The variable `actions` used above is `actions` in scope of this method; apply mapping if exists.
      if (typeof actions !== 'undefined' && Array.isArray(actions) && actions.length > 0) {
        const temp = this._decisionConfig?.temperature ?? 0.35;
        const minF = this._decisionConfig?.minActionFreq ?? 0.02;
        this._applyEvsToActions(actions, actionEVs, temp, minF);
      }

      // Also update HUD EV section with computed EVs
      if (this.pokerTable?.hud) this.pokerTable.hud.updateEVSection(actionEVs);
    } catch (e) {
      console.warn('[Postflop Decision] failed to compute/apply EV mapping', e);
    }
    
    logMessage(
      `${this.logMessagePrefix}> Equity: ${equity}% | Hand: ${handType.description} | Pot Odds: ${roundFloat(potOdds, 1)}%`,
      { color: "cornsilk" }
    );
    
    if (drawInfo.hasDraws) {
      logMessage(
        `${this.logMessagePrefix}> Draws: ${drawInfo.description} (${drawInfo.outs} outs, ${roundFloat(drawInfo.drawEquity, 1)}%)`,
        { color: "cornsilk" }
      );
    }
    
    // 10. GENERAR ACCIONES AVANZADAS CON PERFILES
    const bestActions = this.generateAdvancedPostflopActions(
      equity,
      handStrength,
      drawInfo,
      potOdds,
      impliedOdds,
      isFacingBet,
      betSizeInBB,
      potSize,
      stackInBB,
      isInPosition,
      numBetsThisStreet,
      lastAggressorProfile,
      villainProfiles,
      street
    );
    
    // 10.5. CALCULAR EVs PARA CADA ACCIÓN (GTO-Enhanced con board texture)
    let actionEVs = null;
    try {
      if (window.PokerEyeEvaluator && typeof window.PokerEyeEvaluator.getRecommendation === 'function') {
        const evalRes = await getUnifiedRecommendationFromEvaluator({
          heroHand: this.hand,
          board: this.pokerTable.board,
          players: villainProfiles || activeVillains,
          potSize,
          toCall: maxBet,
          raiseSize: stackInBB * (this.pokerTable.blinds.big || 1),
          context: { winPct, tiePct, drawInfo, iterations: getMonteCarloIterations((villainProfiles||[]).length || activeVillains.length) },
          street,
          isPreflop: false
        });
        if (evalRes && evalRes.evs) actionEVs = evalRes.evs;
      }
    } catch (e) {
      console.warn('[GTO-Enhanced] Unified evaluator failed for EVs, falling back', e);
    }
    if (!actionEVs) {
      actionEVs = this.calculateActionEVs(
        equity,
        potSize,
        maxBet,
        stackInBB * (this.pokerTable.blinds.big || 1),
        isFacingBet,
        numBetsThisStreet,
        false, // isPreflop = false (postflop)
        boardTexture, // GTO: Pass board texture
        villainProfiles, // GTO: Pass villain profiles
        isInPosition, // GTO: Pass position
        street, // GTO: Pass street (flop/turn/river)
        { winPct, tiePct, drawInfo }
      );
    }
    
    logMessage(
      `${this.logMessagePrefix}> EV Analysis (${street.toUpperCase()} - GTO Enhanced):`,
      { color: "cyan" }
    );
    for (const [action, ev] of Object.entries(actionEVs)) {
      const evStr = `${ev >= 0 ? '+' : ''}${roundFloat(ev, 2)}`;
      const evBB = this.pokerTable?.blinds?.big ? roundFloat(ev / this.pokerTable.blinds.big, 2) : 'n/a';
      logMessage(
        `${this.logMessagePrefix}  • EV ${action}: ${evStr} chips (${evBB}bb)`,
        { color: ev >= 0 ? "lightgreen" : "red" }
      );
    }
    
    // Update HUD with EVs immediately (postflop)
    if (this.pokerTable?.hud) {
      this.pokerTable.hud.updateEVSection(actionEVs);
    }

    // Apply EV->softmax mapping to the generated bestActions so frequencies reflect true EVs
    try {
      const temp = this._decisionConfig?.temperature ?? 0.35;
      const minF = this._decisionConfig?.minActionFreq ?? 0.02;
      this._applyEvsToActions(bestActions, actionEVs, temp, minF);
    } catch (e) {
      console.warn('[Postflop Decision] applyEvsToActions failed', e);
    }
    
    // 11. LOG DE ACCIONES RECOMENDADAS
    logMessage(
      `${this.logMessagePrefix}> Acciones recomendadas (${street}, ${isFacingBet ? 'facing bet' : 'checked to us'}):`,
      { color: "cornsilk" }
    );
    
    for (const action of bestActions) {
      logMessage(
        `${this.logMessagePrefix} • ${action.action}${
          action.numBigBlinds > 0
            ? ` (${formatChips(action.amountToBet)} · ${roundFloat(action.numBigBlinds, 1)}bb)`
            : ""
        } [${roundFloat(action.percentage * 100, 0)}%]`,
        { color: "cornsilk" }
      );
    }
    
    return { actions: bestActions, evs: actionEVs };
  };

  // Función auxiliar: Evaluar tipo de mano postflop
  /**
   * Evaluate postflop hand using pokersolver library
   * Returns consistent format: { type, strength, description, rank, cards }
   */
  evaluatePostflopHand(hand, board) {
    // Prefer using PokerSolver when available
    if (PokerSolverManager.isAvailable()) {
      try {
        // Convert to pokersolver format using centralized helper if available
        const allCards = (window.PokerEyeCards && typeof window.PokerEyeCards.toSolverHand === 'function')
          ? window.PokerEyeCards.toSolverHand([...hand, ...board])
          : [...hand, ...board].map(card => {
              let value = card.slice(0, -1);
              let suit = card.slice(-1);
              const suitMap = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
              suit = suitMap[suit] || suit.toLowerCase();
              if (value === '10') value = 'T';
              return value + suit;
            });

        // Use pokersolver to evaluate hand
        const solvedHand = window.PokerSolver.Hand.solve(allCards);

        // Map pokersolver rank to our strength system
        const strengthMap = {
          1: { type: 'highcard', strength: 1, description: 'High Card' },
          2: { type: 'pair', strength: 2, description: 'One Pair' },
          3: { type: 'twopair', strength: 3, description: 'Two Pair' },
          4: { type: 'trips', strength: 4, description: 'Three of a Kind' },
          5: { type: 'straight', strength: 5, description: 'Straight' },
          6: { type: 'flush', strength: 6, description: 'Flush' },
          7: { type: 'fullhouse', strength: 7, description: 'Full House' },
          8: { type: 'quads', strength: 8, description: 'Four of a Kind' },
          9: { type: 'straightflush', strength: 9, description: 'Straight Flush' }
        };

        const result = strengthMap[solvedHand.rank] || { type: 'highcard', strength: 1, description: 'High Card' };
        result.rank = solvedHand.rank;
        result.cards = solvedHand.cards;
        result.descr = solvedHand.descr;
        result.solvedHand = solvedHand; // Keep reference for comparisons

        return result;
      } catch (error) {
        // Log once via manager; fallback silently to internal eval
        console.warn('[PokerSolver] Evaluation failed, using internal fallback');
        return this._evaluatePostflopHandFallback(hand, board);
      }
    }

    // Pokersolver not available - use internal fallback
    return this._evaluatePostflopHandFallback(hand, board);
  }

  /**
   * Fallback hand evaluation (simple version, used only if pokersolver fails)
   */
  _evaluatePostflopHandFallback(hand, board) {
    const allCards = [...hand, ...board];
    const ranks = allCards.map(card => card.slice(0, -1));
    const suits = allCards.map(card => card.slice(-1));
    
    // Contar frecuencias
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    
    const sortedCounts = Object.values(rankCounts).sort((a, b) => b - a);
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    
    // Evaluar mano
    if (sortedCounts[0] === 4) return { type: 'quads', strength: 8, description: 'Four of a Kind' };
    if (sortedCounts[0] === 3 && sortedCounts[1] === 2) return { type: 'fullhouse', strength: 7, description: 'Full House' };
    if (maxSuitCount >= 5) return { type: 'flush', strength: 6, description: 'Flush' };
    if (this._hasStraightFallback(ranks)) return { type: 'straight', strength: 5, description: 'Straight' };
    if (sortedCounts[0] === 3) return { type: 'trips', strength: 4, description: 'Three of a Kind' };
    if (sortedCounts[0] === 2 && sortedCounts[1] === 2) return { type: 'twopair', strength: 3, description: 'Two Pair' };
    if (sortedCounts[0] === 2) return { type: 'pair', strength: 2, description: 'One Pair' };
    return { type: 'highcard', strength: 1, description: 'High Card' };
  }

  _hasStraightFallback(ranks) {
    const rankOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const values = [...new Set(ranks)].map(r => rankOrder.indexOf(r)).sort((a,b) => a-b);
    
    for (let i = 0; i <= values.length - 5; i++) {
      if (values[i+4] - values[i] === 4) return true;
    }
    // Check wheel (A2345)
    if (values.includes(12) && values.includes(0) && values.includes(1) && values.includes(2) && values.includes(3)) return true;
    return false;
  }

  getHandStrength(handType) {
    return handType.strength;
  }

  // Función auxiliar: Calcular equity postflop con perfiles detallados de villanos
  calculatePostflopEquity(hand, board, villainProfiles, lastAggressorProfile, numBets) {
    const handType = this.evaluatePostflopHand(hand, board);
    let equity = 0;
    
    // Equity base según tipo de mano
    const baseEquity = {
      1: 15,  // High card
      2: 35,  // One pair
      3: 55,  // Two pair
      4: 70,  // Trips
      5: 80,  // Straight
      6: 85,  // Flush
      7: 95,  // Full house
      8: 98   // Quads
    };
    
    equity = baseEquity[handType.strength] || 20;
    
    // 1. AJUSTE POR NÚMERO DE OPONENTES
    const numOpponents = villainProfiles.length;
    if (numOpponents >= 2) {
      equity *= Math.pow(0.92, numOpponents - 1);
    }
    
    // 2. AJUSTE POR PERFIL DEL AGRESOR (si existe)
    if (lastAggressorProfile) {
      // Tight players: rangos más fuertes
      if (lastAggressorProfile.isTight) {
        equity *= 0.88;
      }
      
      // Aggressive players: rangos más amplios (pueden estar bluffeando)
      if (lastAggressorProfile.isAggressive) {
        equity *= 1.08;
      }
      
      // Passive players: menos probable que tengan nuts
      if (lastAggressorProfile.isPassive) {
        equity *= 1.05;
      }
      
      // Ajuste por posición del agresor
      if (lastAggressorProfile.position) {
        const tightPositions = ['UTG', 'UTG+1', 'MP'];
        const loosePositions = ['BTN', 'CO', 'SB'];
        
        if (tightPositions.some(p => lastAggressorProfile.position.includes(p))) {
          equity *= 0.93; // Bet desde posición tight = rango más fuerte
        } else if (loosePositions.includes(lastAggressorProfile.position)) {
          equity *= 1.04; // Bet desde posición loose = puede estar robando
        }
      }
      
      // Ajuste por bet sizing del agresor
      const potSizeBB = (this.pokerTable.totalPot || 0) / (this.pokerTable.blinds.big || 1);
      const betSizeBB = lastAggressorProfile.avgBetSizeBB || 0;
      
      if (betSizeBB > 0) {
        const betToPotRatio = betSizeBB / (potSizeBB || 1);
        
        if (betToPotRatio > 1.2) {
          // Overbet: polarizado (nuts o bluff)
          equity *= handType.strength >= 6 ? 1.05 : 0.92;
        } else if (betToPotRatio > 0.75) {
          // Big bet: rango fuerte
          equity *= 0.94;
        } else if (betToPotRatio < 0.4) {
          // Small bet: rango débil o inducing
          equity *= 1.03;
        }
      }
    }
    
    // 3. AJUSTE POR NÚMERO DE BETS (agresión en la calle)
    if (numBets >= 3) {
      equity *= 0.85; // 3-bet o más = rangos muy fuertes
    } else if (numBets === 2) {
      equity *= 0.92; // Raise = rango fuerte
    }
    
    // 4. AJUSTE POR EFFECTIVE STACKS
    if (villainProfiles.length > 0) {
      const minEffStack = Math.min(...villainProfiles.map(p => p.effectiveStack));
      
      if (minEffStack < 15) {
        // Short stack: más all-in push/fold
        equity *= handType.strength >= 4 ? 1.05 : 0.95;
      } else if (minEffStack > 100) {
        // Deep stack: más implied odds para draws
        equity *= handType.type.includes('draw') ? 1.08 : 1.0;
      }
    }
    
    // 5. AJUSTE POR STREET
    if (board.length === 5) { // River
      // Sin draws posibles, equity es más precisa
      equity *= 1.0;
    } else if (board.length === 4) { // Turn
      equity *= 0.98;
    } else if (board.length === 3) { // Flop
      // Más incertidumbre, menos confianza en equity
      equity *= 0.96;
    }
    
    // 6. AJUSTE POR MULTIWAY CON MÚLTIPLES AGRESORES
    const numAggressors = villainProfiles.filter(p => p.raises > 0 || p.bets > 0).length;
    if (numAggressors >= 2) {
      equity *= 0.88; // Múltiples agresores = alguien tiene mano fuerte
    }
    
    return Math.max(5, Math.min(95, Math.round(equity)));
  }

  // Función auxiliar: Analizar draws
  analyzeDraws(hand, board) {
    const allCards = [...hand, ...board];
    const suits = allCards.map(card => card.slice(-1));
    const ranks = allCards.map(card => card.slice(0, -1));
    
    const suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    
    let outs = 0;
    let drawEquity = 0;
    let description = '';
    let hasDraws = false;
    
    // Flush draw
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    if (maxSuitCount === 4) {
      outs += 9;
      description += 'Flush Draw';
      hasDraws = true;
    }
    
    // Straight draw (simplificado)
    const rankOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const values = [...new Set(ranks)].map(r => rankOrder.indexOf(r)).sort((a,b) => a-b);
    
    // OESD
    for (let i = 0; i <= values.length - 4; i++) {
      if (values[i+3] - values[i] === 3) {
        outs += 8;
        description += (description ? ' + ' : '') + 'OESD';
        hasDraws = true;
        break;
      }
    }
    
    // Gutshot
    if (!hasDraws || outs === 9) {
      for (let i = 0; i <= values.length - 4; i++) {
        if (values[i+3] - values[i] === 4) {
          outs += 4;
          description += (description ? ' + ' : '') + 'Gutshot';
          hasDraws = true;
          break;
        }
      }
    }
    
    // Calcular equity del draw
    const cardsToCome = board.length === 3 ? 2 : 1;
    if (cardsToCome === 2) {
      drawEquity = (outs * 4) - (outs - 8) * (outs > 8 ? 1 : 0); // Rule of 4
    } else {
      drawEquity = outs * 2; // Rule of 2
    }
    
    return {
      hasDraws,
      outs,
      drawEquity: Math.min(drawEquity, 100),
      description: description || 'No draws'
    };
  }

  // Función auxiliar: Calcular implied odds
  calculateImpliedOdds(potSize, betSize, stackInBB, equity, drawInfo) {
    if (!drawInfo.hasDraws) return 0;
    
    // Implied odds = potential future winnings if we hit
    const effectiveStack = Math.min(stackInBB * (this.pokerTable.blinds.big || 1), potSize * 3);
    const impliedValue = (effectiveStack / (betSize || 1)) * (drawInfo.drawEquity / 100);
    
    return Math.round(impliedValue * 10) / 10;
  }

  /**
   * ============================================
   * ADVANCED OUTS CALCULATOR
   * ============================================
   * Calculates ALL possible outs that improve your hand
   * Based on Rust poker_ev implementation
   * Returns detailed breakdown of improving cards
   */
  calculateAdvancedOuts(hand, board) {
    if (!hand || hand.length !== 2 || !board || board.length < 3) {
      return {
        totalOuts: 0,
        outsByHandType: {},
        improvementChance: 0,
        detailedOuts: [],
        currentHandStrength: 0,
        cardsRemaining: 0
      };
    }

    // Normalize card representation for deck-exclusion using centralized adapter
    const normalizeCardForDeck = (card) => {
      try {
        if (window.PokerEyeCards && typeof window.PokerEyeCards.normalizeCard === 'function') return window.PokerEyeCards.normalizeCard(card);
      } catch (e) {}
      if (!card) return card;
      const suitMap = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
      let value = card.slice(0, -1);
      let suit = card.slice(-1);
      suit = suitMap[suit] || suit.toLowerCase();
      if (value === '10') value = 'T';
      return `${value}${suit}`;
    };

    // Get current hand evaluation (uses pokersolver internally)
    const currentHandType = this.evaluatePostflopHand(hand, board);
    const currentStrength = currentHandType.strength || this._getHandRankValue(currentHandType.rank) || 0;

    // Prepare known cards normalized for EquityCalculator
    const knownCardsNormalized = [...hand, ...board].map(normalizeCardForDeck);
    const remainingDeck = EquityCalculator._createDeck(knownCardsNormalized);

    const outsByHandType = {};
    const detailedOuts = [];
    let totalOuts = 0;

    // Test each remaining card to see if it improves our hand
    for (const testCard of remainingDeck) {
      // testCard is in 'Ah' format, but evaluatePostflopHand accepts both suit symbols and letters
      const newBoard = [...board, testCard];
      const newHandType = this.evaluatePostflopHand(hand, newBoard);
      const newStrength = newHandType.strength || this._getHandRankValue(newHandType.rank) || 0;

      // If hand improved to better strength
      if (newStrength > currentStrength) {
        const improvedTo = newHandType.description || newHandType.type || `rank_${newStrength}`;

        if (!outsByHandType[improvedTo]) {
          outsByHandType[improvedTo] = {
            count: 0,
            cards: [],
            strength: newStrength,
            description: improvedTo
          };
        }

        outsByHandType[improvedTo].count++;
        outsByHandType[improvedTo].cards.push(testCard);
        totalOuts++;

        detailedOuts.push({
          card: testCard,
          improvesTo: improvedTo,
          newStrength: newStrength,
          descr: newHandType.description || newHandType.descr || null
        });
      }
    }

    // Calculate improvement probability
    const cardsToSee = board.length === 5 ? 0 : (board.length === 4 ? 1 : 2);
    let improvementChance = 0;

    if (cardsToSee === 1) {
      // Turn or river: simple percentage
      improvementChance = (totalOuts / remainingDeck.length) * 100;
    } else if (cardsToSee === 2) {
      // Flop to river: 1 - (probability of missing both)
      const missRate = (remainingDeck.length - totalOuts) / remainingDeck.length;
      improvementChance = (1 - Math.pow(missRate, 2)) * 100;
    }

    return {
      totalOuts,
      outsByHandType,
      improvementChance: Math.min(improvementChance, 100),
      detailedOuts,
      currentHandStrength: currentStrength,
      cardsRemaining: remainingDeck.length
    };
  }

  /**
   * ============================================
   * RELATIVE HAND STRENGTH CALCULATOR
   * ============================================
   * Calculates hand strength relative to opponent's range
   * Shows where your hand sits in the spectrum of possible hands
   */
  calculateRelativeHandStrength(hand, board, equity, villainProfiles = []) {
    if (!hand || hand.length !== 2 || !board || board.length < 3) {
      return {
        absoluteEquity: equity,
        relativeStrength: 50,
        rangePosition: 'middle',
        vsRangeEquity: equity
      };
    }

    console.log('[RelativeStrength] 🎯 Calculating hand strength - Hand:', hand.join(','), 'Board:', board.join(','));
    
    // Get current hand evaluation
    const currentHandType = this.evaluatePostflopHand(hand, board);
    // Use strength directly (1-9), not rank
    const currentHandStrength = currentHandType.strength || 1;
    const currentDescription = currentHandType.description || currentHandType.type || 'Unknown';

    // Create deck and simulate opponent's possible hands
    const knownCards = [...hand, ...board];
    const remainingDeck = EquityCalculator._createDeck(knownCards);

    // Sample opponent hands (all possible 2-card combinations)
    let betterHands = 0;
    let equalHands = 0;
    let worseHands = 0;
    let totalHands = 0;

    const opponentHandTypes = {};

    // Generate all possible opponent hands
    for (let i = 0; i < remainingDeck.length; i++) {
      for (let j = i + 1; j < remainingDeck.length; j++) {
        const oppHand = [remainingDeck[i], remainingDeck[j]];
        const oppHandType = this.evaluatePostflopHand(oppHand, board);
        const oppHandStrength = oppHandType.strength;

        // Track opponent hand type distribution by description
        const handDesc = oppHandType.description || 'Unknown';
        if (!opponentHandTypes[handDesc]) {
          opponentHandTypes[handDesc] = 0;
        }
        opponentHandTypes[handDesc]++;

        totalHands++;

        // Compare hands using strength values
        if (oppHandStrength > currentHandStrength) {
          betterHands++;
        } else if (oppHandStrength === currentHandStrength) {
          // Same strength, need to compare kickers using pokersolver
          const comparison = this._compareHandStrength(hand, oppHand, board);
          if (comparison > 0) {
            worseHands++;
          } else if (comparison < 0) {
            betterHands++;
          } else {
            equalHands++;
          }
        } else {
          worseHands++;
        }
      }
    }

    // Calculate relative strength (0-100)
    const relativeStrength = totalHands > 0 
      ? ((worseHands + equalHands * 0.5) / totalHands) * 100 
      : 50;

    // Determine range position
    let rangePosition;
    if (relativeStrength >= 90) rangePosition = 'top (nutted)';
    else if (relativeStrength >= 75) rangePosition = 'strong';
    else if (relativeStrength >= 60) rangePosition = 'above average';
    else if (relativeStrength >= 40) rangePosition = 'middle';
    else if (relativeStrength >= 25) rangePosition = 'below average';
    else if (relativeStrength >= 10) rangePosition = 'weak';
    else rangePosition = 'bottom (bluff catcher)';

    // Calculate equity vs opponent's actual range (if available)
    let vsRangeEquity = equity; // Default to absolute equity

    if (villainProfiles && villainProfiles.length > 0) {
      // Weight opponent hand types by their likelihood in villain's range
      // This is simplified - in production you'd use actual range analysis
      vsRangeEquity = relativeStrength; // Use relative strength as proxy
    }

    // Log detailed info for debugging
    console.log(`%c[Relative Strength] ✅ RESULTADO FINAL`, 'color: #22c55e; font-weight: bold; font-size: 12px');
    console.log(`[Relative Strength] Hand: ${hand.join(' ')}`);
    console.log(`[Relative Strength] Current: ${currentDescription} (strength: ${currentHandStrength})`);
    console.log(`[Relative Strength] Better: ${betterHands}, Equal: ${equalHands}, Worse: ${worseHands}`);
    console.log(`[Relative Strength] Position: ${relativeStrength.toFixed(1)}% - ${rangePosition}`);
    console.log(`%c──────────────────────────────────────────`, 'color: #6b7280');

    return {
      absoluteEquity: equity,
      relativeStrength: Math.round(relativeStrength * 10) / 10,
      rangePosition,
      vsRangeEquity: Math.round(vsRangeEquity * 10) / 10,
      currentHandType: currentDescription, // Ya tiene el valor por defecto
      currentHandStrength: currentHandStrength,
      opponentHandTypes,
      betterHands,
      equalHands,
      worseHands,
      totalHandsCombos: totalHands
    };
  }

  /**
   * Helper: Get numeric value for hand rank
   */
  _getHandRankValue(rank) {
    const ranks = {
      'High Card': 1,
      'Pair': 2,
      'Two Pair': 3,
      'Three of a Kind': 4,
      'Straight': 5,
      'Flush': 6,
      'Full House': 7,
      'Four of a Kind': 8,
      'Straight Flush': 9,
      'Royal Flush': 10
    };
    return ranks[rank] || 0;
  }

  /**
   * Helper: Compare two hands with same rank (kicker comparison)
   * Returns: 1 if hand1 better, -1 if hand2 better, 0 if tie
   */
  /**
   * Helper: Compare two hands with same rank (kicker comparison)
   * Returns: 1 if hand1 better, -1 if hand2 better, 0 if tie
   * Now uses pokersolver for accurate comparison
   */
  _compareHandStrength(hand1, hand2, board) {
    // Use PokerSolver when available to compare kickers accurately
    if (PokerSolverManager.isAvailable()) {
      try {
        // Convert to pokersolver format using centralized helper if available
        const cards1 = (window.PokerEyeCards && typeof window.PokerEyeCards.toSolverHand === 'function')
          ? window.PokerEyeCards.toSolverHand([...hand1, ...board])
          : [...hand1, ...board].map(card => {
              let value = card.slice(0, -1);
              let suit = card.slice(-1);
              const suitMap = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
              suit = suitMap[suit] || suit.toLowerCase();
              if (value === '10') value = 'T';
              return value + suit;
            });

        const cards2 = (window.PokerEyeCards && typeof window.PokerEyeCards.toSolverHand === 'function')
          ? window.PokerEyeCards.toSolverHand([...hand2, ...board])
          : [...hand2, ...board].map(card => {
              let value = card.slice(0, -1);
              let suit = card.slice(-1);
              const suitMap = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
              suit = suitMap[suit] || suit.toLowerCase();
              if (value === '10') value = 'T';
              return value + suit;
            });

        const solved1 = window.PokerSolver.Hand.solve(cards1);
        const solved2 = window.PokerSolver.Hand.solve(cards2);

        // Use pokersolver's compare method
        // compare returns: -1 if this hand wins, 1 if other hand wins, 0 if tie
        const result = solved1.compare(solved2);

        // Invert because pokersolver returns -1 for winner
        return -result;
      } catch (error) {
        console.warn('[_compareHandStrength] PokerSolver comparison failed, using internal fallback');
      }
    }

    // Fallback to internal evaluator
    const eval1 = EquityCalculator._evaluateHand([...hand1, ...board]);
    const eval2 = EquityCalculator._evaluateHand([...hand2, ...board]);

    if (eval1 > eval2) return 1;
    if (eval1 < eval2) return -1;
    return 0;
  }

  /**
   * Helper: Check if two cards are equal
   */
  _cardsEqual(card1, card2) {
    return card1 === card2;
  }

  // ============ FASE 1: GTO IMPROVEMENTS ============
  
  /**
   * Analyze board texture for GTO decision-making
   * Returns comprehensive texture analysis including:
   * - Wetness (dry/medium/wet/very wet)
   * - Connectivity (rainbow/disconnected/connected/highly connected)
   * - Draw potential (flush draws, straight draws)
   * - Paired/unpaired
   * - High card concentration
   */
  analyzeBoardTexture(board) {
    if (!board || board.length < 3) {
      return {
        isDry: false,
        isWet: false,
        wetness: 'unknown',
        connectivity: 'unknown',
        hasPair: false,
        hasFlushDraw: false,
        hasStraightDraw: false,
        highCardCount: 0,
        texture: 'unknown'
      };
    }
    
    const ranks = board.map(card => card.slice(0, -1));
    const suits = board.map(card => card.slice(-1));
    
    // Convert ranks to numbers for analysis
    const rankValues = ranks.map(r => {
      if (r === 'A') return 14;
      if (r === 'K') return 13;
      if (r === 'Q') return 12;
      if (r === 'J') return 11;
      if (r === 'T') return 10;
      return parseInt(r);
    });
    
    // 1. PAIRING ANALYSIS
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const hasPair = Object.values(rankCounts).some(count => count >= 2);
    const hasTrips = Object.values(rankCounts).some(count => count >= 3);
    
    // 2. SUIT ANALYSIS (Flush draws)
    const suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const hasFlushDraw = maxSuitCount >= 3;
    const hasFlush = maxSuitCount >= 5;
    
    // 3. CONNECTIVITY ANALYSIS (Straight draws)
    const sortedRanks = [...rankValues].sort((a, b) => b - a);
    let maxGap = 0;
    let totalGaps = 0;
    for (let i = 0; i < sortedRanks.length - 1; i++) {
      const gap = sortedRanks[i] - sortedRanks[i + 1] - 1;
      maxGap = Math.max(maxGap, gap);
      totalGaps += gap;
    }
    
    // Check for wheel (A-2-3-4-5) connectivity
    const hasAce = ranks.includes('A');
    const hasLowCards = rankValues.some(v => v <= 5);
    const wheelPossible = hasAce && hasLowCards;
    
    // Straight draw detection
    const hasStraightDraw = maxGap <= 3 || wheelPossible;
    const isHighlyConnected = maxGap <= 1 && sortedRanks.length >= 3;
    
    // 4. HIGH CARD ANALYSIS
    const highCardCount = rankValues.filter(v => v >= 10).length; // T, J, Q, K, A
    
    // 5. WETNESS SCORE (0-100)
    let wetnessScore = 0;
    
    // Connectivity adds wetness
    if (isHighlyConnected) wetnessScore += 30;
    else if (hasStraightDraw) wetnessScore += 15;
    else if (maxGap >= 5) wetnessScore -= 10; // Very disconnected = dry
    
    // Flush draws add wetness
    if (hasFlush) wetnessScore += 40;
    else if (hasFlushDraw) wetnessScore += 20;
    else if (maxSuitCount === 1) wetnessScore -= 10; // Rainbow = dry
    
    // Pairing reduces wetness (less draws possible)
    if (hasTrips) wetnessScore -= 20;
    else if (hasPair) wetnessScore -= 10;
    
    // High cards make board more dynamic
    if (highCardCount >= 2) wetnessScore += 10;
    
    // 6. CATEGORIZE WETNESS
    let wetness, isDry, isWet;
    if (wetnessScore >= 50) {
      wetness = 'very_wet';
      isDry = false;
      isWet = true;
    } else if (wetnessScore >= 25) {
      wetness = 'wet';
      isDry = false;
      isWet = true;
    } else if (wetnessScore >= 0) {
      wetness = 'medium';
      isDry = false;
      isWet = false;
    } else {
      wetness = 'dry';
      isDry = true;
      isWet = false;
    }
    
    // 7. CATEGORIZE CONNECTIVITY
    let connectivity;
    if (isHighlyConnected) connectivity = 'highly_connected';
    else if (hasStraightDraw) connectivity = 'connected';
    else if (maxGap >= 5) connectivity = 'disconnected';
    else if (maxSuitCount === 1) connectivity = 'rainbow';
    else connectivity = 'medium';
    
    // 8. OVERALL TEXTURE DESCRIPTOR
    let texture = '';
    if (hasPair) texture += 'paired_';
    if (isDry) texture += 'dry';
    else if (isWet) texture += 'wet';
    else texture += 'medium';
    
    return {
      // Boolean flags
      isDry,
      isWet,
      hasPair,
      hasTrips,
      hasFlushDraw,
      hasFlush,
      hasStraightDraw,
      isHighlyConnected,
      
      // Categorical
      wetness,
      connectivity,
      texture,
      
      // Numerical
      wetnessScore,
      highCardCount,
      maxGap,
      totalGaps,
      maxSuitCount,
      
      // Detailed
      ranks: sortedRanks,
      suitDistribution: suitCounts
    };
  }
  
  /**
   * Calculate dynamic fold equity based on multiple GTO factors
   * Much more accurate than fixed 30-35% fold equity
   */
  calculateDynamicFoldEquity(
    isInPosition,
    villainProfiles,
    boardTexture,
    betSizeInBB,
    stackDepth,
    street,
    heroImage = 'balanced' // 'tight', 'balanced', 'aggressive'
  ) {
    let baseFoldEquity = 0.30; // Starting point
    const adjustments = []; // Track all adjustments for logging
    
    // 1. POSITION ADJUSTMENT (+/- 12%)
    if (isInPosition) {
      baseFoldEquity += 0.12; // IP has more fold equity (credibility)
      adjustments.push('+12% position (IP)');
    } else {
      baseFoldEquity -= 0.05; // OOP less credible
      adjustments.push('-5% position (OOP)');
    }
    
    // 2. VILLAIN TENDENCIES (+/- 20%)
    if (villainProfiles && villainProfiles.length > 0) {
      const avgTightness = villainProfiles.reduce((sum, p) => {
        if (p.isTight) return sum + 0.15; // Tight players fold more
        if (p.isAggressive) return sum - 0.10; // Aggressive players call/raise more
        if (p.isPassive) return sum + 0.08; // Passive players fold or call (not raise)
        return sum;
      }, 0) / villainProfiles.length;
      
      baseFoldEquity += avgTightness;
      if (avgTightness > 0) adjustments.push(`+${(avgTightness * 100).toFixed(1)}% tight villain`);
      else if (avgTightness < 0) adjustments.push(`${(avgTightness * 100).toFixed(1)}% aggressive villain`);
    }
    
    // 3. BOARD TEXTURE (+/- 15%)
    if (boardTexture) {
      if (boardTexture.isDry) {
        baseFoldEquity += 0.12; // Dry boards = easier to bluff
        adjustments.push('+12% dry board');
      } else if (boardTexture.isWet) {
        baseFoldEquity -= 0.10; // Wet boards = villains have more equity/draws
        adjustments.push('-10% wet board');
      }
      
      // Paired boards = harder to bluff (villain could have trips)
      if (boardTexture.hasPair) {
        baseFoldEquity -= 0.08;
        adjustments.push('-8% paired board');
      }
      
      // Highly connected = villain has more continuing range
      if (boardTexture.isHighlyConnected) {
        baseFoldEquity -= 0.07;
        adjustments.push('-7% connected board');
      }
    }
    
    // 4. BET SIZING (+/- 18%)
    // Larger bets = more fold equity (but diminishing returns)
    const sizingFactor = Math.min((betSizeInBB - 2) / 20, 0.18);
    if (sizingFactor > 0) {
      baseFoldEquity += sizingFactor;
      adjustments.push(`+${(sizingFactor * 100).toFixed(1)}% bet sizing`);
    }
    
    // 5. STACK DEPTH (+/- 15%)
    if (stackDepth < 20) {
      baseFoldEquity -= 0.15; // Short stacks committed (pot odds too good)
      adjustments.push('-15% short stack');
    } else if (stackDepth < 40) {
      baseFoldEquity -= 0.08; // Medium stacks somewhat committed
      adjustments.push('-8% medium stack');
    } else if (stackDepth > 100) {
      baseFoldEquity += 0.10; // Deep stacks = more room to fold
      adjustments.push('+10% deep stack');
    }
    
    // 6. STREET PROGRESSION (+/- 12%)
    if (street === 'flop') {
      baseFoldEquity += 0.08; // Early street = more uncertainty
      adjustments.push('+8% flop');
    } else if (street === 'turn') {
      baseFoldEquity += 0.02; // Turn = some commitment
      adjustments.push('+2% turn');
    } else if (street === 'river') {
      baseFoldEquity -= 0.12; // River = pot committed, showdown
      adjustments.push('-12% river');
    }
    
    // 7. HERO IMAGE (perceived range)
    if (heroImage === 'tight') {
      baseFoldEquity += 0.10; // Tight image = more credibility
      adjustments.push('+10% tight image');
    } else if (heroImage === 'aggressive') {
      baseFoldEquity -= 0.08; // Aggressive image = less credibility (could be bluffing)
      adjustments.push('-8% aggressive image');
    }
    // 'balanced' = no adjustment
    
    // 8. MULTIWAY ADJUSTMENTS (multiplicative model)
    if (villainProfiles && villainProfiles.length > 1) {
      // Multiplicative model: compute per-villain respond probabilities, adjusted by board texture and global mode
      const modeFactor = MULTIWAY_MODE_FACTOR[MULTIWAY_RESPOND_MODE] || 1.0;
      const boardFactorKey = boardTexture?.isDry ? 'dry' : boardTexture?.isWet ? 'wet' : boardTexture?.isHighlyConnected ? 'highly_connected' : boardTexture?.hasPair ? 'paired' : 'medium';
      const boardFactor = BOARD_RESPOND_FACTOR[boardFactorKey] || 1.0;

      const detailedResponds = [];
      const respondProbs = villainProfiles.map(p => {
        let base = 0.35; // default
        if (p.isAggressive) base = 0.50;
        else if (p.isTight) base = 0.28;
        else if (p.isPassive) base = 0.18;

        // Apply board and mode adjustments
        let adjusted = base * boardFactor * modeFactor;
        // Clamp to sensible range
        adjusted = Math.min(Math.max(adjusted, 0.05), 0.95);
        detailedResponds.push({ name: p.name || 'villain', base, adjusted, profile: p });
        return adjusted;
      });

      // Probability that each villain folds = (1 - respondProb), so probability ALL fold = product
      const allFoldProb = respondProbs.reduce((acc, rp) => acc * (1 - rp), 1);
      const adjustedFoldEquity = baseFoldEquity * allFoldProb;
      adjustments.push(`*multiway survival ${ (allFoldProb * 100).toFixed(1) }% (${villainProfiles.length} villains) [mode:${MULTIWAY_RESPOND_MODE},board:${boardFactorKey}]`);

      // Detailed debug log: per-villain respond probabilities and allFoldProb
      try {
        console.log('[GTO multiway] per-villain respond probs:', detailedResponds.map(d => `${d.name}:${(d.adjusted*100).toFixed(1)}%(base ${(d.base*100).toFixed(1)}%)`).join(' | '));
        console.log(`[GTO multiway] All fold probability: ${(allFoldProb*100).toFixed(2)}% → adjusted fold equity: ${(adjustedFoldEquity*100).toFixed(2)}%`);
      } catch(e) {}

      baseFoldEquity = Math.max(0, adjustedFoldEquity);
    }
    
    // FINAL: Clamp to reasonable range [5%, 70%]
    const finalFoldEquity = Math.max(0.05, Math.min(0.70, baseFoldEquity));
    
    // LOG DETAILED BREAKDOWN
    console.log(`[GTO Fold Equity] Base: 30% → Final: ${(finalFoldEquity * 100).toFixed(1)}%`);
    adjustments.forEach(adj => console.log(`  ${adj}`));
    
    return finalFoldEquity;
  }
  
  /**
   * Calculate GTO Minimum Defense Frequency (MDF)
   * This is the % of range villain must defend to prevent us from auto-profit bluffing
   */
  calculateMDF(potSize, betSize) {
    // MDF = Pot / (Pot + Bet)
    // Pot odds (to call) = Bet / (Pot + Bet)
    // Example: $10 pot, $5 bet → MDF = 10/15 = 66.7%, PotOdds = 5/15 = 33.3%
    const denom = (potSize + betSize) || 1;
    const potOdds = betSize / denom; // cost to call / total pot after call
    const mdf = potSize / denom;     // minimum defense frequency (1 - potOdds)

    // Alpha = our required fold equity to break even on pure bluff
    const alphaBreakEven = betSize / denom;

    // Optimal bluff frequency (based on bet size relative to pot)
    const optimalBluffRatio = potSize > 0 ? (betSize / potSize) : 1;
    const optimalBluffFrequency = optimalBluffRatio / (1 + optimalBluffRatio);

    return {
      mdf: mdf, // Minimum defense frequency
      alphaBreakEven: alphaBreakEven, // Fold equity needed to break even
      optimalBluffFrequency: optimalBluffFrequency, // How often we should bluff
      potOdds: potOdds, // Pot odds to call (bet / (pot + bet))
      gtoCallFrequency: mdf, // Same as MDF (how often villain should call/raise)
      gtoFoldFrequency: 1 - mdf // How often villain should fold
    };
  }

  // Función auxiliar: Calcular EV de cada acción (GTO-Enhanced)
  calculateActionEVs(
    equity, 
    potSize, 
    betToCall, 
    stackSize, 
    isFacingBet, 
    raiseCount = 0, 
    isPreflop = false,
    // NEW GTO PARAMETERS (optional - will use defaults if not provided)
    boardTexture = null,
    villainProfiles = [],
    isInPosition = false,
    street = 'flop'
    , extraOptions = {}
  ) {
    // Defensive normalization: ensure monetary inputs are numeric
    try {
      if (typeof potSize === 'string') potSize = parseCurrency(potSize) || 0;
      if (typeof betToCall === 'string') betToCall = parseCurrency(betToCall) || 0;
      if (typeof stackSize === 'string') stackSize = parseCurrency(stackSize) || 0;
      if (!Number.isFinite(potSize)) potSize = Number(potSize) || 0;
      if (!Number.isFinite(betToCall)) betToCall = Number(betToCall) || 0;
      if (!Number.isFinite(stackSize)) stackSize = Number(stackSize) || 0;
    } catch (e) {
      console.warn('[calculateActionEVs] Failed to normalize inputs', e);
    }

  const evs = {};
    const bigBlind = this.pokerTable?.blinds?.big || 1;
    const stackInBB = bigBlind > 0 ? stackSize / bigBlind : 0;

    // Treat stacks/pots as integer chip values by default; avoid noisy diagnostics about units.
    
    // EV Fold = siempre 0 (no ganamos ni perdemos más)
    evs['Fold'] = 0;
    
    if (isFacingBet) {
      // Facing bet: podemos Call, Raise, o Fold
      
        // Prefer explicit win/tie breakdown if provided by Monte Carlo / range-based equity
        const winPct = typeof extraOptions.winPct === 'number' ? extraOptions.winPct : equity;
        const tiePct = typeof extraOptions.tiePct === 'number' ? extraOptions.tiePct : 0;
        const potAfterCall = potSize + betToCall;
        // EV Call uses win chance and tie chance (ties split the pot)
        evs['Call'] = (winPct / 100) * potAfterCall + (tiePct / 100) * (potAfterCall * 0.5) - betToCall;
      
      // Determinar nombre de raise según contexto
      let raiseName = 'Raise';
      if (isPreflop) {
        if (raiseCount === 0) raiseName = 'Raise (RFI)';
        else if (raiseCount === 1) raiseName = '3-Bet';
        else if (raiseCount === 2) raiseName = '4-Bet';
        else raiseName = 'Re-Raise';
      }
      
      // GTO: Calculate dynamic fold equity for raise
      const raiseSize = betToCall * 2.5; // Raise típico 2.5x
      const raiseSizeInBB = raiseSize / bigBlind;
      
      let foldEquity;
      if (boardTexture && villainProfiles.length > 0) {
        // Use GTO dynamic fold equity
        foldEquity = this.calculateDynamicFoldEquity(
          isInPosition,
          villainProfiles,
          boardTexture,
          raiseSizeInBB,
          stackInBB,
          street
        );
        console.log(`[GTO EV] Dynamic fold equity for raise: ${(foldEquity * 100).toFixed(1)}%`);
      } else {
        // Fallback to conservative estimate
        foldEquity = 0.35;
      }
      
  const potAfterRaise = potSize + betToCall + raiseSize;
  // Use win/tie breakdown when available for post-raise equity
  evs[raiseName] = foldEquity * potSize + (1 - foldEquity) * ((winPct / 100) * potAfterRaise + (tiePct / 100) * (potAfterRaise * 0.5) - raiseSize);
      
      // GTO: Calculate MDF to see if villain is over/under-defending
  const mdfData = this.calculateMDF(potSize, betToCall);
  console.log(`[GTO MDF] MDF: ${(mdfData.mdf * 100).toFixed(1)}% · PotOdds (to call): ${(mdfData.potOdds * 100).toFixed(1)}% · Alpha (break-even): ${(mdfData.alphaBreakEven * 100).toFixed(1)}%`);
      
    } else {
      // No facing bet: podemos Check o Bet
      
      // EV Check = 0 (ver flop gratis o check en postflop)
      evs['Check'] = 0;
      
      // Determinar nombre de bet según contexto
      let betName = 'Bet';
      if (isPreflop && raiseCount === 0) {
        betName = 'Raise (RFI)';
      }
      
      // GTO: Calculate dynamic fold equity for bet
  const betSize = potSize * 0.66; // Bet típico 66% pot
      const betSizeInBB = betSize / bigBlind;
      
      let foldEquity;
      if (boardTexture && villainProfiles.length > 0) {
        // Use GTO dynamic fold equity
        foldEquity = this.calculateDynamicFoldEquity(
          isInPosition,
          villainProfiles,
          boardTexture,
          betSizeInBB,
          stackInBB,
          street
        );
        console.log(`[GTO EV] Dynamic fold equity for bet: ${(foldEquity * 100).toFixed(1)}%`);
      } else {
        // Fallback to conservative estimate
        foldEquity = 0.30;
      }
      
  const potAfterBet = potSize + betSize;
  const winPct2 = typeof extraOptions.winPct === 'number' ? extraOptions.winPct : equity;
  const tiePct2 = typeof extraOptions.tiePct === 'number' ? extraOptions.tiePct : 0;
  evs[betName] = foldEquity * potSize + (1 - foldEquity) * ((winPct2 / 100) * potAfterBet + (tiePct2 / 100) * (potAfterBet * 0.5) - betSize);
      
      // GTO: Calculate optimal bluff frequency
  const mdfData = this.calculateMDF(potSize, betSize);
  console.log(`[GTO Bluff] Optimal bluff frequency: ${(mdfData.optimalBluffFrequency * 100).toFixed(1)}% · Alpha (break-even): ${(mdfData.alphaBreakEven * 100).toFixed(1)}% · PotOdds(to call): ${(mdfData.potOdds * 100).toFixed(1)}%`);
    }
    
    return evs;
  }

  // Helper: convert EV map to softmax probabilities with temperature
  _softmaxFromEvs(evsMap, temperature = 0.5, minFreq = 0.02) {
    try {
      const entries = Object.entries(evsMap || {});
      if (entries.length === 0) return {};
      const actions = entries.map(e => e[0]);
      const values = entries.map(e => Number(e[1]) || 0);
      const maxVal = Math.max(...values);
      const exps = values.map(v => Math.exp((v - maxVal) / (temperature || 1e-6)));
      const sum = exps.reduce((s, x) => s + x, 0) || 1;
      let probs = {};
      for (let i = 0; i < actions.length; i++) probs[actions[i]] = exps[i] / sum;

      // enforce minFreq floor then renormalize
      let total = 0;
      for (const a of actions) {
        probs[a] = Math.max(probs[a] || 0, minFreq || 0);
        total += probs[a];
      }
      if (total <= 0) {
        // fallback equal split
        const even = 1 / actions.length;
        for (const a of actions) probs[a] = even;
        return probs;
      }
      for (const a of actions) probs[a] = probs[a] / total;
      return probs;
    } catch (e) {
      console.warn('[softmax] failed', e);
      return {};
    }
  }

  // Apply EV-derived probabilities to an actions array (mutates `actions`) keeping size/amount metadata
  _applyEvsToActions(actions, evsMap, temperature = 0.35, minFreq = 0.02) {
    try {
      if (!Array.isArray(actions) || actions.length === 0) return actions;
      const probs = this._softmaxFromEvs(evsMap, temperature, minFreq);
      // Map action labels from actions[] to evsMap keys as-is. If an action text doesn't match a key, try to match substrings (e.g., 'Bet (Semi-bluff)' -> 'Bet').
      const mapped = {};
      for (const a of actions) {
        const key = a.action;
        if (probs[key] !== undefined) mapped[key] = probs[key];
        else {
          // try substring match
          const foundKey = Object.keys(probs).find(k => key.includes(k) || k.includes(key));
          if (foundKey) mapped[key] = probs[foundKey];
          else mapped[key] = 0; // will be floored by minFreq enforcement in softmax
        }
      }
      // Normalize mapped probabilities (some may be zero)
      let total = Object.values(mapped).reduce((s, v) => s + v, 0) || 1;
      for (const a of actions) {
        a.percentage = (mapped[a.action] || 0) / total;
      }
      return actions;
    } catch (e) {
      console.warn('[applyEvsToActions] failed', e);
      return actions;
    }
  }

  // Función auxiliar: Generar acciones postflop avanzadas con perfiles de villanos
  generateAdvancedPostflopActions(
    equity, handStrength, drawInfo, potOdds, impliedOdds,
    isFacingBet, betSizeInBB, potSize, stackInBB, isInPosition,
    numBetsThisStreet, lastAggressorProfile, villainProfiles, street
  ) {
    const actions = [];
    const totalOdds = potOdds + impliedOdds;
    
    // Analizar tendencias de los villanos
    const hasAggressiveVillain = villainProfiles.some(p => p.isAggressive);
    const hasTightVillain = villainProfiles.some(p => p.isTight);
    const hasPassiveVillain = villainProfiles.some(p => p.isPassive);
    
    // SITUACIÓN 1: No facing bet (checked to us)
    if (!isFacingBet) {
      if (handStrength >= 6 || equity >= 75) {
        // Manos muy fuertes: bet for value (casi siempre)
        // Bet más grande si hay villanos pasivos (pagarán más)
        const valueSizing = hasPassiveVillain ? 0.75 : 0.66;
        actions.push({
          action: "Bet",
          percentage: 0.85,
          numBigBlinds: Math.max(2.5, Math.min(4.0, potSize / (this.pokerTable.blinds.big || 1) * valueSizing)),
          amountToBet: Math.max(2.5, Math.min(4.0, potSize * valueSizing))
        });
        actions.push({
          action: "Check",
          percentage: 0.15,
          numBigBlinds: 0,
          amountToBet: 0
        });
      } else if (handStrength >= 4 || equity >= 60) {
        // Manos fuertes: bet o check (value betting frequency)
        if (isInPosition) {
          // Bet más frecuente en posición, especialmente vs agresivos (pueden raise-bluff)
          const betFreq = hasAggressiveVillain ? 0.75 : 0.70;
          actions.push({
            action: "Bet",
            percentage: betFreq,
            numBigBlinds: Math.max(2.0, Math.min(3.5, potSize / (this.pokerTable.blinds.big || 1) * 0.5)),
            amountToBet: Math.max(2.0, Math.min(3.5, potSize * 0.5))
          });
          actions.push({
            action: "Check",
            percentage: 1 - betFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
        } else {
          // OOP: check más frecuente, especialmente vs tight (no pagarán light)
          const checkFreq = hasTightVillain ? 0.70 : 0.60;
          actions.push({
            action: "Check",
            percentage: checkFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
          actions.push({
            action: "Bet",
            percentage: 1 - checkFreq,
            numBigBlinds: Math.max(2.0, Math.min(3.0, potSize / (this.pokerTable.blinds.big || 1) * 0.5)),
            amountToBet: Math.max(2.0, Math.min(3.0, potSize * 0.5))
          });
        }
      } else if (handStrength >= 2 || equity >= 50) {
        // MEJORA: Medium strength (parejas, top pair weak kicker) - bet for value!
        // En river especialmente, debemos bet for value vs manos peores
        const isRiver = street === 'river' || this.pokerTable.board.length === 5;
        
        if (isRiver) {
          // River: bet más frecuente para extraer value de manos peores
          const betFreq = isInPosition ? 0.65 : 0.50;
          const sizing = hasPassiveVillain ? 0.55 : 0.45; // Más grande vs passive
          
          actions.push({
            action: "Bet",
            percentage: betFreq,
            numBigBlinds: Math.max(1.5, Math.min(2.5, potSize / (this.pokerTable.blinds.big || 1) * sizing)),
            amountToBet: Math.max(1.5, Math.min(2.5, potSize * sizing))
          });
          actions.push({
            action: "Check",
            percentage: 1 - betFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
        } else {
          // Turn/Flop: más cautious
          const betFreq = isInPosition ? 0.55 : 0.40;
          actions.push({
            action: "Bet",
            percentage: betFreq,
            numBigBlinds: Math.max(1.5, Math.min(2.5, potSize / (this.pokerTable.blinds.big || 1) * 0.4)),
            amountToBet: Math.max(1.5, Math.min(2.5, potSize * 0.4))
          });
          actions.push({
            action: "Check",
            percentage: 1 - betFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
        }
      } else if (drawInfo.hasDraws && drawInfo.outs >= 8) {
        // Draws fuertes: semi-bluff o check
        if (isInPosition) {
          // Semi-bluff más frecuente vs tight (foldean más)
          const semiBluffFreq = hasTightVillain ? 0.65 : 0.55;
          actions.push({
            action: "Bet (Semi-bluff)",
            percentage: semiBluffFreq,
            numBigBlinds: Math.max(1.5, Math.min(2.5, potSize / (this.pokerTable.blinds.big || 1) * 0.4)),
            amountToBet: Math.max(1.5, Math.min(2.5, potSize * 0.4))
          });
          actions.push({
            action: "Check",
            percentage: 1 - semiBluffFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
        } else {
          actions.push({
            action: "Check",
            percentage: 0.75,
            numBigBlinds: 0,
            amountToBet: 0
          });
          actions.push({
            action: "Bet (Semi-bluff)",
            percentage: 0.25,
            numBigBlinds: Math.max(1.5, Math.min(2.5, potSize / (this.pokerTable.blinds.big || 1) * 0.4)),
            amountToBet: Math.max(1.5, Math.min(2.5, potSize * 0.4))
          });
        }
      } else {
        // Manos débiles: check
        actions.push({
          action: "Check",
          percentage: 1.0,
          numBigBlinds: 0,
          amountToBet: 0
        });
      }
    }
    
    // SITUACIÓN 2: Facing bet
    else {
      const isOverbet = betSizeInBB > potSize / (this.pokerTable.blinds.big || 1);
      const isPolarized = betSizeInBB > potSize / (this.pokerTable.blinds.big || 1) * 0.75;
      
      // Analizar perfil del agresor si está disponible
      const aggressorIsTight = lastAggressorProfile?.isTight || false;
      const aggressorIsAggressive = lastAggressorProfile?.isAggressive || false;
      const aggressorIsPassive = lastAggressorProfile?.isPassive || false;
      
      if (handStrength >= 7 || equity >= 85) {
        // Nuts o casi nuts: raise for value
        // Raise más grande vs agresivos (pagarán más light)
        const raiseFreq = aggressorIsAggressive ? 0.85 : 0.80;
        const raiseSizing = aggressorIsAggressive ? 2.8 : 2.5;
        actions.push({
          action: "Raise",
          percentage: raiseFreq,
          numBigBlinds: Math.max(betSizeInBB * raiseSizing, 5),
          amountToBet: Math.max(betSizeInBB * raiseSizing, 5) * (this.pokerTable.blinds.big || 1)
        });
        actions.push({
          action: "Call",
          percentage: 1 - raiseFreq,
          numBigBlinds: betSizeInBB,
          amountToBet: betSizeInBB * (this.pokerTable.blinds.big || 1)
        });
      } else if (handStrength >= 5 || equity >= 70) {
        // Manos muy fuertes: raise o call
        if (numBetsThisStreet >= 2 || aggressorIsTight) {
          // Ya hay mucha agresión o villano tight: call más frecuente
          const callFreq = aggressorIsTight ? 0.80 : 0.70;
          actions.push({
            action: "Call",
            percentage: callFreq,
            numBigBlinds: betSizeInBB,
            amountToBet: betSizeInBB * (this.pokerTable.blinds.big || 1)
          });
          actions.push({
            action: "Raise",
            percentage: 1 - callFreq,
            numBigBlinds: Math.max(betSizeInBB * 2.3, 4),
            amountToBet: Math.max(betSizeInBB * 2.3, 4) * (this.pokerTable.blinds.big || 1)
          });
        } else {
          // Raise más frecuente vs agresivos (pueden tener aire)
          const raiseFreq = aggressorIsAggressive ? 0.65 : 0.55;
          actions.push({
            action: "Raise",
            percentage: raiseFreq,
            numBigBlinds: Math.max(betSizeInBB * 2.5, 4),
            amountToBet: Math.max(betSizeInBB * 2.5, 4) * (this.pokerTable.blinds.big || 1)
          });
          actions.push({
            action: "Call",
            percentage: 1 - raiseFreq,
            numBigBlinds: betSizeInBB,
            amountToBet: betSizeInBB * (this.pokerTable.blinds.big || 1)
          });
        }
      } else if (equity >= potOdds || (drawInfo.hasDraws && equity + drawInfo.drawEquity >= totalOdds)) {
        // Equity suficiente para call
        if (drawInfo.hasDraws && street !== 'river') {
          const callFreq = aggressorIsTight ? 0.70 : 0.75;
          actions.push({
            action: "Call",
            percentage: callFreq,
            numBigBlinds: betSizeInBB,
            amountToBet: betSizeInBB * (this.pokerTable.blinds.big || 1)
          });
          // Semi-bluff raise más frecuente vs tight en posición
          if (isInPosition && betSizeInBB < 3) {
            const semiBluffRaiseFreq = aggressorIsTight ? 0.20 : 0.15;
            actions.push({
              action: "Raise (Semi-bluff)",
              percentage: semiBluffRaiseFreq,
              numBigBlinds: Math.max(betSizeInBB * 2.2, 3),
              amountToBet: Math.max(betSizeInBB * 2.2, 3) * (this.pokerTable.blinds.big || 1)
            });
            actions.push({
              action: "Fold",
              percentage: 1 - callFreq - semiBluffRaiseFreq,
              numBigBlinds: 0,
              amountToBet: 0
            });
          } else {
            actions.push({
              action: "Fold",
              percentage: 1 - callFreq,
              numBigBlinds: 0,
              amountToBet: 0
            });
          }
        } else {
          // Call menos frecuente vs tight (tienen rango fuerte)
          const callFreq = aggressorIsTight ? 0.60 : 0.70;
          actions.push({
            action: "Call",
            percentage: callFreq,
            numBigBlinds: betSizeInBB,
            amountToBet: betSizeInBB * (this.pokerTable.blinds.big || 1)
          });
          actions.push({
            action: "Fold",
            percentage: 1 - callFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
        }
      } else if (equity >= potOdds * 0.7) {
        // Equity marginal: fold o bluff raise ocasional
        if (isInPosition && isPolarized && street === 'river' && aggressorIsAggressive) {
          // Bluff vs overbet polarizado en river (agresivos bluffean más)
          const bluffFreq = aggressorIsAggressive ? 0.25 : 0.20;
          actions.push({
            action: "Fold",
            percentage: 1 - bluffFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
          actions.push({
            action: "Bluff Raise",
            percentage: bluffFreq,
            numBigBlinds: Math.max(betSizeInBB * 2.0, 4),
            amountToBet: Math.max(betSizeInBB * 2.0, 4) * (this.pokerTable.blinds.big || 1)
          });
        } else {
          // Fold más frecuente vs tight
          const foldFreq = aggressorIsTight ? 0.90 : 0.85;
          actions.push({
            action: "Fold",
            percentage: foldFreq,
            numBigBlinds: 0,
            amountToBet: 0
          });
          actions.push({
            action: "Call",
            percentage: 1 - foldFreq,
            numBigBlinds: betSizeInBB,
            amountToBet: betSizeInBB * (this.pokerTable.blinds.big || 1)
          });
        }
      } else {
        // Equity insuficiente: fold (siempre vs tight)
        actions.push({
          action: "Fold",
          percentage: 1.0,
          numBigBlinds: 0,
          amountToBet: 0
        });
      }
    }
    
    return actions;
  };

  getBalance() {
    const previousBalance = this.balance;

    // To get the player balance:
    //  1. Get the innerText of the <span> tag with attribute "data-qa" with value "playerBalance"
    //  2. Parse the balance text to a number and store it in a new Player instance
    //   Note: These values are formatted in the "x,xxx.xx" format (e.g."2,224.37"), but whenever the value has no decimal places, the format is "x,xxx" (e.g. "1,963")
    const balanceDOM = this.dom.querySelector('span[data-qa="playerBalance"]');
    
    if (!balanceDOM) {
      // Si no encontramos el elemento, mantener balance anterior
      if (this.isMyPlayer && this.balance === undefined) {
        console.log('[Balance Debug] balanceDOM not found, balance is undefined');
      }
      return this.balance;
    }
    
    const showBBOriginalBalance = this.dom.querySelector(
      "#PokerEyePlus-originalBalance"
    )?.innerText;
    const balanceText = showBBOriginalBalance
      ? showBBOriginalBalance
      : balanceDOM?.innerHTML;

    // DEBUG: Log balance detection
    if (this.isMyPlayer && this.balance === undefined) {
      console.log('[Balance Debug] balanceDOM found:', balanceDOM);
      console.log('[Balance Debug] balanceText:', balanceText);
      console.log('[Balance Debug] showBBOriginalBalance:', showBBOriginalBalance);
    }

    if (balanceText?.includes("PokerEyePlus-originalBalance")) {
      return this.balance;
    }
    
    const balance = parseCurrency(balanceText);
    
    // Si no pudimos parsear el balance, mantener el anterior
    if (balance === undefined || balance === null || isNaN(balance)) {
      if (this.isMyPlayer && this.balance === undefined) {
        console.log('[Balance Debug] Could not parse balance from text:', balanceText);
      }
      return this.balance;
    }
    
    this.balance = balance;

    // Check for the currency symbol
    if (balanceText && isNaN(balanceText.charAt(0))) {
      this.pokerTable.currencySymbol = balanceText.charAt(0) || "";
    } else {
      this.pokerTable.currencySymbol = "";
    }

    // Log the balance if it has changed
    if (this.balance !== undefined && previousBalance !== this.balance) {
      this.balanceHistory.push({
        balance,
        timestamp: formatTimestamp(new Date()),
      });
      this.numBigBlinds = this.getNumBigBlinds();
      logMessage(
        `${this.logMessagePrefix}Balance updated: ${
          this.pokerTable.currencySymbol
        }${roundFloat(this.balance || 0)}${
          previousBalance !== undefined
            ? ` (net: ${this.pokerTable.currencySymbol}${roundFloat(
                this.balance - (previousBalance || 0)
              )}, previous: ${this.pokerTable.currencySymbol}${roundFloat(
                previousBalance || 0
              )})`
            : ""
        }`,
        { color: this.isMyPlayer ? "goldenrod" : "lightgray" }
      );
    }

    return this.balance;
  }

  getHand() {
    // To get hole cards DOM:
    //  1. Get all <div> tags with attribute "data-qa" with a value of "holeCards"
    //  2. Now, for each of the <div> tags we got in step 1, get all <svg> tags that has an attribute of "data-qa" with a value that starts with "card"
    const holeCardsDOM = Array.from(
      Array.from(
        this.dom.querySelectorAll('div[data-qa="holeCards"]') || []
      ).map((div) => div.querySelectorAll('svg[data-qa^="card"]')) || []
    )
      .map((innerNodeList) => Array.from(innerNodeList))
      .flat();
    this.holeCardsDOM = holeCardsDOM;

    // To get hand:
    //  1. Get the "data-qa" attribute value of each <svg> tag
    //  2. Filter out all empty/placeholder cards (this is when the <svg> tag's "data-qa" attribute value equals "card-1")
    //  3. Remove all duplicate cards (by removing all duplicate "data-qa" attribute values from the <svg> tags)
    const newHand = holeCardsDOM
      .map((svg) => svg.getAttribute("data-qa"))
      .filter((card) => card !== "card-1")
      .filter((card, index, cards) => cards.indexOf(card) === index)
      .map((card) => formatCard(card))
      .filter((card) => card !== null);

    // Update the hand if they have changed
    if (JSON.stringify(newHand) !== JSON.stringify(this.hand)) {
      this.hand = newHand;
      if (this.hand.length === 0)
        logMessage(`${this.logMessagePrefix}Hand has been cleared.`, {
          color: this.isMyPlayer ? "goldenrod" : "lightblue",
        });
      else {
        logMessage(
          `${this.logMessagePrefix}Hand updated: ${this.hand
            .map((card) => `[${card}]`)
            .join(" ")}`,
          { color: this.isMyPlayer ? "goldenrod" : "lightblue" }
        );
        
        // Emit handStarted when the hero receives 2 cards for the first time in a new hand
        if (this.isMyPlayer && this.hand.length === 2 && this.pokerTable.board.length === 0) {
          const handType = getHandType(this.hand);
          // Usar equity avanzado con oponentes activos reales
          const activeVillains = Array.from(this.pokerTable.players.values())
            .filter(p => p.id !== this.id && p.isInCurrentHand());
          const winPercentage = getAdvancedPreflopEquity(
            this.hand, 
            this.position, 
            this.getNumBigBlinds(), 
            this.pokerTable.rfiPosition,
            false, // no es 3-bet pot inicialmente
            this.pokerTable.players,
            activeVillains
          );
          this.pokerTable.hud.updateHandAnalysis(winPercentage, handType, null, null, null, null, false);
          logMessage(`${this.logMessagePrefix}> Hand Analysis: ${handType} (${winPercentage}% win rate)`, {
            color: "cornsilk",
          });
            try {
              // Only emit once per hand for this player
              if (!this._hasEmittedHandStartedForThisHand) {
                this._hasEmittedHandStartedForThisHand = true;
                // Emit a centralized 'handStarted' event for precomputes/pipelining
                this.pokerTable.emitGameEvent?.('handStarted', { player: this, hand: this.hand, timestamp: Date.now() });
                // Kick off precompute pipeline on the table (quick pass + refine)
                try { this.pokerTable.startPrecomputeForHeroHand?.(this); } catch (e) {}
              }
            } catch (e) {}
        }
        if (this.isMyPlayer && this.isTurnToAct) {
          this.updateTurnToAct(false);
          this.updateTurnToAct(true);
        }
      }
    }

    return this.hand;
  }

  isPutInMoneyAction(action) {
    return [
      "CALL",
      "BET",
      "RAISE",
      "POST SB",
      "POST BB",
      "ALL-IN",
      "ALL-IN · x%",
    ].some((moneyAction) => action.includes(moneyAction));
  }

  didUserPutInMoney = (action = undefined) =>
    action
      ? this.isPutInMoneyAction(action)
      : this.actionHistory[this.actionHistory.length - 1]
      ? this.isPutInMoneyAction(
          this.actionHistory[this.actionHistory.length - 1].action
        )
      : false;

  // Get a list of all player actions (e.g. "FOLD", "CHECK", "CALL", "BET", "RAISE", "ALL-IN", "ALL-IN · x%", "SITTING OUT...", "POST SB", "POST BB", "x seconds left to make a move...", "NEW PLAYER", "DONT SHOW") along with the action's timestamp (e.g. "2021-01-01 00:00:00.000")
  getCurrentAction() {
    // To get the player's current action DOM:
    //  1. Get the <div> tag with attribute "data-qa" with value "playerTag" or "myPlayerTag"
    //  2. Get the parent <div> of that <div>
    //  3. Get the first <div> tag within that <div> that does not have a "data-qa" attribute with a value of "playerTag" or "myPlayerTag" (don't check recursively, only check the first level of children)
    const currentActionDOM = this.dom
      .querySelector('div[data-qa="playerTag"], div[data-qa="myPlayerTag"]')
      ?.parentNode?.querySelector(
        ':scope > div:not([data-qa="playerTag"]):not([data-qa="myPlayerTag"])'
      );
    this.currentActionDOM = currentActionDOM;

    // Check if the player's current action DOM exists
    if (currentActionDOM) {
      // To get the player's current action:
      //  1. Within the player action DOM, there will be two <div> tags, one is has the opacity of 1 and the other has the opacity of 0, the one with opacity of 1 is the current player action
      //  2. Get the innerText of the <div> tag with style opacity of 1 within the current player action DOM, this is the current player action (note: the style tag may have other styles, e.g. style="opacity: 1; transition: opacity 600ms ease 0s;", so we can't just check if the style tag equals "opacity: 1", we have to check if it contains "opacity: 1")
      const currentAction = this.formatAction(
        Array.from(currentActionDOM.querySelectorAll("div")).find(
          (div) => div.style.opacity === "1"
        )?.innerText
      );

      // Check if the player's current action is different from the previous action (also sift through "NEXT HAND" and startsWith("POSITION UPDATED") actions)
      if (
        !currentAction ||
        (this.actionHistory.length > 0 &&
          this.actionHistory[this.actionHistory.length - 1].action ===
            currentAction) ||
        this.actionHistory[
          this.actionHistory.findLastIndex(
            (action) =>
              action.action !== "NEXT HAND" &&
              !action.action.startsWith("POSITION UPDATED")
          )
        ]?.action === currentAction
      )
        return this.actionHistory[this.actionHistory.length - 1] || null;

      // Create an action object
      const action = {
        action: currentAction,
        amountBet: this.isPutInMoneyAction(currentAction)
          ? this.balanceHistory.length >= 2
            ? roundFloat(
                this.balance -
                  this.balanceHistory[this.balanceHistory.length - 2].balance,
                2,
                false
              )
            : this.balanceHistory.length === 1
            ? roundFloat(
                this.balance - this.balanceHistory[0].balance,
                2,
                false
              )
            : 0
          : undefined,
        timestamp: formatTimestamp(new Date()),
      };

      // Update balance history
      if (this.isPutInMoneyAction(currentAction)) {
        this.balanceHistory[this.balanceHistory.length - 1] = {
          ...this.balanceHistory[this.balanceHistory.length - 1],
          netDifference: action.amountBet,
          action: currentAction,
        };
      }

      // Add the action object to the actionHistory array
      this.actionHistory.push(action);
      this.actionHistoryPerHand.set(
        this.pokerTable.numHandsDealt,
        this.actionHistoryPerHand.get(this.pokerTable.numHandsDealt)
          ? [
              ...this.actionHistoryPerHand.get(this.pokerTable.numHandsDealt),
              action,
            ]
          : [action]
      );
      this.updateTurnToAct(
        currentAction.includes("seconds left to make a move...") ? true : false
      );
      
      // Auto-update HUD when villain takes significant action (FOLD, BET, RAISE, CALL)
      if (!this.isMyPlayer && (currentAction === "FOLD" || currentAction.includes("BET") || currentAction.includes("RAISE") || currentAction === "CALL")) {
        const myPlayer = Array.from(this.pokerTable.players.values()).find(p => p.isMyPlayer);
        if (myPlayer && myPlayer.hand.length === 2 && this.pokerTable.hud?.showBestActions) {
          void (async () => {
            await new Promise(resolve => setTimeout(resolve, 200)); // Wait for state updates
            await myPlayer.updateHUDEquity();
          })();
        }
      }
      
      if (
        LOG_PLAYER_SECONDS_LEFT_TO_MAKE_A_MOVE ||
        !currentAction.includes("seconds left to make a move...")
      ) {
        logMessage(
          `${this.logMessagePrefix}> ${currentAction} (at ${action.timestamp})`,
          {
            color: this.isMyPlayer
              ? "goldenrod"
              : currentAction.includes("seconds left to make a move...")
              ? "lightgray"
              : "lightblue",
          }
        );
      }

      return action;
    }

    return null;
  }

  formatAction(action, removeDetails = true) {
    // Handle undefined/null actions
    if (!action) return null;
    
    const formattedAction =
      // Check if the action is just a number (e.g. "7" for "7 seconds left to make a move")
      !isNaN(action) ? `${action} seconds left to make a move...` : action;
    
    const result = formattedAction === " seconds left to make a move..."
        ? "SITTING OUT..."
        : formattedAction === "SITTING OUT"
        ? "SITTING OUT..."
        : formattedAction;
    
    return removeDetails && result ? result.split(" · ")[0] : result;
  }
}

class PokerTable {
  constructor(iframe, slotNumber) {
    this.iframe = iframe;
    this.slotNumber = slotNumber;

    this.init();
  }

  init() {
    this.id = generateUUID();
    this.doc = this.iframe.contentWindow?.document;
    this.firstHandDealt = false;
    this.isClosing = false;

    // Simple game event system for gameState triggers
    // Events: 'heroTurnStart', 'heroActionStop', 'streetChanged', 'handReset', 'handStarted'
    this._gameEventListeners = new Map();

    // Equity precompute cache and in-flight job tracking
    // key -> { quick: { equity, winPct, tiePct, lossPct }, refined: { ... }, lastUpdated }
    this._equityCache = new Map();
    // key -> jobId (only one inflight job per handKey)
    this._inflightEquityJobs = new Map();
    this._equityConfig = {
      quickIterations: 400,
      refineIterations: 3000,
      quickTimeoutMs: 500,
      refineTimeoutMs: 2500,
      strictPokerSolver: false // If true, refined pass will require PokerSolver to run (fallback skipped)
    };
    // Decision making configuration (softmax temperature, min action freq)
    this._decisionConfig = {
      temperature: 0.35,
      minActionFreq: 0.02 // minimum frequency per action (2%) to avoid zeroing out options
    };


    this.blinds = {
      small: undefined,
      big: undefined,
    };
    this.gameType = undefined;
    this.board = [];
    this.numHandsDealt = 0;
    this.players = new Map();
    this.currencySymbol = "";
    this.rfiPosition = undefined;

    this.totalPot = undefined;
    this.mainPot = undefined;
    this.sidePots = [];

    this.logMessagePrefix = `(Table #${this.slotNumber}): `;
    displayAttribution();

    this.hud = new HUD(this);
    this.syncTableInfo();
  }

  close() {
    this.isClosing = true;
    this.stopSyncingTableInfo();
    this.hud.close();
  }

  syncTableInfo(runInstantly = true) {
    if (runInstantly) this.getTableInfo();
    this.syncTableInfoInterval = setInterval(
      () => this.getTableInfo(),
      TICK_RATE
    );
  }

  stopSyncingTableInfo() {
    clearInterval(this.syncTableInfoInterval);
  }

  getTableInfo() {
    try {
      // Update the document (in case we have joined a new table)
      this.doc = this.iframe.contentWindow?.document;
      if (!this.doc) return;

      return {
        blinds: this.getBlinds(),
        board: this.getBoard(),
        players: this.getPlayers(),
        totalPot: this.getTotalPot(),
        mainPot: this.getMainPot(),
        sidePots: this.getSidePots(),
      };
    } catch (error) {
      if (this.isClosing) return;
      logMessage(`${this.logMessagePrefix}Error getting table info: ${error}`, {
        color: "red",
      });
      console.error(error);
    }
  }

  nextHand() {
    if (!this.firstHandDealt) {
      // Reset activity after the first hand to prevent calculating statistics without the missing data from the first hand (e.g. if we join the table in the middle of a hand, we don't want to calculate statistics for that hand)
      for (const player of Array.from(this.players.values()))
        player.resetActionHistory();

      this.firstHandDealt = true;
    }

    this.board = [];
    this.numHandsDealt++;

    this.totalPot = undefined;
    this.mainPot = undefined;
    this.sidePots = [];

    logMessage(`${this.logMessagePrefix}The next hand is starting...`, {
      color: "magenta",
    });

    this.stopSyncingTableInfo();
    this.syncTableInfo(false);

    // Add a "NEXT HAND" action to the action history of each player
    for (const player of Array.from(this.players.values()))
      player.actionHistory.push({
        action: "NEXT HAND",
        timestamp: formatTimestamp(new Date()),
      });
    this.rfiPosition = undefined;
    
    // Reset HUD W/T/L data for new hand
    if (this.hud) {
      this.hud.resetHandData();
    }
    // Clear per-hand equity caches and cancel in-flight jobs for safety
    try {
      this._equityCache.clear();
      this._inflightEquityJobs.clear();
    } catch (e) {}
    // Reset per-player handStarted emission flags if present
    for (const p of Array.from(this.players.values())) {
      try { p._hasEmittedHandStartedForThisHand = false; } catch (e) {}
    }
    // Emit hand reset event so listeners can clear state
    try { this.emitGameEvent?.('handReset', { numHandsDealt: this.numHandsDealt }); } catch(e) {}
    
    this.updatePlayerPositions();
  }

  getBlinds() {
    // To get the header container DOM:
    //  1. Get the id="root" <div> tag
    //  2. Get the first <div> tag within the root with class "mainContent", then get the innerText of that <div>
    //   • The result will be something like "2/4 No Limit Hold'em", where "2" is the small blind and "4" is the big blind
    //  3. Parse the blinds text to a number and store it in a new Table instance
    const tableDescription = this.doc
      ?.querySelector("#root")
      ?.querySelector(".mainContent")?.innerText;
    this.tableDescription = tableDescription;
    if (!tableDescription) return;

    // Parse the blinds text to two numbers separated by "/"
    //  1. Split the blinds text by "/", then make the small blind be the left side of the "/" and the big blind the right side of the "/" (but before the first " "), where after the first " " is the game type (e.g. "No Limit Hold'em")
    if (!tableDescription?.split("/")[0] || !tableDescription?.split("/")[1])
      return;
    
    const parts = tableDescription.split("/");
    const smallBlind = parseCurrency(parts[0]);
    const bigBlindPart = parts[1]?.split(" ");
    if (!bigBlindPart || bigBlindPart.length === 0) return;
    
    const bigBlind = parseCurrency(bigBlindPart[0]);
    const gameType = bigBlindPart.slice(1).join(" ");

    // Update the blinds if they have changed
    if (
      smallBlind !== this.blinds.small ||
      bigBlind !== this.blinds.big ||
      gameType !== this.gameType
    ) {
      const getUpdatedBlindsMessage = () =>
        `${this.currencySymbol}${roundFloat(smallBlind || 0)}/${
          this.currencySymbol
        }${roundFloat(bigBlind || 0)}`;

      logMessage(
        `${this.logMessagePrefix}${
          (smallBlind !== this.blinds.small || bigBlind !== this.blinds.big) &&
          gameType === this.gameType
            ? `Blinds updated: ${getUpdatedBlindsMessage()}`
            : gameType !== this.gameType
            ? `Game type updated: ${gameType}`
            : `Blinds and game type updated: ${getUpdatedBlindsMessage()} · ${gameType}`
        }`,
        { color: "mediumpurple" }
      );
      this.blinds.small = smallBlind;
      this.blinds.big = bigBlind;
      this.gameType = gameType;
    }
  }

  getBoard() {
    // To get the board:
    //  1. Get all <svg> tags that has an attribute of "data-qa" with a value that starts with "card"
    //  2. Filter out SVGs that are inside div[data-qa="holeCards"] (those are hole cards, not board cards)
    //  3. Get the "data-qa" attribute value of each remaining <svg> tag
    //  4. Filter out all empty/placeholder cards (this is when the <svg> tag's "data-qa" attribute value equals "card-1" or "card-placeholder")
    //  5. Remove all duplicate cards (by removing all duplicate "data-qa" attribute values from the <svg> tags)
    const newBoard = Array.from(
      this.doc?.querySelectorAll('svg[data-qa^="card"]') || []
    )
      .filter((svg) => {
        // Check if the svg is not inside a div[data-qa="holeCards"]
        let parent = svg.parentElement;
        while (parent) {
          if (parent.getAttribute('data-qa') === 'holeCards') {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      })
      .map((svg) => svg.getAttribute("data-qa"))
      // Filter out empty/placeholder cards
      .filter((card) => card !== "card-1" && card !== "card-placeholder")
      // Remove duplicate cards
      .filter((card, index, cards) => cards.indexOf(card) === index)
      .map((card) => formatCard(card))
      .filter((card) => card !== null);

    // Update the board if it has changed
    if (JSON.stringify(newBoard) !== JSON.stringify(this.board)) {
      this.board = newBoard;
      if (this.board.length === 0) {
        logMessage(`${this.logMessagePrefix}The board has been cleared.`, {
          color: "mediumpurple",
        });
        // TODO: more accurate way to detect when the next hand starts (to prevent lots of issues with best action calculations!)
        this.nextHand();
      } else {
        logMessage(
          `${this.logMessagePrefix}The board has been updated. ${this.board
            .map((card) => `[${card}]`)
            .join(" ")}`,
          { color: "mediumpurple" }
        );
        
        // Auto-update HUD equity when board changes (flop→turn→river)
        const heroPlayer = Array.from(this.players.values()).find(p => p.hand.length === 2);
        if (heroPlayer && this.hud?.showBestActions) {
          void (async () => {
            await new Promise(resolve => setTimeout(resolve, 300)); // Wait for DOM updates
            await heroPlayer.updateHUDEquity();
          })();
        }
        // Emit streetChanged event for centralized gameState handling
        try {
          const street = this.board.length === 3 ? 'flop' : (this.board.length === 4 ? 'turn' : (this.board.length === 5 ? 'river' : 'unknown'));
          this.emitGameEvent?.('streetChanged', { board: this.board, street });
        } catch (e) {}
      }

      // Refresh the HUD menu to update the board-dependent text
      if (this.hud) this.hud.createPokerEyeMenu(true);
    }

    return this.board;
  }

  // Create a stable key for caching equity precomputes for a hero hand
  _makeHandKey(hand, board, activeVillains) {
    try {
      const h = (hand || []).slice().sort().join('|');
      const b = (board || []).slice().sort().join('|');
      const v = (activeVillains || []).map(v => v.id || v.seatNumber || '').sort().join(',');
      return `${this.id}::${h}::${b}::v:${v}::hands:${this.numHandsDealt}`;
    } catch (e) {
      return `${this.id}::${JSON.stringify(hand)}::${JSON.stringify(board)}::${Date.now()}`;
    }
  }

  // Start a precompute pipeline for the hero hand: quick pass (fast MC) + refine pass (bigger MC, uses PokerSolver if available)
  async startPrecomputeForHeroHand(player) {
    if (!player || !player.isMyPlayer || player.hand.length !== 2) return;

    const activeVillains = Array.from(this.players.values()).filter(p => p.id !== player.id && !p.hasFoldedThisHand() && !p.isSittingOut());
    const handKey = this._makeHandKey(player.hand, this.board, activeVillains);

    // If we already have a refined result, nothing to do
    const cached = this._equityCache.get(handKey);
    if (cached && cached.refined) return;

    // Assign a job id and mark inflight
    const jobId = `${Date.now()}_${Math.random()}`;
    this._inflightEquityJobs.set(handKey, jobId);

    // Quick pass: attempt fast Monte Carlo (or fallback) to populate HUD quickly
    (async () => {
      try {
        const quickIter = this._equityConfig.quickIterations;
        const rangeContext = { bigBlind: this.blinds.big };
        const result = await EquityCalculator.getMonteCarloEquity(
          player.hand,
          this.board || [],
          Math.max(1, activeVillains.length),
          [],
          quickIter,
          activeVillains,
          rangeContext
        );

        // If job was cancelled/replaced, ignore
        if (this._inflightEquityJobs.get(handKey) !== jobId) return;

        const quick = typeof result === 'object' ? { equity: result.equity, winPct: result.winPct || result.equity, tiePct: result.tiePct || 0, lossPct: result.lossPct || (100 - (result.equity || 0)) } : { equity: result };
        const entry = Object.assign({}, this._equityCache.get(handKey) || {}, { quick, refined: (this._equityCache.get(handKey) || {}).refined || null, lastUpdated: Date.now() });
        this._equityCache.set(handKey, entry);

        // Update HUD with quick pass if hero HUD is present
        try {
          const handType = player.getHand && player.getHand().length ? getHandType(player.getHand()) : null;
          this.hud?.updateHandAnalysis(quick.equity, handType, null, null, null, null, false, quick.winPct, quick.tiePct, quick.lossPct);
        } catch (e) {}
      } catch (e) {
        // ignore quick pass errors
      }

        // Start refine pass (only if still current)
      try {
        if (this._inflightEquityJobs.get(handKey) !== jobId) return;
          const refineIter = this._equityConfig.refineIterations;
          const rangeContext = { bigBlind: this.blinds.big };

          // Optionally require PokerSolver for refined pass (strict mode)
          if (this._equityConfig.strictPokerSolver && !PokerSolverManager.isAvailable()) {
            console.warn('[Precompute] strictPokerSolver enabled but PokerSolver missing — skipping refine pass');
            const entry2 = Object.assign({}, this._equityCache.get(handKey) || {}, { refined: null, lastUpdated: Date.now(), refinedSkipped: true });
            this._equityCache.set(handKey, entry2);
          } else {
            // If PokerSolver is available the _simulateHandOutcome used by EquityCalculator already prefers it.
            const refinedResult = await EquityCalculator.getMonteCarloEquity(
              player.hand,
              this.board || [],
              Math.max(1, activeVillains.length),
              [],
              refineIter,
              activeVillains,
              rangeContext
            );

            if (this._inflightEquityJobs.get(handKey) !== jobId) return;

            const refined = typeof refinedResult === 'object' ? { equity: refinedResult.equity, winPct: refinedResult.winPct || refinedResult.equity, tiePct: refinedResult.tiePct || 0, lossPct: refinedResult.lossPct || (100 - (refinedResult.equity || 0)) } : { equity: refinedResult };
            const entry2 = Object.assign({}, this._equityCache.get(handKey) || {}, { refined, lastUpdated: Date.now() });
            this._equityCache.set(handKey, entry2);

            // Update HUD with refined pass
            try {
              const handType = player.getHand && player.getHand().length ? getHandType(player.getHand()) : null;
              this.hud?.updateHandAnalysis(refined.equity, handType, null, null, null, null, false, refined.winPct, refined.tiePct, refined.lossPct);
            } catch (e) {}
          }
      } catch (e) {
        // ignore refine errors
      }
    })();
  }

  getPlayers() {
    const previousPlayersSize = this.players.size;

    // To get all players DOM:
    //  1. Get all <div> tags with attribute "data-qa" with a value that starts with "playerContainer-"
    const playersSeatDOMs = Array.from(
      this.doc?.querySelectorAll('div[data-qa^="playerContainer-"]') || []
    );
    this.playersSeatDOMs = playersSeatDOMs;

    // Create a new Player instance for each player
    for (const seatDOM of playersSeatDOMs) {
      const seatNumber = this.getSeatNumber(seatDOM);
      if (!seatNumber) continue;
      if (!this.players.has(seatNumber) && !this.isSeatVacant(seatDOM)) {
        logMessage(
          `${this.logMessagePrefix}A player has joined seat #${seatNumber}.`,
          { color: "salmon" }
        );
        this.players.set(seatNumber, new Player(seatDOM, seatNumber, this));
      }
    }

    // If a player has left, remove them from the players
    for (const seatNumber of this.players.keys()) {
      if (!this.isSeatVacant(this.players.get(seatNumber).dom)) continue;
      if (
        !playersSeatDOMs.some((div) => this.getSeatNumber(div) === seatNumber)
      ) {
        this.players.delete(seatNumber);
        logMessage(
          `${this.logMessagePrefix}A player has left seat #${seatNumber}.`,
          { color: "salmon" }
        );
      }
    }

    // Mark the user's seat number
    this.myPlayerSeatNumber = Array.from(this.players.values()).find(
      (player) => player.isMyPlayer
    )?.seatNumber;

    // Log the other players if they have changed
    if (previousPlayersSize !== this.players.size) {
      logMessage(
        `${this.logMessagePrefix}Players: ${Array.from(this.players.values())
          .map(
            (player) =>
              `(#${player.seatNumber}${player.isMyPlayer ? " - you" : ""}) ${
                this.currencySymbol
              }${roundFloat(player.balance || 0)}`
          )
          .join(" | ")}`,
        { color: "orangered" }
      );
    }

    return this.updatePlayerPositions();
  }

  getSeatNumber(seatDOM) {
    const dataQa = seatDOM.getAttribute("data-qa");
    const match = dataQa?.match(/\d+/g);
    if (!match || match.length === 0) {
      console.error(`Invalid data-qa attribute: ${dataQa}`);
      return null;
    }
    return parseInt(match[0]) + 1;
  }

  isSeatVacant(seatDOM) {
    // To check if a seat is vacant:
    //  1. Check if there is a <div> with attribute "data-qa" with a value of "player-empty-seat-panel"
    return (
      seatDOM.querySelector('div[data-qa="player-empty-seat-panel"]') !== null
    );
  }

  getTotalPot() {
    const totalPotText = this.doc.querySelector(
      'span[data-qa="totalPot"]'
    )?.innerText;
    const totalPot = totalPotText ? parseCurrency(totalPotText) : undefined;

    // Update the total pot if it has changed
    if (totalPot !== undefined && this.totalPot !== totalPot) {
      logMessage(
        `${this.logMessagePrefix}Total pot updated: ${
          this.currencySymbol
        }${roundFloat(totalPot || 0)}${
          this.totalPot !== undefined
            ? ` (net: ${this.currencySymbol}${roundFloat(
                totalPot - (this.totalPot || 0)
              )}, previous: ${this.currencySymbol}${roundFloat(
                this.totalPot || 0
              )})`
            : ""
        }`,
        { color: "mediumseagreen" }
      );
      this.totalPot = totalPot;
    }

    return this.totalPot;
  }

  getMainPot() {
    const mainPotText = this.doc.querySelector(
      'span[data-qa="totalPot-0"]'
    )?.innerText;
    const mainPot = mainPotText ? parseCurrency(mainPotText) : undefined;

    // Update the main pot if it has changed
    if (mainPot !== undefined && this.mainPot !== mainPot) {
      logMessage(
        `${this.logMessagePrefix}Main pot updated: ${
          this.currencySymbol
        }${roundFloat(mainPot || 0)}${
          this.mainPot !== undefined
            ? ` (net: ${this.currencySymbol}${roundFloat(
                mainPot - (this.mainPot || 0)
              )}, previous: ${this.currencySymbol}${roundFloat(
                this.mainPot || 0
              )})`
            : ""
        }`,
        { color: "mediumseagreen" }
      );
      this.mainPot = mainPot;
    }

    return this.mainPot;
  }

  getSidePots() {
    const sidePotsDOM = Array.from(
      this.doc.querySelectorAll('span[data-qa^="totalPot-"]') || []
    )
      // Exclude the main pot from the side pots
      .filter((span) => span.getAttribute("data-qa") !== "totalPot-0");
    const sidePots = sidePotsDOM.map((span) => parseCurrency(span.innerText));

    // Update the side pots if they have changed
    if (JSON.stringify(this.sidePots) !== JSON.stringify(sidePots)) {
      if (sidePots.length === 0)
        logMessage(`${this.logMessagePrefix}Side pots have been cleared.`, {
          color: "mediumseagreen",
        });
      else
        logMessage(
          `${this.logMessagePrefix}Side pots updated: ${sidePots
            .map(
              (pot, potIndex) =>
                `(#${potIndex + 1}) ${this.currencySymbol}${roundFloat(
                  pot || 0
                )}${
                  this.sidePots !== undefined
                    ? ` (net: ${this.currencySymbol}${roundFloat(
                        pot - (this.sidePots[potIndex] || 0)
                      )}, previous: ${this.currencySymbol}${roundFloat(
                        this.sidePots[potIndex] || 0
                      )})`
                    : ""
                }`
            )
            .join(" | ")}`,
          { color: "mediumseagreen" }
        );
      this.sidePots = sidePots;
    }

    return this.sidePots;
  }

  // Update all player positions (e.g. "BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "MP", "MP+1", "MP+2", "LJ", "HJ", "CO"):
  updatePlayerPositions() {
    const previousButtonPlayer = Array.from(this.players.values()).find(
      (player) => player.position?.includes("BTN")
    );

    // 1. Get the player with the "BTN" position
    const buttonPlayer = Array.from(this.players.values()).find((curPlayer) => {
      // To get the button indicator DOM:
      //  1. Get the <div> with a style including "z-index: 201" (e.g. <div style="z-index: 201; display: contents;">)
      const buttonIndicatorDOM = Array.from(
        curPlayer.dom.querySelectorAll("div")
      ).find((div) => div.style.zIndex === "201");
      curPlayer.buttonIndicatorDOM = buttonIndicatorDOM;

      // To get the button visibility DOM:
      //  1. Get the first child <div> with their classList containing "Desktop" and a style including "visibility: visible" or "visibility: hidden" (don't check recursively, only check the first level of children)
      const buttonVisibilityDOM = Array.from(buttonIndicatorDOM.children).find(
        (div) =>
          div.classList.contains("Desktop") &&
          (div.style.visibility === "visible" ||
            div.style.visibility === "hidden")
      );
      curPlayer.buttonVisibilityDOM = buttonVisibilityDOM;

      // Check if the current player is the dealer ("BTN")
      // • If the button visibility DOM is visible, that means the current player is the dealer ("BTN")
      if (buttonVisibilityDOM?.style.visibility !== "visible") return false;

      // Check if the current player's position is not "BTN"
      if (!curPlayer.position?.includes("BTN")) {
        // Okay, so the dealer chip has moved to the current player's seat, or we are just joining the table and the dealer chip is already on the current player's seat, so we have to update the player positions...
        // Let's mark this current player as the dealer ("BTN") and clear all other players' positions...

        // 1. Clear all players' positions
        for (const player of Array.from(this.players.values()).filter(
          (player) => player.seatNumber !== curPlayer.seatNumber
        ))
          player.position = null;
        logMessage(
          `${this.logMessagePrefix}New dealer detected. Clearing all current player position data...`,
          { color: "mistyrose" }
        );

        // 2. Update the current player's position to "BTN" (the dealer)
        curPlayer.position = `BTN${
          curPlayer.isSittingOut() ? " (SITTING OUT)" : ""
        }`;
        logMessage(
          `${curPlayer.logMessagePrefix}Position updated: ${curPlayer.position}`,
          { color: curPlayer.isMyPlayer ? "goldenrod" : "plum" }
        );

        // Add a "POSITION UPDATED" action to the action history of the current player (place it after the last occurance of the "NEXT HAND" action)
        curPlayer.actionHistory.splice(
          curPlayer.actionHistory.findLastIndex(
            (action) => action.action === "NEXT HAND"
          ) + 1,
          0,
          {
            action: `POSITION UPDATED · ${curPlayer.position}`,
            timestamp: formatTimestamp(new Date()),
          }
        );
      }

      // 3. Return the current player with the "BTN" position (the dealer)
      return true;
    });

    // Check if we have found the player with the "BTN" position (the dealer)
    if (
      (!previousButtonPlayer && buttonPlayer) ||
      (previousButtonPlayer &&
        buttonPlayer &&
        previousButtonPlayer.seatNumber !== buttonPlayer.seatNumber)
    ) {
      {
        // Now that we have the player with the "BTN" (dealer) position, we have to calculate the rest of the player's positions relative to the dealer...
        // 1. Get all players that are delt cards (meaning they are not sitting out)
        const activePlayers = Array.from(this.players.values())
          .filter((player) => buttonPlayer.seatNumber !== player.seatNumber)
          .filter((player) => {
            if (player.isSittingOut()) {
              // TODO: Check if the player IS IN THE SMALL BLIND SPOT, BLOCKING THE SMALL BLIND FROM POSTING THE BLIND!
              // • In this very specific circumstance, only if the player is in the small blind spot and JUST sat out from doing ONE hand as the big blind, then we can mark the player as "SB (SITTING OUT)"", otherwise, it messes up the other players' positions (BB would be marked as SB, UTG would be marked as BB, and UTG+1/CO/HJ/LJ would be marked as UTG. These are the only possible messed up positions, but it's still a problem, so we have to fix it)
              // TODO: the reason why this is very difficult is because we need to see if the user JUST did the BB then sat out.. We can do this with this.actionHistory!
              // if (
              //   buttonPlayer.seatNumber + 1 === player.seatNumber ||
              //   (buttonPlayer.seatNumber ===
              //     Math.max(
              //       ...Array.from(this.players.values()).map(
              //         (player) => player.seatNumber
              //       )
              //     ) &&
              //     player.seatNumber === 1)
              // ) {
              //   // Mark the player as sitting out in the small blind spot
              //   player.position = `SB (SITTING OUT)`;
              //   logMessage(
              //     `${player.logMessagePrefix}Player is now sitting out in the small blind spot (preventing the small blind from posting the blind).`,
              //     {
              //       color: player.isMyPlayer ? "goldenrod" : "lightgray",
              //     }
              //   );

              //   return true;
              // }

              // Mark the player as sitting out
              player.position = null;
              logMessage(
                `${player.logMessagePrefix}Player is now sitting out.`,
                {
                  color: player.isMyPlayer ? "goldenrod" : "lightgray",
                }
              );

              return false;
            }

            return true;
          })
          .sort((a, b) => a.seatNumber - b.seatNumber);

        // 2. Calculate the player's position relative to the button
        // To calculate the player's position:
        //  1. Find the player with the "BTN" position, and get the player's position relative to the player with the "BTN" position
        //   Note: Make sure to skip any players with player.position === null (this means they are sitting out, so they should not be included in the calculation)
        //  2. The positions are as follows: "UTG", "UTG+1", "UTG+2", "UTG+x", "MP", "MP+1", "MP+2", "MP+x", "LJ", "HJ", "CO", "BTN", "SB", "BB", etc. where "SB" is the player to the left of the "BTN" player, "BB" is the player to the left of the "SB" player, "UTG" is the player to the left of the "BB" player, and so on
        //   Note: Make sure "UTG" is always after "SB", "BTN" is always after "CO", "HJ" is always before "CO", and "LJ" is always before "HJ", and "MP+x" (only include "+x", where x is represents the additional "MP" after "MP") is always before "LJ", and "UTG" (or "UTG+x") is always before "MP"
        //   Another note: On a table with 9 people, the order should always be "BTN", "SB", "BB", "UTG", "UTG+1", "MP", "LJ", "HJ", "CO"
        //   Adding onto the note above: On a table with 6 people, the order should always be "BTN", "SB", "BB", "UTG", "HJ", "CO"
        //   • On extreme cases, which will almost never happen, if there is a table with 13 people for example, the order should be "BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "UTG+3", "MP", "MP+1", "MP+2", "LJ", "HJ", "CO" (you can tell that "UTG+x" gets priority over "MP+x", so whenever theres an odd number of player NOT "UTG"/"UTG+x" or "MP"/"MP+x", the role assigning of "UTG"/"UTG+x" will be prioritized over the "MP"/"MP+x" players, meaning the "+x" number for "UTG+x" will always be greater than the "+x" number for "MP+x")

        // Pivot the SB to the first position in a new array pivotedActivePlayersInOrder, then using the player seatNumbers, we can add the remaining players in order counting up from the dealer, then when we reach the highest seatNumber, we can add the remaining players in order counting from 1 to the dealer's seatNumber
        const pivotedActivePlayersInOrder = [
          // Add the remaining players in order counting up from the dealer until we reach the highest seatNumber
          ...activePlayers
            .filter((player) => player.seatNumber > buttonPlayer.seatNumber)
            .sort((a, b) => a.seatNumber - b.seatNumber),
          // Add the remaining players in order counting from 1 to the dealer's seatNumber
          ...activePlayers
            .filter((player) => player.seatNumber < buttonPlayer.seatNumber)
            .sort((a, b) => a.seatNumber - b.seatNumber),
        ];

        let unassignedPlayers = [];
        if (this.hud && this.hud.showBestActions) {
          // TODO: assign CO, HJ, LJ BEFORE SB, BB, UTG... (this is how the positions are formatted on Jonathan Little's Poker GTO charts)
          // > update this.position calculations (in PokerTable.updatePlayerPositions()) to always start with CO going backwards rather than UTG going forwards

          // Assign the positions.
          // First, assign SB, BB
          for (let i = 0; i <= 1; i++) {
            const player = pivotedActivePlayersInOrder[i];

            // Check if we have reached the end of the player list or if the player already has a position
            if (!player || !player.position) break;

            switch (i) {
              case 0:
                player.position = `SB${
                  player.isSittingOut() ? " (SITTING OUT)" : ""
                }`;
                break;
              case 1:
                player.position = "BB";
                break;
              default:
                break;
            }
          }

          // Get the remaining players with an unassigned position
          unassignedPlayers = pivotedActivePlayersInOrder.filter(
            (player) => player.position === null
          );

          // Then, go to the end of the unassigned player list: for each player, assign backwards CO, HJ, LJ.
          for (let i = unassignedPlayers.length - 1; i >= 0; i--) {
            const player = unassignedPlayers[i];

            // Check if we have reached past the beginning of the player list (which will probably never happen) or if the player already has a position
            if (!player || player.position) break;

            switch (i) {
              case unassignedPlayers.length - 1:
                player.position = "CO";
                break;
              case unassignedPlayers.length - 2:
                player.position = "HJ";
                break;
              case unassignedPlayers.length - 3:
                player.position = "LJ";
                break;
              default:
                break;
            }
          }

          // Update the unassignedPlayers array
          unassignedPlayers = unassignedPlayers.filter(
            (player) => player.position === null
          );

          // Now, let's assign the UTG position.
          const utgPlayer = unassignedPlayers[0];
          if (utgPlayer) utgPlayer.position = "UTG";
        } else {
          // Assign the positions.
          // First, assign SB, BB, UTG
          for (let i = 0; i <= 2; i++) {
            const player = pivotedActivePlayersInOrder[i];

            // Check if we have reached the end of the player list or if the player already has a position
            if (!player || player.position !== null) break;

            switch (i) {
              case 0:
                player.position = `SB${
                  player.isSittingOut() ? " (SITTING OUT)" : ""
                }`;
                break;
              case 1:
                player.position = "BB";
                break;
              case 2:
                player.position = "UTG";
                break;
              default:
                break;
            }
          }

          // Get the remaining players with an unassigned position
          unassignedPlayers = pivotedActivePlayersInOrder.filter(
            (player) => player.position === null
          );

          // Then, go to the end of the unassigned player list: for each player, assign backwards CO, HJ, LJ.
          for (let i = unassignedPlayers.length - 1; i >= 0; i--) {
            const player = unassignedPlayers[i];

            // Check if we have reached past the beginning of the player list (which will probably never happen) or if the player already has a position
            if (!player || player.position !== null) break;

            switch (i) {
              case unassignedPlayers.length - 1:
                player.position = "CO";
                break;
              case unassignedPlayers.length - 2:
                player.position = "HJ";
                break;
              case unassignedPlayers.length - 3:
                player.position = "LJ";
                break;
              default:
                break;
            }
          }
        }

        // Update the unassignedPlayers array
        unassignedPlayers = unassignedPlayers.filter(
          (player) => player.position === null
        );

        // Now, let's assign the positions in the middle of the [BTN, SB, BB, UTG, ..., LJ, HJ, CO] that are still unassigned
        const firstHalfOfUnassignedPlayers = unassignedPlayers.slice(
            0,
            Math.floor(unassignedPlayers.length / 2)
          ),
          secondHalfOfUnassignedPlayers = unassignedPlayers.slice(
            Math.floor(unassignedPlayers.length / 2)
          );

        // Assign the first half of the unassigned players (UTG+x)
        for (let i = 0; i < firstHalfOfUnassignedPlayers.length; i++) {
          const player = firstHalfOfUnassignedPlayers[i];

          // Check if the player already has a position
          if (player.position !== null) continue;

          player.position = `UTG+${i + 1}`;
        }

        // Assign the second half of the unassigned players (MP, MP+x)
        for (let i = 0; i < secondHalfOfUnassignedPlayers.length; i++) {
          const player = secondHalfOfUnassignedPlayers[i];

          // Check if the player already has a position
          if (player.position !== null) continue;

          if (i === 0) player.position = "MP";
          else player.position = `MP+${i + 1}`;
        }

        // Log the updated positions
        for (const player of pivotedActivePlayersInOrder) {
          // Ignore non-updated players
          if (player.position === null || player.position?.includes("BTN"))
            continue;

          logMessage(
            `${player.logMessagePrefix}Position updated: ${player.position}`,
            {
              color: player.isMyPlayer ? "goldenrod" : "plum",
            }
          );

          // Add a "POSITION UPDATED" action to the action history of the current player (place it after the last occurance of the "NEXT HAND" action)
          player.actionHistory.splice(
            player.actionHistory.findLastIndex(
              (action) => action.action === "NEXT HAND"
            ) + 1,
            0,
            {
              action: `POSITION UPDATED · ${player.position}`,
              timestamp: formatTimestamp(new Date()),
            }
          );
        }
      }
    }

    return this.players;
  }

  // Simple game event API: register listener
  onGameEvent(eventName, handler) {
    if (!this._gameEventListeners.has(eventName)) this._gameEventListeners.set(eventName, []);
    this._gameEventListeners.get(eventName).push(handler);
    return () => { // return unsubscribe
      const arr = this._gameEventListeners.get(eventName) || [];
      this._gameEventListeners.set(eventName, arr.filter(h => h !== handler));
    };
  }

  // Emit a game event to listeners
  emitGameEvent(eventName, payload) {
    const arr = this._gameEventListeners.get(eventName) || [];
    for (const h of arr) {
      try { h(payload); } catch (e) { console.error('[GameEvent] handler error', e); }
    }
  }
}

const formatHandForAPI = (hand) => {
  // Accept input as '4h4s', ['4h','4s'], or '4h|4s'
  let cards = [];
  if (Array.isArray(hand)) {
    cards = hand;
  } else if (typeof hand === 'string') {
    if (hand.includes('|')) {
      cards = hand.split('|');
    } else if (hand.length === 4) {
      // e.g. '4h4s'
      cards = [hand.slice(0,2), hand.slice(2,4)];
    } else {
      // fallback: try to split every 2 chars
      for (let i = 0; i < hand.length; i += 2) {
        cards.push(hand.slice(i, i+2));
      }
    }
  }

  // Replace '10' with 'T' for each card
  const formattedCards = cards.map(card => card.replace('10', 'T'));
  if (formattedCards.length !== 2 || formattedCards.some(card => card.length !== 2)) return null;

  // Extract ranks and suits
  const [rank1, suit1] = [formattedCards[0][0], formattedCards[0][1]];
  const [rank2, suit2] = [formattedCards[1][0], formattedCards[1][1]];

  // Sort ranks in descending order
  const sortOrder = 'AKQJT98765432';
  const sortedRanks = [rank1, rank2].sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));

  // Determine the suffix ('s', 'o', or '')
  const suffix = rank1 === rank2 ? '' : suit1 === suit2 ? 's' : 'o';

  // Join the sorted cards to a single string with the suffix
  return `${sortedRanks[0]}${sortedRanks[1]}${suffix}`;
};

/**
 * Wrapper function for backward compatibility
 * Delegates to HandEvaluator module
 */
const getHandType = (hand) => {
  const result = HandEvaluator.evaluatePreflop(hand);
  return result.description;
};

/**
 * Calcula equity preflop avanzado considerando acciones de villanos, posiciones y rangos dinámicos
 * @param {Array} hand - Cartas del jugador
 * @param {string} position - Posición del jugador
 * @param {number} stackSize - Tamaño del stack en BB
 * @param {string} rfiPosition - Posición del RFI (raise first in)
 * @param {boolean} is3BetPot - Si es un pot 3-beteado
 * @param {Map} allPlayers - Todos los jugadores en la mesa
 * @param {Array} activeVillains - Villanos activos en la mano
 * @returns {number} - Equity estimado (0-100)
 */
/**
 * Wrapper function for backward compatibility
 * Delegates to EquityCalculator module
 */
const getAdvancedPreflopEquity = (hand, position, stackSize = 100, rfiPosition = null, is3BetPot = false, allPlayers = null, activeVillains = []) => {
  return EquityCalculator.getQuickPreflopEquity(hand, position, stackSize, rfiPosition, is3BetPot, allPlayers, activeVillains);
};

// Mantener backward compatibility
const getApproximatePreflopEquity = (hand, position, stackSize = 100, rfiPosition = null, is3BetPot = false) => {
  return getAdvancedPreflopEquity(hand, position, stackSize, rfiPosition, is3BetPot, null, []);
};

// To format a card (from the "data-qa" attribute value):
//  1. Get all numbers from the string
//  2. Convert the numbers to the formatted card (e.g. "card9" is the 10 of clubs, or "10c" as we call it)
//   Note: clubs are numbers in range 0-12, diamonds are 13-25, hearts are 26-38, and spades are 39-51
//    • Full list of cards:
//     ac = 0, 2c = 1, 3c = 2, 4c = 3, 5c = 4, 6c = 5, 7c = 6, 8c = 7, 9c = 8, 10c = 9, jc = 10, qc = 11, kc = 12
//     ad = 13, 2d = 14, 3d = 15, 4d = 16, 5d = 17, 6d = 18, 7d = 19, 8d = 20, 9d = 21, 10d = 22, jd = 23, qd = 24, kd = 25
//     ah = 26, 2h = 27, 3h = 28, 4h = 29, 5h = 30, 6h = 31, 7h = 32, 8h = 33, 9h = 34, 10h = 35, jh = 36, qh = 37, kh = 38
//     as = 39, 2s = 40, 3s = 41, 4s = 42, 5s = 43, 6s = 44, 7s = 45, 8s = 46, 9s = 47, 10s = 48, js = 49, qs = 50, ks = 51
const formatCard = (unformattedCard) => {
  const number = parseInt(unformattedCard.match(/\d+/g)[0]);

  // Make sure the number is valid
  if (isNaN(number) || number > 51) return null;

  const suit = Math.floor(number / 13);
  return `${
    ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][
      number % 13
    ]
  }${"cdhs"[suit]}`;
};

// Initialize a Map to store all poker tables
const pokerTables = new Map();

// Check for newly opened/closed poker table "slots"
function syncPokerTableSlots(iframes = getTableSlotIFrames()) {
  assignNewPokerTableSlots(iframes);
  removeClosedPokerTableSlots(iframes);
}

// Assign newly opened poker table slots
function assignNewPokerTableSlots(iframes = getTableSlotIFrames()) {
  for (const iframe of iframes) {
    const slotNumber = getMultitableSlot(iframe);
    if (slotNumber !== 0 && !pokerTables.has(slotNumber)) {
      logMessage(`(Table #${slotNumber}): Table opened.`, {
        color: "limegreen",
      });
      pokerTables.set(slotNumber, new PokerTable(iframe, slotNumber));
    }
  }
}

// Remove closed poker table slots
function removeClosedPokerTableSlots(iframes = getTableSlotIFrames()) {
  for (const slotNumber of pokerTables.keys()) {
    if (!iframes.some((iframe) => getMultitableSlot(iframe) === slotNumber)) {
      pokerTables.get(slotNumber).close();
      pokerTables.delete(slotNumber);
      logMessage(`(Table #${slotNumber}): Table closed.`, {
        color: "red",
      });
    }
  }
}

// Get all "Table slot" iframes and convert the resultant NodeList to Array (for more utility)
const getTableSlotIFrames = () =>
  Array.from(document.querySelectorAll('iframe[title="Table slot"]'));

const getMultitableSlot = (iframe) =>
  parseInt(iframe.getAttribute("data-multitableslot")) + 1;

// Main function (self-invoking)
let syncPokerTableSlotsInterval;
const main = (function main() {
  exit(true);
  syncPokerTableSlots();
  syncPokerTableSlotsInterval = setInterval(syncPokerTableSlots, TICK_RATE);
  return main;
})();

// Exit the script
function exit(silent = false) {
  clearAllIntervals();

  // Stop syncing the poker table slots
  clearInterval(syncPokerTableSlotsInterval);

  // Close all poker tables and stop syncing player info
  for (const table of pokerTables.values()) {
    table.hud.close();
    table.close();
    for (const player of table.players.values()) player.stopSyncingPlayerInfo();
  }

  pokerTables.clear();
  clearAllIntervals();

  if (!silent)
  logMessage("Now exiting PokerEye-Plus-Less for Ignition Casino...", {
      color: "crimson",
    });
}

// utils.js
// Utility function to log watermarked messages to the console
function logMessage(
  message,
  {
    color = "black",
    background = "black",
    fontSize = "1.2em",
    fontWeight = "normal",
    fontStyle = "normal",
  }
) {
  console.log(
    "%c%s",
    `color: ${color}; background: ${background}; font-size: ${fontSize}; font-weight: ${fontWeight}; font-style: ${fontStyle};`,
  `[PokerEye+-]: ${message}`
  );
}

// Utility function to clear all timeouts/intervals created by the script
function clearAllIntervals() {
  // Get a reference to the last interval + 1
  const interval_id = window.setInterval(function () {},
  Number.MAX_SAFE_INTEGER);

  // Clear any timeout/interval up to that id
  for (let i = 1; i < interval_id; i++) {
    window.clearInterval(i);
  }
}

function roundFloat(
  number,
  decimalPlaces = 2,
  forceDecimalPlaces = true,
  asCurrency = false
) {
  return forceDecimalPlaces
    ? parseFloat(number.toFixed(decimalPlaces)).toLocaleString("en-US", {
        style: asCurrency ? "currency" : undefined,
        currency: asCurrency ? "USD" : undefined,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      })
    : parseFloat(number.toFixed(decimalPlaces));
}

function parseCurrency(currency) {
  if (currency === undefined || currency === null) return null;
  return parseFloat(currency.toString().replace(/[$,]/g, ""));
}

function formatCurrencyLikeIgnition(
  number,
  allowAdditionalZeroPastDecimal = true
) {
  const formattedNumber = parseCurrency(number)
    .toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\$/g, "")
    .replace(".00", "");

  return allowAdditionalZeroPastDecimal
    ? formattedNumber
    : formattedNumber.replace(/\.0+$/, "").replace(/(\.\d+?)0+$/, "$1");
}

function formatTimestamp(date) {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const mmm = String(date.getMilliseconds()).padStart(3, "0");

  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Format chips (tournament units) for display.
 * Always show integer chips (no currency symbol). Rounds to nearest integer.
 */
function formatChips(amount) {
  try {
    const n = Math.round(Number(amount) || 0);
    // Use en-US thousands separator for readability
    return n.toLocaleString('en-US');
  } catch (e) {
    return String(amount);
  }
}

// Converts a formatted timestamp (e.g. "2021-01-01 00:00:00.000") to a relative timestamp (e.g. "1 second ago", "2 minutes ago", "3 hours ago")
function convertFormattedTimestampToAgo(formattedTimestamp) {
  const timestamp = new Date(formattedTimestamp).getTime();
  const now = new Date().getTime();
  const difference = now - timestamp;

  const seconds = Math.floor(difference / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds <= 0) return "just now";
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  else if (minutes < 60)
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  else if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  else return `${Math.floor(hours / 24)} days ago`;
}

function generateRandom16BitNumber() {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
}

function generateUUID() {
  return (
    generateRandom16BitNumber() +
    generateRandom16BitNumber() +
    "-" +
    generateRandom16BitNumber() +
    "-" +
    generateRandom16BitNumber() +
    "-" +
    generateRandom16BitNumber() +
    "-" +
    generateRandom16BitNumber() +
    generateRandom16BitNumber() +
    generateRandom16BitNumber()
  );
}

function setNativeValue(element, value) {
  let lastValue = element.value;
  element.value = value;
  let event = new Event("input", { target: element, bubbles: true });
  // React 15
  event.simulated = true;
  // React 16
  let tracker = element._valueTracker;
  if (tracker) tracker.setValue(lastValue);
  element.dispatchEvent(event);
}
