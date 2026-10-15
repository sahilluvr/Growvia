"use client";
import { useEffect, useRef } from "react";

/**
 * Growvia's signature 3D scene:
 *  • Scan portal — the visitor's website as floating glass layers (header, hero, content, images, footer).
 *    A laser plane sweeps through them; issues pop up red and flip to green as they're "fixed".
 *  • Visibility constellation — AI engines and the questions customers ask orbit around the site;
 *    light pulses travel question → engine → website whenever the business gets recommended.
 *  Cursor orbits the camera, hovering an engine highlights it, scrolling turns the scene.
 *  Typing a website in the hero (event "gv:domain") writes that domain onto the site layers.
 */
type Props = { className?: string; domain?: string; compact?: boolean; speed?: number };

const ENGINES = ["ChatGPT", "Gemini", "Google", "Perplexity", "Maps"];
const QUERIES = ["best dentist near me?", "top bakery in town?", "plumber open now?", "gym for beginners?", "lawyer with good reviews?"];
const ISSUES = [
  { layer: 0, x: 0.92, y: 0.52, bad: "Missing meta description", good: "Meta description added" },
  { layer: 1, x: -0.95, y: 0.12, bad: "No FAQ for AI assistants", good: "FAQ ready for AI" },
  { layer: 2, x: 0.85, y: -0.25, bad: "Slow hero image (2.4 MB)", good: "Image compressed" },
  { layer: 3, x: -0.8, y: -0.55, bad: "Missing alt text", good: "Alt text written" },
];

