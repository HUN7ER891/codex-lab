const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const restartButton = document.getElementById("restart");
const scoreEl = document.getElementById("score");
const strikesEl = document.getElementById("strikes");
const aircraftCountEl = document.getElementById("aircraft-count");
const landingsEl = document.getElementById("landings");
const shiftTimeEl = document.getElementById("shift-time");
const runwayStatusEl = document.getElementById("runway-status");
const landButton = document.getElementById("command-land");
const holdButton = document.getElementById("command-hold");
const logElement = document.getElementById("log");

const CENTER = { x: canvas.width / 2, y: canvas.height / 2 };
const APPROACH_FIX = { x: CENTER.x, y: CENTER.y - 210 };
const RUNWAY_THRESHOLD = { x: CENTER.x, y: CENTER.y - 40 };
const RUNWAY_EXIT = { x: CENTER.x + 220, y: CENTER.y + 220 };
const RUNWAY_CLEAR_POINT = { x: CENTER.x, y: CENTER.y + 120 };
const HOLD_RADIUS = 85;
const SHIFT_DURATION = Number(shiftTimeEl?.dataset?.total ?? 180);
const MAX_STRIKES = 3;

const SPAWN_INTERVAL = {
  startMin: 5.5,
  startMax: 9,
  endMin: 2.8,
  endMax: 4.4,
};

const PLANE_TYPES = [
  {
    name: "Turboprop",
    code: "TP",
    cruiseSpeed: 55,
    finalSpeed: 75,
    rollSpeed: 70,
    color: "#bae6fd",
    score: 1,
    separation: 26,
  },
  {
    name: "Regional Jet",
    code: "RJ",
    cruiseSpeed: 62,
    finalSpeed: 84,
    rollSpeed: 82,
    color: "#fca5a5",
    score: 2,
    separation: 30,
  },
  {
    name: "Heavy Jet",
    code: "HV",
    cruiseSpeed: 58,
    finalSpeed: 78,
    rollSpeed: 68,
    color: "#fbcfe8",
    score: 3,
    separation: 34,
  },
];

const ENTRY_VECTORS = [
  { name: "North Gate", position: (margin) => ({ x: randomRange(margin, canvas.width - margin), y: -margin }) },
  {
    name: "East Gate",
    position: (margin) => ({ x: canvas.width + margin, y: randomRange(margin, canvas.height - margin) }),
  },
  { name: "South Gate", position: (margin) => ({ x: randomRange(margin, canvas.width - margin), y: canvas.height + margin }) },
  {
    name: "West Gate",
    position: (margin) => ({ x: -margin, y: randomRange(margin, canvas.height - margin) }),
  },
];

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

class MessageLog {
  constructor(element) {
    this.element = element;
    this.entries = [];
    this.maxEntries = 8;
  }

  push(text) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    this.entries.unshift({ text, timestamp });
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }
    this.render();
  }

  clear() {
    this.entries = [];
    this.render();
  }

  render() {
    if (!this.element) return;
    this.element.innerHTML = "";
    for (const entry of this.entries) {
      const li = document.createElement("li");
      const time = document.createElement("span");
      time.className = "timestamp";
      time.textContent = entry.timestamp;
      li.appendChild(time);
      const text = document.createElement("span");
      text.textContent = entry.text;
      li.appendChild(text);
      this.element.appendChild(li);
    }
  }
}

