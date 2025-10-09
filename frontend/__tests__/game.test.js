const setupDom = () => {
  document.body.innerHTML = `
    <main>
      <section class="game-panel">
        <canvas id="game" width="900" height="600"></canvas>
        <div id="overlay"></div>
      </section>
      <aside class="sidebar">
        <span id="score">0</span>
        <span id="strikes">0</span>
        <span id="aircraft-count">0</span>
        <span id="landings">0</span>
        <span id="shift-time" data-total="180">0:00</span>
        <span id="runway-status" data-state="clear">Clear</span>
        <button id="command-land"></button>
        <button id="command-hold"></button>
        <button id="restart"></button>
        <ol id="log"></ol>
      </aside>
    </main>
  `;
};

const loadGameModule = () => {
  jest.resetModules();
  setupDom();
  return require('../game.js');
};

describe('Runway Rush game core', () => {
  test('currentSpawnWindow eases between configured ranges', () => {
    const gameModule = loadGameModule();
    const game = gameModule.initializeGame();
    const [startMin, startMax] = game.currentSpawnWindow();
    expect(startMin).toBeCloseTo(gameModule.constants.SPAWN_INTERVAL.startMin, 5);
    expect(startMax).toBeCloseTo(gameModule.constants.SPAWN_INTERVAL.startMax, 5);

    game.shiftTime = gameModule.constants.SHIFT_DURATION;
    const [endMin, endMax] = game.currentSpawnWindow();
    expect(endMin).toBeCloseTo(gameModule.constants.SPAWN_INTERVAL.endMin, 5);
    expect(endMax).toBeCloseTo(gameModule.constants.SPAWN_INTERVAL.endMax, 5);
  });

  test('requestLanding reserves the runway and clears the aircraft', () => {
    const gameModule = loadGameModule();
    const game = gameModule.initializeGame();
    const plane = new gameModule.Plane(game, 1, { x: 0, y: 0, name: 'Test Gate' });
    game.planes.push(plane);

    game.requestLanding(plane);

    expect(game.runwayReservation).toBe(plane);
    expect(game.runwayState).toBe('reserved');
    expect(plane.cleared).toBe(true);
  });

  test('requestHold releases runway reservation and updates state', () => {
    const gameModule = loadGameModule();
    const game = gameModule.initializeGame();
    const plane = new gameModule.Plane(game, 2, { x: 0, y: 0, name: 'Test Gate' });
    game.planes.push(plane);

    game.requestLanding(plane);
    expect(game.runwayState).toBe('reserved');

    game.requestHold(plane);

    expect(game.runwayReservation).toBeNull();
    expect(game.runwayState).toBe('clear');
    expect(plane.state).toBe('holding');
  });

  test('detectCollisions adds a strike and removes conflicting aircraft', () => {
    const gameModule = loadGameModule();
    const game = gameModule.initializeGame();
    const planeA = new gameModule.Plane(game, 3, { x: 0, y: 0, name: 'Gate A' });
    const planeB = new gameModule.Plane(game, 4, { x: 0, y: 0, name: 'Gate B' });
    planeA.position = { x: 100, y: 100 };
    planeB.position = { x: 102, y: 102 };
    planeA.separation = 10;
    planeB.separation = 10;
    game.planes.push(planeA, planeB);

    game.detectCollisions();

    expect(game.strikes).toBe(1);
    expect(game.planes).toHaveLength(0);
    expect(document.getElementById('overlay').textContent).toContain('Loss of separation');
  });
});
