const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const restartButton = document.getElementById("restart");
const scoreEl = document.getElementById("score");
const strikesEl = document.getElementById("strikes");
const aircraftCountEl = document.getElementById("aircraft-count");

const CENTER = { x: canvas.width / 2, y: canvas.height / 2 };
const HOLD_RADIUS = 120;
const SPAWN_INTERVAL = { min: 4, max: 8 };
const MAX_STRIKES = 3;

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

class Plane {
  constructor(id, entry) {
    this.id = id;
    this.state = "approach";
    this.cleared = false;
    this.selected = false;
    this.color = `hsl(${Math.floor(randomRange(180, 360))}, 70%, 60%)`;
    this.speed = randomRange(55, 75);
    this.position = { x: entry.x, y: entry.y };
    this.velocity = { x: 0, y: 0 };
    this.heading = 0;
    this.holdAngle = 0;
    this.holdCenter = null;
    this.label = this.generateCallsign();
    this.departDistance = 0;
  }

  generateCallsign() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const prefix = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    const digits = Math.floor(randomRange(100, 999));
    return `${prefix}${digits}`;
  }

  setSelected(selected) {
    this.selected = selected;
  }

  clearToLand() {
    this.cleared = true;
    if (this.state === "holding" || this.state === "approach") {
      this.state = "landing";
    }
  }

  enterHolding() {
    if (this.state === "runway" || this.state === "departed") return;
    this.cleared = false;
    this.state = "holding";
    this.holdCenter = { ...this.position };
    this.holdAngle = Math.atan2(this.position.y - this.holdCenter.y, this.position.x - this.holdCenter.x);
    this.holdAngle = Math.random() * Math.PI * 2;
  }

  update(dt) {
    switch (this.state) {
      case "approach":
        this.moveTowards(CENTER, dt, this.speed);
        if (distance(this.position, CENTER) < HOLD_RADIUS) {
          if (this.cleared) {
            this.state = "landing";
          } else {
            this.enterHolding();
          }
        }
        break;
      case "holding":
        if (this.cleared) {
          this.state = "landing";
          break;
        }
        this.holdAngle += dt * 0.7;
        this.position.x = this.holdCenter.x + Math.cos(this.holdAngle) * HOLD_RADIUS;
        this.position.y = this.holdCenter.y + Math.sin(this.holdAngle) * HOLD_RADIUS;
        this.heading = this.holdAngle + Math.PI / 2;
        break;
      case "landing":
        this.moveTowards(CENTER, dt, this.speed + 25);
        if (distance(this.position, CENTER) < 12) {
          this.state = "runway";
          this.departDistance = 0;
        }
        break;
      case "runway":
        this.position.y += dt * 80;
        this.departDistance += dt * 80;
        this.heading = Math.PI / 2;
        if (this.position.y > canvas.height + 40) {
          this.state = "departed";
        }
        break;
      default:
        break;
    }
  }

  moveTowards(target, dt, speed) {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const len = Math.hypot(dx, dy) || 1;
    this.velocity.x = (dx / len) * speed;
    this.velocity.y = (dy / len) * speed;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.heading = Math.atan2(this.velocity.y, this.velocity.x);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.heading);

    if (this.selected) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(165, 243, 252, 0.9)";
      ctx.lineWidth = 3;
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    this.drawHud(ctx);
  }

  drawHud(ctx) {
    ctx.save();
    ctx.font = "12px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
    const labelY = this.position.y - 26;
    ctx.fillText(`${this.label}`, this.position.x, labelY);
    ctx.font = "10px 'Inter', sans-serif";
    const stateText = this.state.toUpperCase();
    ctx.fillStyle = this.cleared ? "#bbf7d0" : "#fcd34d";
    ctx.fillText(stateText, this.position.x, labelY - 14);
    ctx.restore();
  }
}

class Game {
  constructor() {
    this.planes = [];
    this.nextSpawn = 0;
    this.elapsed = 0;
    this.score = 0;
    this.strikes = 0;
    this.gameOver = false;
    this.selectedPlane = null;
    this.lastTimestamp = 0;
    this.idCounter = 1;
    this.bindEvents();
    this.showOverlay("Press \"Start new shift\" to begin.");
  }

  bindEvents() {
    canvas.addEventListener("click", (event) => {
      if (this.gameOver) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
      this.handleClick({ x, y });
    });

    document.addEventListener("keydown", (event) => {
      if (!this.selectedPlane || this.gameOver) return;
      if (event.key === "l" || event.key === "L") {
        this.selectedPlane.clearToLand();
      } else if (event.key === "h" || event.key === "H") {
        this.selectedPlane.enterHolding();
      }
    });

    restartButton.addEventListener("click", () => this.reset());
  }

  reset() {
    this.planes = [];
    this.nextSpawn = 1;
    this.elapsed = 0;
    this.score = 0;
    this.strikes = 0;
    this.gameOver = false;
    this.selectedPlane = null;
    this.idCounter = 1;
    this.hideOverlay();
    this.lastTimestamp = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
    this.updateHud();
  }