class Plane {
  constructor(game, id, entry) {
    this.game = game;
    this.id = id;
    this.entry = entry;
    this.position = { x: entry.x, y: entry.y };
    this.velocity = { x: 0, y: 0 };
    this.state = "approach";
    this.cleared = false;
    this.selected = false;
    this.heading = 0;
    this.type = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)];
    this.color = this.type.color;
    this.cruiseSpeed = this.type.cruiseSpeed;
    this.finalSpeed = this.type.finalSpeed;
    this.rollSpeed = this.type.rollSpeed;
    this.scoreValue = this.type.score;
    this.separation = this.type.separation;
    this.label = this.generateCallsign();
    this.holdAngle = Math.random() * Math.PI * 2;
    this.holdRate = randomRange(0.6, 0.9);
    this.clearedRunway = false;
  }

  generateCallsign() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const prefix =
      letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    const digits = Math.floor(randomRange(100, 999));
    return `${prefix}${digits}`;
  }

  setSelected(selected) {
    this.selected = selected;
  }

  clearToLand() {
    this.cleared = true;
    this.clearedRunway = false;
    if (this.state === "holding") {
      this.state = "liningUp";
    }
  }

  enterHolding() {
    if (this.state === "landing" || this.state === "departed") return;
    this.cleared = false;
    this.clearedRunway = false;
    this.state = "holding";
    this.holdAngle = Math.random() * Math.PI * 2;
  }

  update(dt) {
    switch (this.state) {
      case "approach":
        this.moveTowards(APPROACH_FIX, dt, this.cruiseSpeed);
        if (distance(this.position, APPROACH_FIX) < 14) {
          if (this.cleared && this.game.canPlaneEnterFinal(this)) {
            this.state = "final";
          } else {
            const hadClearance = this.cleared;
            this.enterHolding();
            this.game.notifyHold(this, hadClearance);
          }
        }
        break;
      case "holding":
        if (this.cleared && this.game.canPlaneEnterFinal(this)) {
          this.state = "liningUp";
          break;
        }
        this.holdAngle += dt * this.holdRate;
        this.position.x = APPROACH_FIX.x + Math.cos(this.holdAngle) * HOLD_RADIUS;
        this.position.y = APPROACH_FIX.y + Math.sin(this.holdAngle) * HOLD_RADIUS;
        this.heading = this.holdAngle + Math.PI / 2;
        break;
      case "liningUp":
        this.moveTowards(APPROACH_FIX, dt, this.cruiseSpeed * 0.95);
        if (distance(this.position, APPROACH_FIX) < 12) {
          this.state = "final";
        }
        break;
      case "final":
        this.moveTowards(RUNWAY_THRESHOLD, dt, this.finalSpeed);
        if (distance(this.position, RUNWAY_THRESHOLD) < 10) {
          this.state = "landing";
          this.game.onTouchdown(this);
        }
        break;
      case "landing":
        this.moveTowards(RUNWAY_EXIT, dt, this.rollSpeed);
        if (!this.clearedRunway && distance(this.position, RUNWAY_CLEAR_POINT) < 10) {
          this.clearedRunway = true;
          this.game.onRunwayClear(this);
        }
        if (distance(this.position, RUNWAY_EXIT) < 14) {
          this.state = "departed";
          this.game.onPlaneDeparted(this);
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
      ctx.strokeStyle = "rgba(165, 243, 252, 0.95)";
      ctx.lineWidth = 3;
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    this.drawHud(ctx);
  }

  hudState() {
    switch (this.state) {
      case "approach":
        return "APPR";
      case "holding":
        return "HOLD";
      case "liningUp":
        return "SEQ";
      case "final":
        return this.cleared ? "FINAL" : "WAIT";
      case "landing":
        return "RUNWAY";
      default:
        return "";
    }
  }

  drawHud(ctx) {
    ctx.save();
    ctx.font = "12px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
    const labelY = this.position.y - 28;
    ctx.fillText(`${this.label} • ${this.type.code}`, this.position.x, labelY);
    ctx.font = "10px 'Inter', sans-serif";
    ctx.fillStyle = this.cleared ? "#bbf7d0" : "#fcd34d";
    ctx.fillText(`${this.hudState()}`, this.position.x, labelY - 14);
    ctx.restore();
  }
}

class Game {
  constructor() {
    this.planes = [];
    this.nextSpawn = 0;
    this.elapsed = 0;
    this.shiftTime = 0;
    this.score = 0;
    this.landed = 0;
    this.strikes = 0;
    this.gameOver = false;
    this.selectedPlane = null;
    this.lastTimestamp = 0;
    this.idCounter = 1;
    this.runwayReservation = null;
    this.runwayState = "clear";
    this.animationFrameId = null;
    this.log = new MessageLog(logElement);
    this.bindEvents();
    this.showOverlay('Press "Start new shift" to begin.');
    this.updateHud();
    this.updateCommandButtons();
  }

  bindEvents() {
    canvas.addEventListener("click", (event) => {
      if (this.gameOver || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
      this.handleClick({ x, y });
    });

    document.addEventListener("keydown", (event) => {
      if (this.gameOver || !this.selectedPlane) return;
      if (event.key === "l" || event.key === "L") {
        this.requestLanding(this.selectedPlane);
      } else if (event.key === "h" || event.key === "H") {
        this.requestHold(this.selectedPlane);
      }
    });

    restartButton?.addEventListener("click", () => this.reset());
    landButton?.addEventListener("click", () => this.requestLanding(this.selectedPlane));
    holdButton?.addEventListener("click", () => this.requestHold(this.selectedPlane));
  }

  reset() {
    this.gameOver = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.planes = [];
    this.nextSpawn = 1.5;
    this.elapsed = 0;
    this.shiftTime = 0;
    this.score = 0;
    this.landed = 0;
    this.strikes = 0;
    this.gameOver = false;
    this.selectedPlane = null;
    this.idCounter = 1;
    this.runwayReservation = null;
    this.setRunwayStatus("clear");
    this.log.clear();
    this.log.push("Shift started. Runway 27 active.");
    this.hideOverlay();
    this.lastTimestamp = performance.now();
    this.updateHud();
    this.updateCommandButtons();
    this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  showOverlay(message) {
    if (!overlay) return;
    overlay.textContent = message;
    overlay.classList.remove("hidden");
  }

  hideOverlay() {
    if (!overlay) return;
    overlay.classList.add("hidden");
  }

  handleClick(point) {
    let clickedPlane = null;
    for (const plane of [...this.planes].reverse()) {
      if (distance(plane.position, point) < 26) {
        clickedPlane = plane;
        break;
      }
    }
    if (!clickedPlane) {
      this.clearSelection();
      return;
    }

    if (this.selectedPlane === clickedPlane) {
      this.requestLanding(clickedPlane);
    } else {
      this.clearSelection();
      clickedPlane.setSelected(true);
      this.selectedPlane = clickedPlane;
      this.log.push(`${clickedPlane.label} selected.`);
    }
    this.updateCommandButtons();
  }

  clearSelection() {
    if (this.selectedPlane) {
      this.selectedPlane.setSelected(false);
    }
    this.selectedPlane = null;
    this.updateCommandButtons();
  }

  updateCommandButtons() {
    const disabled = !this.selectedPlane || this.gameOver;
    if (landButton) landButton.disabled = disabled;
    if (holdButton) holdButton.disabled = disabled;
  }

  spawnPlane() {
    const margin = 40;
    const entryTemplate = ENTRY_VECTORS[Math.floor(Math.random() * ENTRY_VECTORS.length)];
    const position = entryTemplate.position(margin);
    const plane = new Plane(this, this.idCounter++, { ...position, name: entryTemplate.name });
    this.planes.push(plane);
    this.log.push(`${plane.label} inbound via ${entryTemplate.name} (${plane.type.name}).`);
    this.updateHud();
  }

  updateHud() {
    if (scoreEl) scoreEl.textContent = this.score.toString();
    if (strikesEl) strikesEl.textContent = this.strikes.toString();
    if (aircraftCountEl) aircraftCountEl.textContent = this.planes.length.toString();
    if (landingsEl) landingsEl.textContent = this.landed.toString();
    const minutes = Math.floor(this.shiftTime / 60);
    const seconds = Math.floor(this.shiftTime % 60)
      .toString()
      .padStart(2, "0");
    if (shiftTimeEl) {
      const totalMinutes = Math.floor(SHIFT_DURATION / 60);
      const totalSeconds = Math.floor(SHIFT_DURATION % 60)
        .toString()
        .padStart(2, "0");
      shiftTimeEl.textContent = `${minutes}:${seconds} / ${totalMinutes}:${totalSeconds}`;
    }
    if (runwayStatusEl) {
      runwayStatusEl.textContent =
        this.runwayState === "clear" ? "Clear" : this.runwayState === "reserved" ? "Reserved" : "Occupied";
      runwayStatusEl.dataset.state = this.runwayState;
    }
  }

  currentSpawnWindow() {
    const progress = Math.min(this.shiftTime / SHIFT_DURATION, 1);
    const min = lerp(SPAWN_INTERVAL.startMin, SPAWN_INTERVAL.endMin, progress);
    const max = lerp(SPAWN_INTERVAL.startMax, SPAWN_INTERVAL.endMax, progress);
    return [min, max];
  }

  loop(timestamp) {
    if (this.gameOver) return;
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = timestamp;
    this.elapsed += dt;
    this.shiftTime += dt;

    if (this.shiftTime >= SHIFT_DURATION) {
      this.endGame(`Shift complete! Final score: ${this.score}`);
      return;
    }

    if (this.elapsed > this.nextSpawn) {
      this.spawnPlane();
      const [min, max] = this.currentSpawnWindow();
      this.nextSpawn = this.elapsed + randomRange(min, max);
    }

    this.update(dt);
    this.draw();
    this.updateHud();

    this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt) {
    for (const plane of this.planes) {
      plane.update(dt);
    }

    this.planes = this.planes.filter((plane) => plane.state !== "departed");

    this.detectCollisions();
    this.handleRunwayIncursions();
  }

  canPlaneEnterFinal(plane) {
    const reservationMatches = !this.runwayReservation || this.runwayReservation === plane;
    const runwayFree = this.runwayState !== "occupied" || this.runwayReservation === plane;
    return reservationMatches && runwayFree;
  }

  requestLanding(plane) {
    if (!plane || this.gameOver) return;
    if (plane.state === "departed") return;
    if (this.runwayState === "occupied" && this.runwayReservation !== plane) {
      this.log.push("Unable: runway occupied.");
      return;
    }
    if (this.runwayReservation === plane && plane.cleared) {
      this.log.push(`${plane.label} already cleared to land.`);
      return;
    }
    if (this.runwayReservation && this.runwayReservation !== plane) {
      this.log.push(`Unable: runway reserved for ${this.runwayReservation.label}.`);
      return;
    }
    this.runwayReservation = plane;
    this.setRunwayStatus("reserved");
    plane.clearToLand();
    this.log.push(`${plane.label} cleared to land Runway 27 (${plane.type.name}).`);
  }

  requestHold(plane) {
    if (!plane || this.gameOver) return;
    plane.enterHolding();
    if (this.runwayReservation === plane) {
      this.runwayReservation = null;
      this.setRunwayStatus(this.anyPlaneOnRunway() ? "occupied" : "clear");
    }
    this.log.push(`${plane.label} instructed to hold at NAROW fix.`);
  }

  notifyHold(plane, hadClearance = false) {
    if (hadClearance) {
      plane.cleared = false;
      if (this.runwayReservation === plane) {
        this.runwayReservation = null;
        this.setRunwayStatus(this.anyPlaneOnRunway() ? "occupied" : "clear");
      }
      this.log.push(`${plane.label} returning to hold — runway unavailable.`);
    } else {
      this.log.push(`${plane.label} established in the hold.`);
    }
  }

  onTouchdown(plane) {
    this.setRunwayStatus("occupied");
    this.log.push(`${plane.label} touchdown.`);
  }

  onRunwayClear(plane) {
    if (this.runwayReservation === plane) {
      this.runwayReservation = null;
      this.setRunwayStatus("clear");
      this.log.push(`Runway clear. ${plane.label} vacating.`);
    }
  }

  onPlaneDeparted(plane) {
    this.score += plane.scoreValue;
    this.landed += 1;
    this.log.push(`${plane.label} vacated. +${plane.scoreValue} points.`);
    if (this.selectedPlane === plane) {
      this.selectedPlane = null;
    }
    this.updateCommandButtons();
  }

  setRunwayStatus(state) {
    this.runwayState = state;
    if (!runwayStatusEl) return;
    runwayStatusEl.dataset.state = state;
    runwayStatusEl.textContent = state === "clear" ? "Clear" : state === "reserved" ? "Reserved" : "Occupied";
  }

  anyPlaneOnRunway() {
    return this.planes.some((plane) => plane.state === "landing");
  }

  handleRunwayIncursions() {
    for (const plane of this.planes) {
      if (plane.state === "landing" && !plane.cleared) {
        this.addStrike(`Runway incursion: ${plane.label} without clearance.`);
        plane.state = "departed";
        this.onPlaneDeparted(plane);
      }
    }
    this.planes = this.planes.filter((plane) => plane.state !== "departed");
  }

  detectCollisions() {
    for (let i = 0; i < this.planes.length; i++) {
      const planeA = this.planes[i];
      for (let j = i + 1; j < this.planes.length; j++) {
        const planeB = this.planes[j];
        const safeDistance = Math.max(planeA.separation, planeB.separation);
        if (distance(planeA.position, planeB.position) < safeDistance) {
          this.addStrike(`Loss of separation between ${planeA.label} and ${planeB.label}.`);
          planeA.state = "departed";
          planeB.state = "departed";
        }
      }
    }
    this.planes = this.planes.filter((plane) => plane.state !== "departed");
  }

  addStrike(message) {
    this.strikes += 1;
    this.log.push(`⚠️ ${message}`);
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
    this.log.push(`Shift complete. Final score ${this.score}.`);
    this.updateCommandButtons();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
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

    // Final approach path
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(APPROACH_FIX.x, APPROACH_FIX.y);
    ctx.lineTo(RUNWAY_THRESHOLD.x, RUNWAY_THRESHOLD.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Holding pattern
    ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(APPROACH_FIX.x, APPROACH_FIX.y, HOLD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
    ctx.beginPath();
    ctx.arc(APPROACH_FIX.x, APPROACH_FIX.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Runway
    const runwayWidth = 84;
    const runwayLength = 420;
    ctx.fillStyle = "#111827";
    ctx.fillRect(
      CENTER.x - runwayWidth / 2,
      CENTER.y - runwayLength / 2,
      runwayWidth,
      runwayLength
    );

    ctx.fillStyle = "#e2e8f0";
    for (let i = -runwayLength / 2 + 20; i < runwayLength / 2; i += 40) {
      ctx.fillRect(CENTER.x - 4, CENTER.y + i, 8, 18);
    }

    // Taxiway exit
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(CENTER.x + runwayWidth / 2, CENTER.y + 80);
    ctx.lineTo(RUNWAY_EXIT.x, RUNWAY_EXIT.y);
    ctx.stroke();

    ctx.restore();
  }
}

new Game();
