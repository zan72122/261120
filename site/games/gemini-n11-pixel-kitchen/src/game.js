// Little Pixel Kitchen — Wordless 360° Sprite-Stacking Cooking Toy
(function () {
  const COUNTER_Z = 38;
  const BOARD_POS = { x: -12, y: 11, z: 45 };
  const PAN_POS = { x: 11, y: 12, z: 42 };
  const POT_POS = { x: 11, y: -12, z: 42 };
  const PLATE_POS = { x: 38, y: 10, z: 43 };
  const BOWL_POS = { x: 39, y: -12, z: 42 };
  const BELL_POS = { x: 48, y: 24, z: 38 };
  const SALT_HOME = { x: -18, y: -15, z: 38 };
  const KETCHUP_HOME = { x: -5, y: -15, z: 38 };
  const KNIFE_HOME = { x: -16, y: 23, z: 45 };
  const KNOB_PAN_POS = { x: 8, y: 30, z: 31 };
  const KNOB_POT_POS = { x: 22, y: 30, z: 31 };
  const TOWEL_POS = { x: -55, y: 0, z: 10 };
  const OVEN_POS = { x: -25, y: 28, z: 18 };
  const MAMA_POS = { x: 73, y: 2, z: 0 };
  const MAMA_BASE_ANGLE = 0.98; // Faces plate & welcomingly toward front viewer!

  const BASKET_SLOTS = [
    { kind: "tomato",   x: -44, y: -11, z: 42, col: "#e02b22", soupRgb: [224, 62, 46] },
    { kind: "carrot",   x: -33, y: -11, z: 42, col: "#eb721a", soupRgb: [238, 134, 42] },
    { kind: "egg",      x: -44, y: 2,   z: 42, col: "#ffd538", soupRgb: [248, 212, 92] },
    { kind: "wiener",   x: -33, y: 2,   z: 42, col: "#c9372a", soupRgb: [204, 96, 68] },
    { kind: "mushroom", x: -44, y: 14,  z: 42, col: "#8c5738", soupRgb: [168, 124, 86] },
    { kind: "broccoli", x: -33, y: 14,  z: 42, col: "#3a9929", soupRgb: [112, 178, 86] },
  ];

  function foodModelName(item) {
    switch (item.kind) {
      case "tomato":
        if (item.cooked >= 1) return "tomato_cooked";
        return item.chops > 0 ? "tomato_sliced" : "tomato_whole";
      case "carrot":
        if (item.cooked >= 1) return "carrot_cooked";
        if (item.chops >= 2) return "carrot_flower";
        return item.chops === 1 ? "carrot_sliced" : "carrot_whole";
      case "egg":
        if (item.cooked >= 1) return "egg_fried";
        return item.chops > 0 ? "egg_raw" : "egg_whole";
      case "wiener":
        if (item.cooked >= 1) return "wiener_tako";
        return item.chops > 0 ? "wiener_cut" : "wiener_whole";
      case "mushroom":
        if (item.cooked >= 1) return "mushroom_cooked";
        return item.chops > 0 ? "mushroom_sliced" : "mushroom_whole";
      case "broccoli":
        if (item.cooked >= 1) return "broccoli_cooked";
        return item.chops > 0 ? "broccoli_sliced" : "broccoli_whole";
      default:
        return "tomato_whole";
    }
  }

  function foodHeight(item) {
    const m = foodModelName(item);
    if (m.includes("sliced") || m.includes("cooked") || m.includes("flower")) return 7;
    if (m === "egg_raw" || m === "egg_fried") return 6;
    if (m === "wiener_tako") return 13;
    return 11;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dist2D(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function rgbToHex(r, g, b) {
    const toH = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return "#" + toH(r) + toH(g) + toH(b);
  }

  class KitchenGame {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new window.StackRenderer(canvas);
      this.audio = new window.KitchenAudio();

      this.time = 0;
      this.lastTs = 0;
      this.idleTime = 0;
      this.hintPulse = 0;

      // Camera rotation & inertia
      this.camVel = 0;
      this.introSpin = 0.25; // Gentle welcoming reveal tilt at start

      // Stove burners: 0 = off, 1 = low, 2 = high
      this.panHeat = 0;
      this.potHeat = 0;
      this.panKnobAnim = 0;
      this.potKnobAnim = 0;

      // Pan & Knife animations
      this.panPos = { x: PAN_POS.x, y: PAN_POS.y, z: PAN_POS.z };
      this.panTilt = 0;
      this.panFlipTimer = 0;
      this.knifePos = { x: KNIFE_HOME.x, y: KNIFE_HOME.y, z: KNIFE_HOME.z };
      this.knifeChopTimer = 0;

      // Soup pot state
      this.soup = {
        amount: 0.45, // Starts with warm clear golden broth ready for veggies!
        rgb: [242, 224, 168],
        ingredients: [],
        flecks: [],
        swirlAngle: 0,
        swirlVel: 0,
        boilLevel: 0,
        boilOver: 0,
        saltCount: 0,
      };
      this.ladlePos = { x: POT_POS.x + 2, y: POT_POS.y - 2, z: POT_POS.z + 8 };
      this.ladleScoopColor = null;
      this.ladlePourAnim = 0;

      // Serving bowl state
      this.bowl = {
        filled: false,
        rgb: [242, 224, 168],
        flecks: [],
        saltCount: 0,
        swirl: 0,
      };

      // Seasonings
      this.saltPos = { ...SALT_HOME };
      this.saltTilt = 0;
      this.saltCooldown = 0;
      this.ketchupPos = { ...KETCHUP_HOME };
      this.ketchupTilt = 0;
      this.ketchupCooldown = 0;

      // Ambient interactive toys
      this.towelSway = 0;
      this.towelVel = 0;
      this.ovenGlowBoost = 0;
      this.bellBounce = 0;

      // Ingredients in the world (basket + active cooking + plate)
      this.nextId = 1;
      this.foods = [];
      this.basketRespawn = {}; // slotIndex -> timer
      this._initBasket();

      // Mama character state
      this.mama = {
        expr: "idle",
        exprTimer: 0,
        emote: null,
        emoteTimer: 0,
        headYawOffset: 0,
        targetYawOffset: 0,
        bounce: 0,
        lean: 0,
        eating: false,
        eatQueue: [],
        eatStepTimer: 0,
        mealSummary: null,
      };

      // Pixel particles
      this.particles = [];

      // Single-finger safe pointer state
      this.activePointerId = null;
      this.drag = null; // { mode, item, startBx, startBy, lastBx, lastBy, startTime, moved }

      this._bindEvents();
      this._handleResize();

      this.renderer.loadModels(window.SLICE_DATA, () => {
        if (window.location.search.indexOf("thumb=1") !== -1) {
          this._setupThumbShowcase();
        }
        this.lastTs = performance.now();
        requestAnimationFrame((ts) => this._loop(ts));
      });
    }

    _setupThumbShowcase() {
      this.renderer.camAngle = -0.36;
      this.introSpin = 0;
      this.camVel = 0;
      this.panHeat = 2;
      this.potHeat = 2;
      this.soup.rgb = [234, 96, 48];
      this.soup.amount = 0.85;
      this.soup.boilLevel = 0.85;
      this.soup.boilOver = 0.15;
      this.soup.flecks = [
        { a: 0.4, r: 2.5, col: "#e02b22" },
        { a: 1.5, r: 4.5, col: "#eb721a" },
        { a: 2.8, r: 3.2, col: "#3a9929" },
        { a: 4.1, r: 4.8, col: "#ffd538" },
        { a: 5.3, r: 2.2, col: "#8c5738" },
        { a: 0.9, r: 5.0, col: "#e02b22" },
      ];
      this.bowl.filled = true;
      this.bowl.rgb = [234, 96, 48];
      this.bowl.flecks = this.soup.flecks.slice(0, 5).map((f) => ({ ...f }));

      // Flower carrot on cutting board
      this.foods.push({
        id: this.nextId++, kind: "carrot", slotIndex: 1, zone: "board",
        x: BOARD_POS.x, y: BOARD_POS.y - 2, z: BOARD_POS.z,
        vx: 0, vy: 0, vz: 0, angle: 0.2, spinVel: 0, scale: 1,
        chops: 2, cookProgress: 0, cooked: 0, salted: 0, ketchupDots: [],
        hopTimer: 0, plateIndex: 0, stackSwayPhase: 0,
      });
      // Sizzling sunny-side-up egg & octopus wiener in frying pan
      this.foods.push({
        id: this.nextId++, kind: "egg", slotIndex: 2, zone: "pan",
        x: PAN_POS.x - 2, y: PAN_POS.y + 1, z: PAN_POS.z + 2,
        vx: 0, vy: 0, vz: 0, angle: 0.1, spinVel: 0, scale: 1,
        chops: 1, cookProgress: 1.2, cooked: 1, salted: 1, ketchupDots: [],
        hopTimer: 0, plateIndex: 0, stackSwayPhase: 0,
      });
      this.foods.push({
        id: this.nextId++, kind: "wiener", slotIndex: 3, zone: "pan",
        x: PAN_POS.x + 3, y: PAN_POS.y - 2, z: PAN_POS.z + 2,
        vx: 0, vy: 0, vz: 0, angle: -0.2, spinVel: 0, scale: 1,
        chops: 1, cookProgress: 1.2, cooked: 1, salted: 0, ketchupDots: [],
        hopTimer: 0, plateIndex: 0, stackSwayPhase: 0,
      });
      // Plated fried egg + octopus wiener + red ketchup dots!
      this.foods.push({
        id: this.nextId++, kind: "egg", slotIndex: 2, zone: "plate",
        x: PLATE_POS.x, y: PLATE_POS.y, z: PLATE_POS.z,
        vx: 0, vy: 0, vz: 0, angle: 0.15, spinVel: 0, scale: 1,
        chops: 1, cookProgress: 1.2, cooked: 1, salted: 1,
        ketchupDots: [{ ox: -2, oy: 1 }, { ox: 1, oy: -1 }, { ox: 2, oy: 2 }],
        hopTimer: 0, plateIndex: 0, stackSwayPhase: 0,
      });
      this.foods.push({
        id: this.nextId++, kind: "wiener", slotIndex: 3, zone: "plate",
        x: PLATE_POS.x + 1, y: PLATE_POS.y - 1, z: PLATE_POS.z + 5,
        vx: 0, vy: 0, vz: 0, angle: 0.35, spinVel: 0, scale: 1,
        chops: 1, cookProgress: 1.2, cooked: 1, salted: 1, ketchupDots: [],
        hopTimer: 0, plateIndex: 1, stackSwayPhase: 1,
      });

      this.mama.expr = "star";
      this.mama.exprTimer = 20;
      this.mama.emote = "heart";
      this.mama.emoteTimer = 20;
      this.mama.bounce = 0.5;
      this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 48, 4, "heart", "#ff4d6a");
      this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 50, 5, "star", "#ffe042");
      this._spawnParticles(PAN_POS.x, PAN_POS.y, PAN_POS.z + 10, 4, "steam", "#ffffff");
      this._spawnParticles(POT_POS.x, POT_POS.y, POT_POS.z + 17, 4, "steam", "#ffffff");
    }

    _initBasket() {
      BASKET_SLOTS.forEach((slot, idx) => {
        this._spawnBasketItem(idx, true);
      });
    }

    _spawnBasketItem(slotIndex, immediate = false) {
      const slot = BASKET_SLOTS[slotIndex];
      const item = {
        id: this.nextId++,
        kind: slot.kind,
        slotIndex,
        zone: "basket", // 'basket' | 'board' | 'pan' | 'plate' | 'drag' | 'flying'
        x: slot.x,
        y: slot.y,
        z: slot.z,
        vx: 0, vy: 0, vz: 0,
        angle: (slotIndex % 2 === 0 ? 0.25 : -0.35),
        spinVel: 0,
        scale: immediate ? 1 : 0.1,
        chops: 0,
        cookProgress: 0, // 0..1 -> cooked = 1; >2.2 -> extra crispy
        cooked: 0,
        salted: 0,
        ketchupDots: [],
        hopTimer: 0,
        plateIndex: 0,
        stackSwayPhase: Math.random() * Math.PI * 2,
      };
      this.foods.push(item);
      return item;
    }

    _bindEvents() {
      window.addEventListener("resize", () => this._handleResize());
      const c = this.canvas;
      c.addEventListener("pointerdown", (e) => this._onPointerDown(e));
      window.addEventListener("pointermove", (e) => this._onPointerMove(e));
      window.addEventListener("pointerup", (e) => this._onPointerUp(e));
      window.addEventListener("pointercancel", (e) => this._onPointerUp(e));
      // Prevent iOS Safari bounce / double-tap zoom / context menu
      c.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    _handleResize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.resize(window.innerWidth, window.innerHeight, dpr);
    }

    // -------------------------------------------------------------------------
    // Input & Generous Toddler-Friendly Hit Testing
    // -------------------------------------------------------------------------
    _onPointerDown(e) {
      if (this.activePointerId !== null) return; // Multi-touch guard!
      this.activePointerId = e.pointerId;
      this.audio.unlock();
      this.idleTime = 0;

      const rect = this.canvas.getBoundingClientRect();
      const { bx, by } = this.renderer.screenCssToBuf(e.clientX - rect.left, e.clientY - rect.top);
      const hit = this._hitTest(bx, by);

      this.drag = {
        mode: hit ? hit.type : "rotate",
        target: hit ? hit.target : null,
        startBx: bx,
        startBy: by,
        lastBx: bx,
        lastBy: by,
        startTime: this.time,
        moved: false,
      };

      if (hit) {
        if (hit.type === "food") {
          this.audio.playPick();
        } else if (hit.type === "knob_pan") {
          this._toggleBurner("pan");
          this.drag.mode = "done";
        } else if (hit.type === "knob_pot") {
          this._toggleBurner("pot");
          this.drag.mode = "done";
        } else if (hit.type === "bell") {
          this._ringBell();
          this.drag.mode = "done";
        } else if (hit.type === "towel") {
          this.towelVel = (Math.random() > 0.5 ? 1 : -1) * 14;
          this.audio.playStir();
          this.drag.mode = "done";
        } else if (hit.type === "oven") {
          this.ovenGlowBoost = 1.0;
          this.audio.playSoftChime();
          this._spawnParticles(OVEN_POS.x, OVEN_POS.y + 3, OVEN_POS.z + 2, 6, "star", "#ffd966");
          this.drag.mode = "done";
        } else if (hit.type === "knife") {
          this._doKnifeChop();
          this.drag.mode = "done";
        }
      }
    }

    _onPointerMove(e) {
      if (e.pointerId !== this.activePointerId || !this.drag) return;
      const rect = this.canvas.getBoundingClientRect();
      const { bx, by } = this.renderer.screenCssToBuf(e.clientX - rect.left, e.clientY - rect.top);
      const dx = bx - this.drag.lastBx;
      const dy = by - this.drag.lastBy;
      const totalDist = Math.hypot(bx - this.drag.startBx, by - this.drag.startBy);
      if (totalDist > 4) this.drag.moved = true;

      this.idleTime = 0;

      if (this.drag.mode === "rotate") {
        const dAng = -dx * 0.015;
        this.renderer.camAngle += dAng;
        this.camVel = dAng * 42;
      } else if (this.drag.mode === "food" && this.drag.moved) {
        const item = this.drag.target;
        if (item.zone === "basket") {
          this.basketRespawn[item.slotIndex] = 1.1;
        }
        item.zone = "drag";
        const w = this.renderer.bufToWorldOnZ(bx, by, COUNTER_Z + 14);
        item.x = clamp(w.wx, -62, 62);
        item.y = clamp(w.wy, -38, 38);
        item.z = COUNTER_Z + 14;
        this._mamaLookAt(item.x, item.y);
      } else if (this.drag.mode === "salt" && this.drag.moved) {
        const w = this.renderer.bufToWorldOnZ(bx, by, COUNTER_Z + 18);
        this.saltPos.x = clamp(w.wx, -55, 58);
        this.saltPos.y = clamp(w.wy, -35, 35);
        this.saltPos.z = COUNTER_Z + 18;
        this.saltTilt = 0.65 + Math.sin(this.time * 24) * 0.25;
        if (Math.hypot(dx, dy) > 1.2 && this.saltCooldown <= 0) {
          this._sprinkleSalt(this.saltPos.x, this.saltPos.y);
          this.saltCooldown = 0.16;
        }
      } else if (this.drag.mode === "ketchup" && this.drag.moved) {
        const w = this.renderer.bufToWorldOnZ(bx, by, COUNTER_Z + 18);
        this.ketchupPos.x = clamp(w.wx, -55, 58);
        this.ketchupPos.y = clamp(w.wy, -35, 35);
        this.ketchupPos.z = COUNTER_Z + 18;
        this.ketchupTilt = 0.72;
        if (this.ketchupCooldown <= 0) {
          this._squirtKetchup(this.ketchupPos.x, this.ketchupPos.y);
          this.ketchupCooldown = 0.22;
        }
      } else if (this.drag.mode === "ladle" && this.drag.moved) {
        const w = this.renderer.bufToWorldOnZ(bx, by, COUNTER_Z + 16);
        const distPot = dist2D(w.wx, w.wy, POT_POS.x, POT_POS.y);
        if (distPot < 17) {
          // Stirring inside the pot!
          const ang = Math.atan2(w.wy - POT_POS.y, w.wx - POT_POS.x);
          this.soup.swirlVel = clamp(this.soup.swirlVel + Math.hypot(dx, dy) * 0.55, 0, 12);
          this.soup.boilOver = Math.max(0, this.soup.boilOver - 0.12);
          this.ladlePos.x = POT_POS.x + Math.cos(ang) * 4.5;
          this.ladlePos.y = POT_POS.y + Math.sin(ang) * 4.5;
          this.ladlePos.z = POT_POS.z + 8;
          if (Math.hypot(dx, dy) > 2.2 && Math.random() < 0.28) {
            this.audio.playStir();
          }
        } else {
          // Carrying ladle with scooped custom soup to the soup bowl!
          this.ladleScoopColor = rgbToHex(...this.soup.rgb);
          this.ladlePos.x = clamp(w.wx, -45, 56);
          this.ladlePos.y = clamp(w.wy, -32, 32);
          this.ladlePos.z = COUNTER_Z + 18;
        }
      } else if (this.drag.mode === "pan" && this.drag.moved) {
        const w = this.renderer.bufToWorldOnZ(bx, by, COUNTER_Z + 14);
        this.panPos.x = clamp(w.wx, -30, 52);
        this.panPos.y = clamp(w.wy, -24, 28);
        this.panPos.z = COUNTER_Z + 12;
        // Move food inside pan along with pan!
        const panItems = this.foods.filter((f) => f.zone === "pan");
        panItems.forEach((f, idx) => {
          const a = idx * 2.1;
          const r = panItems.length === 1 ? 0 : 3.5;
          f.x = this.panPos.x + Math.cos(a) * r;
          f.y = this.panPos.y + Math.sin(a) * r;
          f.z = this.panPos.z + 2;
        });
        // Tilt slightly when near the plate to show pour affordance!
        if (dist2D(this.panPos.x, this.panPos.y, PLATE_POS.x, PLATE_POS.y) < 20) {
          this.panTilt = 0.55;
        } else {
          this.panTilt = 0.12;
        }
      }

      this.drag.lastBx = bx;
      this.drag.lastBy = by;
    }

    _onPointerUp(e) {
      if (e.pointerId !== this.activePointerId || !this.drag) return;
      const d = this.drag;
      this.activePointerId = null;
      this.drag = null;

      if (d.mode === "done" || d.mode === "rotate") return;

      if (d.mode === "food") {
        const item = d.target;
        if (!d.moved) {
          this._onFoodTap(item);
        } else {
          this._dropFood(item);
        }
      } else if (d.mode === "salt") {
        if (!d.moved) {
          this._sprinkleSalt(SALT_HOME.x, SALT_HOME.y);
        } else {
          this._sprinkleSalt(this.saltPos.x, this.saltPos.y);
        }
        this.saltPos = { ...SALT_HOME };
        this.saltTilt = 0;
      } else if (d.mode === "ketchup") {
        if (!d.moved) {
          this.audio.playKetchup();
          this._spawnParticles(KETCHUP_HOME.x, KETCHUP_HOME.y, KETCHUP_HOME.z + 20, 5, "dot", "#ff3b30");
        } else {
          this._squirtKetchup(this.ketchupPos.x, this.ketchupPos.y);
        }
        this.ketchupPos = { ...KETCHUP_HOME };
        this.ketchupTilt = 0;
      } else if (d.mode === "ladle") {
        if (!d.moved) {
          // Tap ladle -> playful stir swirl!
          this.soup.swirlVel = 8.5;
          this.soup.boilOver = Math.max(0, this.soup.boilOver - 0.5);
          this.audio.playStir();
          this._spawnParticles(POT_POS.x, POT_POS.y, POT_POS.z + 17, 6, "steam", "#fffdf5");
        } else if (dist2D(this.ladlePos.x, this.ladlePos.y, BOWL_POS.x, BOWL_POS.y) < 22) {
          this._pourSoupIntoBowl();
        }
        this.ladleScoopColor = null;
      } else if (d.mode === "pan") {
        if (!d.moved) {
          this._flipPan();
        } else if (dist2D(this.panPos.x, this.panPos.y, PLATE_POS.x, PLATE_POS.y) < 24) {
          this._slidePanOntoPlate();
        } else {
          // Even a quick flick-drag of the pan tosses the food!
          this._flipPan();
        }
        this.panPos = { ...PAN_POS };
        this.panTilt = 0;
      } else if (d.mode === "mama") {
        this._onMamaTap();
      }
    }

    _hitTest(bx, by) {
      const candidates = [];
      const add = (type, target, wx, wy, wz, radius, priority) => {
        const p = this.renderer.worldToBuf(wx, wy, wz);
        const dist = Math.hypot(bx - p.sx, by - p.sy);
        if (dist <= radius) {
          candidates.push({ type, target, dist, depth: p.depth, priority });
        }
      };

      // Stove knobs (front edge, very responsive!)
      add("knob_pan", null, KNOB_PAN_POS.x, KNOB_PAN_POS.y, KNOB_PAN_POS.z + 3, 13, 10);
      add("knob_pot", null, KNOB_POT_POS.x, KNOB_POT_POS.y, KNOB_POT_POS.z + 3, 13, 10);

      // Service Bell
      add("bell", null, BELL_POS.x, BELL_POS.y, BELL_POS.z + 6, 13, 9);

      // Active food items (board, pan, plate, basket) — always easy to grab & re-drag!
      for (const f of this.foods) {
        if (f.zone === "flying" || f.scale < 0.5) continue;
        const prio = f.zone === "board" ? 10 : f.zone === "plate" ? 9 : f.zone === "pan" ? 9 : 8;
        add("food", f, f.x, f.y, f.z + 6, 14, prio);
      }

      // Knife (tapping knife chops what's on the board!)
      add("knife", null, this.knifePos.x, this.knifePos.y, this.knifePos.z + 4, 13, 8);

      // Seasonings
      add("salt", null, this.saltPos.x, this.saltPos.y, this.saltPos.z + 9, 13, 8);
      add("ketchup", null, this.ketchupPos.x, this.ketchupPos.y, this.ketchupPos.z + 11, 13, 8);

      // Ladle / Pot stirring
      add("ladle", null, this.ladlePos.x, this.ladlePos.y, this.ladlePos.z + 9, 15, 7);
      add("ladle", null, POT_POS.x, POT_POS.y, POT_POS.z + 14, 13, 6);

      // Frying pan & front-facing handle
      add("pan", null, this.panPos.x, this.panPos.y + 13, this.panPos.z + 7, 14, 7);
      add("pan", null, this.panPos.x, this.panPos.y, this.panPos.z + 5, 13, 5);

      // Mama character
      add("mama", null, MAMA_POS.x, MAMA_POS.y, MAMA_POS.z + 24, 22, 6);

      // Playful cabinet details (towel & oven)
      add("towel", null, TOWEL_POS.x, TOWEL_POS.y, TOWEL_POS.z + 8, 12, 4);
      add("oven", null, OVEN_POS.x, OVEN_POS.y, OVEN_POS.z, 13, 3);

      if (!candidates.length) return null;
      candidates.sort((a, b) => (b.priority - a.priority) || (a.dist - b.dist));
      return candidates[0];
    }

    // -------------------------------------------------------------------------
    // Cooking & Toy Actions
    // -------------------------------------------------------------------------
    _onFoodTap(item) {
      if (item.zone === "basket") {
        // Hop cheerfully onto the Chopping Board (or straight to Frying Pan if board is busy!)
        const onBoard = this.foods.some((f) => f.zone === "board");
        this.basketRespawn[item.slotIndex] = 1.1;
        if (!onBoard) {
          this._launchArc(item, BOARD_POS.x, BOARD_POS.y, BOARD_POS.z, "board");
        } else {
          this._launchArc(item, PAN_POS.x + (Math.random() - 0.5) * 6, PAN_POS.y + (Math.random() - 0.5) * 6, PAN_POS.z + 2, "pan");
        }
        this._mamaLookAt(BOARD_POS.x, BOARD_POS.y);
      } else if (item.zone === "board") {
        // Tap ingredient on cutting board -> CHOP IT with the knife!
        this._chopItem(item);
      } else if (item.zone === "pan") {
        // Tap food in pan -> playful pan toss!
        this._flipPan();
      } else if (item.zone === "plate") {
        // Tap food on plate -> cute little jiggle + Mama peeks eagerly!
        item.hopTimer = 0.25;
        this.audio.playDrop("plate");
        this._mamaExcitedPeek();
      }
    }

    _launchArc(item, tx, ty, tz, targetZone) {
      item.zone = "flying";
      item.arcStart = { x: item.x, y: item.y, z: item.z };
      item.arcEnd = { x: tx, y: ty, z: tz };
      item.arcZone = targetZone;
      item.arcT = 0;
      this.audio.playPick();
    }

    _dropFood(item) {
      const dBoard = dist2D(item.x, item.y, BOARD_POS.x, BOARD_POS.y);
      const dPan = dist2D(item.x, item.y, PAN_POS.x, PAN_POS.y);
      const dPot = dist2D(item.x, item.y, POT_POS.x, POT_POS.y);
      const dPlate = dist2D(item.x, item.y, PLATE_POS.x, PLATE_POS.y);
      const dBowl = dist2D(item.x, item.y, BOWL_POS.x, BOWL_POS.y);

      // Pick the strictly closest valid station so drops near boundaries always snap cleanly!
      const targets = [
        { name: "pot",   d: dPot,   maxR: 18 },
        { name: "pan",   d: dPan,   maxR: 19 },
        { name: "plate", d: dPlate, maxR: 22 },
        { name: "board", d: dBoard, maxR: 20 },
      ];
      if (this.bowl.filled) {
        targets.push({ name: "bowl", d: dBowl, maxR: 13 });
      }
      targets.sort((a, b) => a.d - b.d);
      const chosen = targets[0];

      if (chosen.name === "pot" && chosen.d < chosen.maxR) {
        this._dropIntoPot(item);
        return;
      }
      if (chosen.name === "bowl" && chosen.d < chosen.maxR) {
        this._addFleckToBowl(item.kind);
        this.foods = this.foods.filter((f) => f.id !== item.id);
        this.audio.playDrop("soup");
        this._spawnParticles(BOWL_POS.x, BOWL_POS.y, BOWL_POS.z + 10, 7, "dot", "#fff6d6");
        this._mamaExcitedPeek();
        return;
      }
      if (chosen.name === "pan" && chosen.d < chosen.maxR) {
        item.zone = "pan";
        item.x = PAN_POS.x + clamp(item.x - PAN_POS.x, -5.5, 5.5);
        item.y = PAN_POS.y + clamp(item.y - PAN_POS.y, -5.5, 5.5);
        item.z = PAN_POS.z + 2;
        this.audio.playDrop("pan");
        if (item.kind === "egg" && item.chops === 0) {
          item.chops = 1;
          this.audio.playCrack();
          this._spawnParticles(item.x, item.y, item.z + 4, 7, "dot", "#fffef5");
        }
        if (this.panHeat > 0) {
          this._spawnParticles(item.x, item.y, item.z + 5, 6, "steam", "#ffffff");
        }
        this._mamaLookAt(PAN_POS.x, PAN_POS.y);
        return;
      }
      if (chosen.name === "plate" && chosen.d < chosen.maxR) {
        this._placeOnPlate(item);
        return;
      }
      if (chosen.name === "board" && chosen.d < chosen.maxR) {
        item.zone = "board";
        item.x = BOARD_POS.x + clamp(item.x - BOARD_POS.x, -5.5, 5.5);
        item.y = BOARD_POS.y + clamp(item.y - BOARD_POS.y, -4.5, 4.5);
        item.z = BOARD_POS.z;
        this.audio.playDrop("wood");
        this._mamaLookAt(BOARD_POS.x, BOARD_POS.y);
        return;
      }

      // Friendly magnetic fallback to nearest surface
      if (chosen.name === "plate") this._placeOnPlate(item);
      else if (chosen.name === "pan") {
        item.zone = "pan"; item.x = PAN_POS.x; item.y = PAN_POS.y; item.z = PAN_POS.z + 2;
        this.audio.playDrop("pan");
      } else {
        item.zone = "board"; item.x = BOARD_POS.x; item.y = BOARD_POS.y; item.z = BOARD_POS.z;
        this.audio.playDrop("wood");
      }
    }

    _doKnifeChop() {
      const boardItem = this.foods.find((f) => f.zone === "board");
      if (boardItem) {
        this._chopItem(boardItem);
      } else {
        // Playful practice chop on empty board!
        this.knifeChopTimer = 0.24;
        this.audio.playChop(0);
      }
    }

    _chopItem(item) {
      this.knifeChopTimer = 0.26;
      item.hopTimer = 0.22;
      const slot = BASKET_SLOTS.find((s) => s.kind === item.kind);
      const juiceCol = slot ? slot.col : "#ffaa44";

      if (item.kind === "egg") {
        if (item.chops === 0) {
          item.chops = 1;
          this.audio.playCrack();
          this._spawnParticles(item.x, item.y, item.z + 6, 9, "dot", "#fff8e8");
        } else {
          this.audio.playChop(1);
        }
      } else if (item.kind === "carrot") {
        if (item.chops < 2) {
          item.chops++;
          this.audio.playChop(item.chops);
          if (item.chops === 2) {
            // Surprise discovery: Flower-shaped carrot!!
            this.audio.playPopTransform();
            this._spawnParticles(item.x, item.y, item.z + 8, 8, "star", "#ffd24d");
          }
        } else {
          this.audio.playChop(2);
        }
      } else {
        if (item.chops < 1) {
          item.chops = 1;
        }
        this.audio.playChop(item.chops);
      }
      this._spawnParticles(item.x, item.y, item.z + 6, 7, "dot", juiceCol);
      this._mamaLookAt(BOARD_POS.x, BOARD_POS.y);
    }

    _toggleBurner(which) {
      if (which === "pan") {
        this.panHeat = (this.panHeat + 1) % 3;
        this.panKnobAnim = 0.22;
        this.audio.playKnob(this.panHeat);
        if (this.panHeat > 0) {
          this._spawnParticles(PAN_POS.x, PAN_POS.y, PAN_POS.z + 1, 6, "dot", "#4cc3ff");
          this._mamaLookAt(PAN_POS.x, PAN_POS.y);
        }
      } else {
        this.potHeat = (this.potHeat + 1) % 3;
        this.potKnobAnim = 0.22;
        this.audio.playKnob(this.potHeat);
        if (this.potHeat > 0) {
          this._spawnParticles(POT_POS.x, POT_POS.y, POT_POS.z + 1, 6, "dot", "#4cc3ff");
          this._mamaLookAt(POT_POS.x, POT_POS.y);
        } else {
          this.soup.boilOver = 0;
        }
      }
    }

    _flipPan() {
      this.panFlipTimer = 0.34;
      this.audio.playFlip();
      const panItems = this.foods.filter((f) => f.zone === "pan");
      panItems.forEach((f) => {
        f.vz = 58 + Math.random() * 14;
        f.spinVel = (Math.random() > 0.5 ? 1 : -1) * 11;
        if (this.panHeat > 0) {
          f.cookProgress += 0.24; // Flipping helps sear faster!
        }
      });
      if (panItems.length && this.panHeat > 0) {
        this._spawnParticles(PAN_POS.x, PAN_POS.y, PAN_POS.z + 8, 8, "star", "#ffd966");
      }
    }

    _slidePanOntoPlate() {
      const panItems = this.foods.filter((f) => f.zone === "pan");
      if (!panItems.length) {
        this.audio.playDrop("pan");
        return;
      }
      panItems.forEach((f) => this._placeOnPlate(f));
      this.audio.playFlip();
    }

    _dropIntoPot(item) {
      const slot = BASKET_SLOTS.find((s) => s.kind === item.kind);
      const rgb = slot ? slot.soupRgb : [230, 160, 90];
      const w = 0.36;
      this.soup.rgb = [
        this.soup.rgb[0] * (1 - w) + rgb[0] * w,
        this.soup.rgb[1] * (1 - w) + rgb[1] * w,
        this.soup.rgb[2] * (1 - w) + rgb[2] * w,
      ];
      this.soup.amount = Math.min(1.0, this.soup.amount + 0.14);
      this.soup.ingredients.push(item.kind);
      if (this.soup.flecks.length < 14) {
        this.soup.flecks.push({
          a: Math.random() * Math.PI * 2,
          r: 1.5 + Math.random() * 5.0,
          col: slot ? slot.col : "#ffffff",
        });
      }
      this.soup.swirlVel = Math.max(this.soup.swirlVel, 4.5);
      this.foods = this.foods.filter((f) => f.id !== item.id);
      this.audio.playDrop("soup");
      this._spawnParticles(POT_POS.x, POT_POS.y, POT_POS.z + 15, 10, "dot", rgbToHex(...this.soup.rgb));
      this._mamaLookAt(POT_POS.x, POT_POS.y);
      if (this.soup.ingredients.length >= 2 && this.potHeat > 0) {
        this.mama.emote = "sniff";
        this.mama.emoteTimer = 2.4;
      }
    }

    _addFleckToBowl(kind) {
      const slot = BASKET_SLOTS.find((s) => s.kind === kind);
      this.bowl.flecks.push({
        a: Math.random() * Math.PI * 2,
        r: 1.2 + Math.random() * 3.5,
        col: slot ? slot.col : "#fff",
      });
    }

    _pourSoupIntoBowl() {
      this.bowl.filled = true;
      this.bowl.rgb = [...this.soup.rgb];
      this.bowl.flecks = this.soup.flecks.slice(0, 8).map((f) => ({ ...f }));
      this.bowl.saltCount = this.soup.saltCount;
      this.ladlePourAnim = 0.45;
      this.audio.playDrop("soup");
      this._spawnParticles(BOWL_POS.x, BOWL_POS.y, BOWL_POS.z + 12, 10, "dot", rgbToHex(...this.soup.rgb));
      this._spawnParticles(BOWL_POS.x, BOWL_POS.y, BOWL_POS.z + 14, 5, "steam", "#ffffff");
      this._mamaExcitedPeek();
    }

    _sprinkleSalt(wx, wy) {
      this.audio.playSalt();
      this._spawnParticles(wx, wy, COUNTER_Z + 12, 8, "dot", "#ffffff");
      this._spawnParticles(wx, wy, COUNTER_Z + 12, 4, "dot", "#a0a8b8");

      // Season nearby foods or pot!
      if (dist2D(wx, wy, POT_POS.x, POT_POS.y) < 18) {
        this.soup.saltCount++;
      }
      for (const f of this.foods) {
        if ((f.zone === "pan" || f.zone === "plate" || f.zone === "board") && dist2D(wx, wy, f.x, f.y) < 18) {
          f.salted++;
          this._spawnParticles(f.x, f.y, f.z + 8, 3, "star", "#ffffff");
        }
      }
    }

    _squirtKetchup(wx, wy) {
      this.audio.playKetchup();
      this._spawnParticles(wx, wy, COUNTER_Z + 11, 5, "dot", "#f02c24");
      // Land cute red ketchup dots on any food below!
      let hitFood = null;
      let bestD = 18;
      for (const f of this.foods) {
        if (f.zone === "plate" || f.zone === "pan" || f.zone === "board") {
          const d = dist2D(wx, wy, f.x, f.y);
          if (d < bestD) {
            bestD = d;
            hitFood = f;
          }
        }
      }
      if (hitFood && hitFood.ketchupDots.length < 7) {
        hitFood.ketchupDots.push({
          ox: (Math.random() - 0.5) * 6,
          oy: (Math.random() - 0.5) * 6,
        });
      }
    }

    _placeOnPlate(item) {
      const plated = this.foods.filter((f) => f.zone === "plate" && f.id !== item.id);
      item.zone = "plate";
      item.plateIndex = plated.length;

      // Stack food vertically in a charming wobbly pile!
      let stackZ = PLATE_POS.z;
      for (const p of plated) {
        stackZ += Math.max(4.5, foodHeight(p) * 0.62);
      }

      if (plated.length >= 6) {
        // Super-tall food tower tumbles playfully to the side rim!
        const ang = Math.random() * Math.PI * 2;
        item.x = PLATE_POS.x + Math.cos(ang) * 7.5;
        item.y = PLATE_POS.y + Math.sin(ang) * 7.5;
        item.z = PLATE_POS.z + 2;
        item.hopTimer = 0.3;
        this.audio.playSurprised();
        this.mama.expr = "surprised";
        this.mama.exprTimer = 1.6;
        this.mama.emote = "whoa";
        this.mama.emoteTimer = 1.6;
      } else {
        const spiralA = plated.length * 1.9;
        const spread = plated.length === 0 ? 0 : Math.min(3.2, plated.length * 0.7);
        item.x = PLATE_POS.x + Math.cos(spiralA) * spread;
        item.y = PLATE_POS.y + Math.sin(spiralA) * spread;
        item.z = stackZ;
        item.hopTimer = 0.22;
        this.audio.playDrop("plate");
        this._mamaExcitedPeek();
      }
    }

    _mamaLookAt(wx, wy) {
      if (this.mama.eating) return;
      const dx = wx - MAMA_POS.x;
      const dy = wy - MAMA_POS.y;
      const desired = Math.atan2(-dx, dy);
      let diff = desired - MAMA_BASE_ANGLE;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mama.targetYawOffset = clamp(diff, -0.55, 0.55);
    }

    _mamaExcitedPeek() {
      if (this.mama.eating) return;
      this._mamaLookAt(PLATE_POS.x, PLATE_POS.y);
      this.mama.expr = "star";
      this.mama.exprTimer = 2.0;
      this.mama.emote = "star";
      this.mama.emoteTimer = 1.8;
      this.mama.bounce = 1.0;
      this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 48, 4, "star", "#ffe042");
    }

    _ringBell() {
      this.bellBounce = 1.0;
      this.audio.playBell();
      this._spawnParticles(BELL_POS.x, BELL_POS.y, BELL_POS.z + 12, 6, "star", "#ffe473");
      this._startMamaTasting();
    }

    _onMamaTap() {
      const plated = this.foods.filter((f) => f.zone === "plate");
      if (plated.length > 0 || this.bowl.filled) {
        this._startMamaTasting();
      } else {
        // Warm friendly greeting wave/giggle + glance at plate
        this.audio.playSoftChime();
        this.mama.expr = "happy";
        this.mama.exprTimer = 1.4;
        this.mama.emote = "heart";
        this.mama.emoteTimer = 1.3;
        this.mama.bounce = 0.8;
        this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 50, 3, "heart", "#ff6680");
      }
    }

    _startMamaTasting() {
      if (this.mama.eating) return;
      const plated = this.foods.filter((f) => f.zone === "plate").sort((a, b) => b.z - a.z);
      if (plated.length === 0 && !this.bowl.filled) {
        // Nothing served yet -> cute curious bounce!
        this.mama.expr = "idle";
        this.mama.emote = "bell";
        this.mama.emoteTimer = 1.2;
        this.mama.bounce = 0.6;
        return;
      }

      // Analyze the chef's creation for unique wordless reactions!
      const hasTako = plated.some((f) => foodModelName(f) === "wiener_tako");
      const hasFlower = plated.some((f) => foodModelName(f) === "carrot_flower" || (f.kind === "carrot" && f.chops >= 2));
      const hasCooked = plated.some((f) => f.cooked >= 1);
      const hasKetchup = plated.some((f) => f.ketchupDots.length > 0);
      const totalSalt = plated.reduce((s, f) => s + f.salted, 0) + (this.bowl.filled ? this.bowl.saltCount : 0);
      const isTower = plated.length >= 4;
      const isFullMeal = plated.length > 0 && this.bowl.filled;

      this.mama.eating = true;
      this.mama.eatQueue = plated.map((f) => ({ type: "food", item: f }));
      if (this.bowl.filled) {
        this.mama.eatQueue.push({ type: "soup" });
      }
      this.mama.mealSummary = { hasTako, hasFlower, hasCooked, hasKetchup, totalSalt, isTower, isFullMeal };
      this.mama.eatStepTimer = 0.55;
      this._mamaLookAt(PLATE_POS.x, PLATE_POS.y);

      if (isTower) {
        this.mama.expr = "surprised";
        this.mama.emote = "whoa";
        this.mama.emoteTimer = 1.2;
        this.audio.playSurprised();
      } else {
        this.mama.expr = "star";
        this.mama.emote = "star";
        this.mama.emoteTimer = 1.2;
      }
      this.mama.bounce = 1.0;
    }

    _finishMamaTasting() {
      const m = this.mama.mealSummary || {};
      this.mama.eating = false;
      this.mama.lean = 0;

      if (m.totalSalt >= 5) {
        // Funny super-salty reaction (affectionate & silly!)
        this.mama.expr = "surprised";
        this.mama.exprTimer = 2.4;
        this.mama.emote = "whoa";
        this.mama.emoteTimer = 2.4;
        this.audio.playSurprised();
        this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 52, 6, "dot", "#7dd6ff");
      } else if (m.isFullMeal || m.hasTako || m.hasFlower) {
        // Grand celebration!
        this.mama.expr = "star";
        this.mama.exprTimer = 3.2;
        this.mama.emote = "heart";
        this.mama.emoteTimer = 3.2;
        this.mama.bounce = 1.4;
        this.audio.playHappyFanfare(true);
        this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 50, 8, "heart", "#ff4d6a");
        this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 54, 10, "star", "#ffe042");
        this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 48, 5, "note", "#ff8c42");
      } else {
        this.mama.expr = m.hasCooked || m.hasKetchup ? "happy" : "giggle";
        this.mama.exprTimer = 2.8;
        this.mama.emote = m.hasKetchup ? "heart" : "note";
        this.mama.emoteTimer = 2.8;
        this.mama.bounce = 1.2;
        this.audio.playHappyFanfare(false);
        this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 50, 6, "heart", "#ff5c77");
        this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 52, 5, "star", "#ffe042");
      }

      // Plate shines clean!
      this._spawnParticles(PLATE_POS.x, PLATE_POS.y, PLATE_POS.z + 5, 5, "star", "#ffffff");
    }

    // -------------------------------------------------------------------------
    // Particles Helper
    // -------------------------------------------------------------------------
    _spawnParticles(x, y, z, count, kind, col) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = kind === "steam" ? (2 + Math.random() * 4) : (10 + Math.random() * 20);
        this.particles.push({
          x: x + (Math.random() - 0.5) * 4,
          y: y + (Math.random() - 0.5) * 4,
          z,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          vz: kind === "steam" || kind === "heart" || kind === "note" ? (14 + Math.random() * 14) : (22 + Math.random() * 24),
          gravity: (kind === "steam" || kind === "heart" || kind === "note" || kind === "star") ? -4 : 95,
          life: kind === "heart" || kind === "note" ? 1.25 : (kind === "steam" ? 0.95 : 0.55),
          maxLife: kind === "heart" || kind === "note" ? 1.25 : (kind === "steam" ? 0.95 : 0.55),
          kind,
          col,
          size: kind === "steam" ? 2 : 2,
          fade: true,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Main Simulation Update (dt in seconds)
    // -------------------------------------------------------------------------
    _update(dt) {
      this.time += dt;
      this.idleTime += dt;

      // Gentle opening reveal rotation (only on very first 1.2s)
      if (this.introSpin > 0) {
        const step = Math.min(this.introSpin, dt * 0.25);
        this.renderer.camAngle += step * 0.35;
        this.introSpin -= step;
      }

      // Silky camera rotation inertia
      if ((!this.drag || this.drag.mode !== "rotate") && Math.abs(this.camVel) > 0.002) {
        this.renderer.camAngle += this.camVel * dt;
        this.camVel *= Math.pow(0.05, dt);
      }

      // Cooldowns & spring animations
      this.saltCooldown = Math.max(0, this.saltCooldown - dt);
      this.ketchupCooldown = Math.max(0, this.ketchupCooldown - dt);
      this.panKnobAnim = Math.max(0, this.panKnobAnim - dt);
      this.potKnobAnim = Math.max(0, this.potKnobAnim - dt);
      this.panFlipTimer = Math.max(0, this.panFlipTimer - dt);
      this.knifeChopTimer = Math.max(0, this.knifeChopTimer - dt);
      this.ladlePourAnim = Math.max(0, this.ladlePourAnim - dt);
      this.ovenGlowBoost = Math.max(0, this.ovenGlowBoost - dt * 1.4);
      this.bellBounce = Math.max(0, this.bellBounce - dt * 3.5);

      // Hanging checkered towel spring physics
      this.towelVel += -this.towelSway * 38 * dt;
      this.towelVel *= Math.pow(0.18, dt);
      this.towelSway += this.towelVel * dt;

      // Basket gentle replenishment
      for (const key of Object.keys(this.basketRespawn)) {
        this.basketRespawn[key] -= dt;
        if (this.basketRespawn[key] <= 0) {
          delete this.basketRespawn[key];
          this._spawnBasketItem(Number(key), false);
        }
      }

      // Update foods: spawn pop-in, arc flight, pan flip gravity, cooking!
      let sizzlingCount = 0;
      for (const f of this.foods) {
        if (f.scale < 1) {
          f.scale = Math.min(1, f.scale + dt * 4.2);
        }
        if (f.hopTimer > 0) {
          f.hopTimer = Math.max(0, f.hopTimer - dt);
        }

        if (f.zone === "flying") {
          f.arcT = Math.min(1, f.arcT + dt * 3.4);
          const t = f.arcT;
          f.x = f.arcStart.x + (f.arcEnd.x - f.arcStart.x) * t;
          f.y = f.arcStart.y + (f.arcEnd.y - f.arcStart.y) * t;
          f.z = f.arcStart.z + (f.arcEnd.z - f.arcStart.z) * t + Math.sin(t * Math.PI) * 20;
          if (f.arcT >= 1) {
            f.zone = f.arcZone;
            if (f.zone === "board") this.audio.playDrop("wood");
            else if (f.zone === "pan") {
              this.audio.playDrop("pan");
              if (f.kind === "egg" && f.chops === 0) {
                f.chops = 1;
                this.audio.playCrack();
              }
            }
          }
        } else if (f.zone === "pan") {
          // Vertical bounce physics from pan flips!
          if (f.z > PAN_POS.z + 2 || f.vz !== 0) {
            f.vz -= 220 * dt;
            f.z += f.vz * dt;
            f.angle += f.spinVel * dt;
            if (f.z <= PAN_POS.z + 2) {
              f.z = PAN_POS.z + 2;
              f.vz = 0;
              f.spinVel = 0;
              this.audio.playDrop("pan");
            }
          }
          // Cooking on hot burner!
          if (this.panHeat > 0) {
            sizzlingCount++;
            const rate = this.panHeat === 2 ? 0.34 : 0.17;
            const prevCooked = f.cooked;
            f.cookProgress += rate * dt;
            if (f.cookProgress >= 1.0 && prevCooked === 0) {
              f.cooked = 1;
              f.vz = 26; // Cute done-pop!
              this.audio.playPopTransform();
              this._spawnParticles(f.x, f.y, f.z + 7, 8, "star", "#ffe042");
              if (!this.mama.eating) {
                this.mama.emote = "sniff";
                this.mama.emoteTimer = 2.0;
                this._mamaLookAt(PAN_POS.x, PAN_POS.y);
              }
            }
            // Sizzle steam & tiny golden sparks
            if (Math.random() < (this.panHeat === 2 ? 0.24 : 0.11)) {
              this._spawnParticles(f.x, f.y, f.z + 5, 1, "steam", "#ffffff");
            }
            if (f.cookProgress > 2.6 && Math.random() < 0.08) {
              // Extra toasty playful comic puff (never punishing!)
              this._spawnParticles(f.x, f.y, f.z + 6, 1, "steam", "#b8afa2");
            }
          }
        }
      }

      // Soup pot simmer, stirring & playful boil-over!
      this.soup.swirlAngle += (0.5 + this.soup.swirlVel) * dt;
      this.soup.swirlVel *= Math.pow(0.18, dt);
      if (!this.drag || this.drag.mode !== "ladle") {
        // Ladle rests & gently drifts with swirl inside pot
        const la = this.soup.swirlAngle * 0.45 + 0.6;
        const targetLx = POT_POS.x + Math.cos(la) * 3.5;
        const targetLy = POT_POS.y + Math.sin(la) * 3.5;
        const targetLz = POT_POS.z + 8;
        this.ladlePos.x += (targetLx - this.ladlePos.x) * Math.min(1, dt * 8);
        this.ladlePos.y += (targetLy - this.ladlePos.y) * Math.min(1, dt * 8);
        this.ladlePos.z += (targetLz - this.ladlePos.z) * Math.min(1, dt * 8);
      }

      if (this.potHeat > 0) {
        const targetBoil = this.potHeat === 2 ? 1.0 : 0.45;
        this.soup.boilLevel += (targetBoil - this.soup.boilLevel) * Math.min(1, dt * 1.8);
        if (Math.random() < this.soup.boilLevel * 0.22) {
          this._spawnParticles(POT_POS.x, POT_POS.y, POT_POS.z + 16, 1, "steam", "#ffffff");
        }
        // High heat builds playful foamy boil-over if unstirred!
        if (this.potHeat === 2 && this.soup.swirlVel < 1.5) {
          this.soup.boilOver = Math.min(1.0, this.soup.boilOver + dt * 0.12);
          if (this.soup.boilOver > 0.65 && Math.random() < 0.22) {
            const ang = Math.random() * Math.PI * 2;
            this._spawnParticles(
              POT_POS.x + Math.cos(ang) * 9,
              POT_POS.y + Math.sin(ang) * 9,
              POT_POS.z + 18,
              1,
              "steam",
              "#fffaf0"
            );
          }
        } else {
          this.soup.boilOver = Math.max(0, this.soup.boilOver - dt * 0.35);
        }
      } else {
        this.soup.boilLevel = Math.max(0, this.soup.boilLevel - dt * 1.5);
        this.soup.boilOver = Math.max(0, this.soup.boilOver - dt * 0.8);
      }

      // Steaming served soup bowl
      if (this.bowl.filled && Math.random() < 0.08) {
        this._spawnParticles(BOWL_POS.x, BOWL_POS.y, BOWL_POS.z + 10, 1, "steam", "#ffffff");
      }

      // Continuous kitchen soundscape
      const sizzleAmt = this.panHeat > 0 ? (0.2 + Math.min(1, sizzlingCount * 0.45)) * (this.panHeat === 2 ? 1.0 : 0.55) : 0;
      this.audio.updateLoops(dt, sizzleAmt, this.soup.boilLevel);

      // Mama animation & tasting sequence
      this.mama.headYawOffset += (this.mama.targetYawOffset - this.mama.headYawOffset) * Math.min(1, dt * 6);
      this.mama.bounce = Math.max(0, this.mama.bounce - dt * 2.4);

      if (this.mama.eating) {
        this.mama.lean = Math.min(1, this.mama.lean + dt * 4);
        this.mama.eatStepTimer -= dt;
        if (this.mama.eatStepTimer <= 0) {
          const next = this.mama.eatQueue.shift();
          if (next) {
            this.mama.expr = "munch";
            this.mama.bounce = 0.7;
            this.audio.playMunch();
            if (next.type === "food") {
              const f = next.item;
              const slot = BASKET_SLOTS.find((s) => s.kind === f.kind);
              this._spawnParticles(f.x, f.y, f.z + 4, 6, "dot", slot ? slot.col : "#ffbb66");
              this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 48, 2, "heart", "#ff5c77");
              this.foods = this.foods.filter((x) => x.id !== f.id);
            } else if (next.type === "soup") {
              this._spawnParticles(BOWL_POS.x, BOWL_POS.y, BOWL_POS.z + 9, 7, "dot", rgbToHex(...this.bowl.rgb));
              this._spawnParticles(MAMA_POS.x, MAMA_POS.y, 48, 3, "star", "#ffe042");
              this.bowl.filled = false;
              this.bowl.flecks = [];
            }
            this.mama.eatStepTimer = 0.58;
          } else {
            this._finishMamaTasting();
          }
        }
      } else {
        this.mama.lean = Math.max(0, this.mama.lean - dt * 4);
        if (this.mama.exprTimer > 0) {
          this.mama.exprTimer -= dt;
          if (this.mama.exprTimer <= 0) this.mama.expr = "idle";
        }
        if (this.mama.emoteTimer > 0) {
          this.mama.emoteTimer -= dt;
          if (this.mama.emoteTimer <= 0) this.mama.emote = null;
        }
      }

      // Gentle late idle invitation (>10s untouched: next natural item gives one subtle playful hop!)
      if (this.idleTime > 10.0) {
        this.idleTime = 4.0;
        const plated = this.foods.filter((f) => f.zone === "plate");
        const onBoard = this.foods.find((f) => f.zone === "board");
        const inPan = this.foods.find((f) => f.zone === "pan");
        if (plated.length > 0 || this.bowl.filled) {
          this.bellBounce = 0.85;
          this.mama.emote = "bell";
          this.mama.emoteTimer = 1.6;
        } else if (inPan && this.panHeat === 0) {
          this.panKnobAnim = 0.35;
        } else if (onBoard) {
          onBoard.hopTimer = 0.25;
        } else {
          const sample = this.foods.find((f) => f.zone === "basket" && f.kind === "tomato");
          if (sample) sample.hopTimer = 0.28;
        }
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life -= dt;
        if (pt.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
        pt.vz -= pt.gravity * dt;
        if (pt.z < 2) {
          pt.z = 2;
          pt.vz *= -0.3;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Depth-Sorted 360° Sprite-Stacking Render Pass
    // -------------------------------------------------------------------------
    _render() {
      const r = this.renderer;
      r.drawBackdrop(this.time);

      // Compare depth of Kitchen Island vs Mama so 360° rotation occludes cleanly!
      const islandDepth = r.worldToBuf(0, 0, 0).depth;
      const mamaDepth = r.worldToBuf(MAMA_POS.x, MAMA_POS.y, 0).depth;

      const drawMama = () => {
        const bOff = Math.sin(this.mama.bounce * Math.PI) * 4.5 + Math.sin(this.time * 2.6) * 0.4;
        const leanX = -this.mama.lean * 0.22;
        const bodyAng = MAMA_BASE_ANGLE;
        const headAng = MAMA_BASE_ANGLE + this.mama.headYawOffset;

        r.drawStack("mama_body", MAMA_POS.x, MAMA_POS.y, MAMA_POS.z + bOff * 0.5, {
          objAngle: bodyAng,
          tiltX: leanX * Math.cos(r.camAngle),
        });
        const headName = "mama_head_" + (this.mama.expr || "idle");
        r.drawStack(headName, MAMA_POS.x - this.mama.lean * 2.5, MAMA_POS.y, MAMA_POS.z + 24 + bOff, {
          objAngle: headAng,
          tiltX: leanX * Math.cos(r.camAngle),
        });

        if (this.mama.emote) {
          r.drawEmoteBubble(
            MAMA_POS.x,
            MAMA_POS.y,
            MAMA_POS.z + 55 + bOff,
            this.mama.emote,
            Math.sin(this.time * 5.2) * 1.5
          );
        }
      };

      const drawIslandAndCounter = () => {
        // 1. Kitchen Island base (42 slices!)
        r.drawStack("island", 0, 0, 0);

        // Warm oven pulse glow overlay on front window when tapped!
        if (this.ovenGlowBoost > 0.02) {
          const p = r.worldToBuf(OVEN_POS.x, OVEN_POS.y + 1, OVEN_POS.z);
          const ctx = r.bufCtx;
          ctx.save();
          ctx.globalAlpha = this.ovenGlowBoost * 0.45;
          ctx.fillStyle = "#ffcf54";
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 2. Side-mounted & front-mounted island attachments (towel + 2 clickable stove knobs!)
        const sideQueue = [
          {
            depth: r.worldToBuf(TOWEL_POS.x, TOWEL_POS.y, TOWEL_POS.z).depth,
            draw: () => r.drawStack("towel", TOWEL_POS.x, TOWEL_POS.y, TOWEL_POS.z, {
              tiltX: Math.sin(this.towelSway) * 0.16,
            }),
          },
          {
            depth: r.worldToBuf(KNOB_PAN_POS.x, KNOB_PAN_POS.y, KNOB_PAN_POS.z).depth,
            draw: () => {
              const s = 1 + Math.sin(this.panKnobAnim * Math.PI * 4) * 0.14;
              r.drawStack("knob_red", KNOB_PAN_POS.x, KNOB_PAN_POS.y, KNOB_PAN_POS.z, {
                objAngle: this.panHeat * 1.15,
                scale: s,
              });
            },
          },
          {
            depth: r.worldToBuf(KNOB_POT_POS.x, KNOB_POT_POS.y, KNOB_POT_POS.z).depth,
            draw: () => {
              const s = 1 + Math.sin(this.potKnobAnim * Math.PI * 4) * 0.14;
              r.drawStack("knob_yellow", KNOB_POT_POS.x, KNOB_POT_POS.y, KNOB_POT_POS.z, {
                objAngle: this.potHeat * 1.15,
                scale: s,
              });
            },
          },
        ];
        // Draw only side/front items that are in front of the island core (or always sort cleanly)
        for (const sq of sideQueue) {
          if (sq.depth >= islandDepth - 36) sq.draw();
        }

        // 3. Animated gas burner flames right on top of the cast-iron grates!
        r.drawBurnerFlame(PAN_POS.x, PAN_POS.y, 41, this.panHeat, this.time);
        r.drawBurnerFlame(POT_POS.x, POT_POS.y, 41, this.potHeat, this.time);

        // 4. All countertop objects sorted cleanly back-to-front by camera depth!
        const items = [];
        const pushObj = (wx, wy, wz, drawFn, bias = 0) => {
          items.push({
            depth: r.worldToBuf(wx, wy, wz).depth + bias,
            draw: drawFn,
          });
        };

        // Wooden Ingredient Tray (low tray sits underneath all 6 ingredients inside!)
        pushObj(-39, 2, COUNTER_Z, () => {
          r.drawStack("basket", -39, 2, COUNTER_Z);
        }, -24);

        // Chopping board
        pushObj(BOARD_POS.x, BOARD_POS.y, COUNTER_Z, () => {
          r.drawStack("board", BOARD_POS.x, BOARD_POS.y, COUNTER_Z);
        }, -3);

        // Kitchen knife (lifts & chops onto board when active!)
        pushObj(this.knifePos.x, this.knifePos.y, this.knifePos.z, () => {
          let kx = this.knifePos.x;
          let ky = this.knifePos.y;
          let kz = this.knifePos.z;
          let ktilt = 0;
          if (this.knifeChopTimer > 0) {
            const p = this.knifeChopTimer / 0.26; // 1 -> 0
            kx = BOARD_POS.x + 5;
            ky = BOARD_POS.y;
            kz = BOARD_POS.z + (p > 0.45 ? (p - 0.45) * 26 : 1);
            ktilt = p > 0.45 ? -0.35 : 0.15;
          }
          r.drawStack("knife", kx, ky, kz, { objAngle: 0.08, tiltY: ktilt });
        }, 4);

        // Frying Pan (handle pointing cleanly forward above red knob — zero overlap!)
        pushObj(this.panPos.x, this.panPos.y, this.panPos.z, () => {
          const flipT = this.panFlipTimer > 0 ? Math.sin((this.panFlipTimer / 0.34) * Math.PI) : 0;
          const pz = this.panPos.z + flipT * 5.5;
          r.drawStack("pan", this.panPos.x, this.panPos.y, pz, {
            objAngle: 1.52, // Handle sticks cleanly forward toward front edge!
            tiltX: this.panTilt + flipT * 0.35,
          });
        }, -2);

        // Coral-Red Enamel Soup Pot + dynamic color-blended soup surface + wooden ladle!
        pushObj(POT_POS.x, POT_POS.y, POT_POS.z, () => {
          // Lower pot body (z=0..16)
          r.drawStack("pot", POT_POS.x, POT_POS.y, POT_POS.z, { zStart: 0, zEnd: 17 });
          // Dynamic swirling soup surface inside hollow pot!
          const soupZ = POT_POS.z + 11 + this.soup.amount * 4.2 + this.soup.boilOver * 2.2;
          r.drawSoupSurface(
            POT_POS.x,
            POT_POS.y,
            soupZ,
            7.8,
            rgbToHex(...this.soup.rgb),
            this.soup.swirlAngle,
            this.soup.boilLevel,
            this.soup.flecks,
            this.time
          );
          // Foamy boil-over ring around rim if bubbling high (keeps colorful soup visible in center!)
          if (this.soup.boilOver > 0.45) {
            const p = r.worldToBuf(POT_POS.x, POT_POS.y, POT_POS.z + 18.2);
            const ctx = r.bufCtx;
            ctx.save();
            ctx.translate(p.sx, p.sy);
            ctx.scale(1, r.tilt);
            ctx.rotate(r.camAngle);
            ctx.strokeStyle = "rgba(255, 250, 236, 0.88)";
            ctx.lineWidth = 2.2 + this.soup.boilOver * 1.4;
            ctx.beginPath();
            ctx.arc(0, 0, 7.6 + this.soup.boilOver * 0.8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          // Upper white pot rim (z=17..20)
          r.drawStack("pot", POT_POS.x, POT_POS.y, POT_POS.z, { zStart: 17, zEnd: 20 });
        }, 0);

        // Wooden Ladle (drawn cleanly above pot/bowl)
        pushObj(this.ladlePos.x, this.ladlePos.y, this.ladlePos.z, () => {
          const isCarried = this.drag && this.drag.mode === "ladle" && this.drag.moved;
          r.drawStack("ladle", this.ladlePos.x, this.ladlePos.y, this.ladlePos.z, {
            objAngle: this.soup.swirlAngle * 0.45 + 0.4,
            tiltX: this.ladlePourAnim > 0 ? 0.55 : (isCarried ? 0.18 : 0),
          });
          if (this.ladleScoopColor) {
            r.drawSoupSurface(this.ladlePos.x, this.ladlePos.y, this.ladlePos.z + 4, 2.8, this.ladleScoopColor, 0, 0, [], this.time);
          }
        }, 6);

        // Salt Shaker & Ketchup Bottle
        pushObj(this.saltPos.x, this.saltPos.y, this.saltPos.z, () => {
          if (this.saltPos.z > COUNTER_Z + 2) {
            r.drawShadowEllipse(this.saltPos.x, this.saltPos.y, COUNTER_Z + 1, 5, 5, 0.22);
          }
          r.drawStack("salt", this.saltPos.x, this.saltPos.y, this.saltPos.z, {
            tiltX: this.saltTilt,
          });
        }, this.saltPos.z > COUNTER_Z + 2 ? 25 : 0);

        pushObj(this.ketchupPos.x, this.ketchupPos.y, this.ketchupPos.z, () => {
          if (this.ketchupPos.z > COUNTER_Z + 2) {
            r.drawShadowEllipse(this.ketchupPos.x, this.ketchupPos.y, COUNTER_Z + 1, 5, 5, 0.22);
          }
          r.drawStack("ketchup", this.ketchupPos.x, this.ketchupPos.y, this.ketchupPos.z, {
            tiltX: this.ketchupTilt,
          });
        }, this.ketchupPos.z > COUNTER_Z + 2 ? 25 : 0);

        // Serving Plate
        pushObj(PLATE_POS.x, PLATE_POS.y, COUNTER_Z, () => {
          r.drawStack("plate", PLATE_POS.x, PLATE_POS.y, COUNTER_Z);
        }, -3);

        // Serving Soup Bowl + dynamic poured soup inside!
        pushObj(BOWL_POS.x, BOWL_POS.y, COUNTER_Z, () => {
          r.drawStack("bowl", BOWL_POS.x, BOWL_POS.y, COUNTER_Z, { zStart: 0, zEnd: 10 });
          if (this.bowl.filled) {
            r.drawSoupSurface(
              BOWL_POS.x,
              BOWL_POS.y,
              COUNTER_Z + 8.5,
              6.6,
              rgbToHex(...this.bowl.rgb),
              this.time * 0.4,
              0.15,
              this.bowl.flecks,
              this.time
            );
          }
          r.drawStack("bowl", BOWL_POS.x, BOWL_POS.y, COUNTER_Z, { zStart: 10, zEnd: 12 });
        }, -1);

        // Shiny Brass Service Bell
        pushObj(BELL_POS.x, BELL_POS.y, BELL_POS.z, () => {
          const sq = 1 - Math.sin(this.bellBounce * Math.PI) * 0.16;
          r.drawStack("bell", BELL_POS.x, BELL_POS.y, BELL_POS.z, { squashZ: sq });
        }, 1);

        // All Food Items!
        for (const f of this.foods) {
          const isElevated = f.zone === "drag" || f.zone === "flying";
          const bias = isElevated ? 30 : (f.zone === "plate" ? f.plateIndex * 2.5 + 1 : 2);
          pushObj(f.x, f.y, f.z, () => {
            const hopZ = f.hopTimer > 0 ? Math.sin((f.hopTimer / 0.25) * Math.PI) * 7 : 0;
            // Subtle wobbly sway on tall plate towers!
            const sway = (f.zone === "plate" && f.plateIndex >= 2)
              ? Math.sin(this.time * 3.8 + f.stackSwayPhase) * (f.plateIndex * 0.22)
              : 0;
            if (isElevated) {
              r.drawShadowEllipse(f.x, f.y, COUNTER_Z + 1, 6, 6, 0.24);
            }
            const model = foodModelName(f);
            r.drawStack(model, f.x + sway, f.y, f.z + hopZ, {
              objAngle: f.angle,
              scale: f.scale,
            });
            // Glossy red ketchup dots on top of food!
            if (f.ketchupDots.length) {
              r.drawKetchupOnFood(f.x + sway, f.y, f.z + hopZ + foodHeight(f), f.ketchupDots);
            }
          }, bias);
        }

        items.sort((a, b) => a.depth - b.depth);
        for (const it of items) it.draw();
      };

      // Clean 360° painter's order between Mama & Kitchen Island
      if (mamaDepth < islandDepth) {
        drawMama();
        drawIslandAndCounter();
      } else {
        drawIslandAndCounter();
        drawMama();
      }

      // Crisp pixel particles on top
      r.drawParticles(this.particles);

      // Blit low-res pixel buffer crisply to display canvas!
      r.present();
    }

    _loop(ts) {
      const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
      this.lastTs = ts;
      this._update(dt);
      this._render();
      requestAnimationFrame((t) => this._loop(t));
    }
  }

  // Expose globally for debugging/verification & auto-boot
  window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("game-canvas");
    window.kitchenGame = new KitchenGame(canvas);
  });
})();
