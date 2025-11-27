// PokerSolver Worker: bundles PokerSolver for reliable hand evaluation
importScripts('../pokersolver.js');

function getRandomHand(deck) {
	// Remove two random cards from deck
	const idx1 = Math.floor(Math.random() * deck.length);
	const card1 = deck.splice(idx1, 1)[0];
	const idx2 = Math.floor(Math.random() * deck.length);
	const card2 = deck.splice(idx2, 1)[0];
	return [card1, card2];
}

self.onmessage = function(event) {
	const { id, method, payload } = event.data || {};
	try {
		if (method === 'compare') {
			const { heroHand, oppHand, board } = payload;
			const heroSolved = PokerSolver.Hand.solve([...heroHand, ...board]);
			const oppSolved = PokerSolver.Hand.solve([...oppHand, ...board]);
			let result = 'loss';
			if (heroSolved.rank > oppSolved.rank) result = 'win';
			else if (heroSolved.rank === oppSolved.rank) result = 'tie';
			self.postMessage({ id, success: true, result });
			return;
		}
		if (method === 'equity') {
			const { heroHand, board, numOpponents, deadCards, iterations } = payload;
			let wins = 0, ties = 0, losses = 0;
			for (let i = 0; i < iterations; i++) {
				// Build deck
				const suits = ['h','d','c','s'];
				const values = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
				let deck = [];
				for (const v of values) for (const s of suits) deck.push(v+s);
				// Remove hero cards, board, deadCards
				for (const c of [...heroHand, ...board, ...(deadCards||[])]) {
					const idx = deck.indexOf(c);
					if (idx !== -1) deck.splice(idx, 1);
				}
				// Deal opponent hands
				let oppHands = [];
				for (let j = 0; j < numOpponents; j++) {
					oppHands.push(getRandomHand(deck));
				}
				// Complete board if needed
				let fullBoard = [...board];
				while (fullBoard.length < 5) {
					fullBoard.push(deck.pop());
				}
				// Compare hero vs all opponents
				const heroSolved = PokerSolver.Hand.solve([...heroHand, ...fullBoard]);
				let anyBetter = false, anyEqual = false;
				for (const oppHand of oppHands) {
					const oppSolved = PokerSolver.Hand.solve([...oppHand, ...fullBoard]);
					if (heroSolved.rank < oppSolved.rank) { anyBetter = true; break; }
					if (heroSolved.rank === oppSolved.rank) anyEqual = true;
				}
				if (!anyBetter && !anyEqual) wins++;
				else if (!anyBetter && anyEqual) ties++;
				else losses++;
			}
			const total = wins + ties + losses;
			const equity = total ? (wins + ties * 0.5) / total * 100 : 0;
			self.postMessage({ id, success: true, result: { equity, wins, ties, losses, total } });
			return;
		}
		if (method === 'init') {
			self.postMessage({ id, success: true, result: { ok: true } });
			return;
		}
		self.postMessage({ id, success: false, error: 'unknown method' });
	} catch (err) {
		self.postMessage({ id, success: false, error: String(err) });
	}
};
