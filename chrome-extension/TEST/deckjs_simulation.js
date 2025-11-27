// deckjs_simulation.js - Ejemplo de simulación con @creativenull/deckjs en Node.js
const { Poker } = require('@creativenull/deckjs');


// Función para generar una mano aleatoria de 5 cartas
function getRandomHand(deck, usedIds = []) {
  const hand = [];
  while (hand.length < 5) {
    const card = deck.getCards(1)[0];
    if (!usedIds.includes(card.id)) {
      hand.push(card);
      usedIds.push(card.id);
    }
  }
  return hand;
}

// Simular varios escenarios
const poker = new Poker();
const numSimulations = 5;
for (let i = 0; i < numSimulations; i++) {
  // Reiniciar el deck para cada simulación
  const deck = new Poker();
  const usedIds = [];
  const heroHand = getRandomHand(deck, usedIds);
  const villainHand = getRandomHand(deck, usedIds);
  const results = deck.winner([
    { id: 'hero', hand: heroHand },
    { id: 'villain', hand: villainHand }
  ]);
  console.log(`Simulación ${i+1}`);
  console.log('Hero:', heroHand.map(c => c.id).join(' '));
  console.log('Villain:', villainHand.map(c => c.id).join(' '));
  console.log('Resultados:', results);
  console.log('-----------------------------');
}
