// "Basic chart" view: a clean top-down family chart with cards.
// To keep wide families readable, a group of children who have no children of their own
// is stacked vertically under the parent instead of being spread sideways.
window.BasicTree = {
  render(svgEl, data, { onSelect, selectedId }) {
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('class', 'tree basic');
    svg.append('rect').attr('class', 'bg').attr('width', '100%').attr('height', '100%');
    const g = svg.append('g');
    const W = 184, H = 64, GAP = 12, INDENT = 18;

    const hasKids = (d) => d.children && d.children.length;
    // Layout hierarchy: a node's children take part in the sideways layout only if at least one of them has children.
    const root = d3.hierarchy(data, (d) => (hasKids(d) && d.children.some(hasKids) ? d.children : null));
    const maxStack = d3.max(root.leaves(), (d) => (hasKids(d.data) ? d.data.children.length : 0)) || 0;
    d3.tree().nodeSize([W + 26, H + 70]).separation((a, b) => (a.parent === b.parent ? 1 : 1.12))(root);

    const items = []; const lines = [];
    root.each((d) => {
      items.push({ x: d.x, y: d.y, n: d.data });
      if (d.parent) {
        const s = d.parent, my = (s.y + H / 2 + d.y - H / 2) / 2;
        lines.push(`M${s.x},${s.y + H / 2}V${my}H${d.x}V${d.y - H / 2}`);
      }
      if (!d.children && hasKids(d.data)) { // stacked list of childless children
        const railX = d.x - W / 2 + INDENT / 2;
        d.data.children.forEach((c, i) => {
          const y = d.y + (i + 1) * (H + GAP) + 10;
          items.push({ x: d.x + INDENT, y, n: c });
          lines.push(`M${railX},${d.y + H / 2}V${y}H${d.x + INDENT - W / 2}`);
        });
      }
    });
    void maxStack;

    g.append('g').attr('class', 'links').selectAll('path').data(lines).join('path').attr('d', (d) => d);

    const node = g.append('g').selectAll('g').data(items).join('g')
      .attr('class', (d) => 'card' + (d.n.person.deathYear ? ' deceased' : '') + (d.n.id === selectedId ? ' selected' : ''))
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .on('click', (e, d) => { e.stopPropagation(); onSelect(d.n.person); });

    const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
    node.append('rect').attr('x', -W / 2).attr('y', -H / 2).attr('width', W).attr('height', H).attr('rx', 10);
    node.append('rect').attr('class', (d) => 'stripe g-' + (d.n.person.gender || 'u'))
      .attr('x', -W / 2).attr('y', -H / 2).attr('width', 6).attr('height', H).attr('rx', 3);
    node.append('text').attr('class', 'name').attr('x', -W / 2 + 16).attr('y', -H / 2 + 20)
      .text((d) => trunc(FT.displayName(d.n.person) || '(no name)', 24) + (d.n.person.deathYear ? ' †' : ''));
    node.append('text').attr('class', 'meta').attr('x', -W / 2 + 16).attr('y', -H / 2 + 37)
      .text((d) => [FT.lifespan(d.n.person), d.n.person.place].filter(Boolean).join(' · '));
    node.append('text').attr('class', 'spouse').attr('x', -W / 2 + 16).attr('y', -H / 2 + 54)
      .text((d) => (d.n.spouse ? '⚭ ' + trunc(FT.displayName(d.n.spouse), 22) : ''));
    node.filter((d) => d.n.hidden > 0).append('text').attr('class', 'more').attr('x', W / 2 - 8).attr('y', -H / 2 + 54).attr('text-anchor', 'end')
      .text((d) => `+${d.n.hidden} ▾`);
    node.append('title').text((d) => d.n.person.name);
    return g;
  },
};