export function ScanConstellation({ className = "", domain, compact = false, speed = 1 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ domain: domain ?? "", speed });
  live.current.speed = speed;

  useEffect(() => {
    const el = host.current; if (!el) return;
    let dispose = () => {};
    let cancelled = false;
    (async () => {
      const THREE = await import("three");
      if (cancelled || !host.current) return;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = innerWidth < 768 || compact;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(dpr);
      renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(compact ? 40 : 38, 1, 0.1, 100);
      const world = new THREE.Group(); scene.add(world);
      const disposables: { dispose: () => void }[] = [];
      const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

      /* ───── Website layers (canvas textures) ───── */
      const W = 512, H = 320;
      const drawLayer = (ctx: CanvasRenderingContext2D, i: number, dom: string) => {
        ctx.clearRect(0, 0, W, H);
        const r = 22;
        ctx.fillStyle = "rgba(255,255,255,0.72)"; ctx.strokeStyle = "rgba(75,155,224,0.55)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H - 8, r); ctx.fill(); ctx.stroke();
        const bar = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(8, h / 2)); ctx.fill(); };
        if (i === 0) { // header + hero
          bar(24, 22, 26, 26, "#C5F23A"); ctx.fillStyle = "#0B0D0C"; ctx.font = "600 22px ui-sans-serif, system-ui"; ctx.fillText(dom || "yourbusiness.com", 62, 43);
          [300, 350, 400].forEach((x) => bar(x, 30, 38, 10, "rgba(11,13,12,.18)"));
          bar(440, 24, 48, 22, "#0B0D0C");
          bar(24, 92, 300, 30, "rgba(11,13,12,.82)"); bar(24, 132, 240, 30, "rgba(11,13,12,.82)");
          bar(24, 182, 340, 12, "rgba(11,13,12,.22)"); bar(24, 202, 300, 12, "rgba(11,13,12,.22)");
          bar(24, 238, 130, 40, "#0B0D0C"); bar(166, 238, 110, 40, "rgba(168,218,22,.55)");
          bar(360, 92, 128, 186, "rgba(143,211,255,.45)");
        } else if (i === 1) { // services cards
          ctx.fillStyle = "rgba(11,13,12,.75)"; ctx.font = "600 20px ui-sans-serif, system-ui"; ctx.fillText("Services", 24, 46);
          [0, 1, 2].forEach((k) => { const x = 24 + k * 160; bar(x, 70, 144, 210, "rgba(239,239,234,.95)"); bar(x + 14, 86, 36, 36, k === 1 ? "#C5F23A" : "rgba(122,92,240,.35)"); bar(x + 14, 136, 110, 12, "rgba(11,13,12,.6)"); bar(x + 14, 158, 100, 9, "rgba(11,13,12,.2)"); bar(x + 14, 174, 90, 9, "rgba(11,13,12,.2)"); });
        } else if (i === 2) { // gallery
          [0, 1, 2, 3].forEach((k) => bar(24 + (k % 2) * 236, 24 + Math.floor(k / 2) * 142, 224, 130, ["rgba(143,211,255,.5)", "rgba(197,242,58,.5)", "rgba(122,92,240,.32)", "rgba(255,179,138,.45)"][k]));
        } else if (i === 3) { // FAQ / text
          ctx.fillStyle = "rgba(11,13,12,.75)"; ctx.font = "600 20px ui-sans-serif, system-ui"; ctx.fillText("Questions & reviews", 24, 46);
          for (let k = 0; k < 6; k++) { bar(24, 70 + k * 38, 464, 26, "rgba(239,239,234,.95)"); bar(36, 79 + k * 38, 200 + ((k * 53) % 180), 8, "rgba(11,13,12,.35)"); }
        } else { // footer
          bar(24, 30, 220, 18, "rgba(11,13,12,.7)"); [0, 1, 2].forEach((k) => { bar(24 + k * 160, 80, 110, 10, "rgba(11,13,12,.45)"); for (let j = 0; j < 4; j++) bar(24 + k * 160, 104 + j * 22, 90 - j * 8, 8, "rgba(11,13,12,.2)"); });
          bar(24, 236, 464, 2, "rgba(11,13,12,.12)"); bar(24, 256, 160, 8, "rgba(11,13,12,.2)");
        }
      };
      const stack = new THREE.Group();
      const LAYERS = 5, gap = compact ? 0.4 : 0.46, LW = 2.9, LH = 1.81;
      const layerCtx: { ctx: CanvasRenderingContext2D; tex: InstanceType<typeof THREE.CanvasTexture> }[] = [];
      for (let i = 0; i < LAYERS; i++) {
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d")!; drawLayer(ctx, i, live.current.domain);
        const tex = keep(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        const mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(LW, LH)), keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
        mesh.position.z = (LAYERS / 2 - i) * gap; mesh.renderOrder = LAYERS - i;
        stack.add(mesh); layerCtx.push({ ctx, tex });
      }
      stack.rotation.set(-0.42, 0.62, 0.08);
      world.add(stack);
      const redrawDomain = (d: string) => { live.current.domain = d; drawLayer(layerCtx[0].ctx, 0, d); layerCtx[0].tex.needsUpdate = true; };

      // Laser scan plane sweeping through all layers.
      const scanGeo = keep(new THREE.PlaneGeometry(LW * 1.12, LAYERS * gap + 0.6));
      const scanCv = document.createElement("canvas"); scanCv.width = 8; scanCv.height = 128;
      const sc = scanCv.getContext("2d")!; const g = sc.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, "rgba(197,242,58,0)"); g.addColorStop(0.5, "rgba(197,242,58,0.85)"); g.addColorStop(1, "rgba(197,242,58,0)"); sc.fillStyle = g; sc.fillRect(0, 0, 8, 128);
      const scanTex = keep(new THREE.CanvasTexture(scanCv));
      const scan = new THREE.Mesh(scanGeo, keep(new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending })));
      scan.rotation.x = Math.PI / 2; scan.scale.y = 1; stack.add(scan);
      // glowing frame around the laser sheet (not a solid slab)
      const scanLine = new THREE.LineSegments(keep(new THREE.EdgesGeometry(scanGeo)), keep(new THREE.LineBasicMaterial({ color: 0x8bc20a, transparent: true, opacity: 0.9 })));
      scanLine.rotation.x = Math.PI / 2; stack.add(scanLine);

      /* ───── Issue markers (sprites) red → green when the laser passes ───── */
      const markerTex = (ok: boolean) => {
        const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d")!;
        x.fillStyle = ok ? "#A8DA16" : "#E5484D"; x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill();
        x.strokeStyle = "#fff"; x.lineWidth = 7; x.lineCap = "round"; x.beginPath();
        if (ok) { x.moveTo(20, 33); x.lineTo(29, 42); x.lineTo(45, 24); } else { x.moveTo(32, 18); x.lineTo(32, 36); x.moveTo(32, 46); x.lineTo(32, 47); }
        x.stroke(); return keep(new THREE.CanvasTexture(c));
      };
      const texBad = markerTex(false), texGood = markerTex(true);
      const markers = ISSUES.map((m) => {
        const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: texBad, depthTest: false, transparent: true })));
        s.scale.setScalar(compact ? 0.22 : 0.26);
        s.position.set(m.x * (LW / 2) * 0.9, m.y * (LH / 2), (LAYERS / 2 - m.layer) * gap + 0.02);
        stack.add(s);
        return { ...m, sprite: s, fixed: false, at: 0 };
      });

      /* ───── Constellation: engines + questions ───── */
      const nodeMat = (c: number) => keep(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95 }));
      const halo = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d")!; const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, "rgba(197,242,58,.9)"); rg.addColorStop(1, "rgba(197,242,58,0)"); x.fillStyle = rg; x.fillRect(0, 0, 64, 64); return keep(new THREE.CanvasTexture(c)); })();
      const engineGeo = keep(new THREE.SphereGeometry(0.11, 20, 20)), queryGeo = keep(new THREE.SphereGeometry(0.055, 12, 12));
      const R = compact ? 2.35 : 2.3;
      const engines = ENGINES.map((name, i) => {
        const a = (i / ENGINES.length) * Math.PI * 2 + 0.4;
        const m = new THREE.Mesh(engineGeo, nodeMat(i % 2 ? 0x4b9be0 : 0x7a5cf0));
        m.position.set(Math.cos(a) * R, Math.sin(a * 1.7) * 0.9, Math.sin(a) * R * 0.55);
        const h = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, opacity: 0.0 }))); h.scale.setScalar(0.9); m.add(h);
        world.add(m); return { name, mesh: m, halo: h, a, hot: 0 };
      });
      const queries = (compact ? QUERIES.slice(0, 3) : QUERIES).map((q, i) => {
        const a = (i / QUERIES.length) * Math.PI * 2 + 1.1;
        const m = new THREE.Mesh(queryGeo, nodeMat(0x0b0d0c));
        m.position.set(Math.cos(a) * (R + 0.35), Math.sin(a * 1.3) * 1.9, Math.sin(a) * (R + 0.35) * 0.5 - 0.6);
        world.add(m); return { q, mesh: m, a };
      });
      // faint links question → nearest engines
      const linkPos: number[] = [];
      queries.forEach((q, i) => [engines[i % engines.length], engines[(i + 2) % engines.length]].forEach((e) => linkPos.push(...q.mesh.position.toArray(), ...e.mesh.position.toArray())));
      engines.forEach((e) => linkPos.push(...e.mesh.position.toArray(), 0, 0, 0));
      const linkGeo = keep(new THREE.BufferGeometry()); linkGeo.setAttribute("position", new THREE.Float32BufferAttribute(linkPos, 3));
      const links = new THREE.LineSegments(linkGeo, keep(new THREE.LineBasicMaterial({ color: 0x4b9be0, transparent: true, opacity: 0.16 })));
      world.add(links);

      // Light pulses: question → engine → website.
      const pulseGeo = keep(new THREE.SphereGeometry(0.05, 10, 10)), pulseMat = keep(new THREE.MeshBasicMaterial({ color: 0x9fd60f }));
      const pulses: { m: InstanceType<typeof THREE.Mesh>; path: InstanceType<typeof THREE.Vector3>[]; t: number; e: number }[] = [];
      const firePulse = () => {
        const qi = (Math.random() * queries.length) | 0, ei = (qi + (Math.random() < 0.5 ? 0 : 2)) % engines.length;
        const m = new THREE.Mesh(pulseGeo, pulseMat); const h = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false }))); h.scale.setScalar(0.45); m.add(h);
        world.add(m); pulses.push({ m, path: [queries[qi].mesh.position.clone(), engines[ei].mesh.position.clone(), new THREE.Vector3(0, 0, 0)], t: 0, e: ei });
      };

      // Background stars.
      const starN = small ? 140 : 320, sp = new Float32Array(starN * 3);
      for (let i = 0; i < starN; i++) sp.set([(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 11, -4 - Math.random() * 6], i * 3);
      const starGeo = keep(new THREE.BufferGeometry()); starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
      const stars = new THREE.Points(starGeo, keep(new THREE.PointsMaterial({ color: 0x7a5cf0, size: 0.035, transparent: true, opacity: 0.45 })));
      scene.add(stars);

      /* ───── HTML labels (engines, questions, issue tags) projected from 3D ───── */
      const labelLayer = document.createElement("div"); labelLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden"; el.appendChild(labelLayer);
      const mk = (cls: string, text: string) => { const d = document.createElement("div"); d.className = cls; d.textContent = text; labelLayer.appendChild(d); return d; };
      const engineLabels = engines.map((e) => mk("gv-3d-tag gv-3d-engine", e.name));
      const queryLabels = compact ? [] : queries.map((q) => mk("gv-3d-tag gv-3d-query", `“${q.q}”`));
      const issueLabels = markers.map((m) => mk("gv-3d-tag gv-3d-issue", m.bad));
      const v = new THREE.Vector3();
      const place = (d: HTMLElement, obj: { getWorldPosition: (v: InstanceType<typeof THREE.Vector3>) => InstanceType<typeof THREE.Vector3> }, dx = 0, dy = -18, show = true) => {
        obj.getWorldPosition(v);
        const behind = v.z < -0.6; // nodes behind the website stack fade so labels never sit on top of it
        v.project(camera);
        const r = el.getBoundingClientRect();
        const x = (v.x * 0.5 + 0.5) * r.width, y = (-v.y * 0.5 + 0.5) * r.height;
        d.style.opacity = show && v.z < 1 ? (behind ? "0.28" : "1") : "0";
        d.style.transform = `translate(-50%,-100%) translate(${x + dx}px, ${y + dy}px)`;
      };

      /* ───── Sizing, interaction, loop ───── */
      const size = () => { const r = el.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); camera.position.set(0, 0.2, (compact ? 9.6 : 10.2) / Math.min(1, camera.aspect + 0.1)); };
      size(); const ro = new ResizeObserver(size); ro.observe(el);
      const mouse = { x: 0, y: 0 }, cam = { az: 0, el: 0 }, ndc = new THREE.Vector2(99, 99), ray = new THREE.Raycaster();
      const pm = (e: PointerEvent) => { const r = el.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1; ndc.set(mouse.x, mouse.y); };
      addEventListener("pointermove", pm, { passive: true });
      const onDomain = (e: Event) => redrawDomain(String((e as CustomEvent).detail ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").slice(0, 32));
      addEventListener("gv:domain", onDomain);
      if (domain) redrawDomain(domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));

      let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !reduce) loop(); }); io.observe(el);
      let raf = 0, last = performance.now(), scanT = 0, nextPulse = 0, clock = 0;
      const loop = () => {
        cancelAnimationFrame(raf); if (!visible) return;
        const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000) * live.current.speed; last = now; clock += dt;
        // camera orbit from cursor + gentle drift + scroll turn
        const r = el.getBoundingClientRect(); const scroll = Math.max(-1, Math.min(1, -r.top / Math.max(1, r.height)));
        cam.az += ((mouse.x * 0.55 + Math.sin(clock * 0.15) * 0.12 + scroll * 0.6) - cam.az) * 0.05;
        cam.el += ((mouse.y * 0.28) - cam.el) * 0.05;
        world.rotation.y = cam.az; world.rotation.x = -cam.el;
        // scan sweep (top → bottom of the layers), markers flip as it passes
        scanT = (scanT + dt * 0.28) % 1.25;
        const sy = LH / 2 - Math.min(1, scanT) * LH;
        scan.position.y = sy; scanLine.position.y = sy; (scan.material as { opacity: number }).opacity = scanT > 1 ? 0 : 0.22; scanLine.visible = scanT <= 1;
        if (scanT < 0.02) markers.forEach((m, i) => { m.fixed = false; m.sprite.material.map = texBad; m.sprite.material.needsUpdate = true; issueLabels[i].textContent = m.bad; issueLabels[i].classList.remove("ok"); });
        markers.forEach((m, i) => {
          if (!m.fixed && sy < m.sprite.position.y - 0.05) { m.fixed = true; m.at = clock; m.sprite.material.map = texGood; m.sprite.material.needsUpdate = true; issueLabels[i].textContent = m.good; issueLabels[i].classList.add("ok"); }
          const pop = m.fixed ? 1 + Math.max(0, 0.35 - (clock - m.at)) * 1.6 : 1 + Math.sin(clock * 5 + i) * 0.06;
          m.sprite.scale.setScalar((compact ? 0.22 : 0.26) * pop);
        });
        // hover engines
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(engines.map((e) => e.mesh))[0]?.object;
        engines.forEach((e, i) => {
          const hov = e.mesh === hit; e.hot = Math.max(0, e.hot - dt * 1.5);
          const s = 1 + (hov ? 0.6 : 0) + e.hot * 0.8; e.mesh.scale.setScalar(s);
          (e.halo.material as { opacity: number }).opacity = Math.min(1, (hov ? 0.9 : 0) + e.hot);
          engineLabels[i].classList.toggle("hot", hov || e.hot > 0.2);
          e.mesh.position.y += Math.sin(clock * 1.2 + i) * 0.0015;
        });
        // pulses
        if (clock > nextPulse) { firePulse(); nextPulse = clock + (compact ? 0.9 : 1.3); }
        for (let k = pulses.length - 1; k >= 0; k--) {
          const p = pulses[k]; p.t += dt * 0.7;
          if (p.t >= 2) { world.remove(p.m); pulses.splice(k, 1); continue; }
          const seg = p.t < 1 ? 0 : 1, f = p.t - seg;
          p.m.position.lerpVectors(p.path[seg], p.path[seg + 1], f);
          if (seg === 1 && f < 0.05) engines[p.e].hot = 1;
        }
        stars.rotation.z += dt * 0.01;
        renderer.render(scene, camera);
        engines.forEach((e, i) => place(engineLabels[i], e.mesh, 0, -14));
        queries.forEach((q, i) => queryLabels[i] && place(queryLabels[i], q.mesh, 0, -10));
        // issue tags appear as the laser reaches them and linger briefly once fixed (no clutter)
        markers.forEach((m, i) => place(issueLabels[i], m.sprite, 0, -16, (!m.fixed && Math.abs(sy - m.sprite.position.y) < 0.55) || (m.fixed && clock - m.at < 2.2)));
        if (!reduce) raf = requestAnimationFrame(loop);
      };
      loop();

      dispose = () => {
        cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
        removeEventListener("pointermove", pm); removeEventListener("gv:domain", onDomain);
        disposables.forEach((d) => d.dispose()); renderer.dispose(); renderer.domElement.remove(); labelLayer.remove();
      };
    })().catch(() => { /* no WebGL — the page works without the effect */ });
    return () => { cancelled = true; dispose(); };
  }, [compact, domain]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} className={`pointer-events-none ${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`} aria-hidden />;
}