  showOverlay(message) {
    overlay.textContent = message;
    overlay.classList.remove("hidden");
  }

  hideOverlay() {
    overlay.classList.add("hidden");
  }

  handleClick(point) {
    let clickedPlane = null;
    for (const plane of [...this.planes].reverse()) {
      if (distance(plane.position, point) < 24) {
        clickedPlane = plane;
        break;
      }
    }
    if (!clickedPlane) {
      this.clearSelection();
      return;
    }

    if (this.selectedPlane === clickedPlane) {
      clickedPlane.clearToLand();
    } else {
      this.clearSelection();
      clickedPlane.setSelected(true);
      this.selectedPlane = clickedPlane;
    }
  }

  clearSelection() {
    if (this.selectedPlane) {
      this.selectedPlane.setSelected(false);
    }
    this.selectedPlane = null;
  }

  spawnPlane() {
    const edge = Math.floor(Math.random() * 4);
    let entry;
    const margin = 40;
    switch (edge) {
      case 0:
        entry = { x: randomRange(margin, canvas.width - margin), y: -margin };
        break;
      case 1:
        entry = { x: canvas.width + margin, y: randomRange(margin, canvas.height - margin) };
        break;
      case 2:
        entry = { x: randomRange(margin, canvas.width - margin), y: canvas.height + margin };
        break;
      default:
        entry = { x: -margin, y: randomRange(margin, canvas.height - margin) };
        break;
    }
    const plane = new Plane(this.idCounter++, entry);
    this.planes.push(plane);
    aircraftCountEl.textContent = this.planes.length.toString();
  }

  updateHud() {
    scoreEl.textContent = this.score.toString();
    strikesEl.textContent = this.strikes.toString();
    aircraftCountEl.textContent = this.planes.filter((p) => p.state !== "departed").length.toString();
  }

  loop(timestamp) {
    if (this.gameOver) return;
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = timestamp;
    this.elapsed += dt;

    if (this.elapsed > this.nextSpawn) {
      this.spawnPlane();
      this.nextSpawn = this.elapsed + randomRange(SPAWN_INTERVAL.min, SPAWN_INTERVAL.max);
    }

    this.update(dt);
    this.draw();
    this.updateHud();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt) {
    for (const plane of this.planes) {
      plane.update(dt);
    }

    for (const plane of this.planes) {
      if (plane.state === "departed") {
        this.score += 1;
        this.planes = this.planes.filter((p) => p !== plane);
        if (this.selectedPlane === plane) {
          this.selectedPlane = null;
        }
        break;
      }
    }

    this.handleRunwayIncursions();
    this.detectCollisions();
  }

  handleRunwayIncursions() {
    for (const plane of this.planes) {
      if (plane.state === "landing" && !plane.cleared && distance(plane.position, CENTER) < 18) {
        this.addStrike(`Runway incursion: ${plane.label} landed without clearance.`);
        plane.state = "departed";
      }
    }
    this.planes = this.planes.filter((plane) => plane.state !== "departed");
  }

  detectCollisions() {
    for (let i = 0; i < this.planes.length; i++) {
      const planeA = this.planes[i];
      if (planeA.state === "runway") continue;
      for (let j = i + 1; j < this.planes.length; j++) {
        const planeB = this.planes[j];
        if (planeB.state === "runway") continue;
        if (distance(planeA.position, planeB.position) < 18) {
          this.addStrike(`Collision between ${planeA.label} and ${planeB.label}.`);
          planeA.state = "departed";
          planeB.state = "departed";
        }
      }
    }
    this.planes = this.planes.filter((plane) => plane.state !== "departed");
  }

  addStrike(message) {
    this.strikes += 1;
    this.showOverlay(`${message}\nStrikes: ${this.strikes}/${MAX_STRIKES}`);
    if (this.strikes >= MAX_STRIKES) {
      this.endGame(`${message}\n\nShift over. Final score: ${this.score}`);
    } else {
      setTimeout(() => {
        if (!this.gameOver) this.hideOverlay();
      }, 1500);
    }
  }

  endGame(message) {
    this.gameOver = true;
    this.showOverlay(message);
  }

  draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawBackground();
    for (const plane of this.planes) {
      plane.draw(ctx);
    }
  }

  drawBackground() {
    ctx.save();

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, HOLD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    const runwayWidth = 80;
    const runwayLength = 380;
    ctx.fillStyle = "#111827";
    ctx.fillRect(CENTER.x - runwayWidth / 2, CENTER.y - runwayLength / 2, runwayWidth, runwayLength);

    ctx.fillStyle = "#e2e8f0";
    for (let i = -runwayLength / 2 + 20; i < runwayLength / 2; i += 40) {
      ctx.fillRect(CENTER.x - 4, CENTER.y + i, 8, 18);
    }

    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

const game = new Game();
