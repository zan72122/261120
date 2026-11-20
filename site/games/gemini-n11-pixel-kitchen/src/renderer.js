// Crisp 60fps 2D Canvas Sprite-Stacking Renderer for Little Pixel Kitchen
(function () {
  class StackRenderer {
    constructor(displayCanvas) {
      this.displayCanvas = displayCanvas;
      this.displayCtx = displayCanvas.getContext("2d", { alpha: false });
      this.bufCanvas = document.createElement("canvas");
      this.bufCtx = this.bufCanvas.getContext("2d", { alpha: false });

      this.models = {};
      this.ready = false;

      // Camera & projection parameters
      this.camAngle = -0.38; // Front-3/4 showing oven, drawers, knobs, towel, stove, plate & Mama!
      this.tilt = 0.58;
      this.zStep = 0.84;
      this.centerX = 150;
      this.centerY = 105;
      this.worldOffsetX = 11; // Center diorama (island + Mama on right)
      this.worldOffsetY = 0;

      this.bufW = 280;
      this.bufH = 160;
      this.scaleToDisplay = 1;
    }

    loadModels(sliceData, onReady) {
      const keys = Object.keys(sliceData);
      let loaded = 0;
      keys.forEach((key) => {
        const meta = sliceData[key];
        const img = new Image();
        img.onload = () => {
          // Copy into offscreen canvas for fastest hardware-accelerated Safari drawImage
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext("2d");
          g.imageSmoothingEnabled = false;
          g.drawImage(img, 0, 0);
          this.models[key] = {
            w: meta.w,
            d: meta.d,
            h: meta.h,
            canvas: c,
          };
          loaded++;
          if (loaded === keys.length) {
            this.ready = true;
            if (onReady) onReady();
          }
        };
        img.src = meta.data;
      });
    }

    resize(cssW, cssH, dpr) {
      const w = Math.max(320, cssW);
      const h = Math.max(240, cssH);
      this.displayCanvas.width = Math.round(w * dpr);
      this.displayCanvas.height = Math.round(h * dpr);
      this.displayCanvas.style.width = w + "px";
      this.displayCanvas.style.height = h + "px";

      const aspect = w / h;
      if (aspect >= 1.0) {
        // Landscape (iPad / Desktop / 16:9) — ultra-crisp 16-bit pixel framing!
        const targetH = Math.round(Math.max(166, Math.min(194, 298 / aspect)));
        this.bufH = targetH;
        this.bufW = Math.round(targetH * aspect);
      } else {
        // Portrait (iPhone): crisp framing fitting island + Mama cleanly across width
        this.bufW = 200;
        this.bufH = Math.round(this.bufW / aspect);
      }
      this.bufCanvas.width = this.bufW;
      this.bufCanvas.height = this.bufH;
      this.centerX = this.bufW * 0.5;
      this.centerY = this.bufH * (aspect >= 1.0 ? 0.65 : 0.60);
      this.scaleToDisplay = w / this.bufW;
    }

    screenCssToBuf(cssX, cssY) {
      return {
        bx: cssX / this.scaleToDisplay,
        by: cssY / this.scaleToDisplay,
      };
    }

    worldToBuf(wx, wy, wz = 0) {
      const lx = wx - this.worldOffsetX;
      const ly = wy - this.worldOffsetY;
      const c = Math.cos(this.camAngle);
      const s = Math.sin(this.camAngle);
      const rx = lx * c - ly * s;
      const ry = lx * s + ly * c;
      return {
        sx: this.centerX + rx,
        sy: this.centerY + ry * this.tilt - wz * this.zStep,
        depth: ry,
      };
    }

    bufToWorldOnZ(bx, by, wz = 38) {
      const rx = bx - this.centerX;
      const ry = (by + wz * this.zStep - this.centerY) / this.tilt;
      const c = Math.cos(-this.camAngle);
      const s = Math.sin(-this.camAngle);
      return {
        wx: rx * c - ry * s + this.worldOffsetX,
        wy: rx * s + ry * c + this.worldOffsetY,
      };
    }

    // Draw warm sunlit kitchen backdrop + subtle rotating floor mat shadow
    drawBackdrop(time) {
      const ctx = this.bufCtx;
      const W = this.bufW;
      const H = this.bufH;

      // Soft warm cream-apricot sunlit backdrop
      const grad = ctx.createRadialGradient(
        this.centerX, this.centerY - 12, 18,
        this.centerX, this.centerY, Math.max(W, H) * 0.78
      );
      grad.addColorStop(0, "#fdf6e7");
      grad.addColorStop(0.55, "#f3e3c6");
      grad.addColorStop(1, "#e2c9a1");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Subtle cozy warm floor tile dots in background
      ctx.fillStyle = "rgba(186, 148, 102, 0.14)";
      for (let y = 8; y < H; y += 14) {
        for (let x = ((y / 14) % 2) * 7; x < W; x += 14) {
          ctx.fillRect(x, y, 2, 2);
        }
      }

      // Ground contact shadow beneath the rotating Kitchen Island + Mama's stool
      ctx.save();
      const base = this.worldToBuf(0, 0, 0);
      ctx.translate(Math.round(base.sx), Math.round(base.sy + 2));
      ctx.scale(1, this.tilt);
      ctx.rotate(this.camAngle);
      ctx.fillStyle = "rgba(92, 52, 24, 0.24)";
      ctx.fillRect(-60, -34, 120, 68);
      ctx.fillStyle = "rgba(92, 52, 24, 0.14)";
      ctx.fillRect(-63, -37, 126, 74);

      // Mama's stool ground shadow
      ctx.fillStyle = "rgba(92, 52, 24, 0.24)";
      ctx.beginPath();
      ctx.arc(73, 2, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawShadowEllipse(wx, wy, wz, rx, ry, alpha = 0.26) {
      const ctx = this.bufCtx;
      const p = this.worldToBuf(wx, wy, wz);
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.scale(1, this.tilt);
      ctx.rotate(this.camAngle);
      ctx.fillStyle = `rgba(60, 32, 16, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /**
     * Draw a horizontal sprite-stacked 3D pixel-art model!
     * opts: { objAngle, scale, tiltX, tiltY, zStart, zEnd, squashZ, flash }
     */
    drawStack(modelName, wx, wy, wz, opts = {}) {
      const m = this.models[modelName];
      if (!m) return;
      const ctx = this.bufCtx;
      const objAngle = opts.objAngle || 0;
      const scale = opts.scale || 1;
      const tiltX = opts.tiltX || 0;
      const tiltY = opts.tiltY || 0;
      const squashZ = opts.squashZ || 1;
      const zStart = opts.zStart || 0;
      const zEnd = opts.zEnd !== undefined ? Math.min(m.h, opts.zEnd) : m.h;

      const p = this.worldToBuf(wx, wy, wz);
      const totalAngle = this.camAngle + objAngle;
      const w = m.w;
      const d = m.d;
      const hw = w * 0.5;
      const hd = d * 0.5;
      const step = this.zStep * scale * squashZ;

      ctx.imageSmoothingEnabled = false;
      for (let z = zStart; z < zEnd; z++) {
        const sx = p.sx + tiltX * z;
        const sy = p.sy - z * step + tiltY * z;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scale, this.tilt * scale);
        ctx.rotate(totalAngle);
        ctx.drawImage(m.canvas, z * w, 0, w, d, -hw, -hd, w, d);
        ctx.restore();
      }
    }

    /**
     * Draw animated pixel gas flames inside a stove burner grate!
     */
    drawBurnerFlame(wx, wy, wz, level, time) {
      if (level <= 0) return;
      const ctx = this.bufCtx;
      const count = level === 2 ? 10 : 7;
      const radius = level === 2 ? 6.8 : 5.4;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + time * 1.4;
        const fx = wx + Math.cos(ang) * radius;
        const fy = wy + Math.sin(ang) * radius;
        const flicker = Math.sin(time * 18 + i * 2.3) * 0.5 + 0.5;
        const fh = (level === 2 ? 3.5 : 2.2) + flicker * (level === 2 ? 2.5 : 1.2);
        const p = this.worldToBuf(fx, fy, wz);
        const px = Math.round(p.sx);
        const py = Math.round(p.sy);

        // Bright cyan-blue gas base
        ctx.fillStyle = "#36b8ff";
        ctx.fillRect(px - 1, py - Math.round(fh), 3, Math.round(fh) + 1);
        // White-hot inner core
        ctx.fillStyle = "#d9f6ff";
        ctx.fillRect(px, py - Math.round(fh * 0.6), 1, Math.max(1, Math.round(fh * 0.6)));
        // Warm orange dancing tip on High heat
        if (level === 2 && flicker > 0.35) {
          ctx.fillStyle = "#ffae36";
          ctx.fillRect(px, py - Math.round(fh) - 1, 2, 2);
        }
      }
    }

    /**
     * Draw dynamic color-blended soup inside pot or soup bowl!
     */
    drawSoupSurface(wx, wy, wz, radius, colorHex, swirlPhase, boilAmt, flecks, time) {
      const ctx = this.bufCtx;
      const p = this.worldToBuf(wx, wy, wz);
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.scale(1, this.tilt);
      ctx.rotate(this.camAngle);

      // Base rich broth
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Lighter swirling soup ribbon!
      ctx.strokeStyle = "rgba(255, 250, 232, 0.38)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let a = 0; a < 4.4; a += 0.35) {
        const r = (a / 4.4) * (radius * 0.72);
        const sx = Math.cos(a + swirlPhase) * r;
        const sy = Math.sin(a + swirlPhase) * r;
        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Floating little veggie/egg flecks!
      if (flecks && flecks.length) {
        for (let i = 0; i < flecks.length; i++) {
          const f = flecks[i];
          const fa = f.a + swirlPhase * (0.65 + (i % 3) * 0.15);
          const fx = Math.cos(fa) * f.r * (radius / 7.5);
          const fy = Math.sin(fa) * f.r * (radius / 7.5);
          ctx.fillStyle = f.col;
          ctx.fillRect(Math.round(fx - 1), Math.round(fy - 1), 2, 2);
        }
      }

      // Simmering & boiling bubbles on broth surface
      if (boilAmt > 0.05) {
        const bCount = Math.ceil(boilAmt * 6);
        for (let i = 0; i < bCount; i++) {
          const phase = (time * (2.2 + boilAmt * 2.0) + i * 1.37) % 1;
          const ba = i * 2.4 + swirlPhase * 0.4;
          const br = ((i * 2.7) % 5.2) * (radius / 7.5);
          const bx = Math.cos(ba) * br;
          const by = Math.sin(ba) * br;
          const rad = 0.8 + phase * (1.3 + boilAmt * 0.9);
          ctx.fillStyle = "rgba(255, 252, 240, 0.72)";
          ctx.beginPath();
          ctx.arc(bx, by, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    /**
     * Draw glossy red pixel ketchup dots / squiggle on top of a food item!
     */
    drawKetchupOnFood(wx, wy, wz, dots) {
      if (!dots || !dots.length) return;
      const ctx = this.bufCtx;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const p = this.worldToBuf(wx + d.ox, wy + d.oy, wz + 0.5);
        const px = Math.round(p.sx);
        const py = Math.round(p.sy);
        ctx.fillStyle = "#b81c16";
        ctx.fillRect(px - 1, py - 1, 3, 2);
        ctx.fillStyle = "#ff4238";
        ctx.fillRect(px - 1, py - 1, 2, 1);
      }
    }

    /**
     * Draw crisp pixel-art particles (steam, juice, salt, bubbles, sparks, hearts, stars!)
     */
    drawParticles(particles) {
      const ctx = this.bufCtx;
      for (let i = 0; i < particles.length; i++) {
        const pt = particles[i];
        const p = this.worldToBuf(pt.x, pt.y, pt.z);
        const px = Math.round(p.sx);
        const py = Math.round(p.sy);
        const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));

        ctx.save();
        ctx.globalAlpha = pt.fade ? alpha : Math.min(1, alpha * 2.5);
        if (pt.kind === "heart") {
          this._drawPixelHeart(ctx, px, py, pt.col || "#ff5268");
        } else if (pt.kind === "star") {
          this._drawPixelStar(ctx, px, py, pt.col || "#ffe042");
        } else if (pt.kind === "note") {
          this._drawPixelNote(ctx, px, py, pt.col || "#ff8c42");
        } else if (pt.kind === "steam") {
          const s = pt.size || 2;
          ctx.fillStyle = pt.col || "#ffffff";
          ctx.fillRect(px - Math.floor(s / 2), py - Math.floor(s / 2), s, s);
        } else {
          const s = pt.size || 2;
          ctx.fillStyle = pt.col;
          ctx.fillRect(px, py, s, s);
        }
        ctx.restore();
      }
    }

    _drawPixelHeart(ctx, cx, cy, col) {
      const rows = [
        ".XX.XX.",
        "XXXXXXX",
        "XXXXXXX",
        ".XXXXX.",
        "..XXX..",
        "...X...",
      ];
      ctx.fillStyle = "#2b1912";
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if (rows[r][c] === "X") {
            ctx.fillRect(cx + c - 3, cy + r - 3 + 1, 1, 1);
          }
        }
      }
      ctx.fillStyle = col;
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if (rows[r][c] === "X") {
            ctx.fillRect(cx + c - 3, cy + r - 3, 1, 1);
          }
        }
      }
      ctx.fillStyle = "#ffc2cc";
      ctx.fillRect(cx - 2, cy - 2, 1, 1);
    }

    _drawPixelStar(ctx, cx, cy, col) {
      ctx.fillStyle = col;
      ctx.fillRect(cx, cy - 2, 1, 5);
      ctx.fillRect(cx - 2, cy, 5, 1);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx, cy, 1, 1);
    }

    _drawPixelNote(ctx, cx, cy, col) {
      ctx.fillStyle = "#2b1912";
      ctx.fillRect(cx - 1, cy + 1, 3, 2);
      ctx.fillRect(cx + 1, cy - 3, 2, 5);
      ctx.fillRect(cx + 2, cy - 3, 3, 2);
      ctx.fillStyle = col;
      ctx.fillRect(cx - 1, cy + 1, 2, 2);
      ctx.fillRect(cx + 1, cy - 3, 1, 4);
      ctx.fillRect(cx + 2, cy - 3, 2, 1);
    }

    /**
     * Draw a cute wordless pixel emote bubble above Mama!
     */
    drawEmoteBubble(wx, wy, wz, icon, bob, scale = 1) {
      if (!icon) return;
      const ctx = this.bufCtx;
      const p = this.worldToBuf(wx, wy, wz);
      const cx = Math.round(p.sx);
      const cy = Math.round(p.sy + bob);

      // Cute crisp pixel speech-cloud bubble
      ctx.fillStyle = "#2b1912";
      ctx.fillRect(cx - 7, cy - 7, 14, 12);
      ctx.fillRect(cx - 8, cy - 6, 16, 10);
      ctx.fillRect(cx - 2, cy + 5, 4, 2);
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(cx - 6, cy - 6, 12, 10);
      ctx.fillRect(cx - 7, cy - 5, 14, 8);
      ctx.fillRect(cx - 1, cy + 4, 2, 2);

      if (icon === "heart") {
        this._drawPixelHeart(ctx, cx, cy - 1, "#ff4d6a");
      } else if (icon === "star") {
        this._drawPixelStar(ctx, cx - 2, cy - 1, "#ffb700");
        this._drawPixelStar(ctx, cx + 2, cy, "#ffe042");
      } else if (icon === "note") {
        this._drawPixelNote(ctx, cx - 1, cy - 1, "#e8633b");
      } else if (icon === "whoa") {
        // Exclamation mark (pure visual symbol, no words)
        ctx.fillStyle = "#e84a3b";
        ctx.fillRect(cx - 1, cy - 4, 2, 4);
        ctx.fillRect(cx - 1, cy + 1, 2, 2);
      } else if (icon === "sniff") {
        // Cozy wavy aroma lines
        ctx.fillStyle = "#c98b5b";
        ctx.fillRect(cx - 3, cy - 3, 1, 2);
        ctx.fillRect(cx - 2, cy - 1, 1, 2);
        ctx.fillRect(cx + 1, cy - 3, 1, 2);
        ctx.fillRect(cx + 2, cy - 1, 1, 2);
      } else if (icon === "bell") {
        ctx.fillStyle = "#ebb02d";
        ctx.fillRect(cx - 2, cy - 3, 4, 4);
        ctx.fillRect(cx - 3, cy + 1, 6, 1);
      }
    }

    present() {
      const dCtx = this.displayCtx;
      dCtx.imageSmoothingEnabled = false;
      dCtx.drawImage(
        this.bufCanvas,
        0, 0, this.bufW, this.bufH,
        0, 0, this.displayCanvas.width, this.displayCanvas.height
      );
    }
  }

  window.StackRenderer = StackRenderer;
})();
