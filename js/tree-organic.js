// "Living tree" view: the family drawn as a real tree — trunk, tapering branches, leaves.
// Layout: a fan-shaped (half-radial) d3.tree growing upward from the trunk. Each ring
// (generation) gets a radius big enough that neighbours never crowd each other.
(function () {
  const LIVE = ['#3f7d32', '#559a3f', '#6fb24c', '#2f6a2a', '#86c062', '#4a8c3a'];
  const AUTUMN = ['#d9822b', '#c9612b', '#e2aa3c', '#b4492a', '#e8c15a'];

  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // A filled, tapering branch along a cubic Bézier: width w0 at the start, w1 at the end.
  function branchPath(p0, p1, p2, p3, w0, w1) {
    const N = 16, L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
      const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
      let dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
      let dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
      let len = Math.hypot(dx, dy);
      if (len < 1e-6) { dx = p3[0] - p0[0]; dy = p3[1] - p0[1]; len = Math.hypot(dx, dy) || 1; }
      const w = (w0 + (w1 - w0) * Math.pow(t, 0.8)) / 2;
      L.push([x - (dy / len) * w, y + (dx / len) * w]);
      R.push([x + (dy / len) * w, y - (dx / len) * w]);
    }
    const line = d3.line().curve(d3.curveCatmullRom);
    return line(L) + 'L' + line(R.reverse()).slice(1) + 'Z';
  }

  window.OrganicTree = {
    render(svgEl, data, { onSelect, selectedId }) {
      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
      svg.attr('class', 'tree organic');

      const defs = svg.append('defs');
      const sky = defs.append('linearGradient').attr('id', 'sky').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
      sky.append('stop').attr('offset', '0%').attr('stop-color', '#cfe8f6');
      sky.append('stop').attr('offset', '100%').attr('stop-color', '#f6f8ea');
      const bark = defs.append('linearGradient').attr('id', 'bark').attr('x1', 0).attr('y1', 0).attr('x2', 1).attr('y2', 0);
      [['0%', '#4a2e17'], ['45%', '#8a5a33'], ['100%', '#5a3920']].forEach(([o, c]) => bark.append('stop').attr('offset', o).attr('stop-color', c));
      const grass = defs.append('radialGradient').attr('id', 'grass');
      grass.append('stop').attr('offset', '0%').attr('stop-color', '#7fb35a');
      grass.append('stop').attr('offset', '70%').attr('stop-color', '#5f9a43');
      grass.append('stop').attr('offset', '100%').attr('stop-color', '#5f9a43').attr('stop-opacity', 0);
      defs.append('path').attr('id', 'leaf').attr('d', 'M0,0 C5,-7 15,-8 22,0 C15,8 5,7 0,0 Z');

      svg.append('rect').attr('class', 'bg').attr('width', '100%').attr('height', '100%').attr('fill', 'url(#sky)');
      const g = svg.append('g');

      // ---- layout ----
      const root = d3.hierarchy(data).sum(() => 1); // value = people in this subtree
      const total = root.value;
      const big = total > 300;
      const nLeaves = root.leaves().length;
      const span = Math.min(Math.PI * 0.8, Math.max(Math.PI / 4, nLeaves * 0.3));
      d3.tree().size([span, 1]).separation((a, b) => (a.parent === b.parent ? 1 : 1.5))(root);
      root.each((d) => { d.a = d.x - span / 2; });

      // Ring radius per generation: evenly spaced, but pushed out where neighbours would crowd.
      const MIN_GAP = big ? 46 : 70, DY = big ? 150 : 175, H = root.height;
      const byDepth = d3.group(root.descendants(), (d) => d.depth);
      const need = [0];
      for (let k = 1; k <= H; k++) {
        const angles = byDepth.get(k).map((d) => d.a).sort((x, y) => x - y);
        let gap = Infinity; for (let i = 1; i < angles.length; i++) gap = Math.min(gap, angles[i] - angles[i - 1]);
        need[k] = gap === Infinity ? 0 : MIN_GAP / gap;
      }
      const outer = Math.max(H * DY, ...need.map((n, k) => (k ? n * Math.pow(H / k, 0.6) : 0)));
      const R = [0];
      for (let k = 1; k <= H; k++) R[k] = Math.max(R[k - 1] + DY, need[k], outer * Math.pow(k / H, 0.85));
      const pos = (a, r) => [r * Math.sin(a), -r * Math.cos(a) * 1.15];
      root.each((d) => { d.r = R[d.depth]; [d.px, d.py] = pos(d.a, d.r); });
      const crown = Math.max(R[H] || 0, 200);
      const sc = Math.max(1, Math.pow(crown / 700, 0.6)); // thicker wood on bigger trees
      const width = (d) => Math.min(70 * sc, (3 + 2.6 * Math.sqrt(d.value)) * sc);
      const leafScale = Math.min(2.4, Math.max(1, sc * 0.75));

      // ---- ground + trunk ----
      const trunkH = Math.max(140, crown * 0.2);
      const trunkW = width(root) * 1.35;
      g.append('ellipse').attr('cx', 0).attr('cy', trunkH + 10).attr('rx', Math.max(380, crown * 0.75)).attr('ry', Math.max(50, crown * 0.06)).attr('fill', 'url(#grass)');
      const bk = g.append('g').attr('class', 'bark');
      // roots
      [[-1, 0.9], [-1, 0.45], [1, 0.5], [1, 0.95]].forEach(([s, f]) => {
        const ex = s * trunkW * (1.2 + f), ey = trunkH + 14 + f * 10;
        bk.append('path').attr('d', branchPath([s * trunkW * 0.25, trunkH - 25], [s * trunkW * 0.35, trunkH], [ex * 0.7, ey - 4], [ex, ey], trunkW * 0.42 * f + 6, 2));
      });
      bk.append('path').attr('d', branchPath([0, trunkH + 6], [0, trunkH * 0.6], [0, trunkH * 0.3], [0, 0], trunkW * 1.15, width(root)));

      // ---- branches ----
      const links = root.links().sort((x, y) => y.target.value - x.target.value);
      bk.selectAll('path.branch').data(links).join('path').attr('class', 'branch')
        .attr('d', ({ source: s, target: t }) => {
          const mid = s.r + (t.r - s.r) * 0.5;
          return branchPath([s.px, s.py], pos(s.a, s.depth === 0 ? (t.r - s.r) * 0.35 : mid), pos(t.a, mid), [t.px, t.py], width(t) * 1.05, width(t) * 0.7);
        });
      bk.selectAll('circle.knot').data(root.descendants()).join('circle').attr('class', 'knot')
        .attr('cx', (d) => d.px).attr('cy', (d) => d.py).attr('r', (d) => width(d) * 0.36);

      // ---- leaves ----
      const leafLayer = g.append('g').attr('class', 'leaves' + (big ? '' : ' sway'));
      root.each((d) => {
        const r = rng(hash(d.data.id));
        const dead = !!d.data.person.deathYear;
        const count = d.children ? (big ? 3 : 5) : (big ? 5 : 9);
        const cluster = leafLayer.append('g').attr('class', 'cluster').attr('transform', `translate(${d.px},${d.py})`);
        if (!big) cluster.style('animation-delay', `${(-r() * 4).toFixed(2)}s`);
        for (let i = 0; i < count; i++) {
          const ang = d.a + (r() - 0.5) * (d.children ? 3.4 : 2.4);
          const dist = (10 + r() * (d.children ? 24 : 34)) * leafScale;
          const [lx, ly] = pos(ang, dist);
          const rot = (ang * 180) / Math.PI - 90 + (r() - 0.5) * 70;
          const pal = dead ? AUTUMN : LIVE;
          cluster.append('use').attr('href', '#leaf')
            .attr('transform', `translate(${lx.toFixed(1)},${ly.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${((0.75 + r() * 0.6) * leafScale).toFixed(2)})`)
            .attr('fill', pal[Math.floor(r() * pal.length)]);
        }
      });

      // ---- people ----
      const node = g.append('g').selectAll('g').data(root.descendants()).join('g')
        .attr('class', (d) => 'person' + (d.data.person.deathYear ? ' deceased' : '') + (d.data.id === selectedId ? ' selected' : '') + (d.depth === 0 ? ' root' : ''))
        .attr('transform', (d) => `translate(${d.px},${d.py})`)
        .on('click', (e, d) => { e.stopPropagation(); onSelect(d.data.person); });
      node.append('circle').attr('class', 'fruit').attr('r', (d) => (d.depth === 0 ? 13 : 9));
      node.append('text').attr('class', 'initial').attr('dy', '0.35em').attr('text-anchor', 'middle')
        .text((d) => (d.data.person.name || '?').trim().charAt(0).toUpperCase());

      const label = node.append('g').attr('class', 'label');
      const first = (n) => (n || '').split(' ')[0];
      label.each(function (d) {
        const l = d3.select(this);
        const p = d.data.person;
        const full = FT.displayName(p) || '(no name)';
        const name = full.length > 26 ? full.slice(0, 25) + '…' : full;
        let sub = [FT.lifespan(p), d.data.spouse ? '& ' + first(FT.displayName(d.data.spouse)) : ''].filter(Boolean).join('  ');
        if (!d.children && d.depth > 0) {
          if (d.data.hidden) sub += `  +${d.data.hidden} more`;
          // outer twigs: radial labels, like names written along the leaves
          const deg = (d.a * 180) / Math.PI;
          const right = d.a >= 0;
          const t = l.attr('transform', `rotate(${right ? deg - 90 : deg + 90})`).append('text')
            .attr('x', right ? 22 : -22).attr('dy', '0.32em').attr('text-anchor', right ? 'start' : 'end');
          t.append('tspan').attr('class', 'nm').text(name);
          if (sub) t.append('tspan').attr('class', 'sub').attr('dx', 6).text(sub);
        } else {
          const t = l.append('text').attr('text-anchor', 'middle').attr('y', d.depth === 0 ? 34 : 26);
          t.append('tspan').attr('class', 'nm').attr('x', 0).text(name);
          if (sub) t.append('tspan').attr('class', 'sub').attr('x', 0).attr('dy', '1.25em').text(sub);
          if (d.data.hidden) t.append('tspan').attr('class', 'sub more').attr('x', 0).attr('dy', '1.25em').text(`+${d.data.hidden} more`);
        }
      });
      node.append('title').text((d) => d.data.person.name);
      return g;
    },
  };
})();
