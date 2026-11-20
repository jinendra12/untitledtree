// Sample datasets for the POC: small, a realistic extended family, a large stress test,
// and an "edge cases" set (missing data, remarriage, cousin marriage, deep chains…).
(function () {
  const MALE = ['Ramesh','Suresh','Mahesh','Dinesh','Rajesh','Mukesh','Anil','Sunil','Vijay','Ajay','Sanjay','Amit','Rohit','Vikas','Arun','Varun','Karan','Arjun','Rahul','Nikhil','Aditya','Ishaan','Kabir','Vivaan','Aarav','Reyansh','Dev','Yash','Harsh','Manoj','Pankaj','Deepak','Ashok','Prakash','Naveen','Gaurav','Saurabh','Kunal','Tarun','Mohan'];
  const FEMALE = ['Sita','Gita','Kamla','Sushila','Sunita','Anita','Kavita','Savita','Meena','Reena','Neha','Pooja','Priya','Sneha','Ritu','Shalini','Anjali','Divya','Kiran','Asha','Usha','Lata','Nisha','Shreya','Ananya','Diya','Aadhya','Myra','Saanvi','Isha','Komal','Rekha','Seema','Poonam','Jyoti','Swati','Megha','Tanvi','Riya','Kriti'];
  const SURNAMES = ['Verma','Gupta','Agarwal','Mehta','Shah','Patel','Joshi','Bansal','Goyal','Mittal','Singhal','Khanna','Kapoor'];
  const PLACES = ['Jaipur','Delhi','Indore','Mumbai','Pune','Bengaluru','Kolkata','Ahmedabad','Surat','Udaipur','Toronto','London'];
  const THIS_YEAR = new Date().getFullYear();

  const BLANK = { id: '', name: '', gender: '', birthYear: '', deathYear: '', fatherId: '', motherId: '', spouseId: '', place: '', notes: '', photoUrl: '' };

  function rng(seed) { // mulberry32 — deterministic, so samples look the same every load
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate({ seed, sons, daughters, generations, kids, maxPeople, surname = 'Sharma', rootBirth = 1920 }) {
    const r = rng(seed);
    const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const pick = (a) => a[Math.floor(r() * a.length)];
    const people = []; const byId = {}; let n = 0;
    const mk = (p) => { const o = { ...BLANK, id: 'P' + String(++n).padStart(4, '0'), place: pick(PLACES), ...p }; people.push(o); byId[o.id] = o; return o; };
    const lastName = (p) => p.name.split(' ').slice(-1)[0];
    const death = (by) => {
      const age = THIS_YEAR - by;
      if (age > 92) return by + ri(68, 92);
      if (age > 55 && r() < 0.2) return by + ri(50, age - 1);
      return '';
    };
    const marry = (p) => {
      const g = p.gender === 'M' ? 'F' : 'M';
      const by = p.birthYear + (g === 'F' ? ri(1, 5) : -ri(1, 5));
      const s = mk({ name: g === 'F' ? `${pick(FEMALE)} ${lastName(p)}` : `${pick(MALE)} ${pick(SURNAMES)}`, gender: g, birthYear: by, spouseId: p.id });
      s.deathYear = death(by);
      p.spouseId = s.id;
    };

    const root = mk({ name: `Ramchandra ${surname}`, gender: 'M', birthYear: rootBirth, notes: 'Family patriarch' });
    root.deathYear = death(rootBirth);
    marry(root);
    const queue = [{ p: root, gen: 0 }];
    while (queue.length && people.length < maxPeople) {
      const { p, gen } = queue.shift();
      if (gen >= generations - 1 || !p.spouseId) continue;
      const sp = byId[p.spouseId];
      const father = p.gender === 'M' ? p : sp, mother = p.gender === 'M' ? sp : p;
      const genders = gen === 0 && sons != null
        ? [...Array(sons).fill('M'), ...Array(daughters).fill('F')]
        : Array.from({ length: ri(kids[0], kids[1]) }, () => (r() < 0.5 ? 'M' : 'F'));
      let by = mother.birthYear + ri(20, 26);
      const used = new Set();
      for (const g of genders) {
        if (people.length >= maxPeople || by > THIS_YEAR - 1) break;
        let first; do { first = pick(g === 'M' ? MALE : FEMALE); } while (used.has(first) && used.size < 30);
        used.add(first);
        const c = mk({ name: `${first} ${lastName(father)}`, gender: g, birthYear: by, fatherId: father.id, motherId: mother.id });
        c.deathYear = death(by);
        if (THIS_YEAR - by >= 23 && r() < 0.88) marry(c);
        queue.push({ p: c, gen: gen + 1 });
        by += ri(1, 4);
      }
    }
    return people;
  }

  function small() {
    const P = (id, name, gender, birthYear, deathYear, fatherId, motherId, spouseId, place, notes) =>
      ({ ...BLANK, id, name, gender, birthYear, deathYear, fatherId, motherId, spouseId, place, notes });
    return [
      P('S1', 'Hariprasad Sharma', 'M', 1935, 2010, '', '', 'S2', 'Jaipur', 'Founded the family shop'),
      P('S2', 'Kamla Sharma', 'F', 1940, '', '', '', 'S1', 'Jaipur', ''),
      P('S3', 'Ramesh Sharma', 'M', 1962, '', 'S1', 'S2', 'S4', 'Delhi', ''),
      P('S4', 'Sunita Sharma', 'F', 1965, '', '', '', 'S3', 'Delhi', ''),
      P('S5', 'Meena Gupta', 'F', 1966, '', 'S1', 'S2', 'S6', 'Indore', ''),
      P('S6', 'Anil Gupta', 'M', 1963, '', '', '', 'S5', 'Indore', ''),
      P('S7', 'Suresh Sharma', 'M', 1970, '', 'S1', 'S2', '', 'Pune', ''),
      P('S8', 'Rohit Sharma', 'M', 1990, '', 'S3', 'S4', '', 'Bengaluru', ''),
      P('S9', 'Neha Sharma', 'F', 1993, '', 'S3', 'S4', '', 'Delhi', ''),
      P('S10', 'Ishaan Gupta', 'M', 1995, '', 'S6', 'S5', '', 'Indore', ''),
    ];
  }

  function edge() {
    const people = []; let n = 0;
    const add = (p) => { const o = { ...BLANK, id: 'E' + (++n), ...p }; people.push(o); return o; };
    const marry = (a, b) => { a.spouseId = b.id; b.spouseId = a.id; };

    const root = add({ name: 'Bhanu Pratap', gender: 'M', notes: 'Birth year unknown, wife unknown' });
    // Remarriage: first wife (deceased) and second wife; children from both
    const a = add({ name: 'Devendra Pratap', gender: 'M', birthYear: 1950, fatherId: root.id });
    const w1 = add({ name: 'Lata (first wife)', gender: 'F', birthYear: 1952, deathYear: 1980 });
    const w2 = add({ name: 'Usha (second wife)', gender: 'F', birthYear: 1958 });
    marry(a, w2);
    add({ name: 'Child of first marriage', gender: 'M', birthYear: 1975, fatherId: a.id, motherId: w1.id });
    add({ name: 'Child of second marriage', gender: 'F', birthYear: 1985, fatherId: a.id, motherId: w2.id });
    // Only the mother is known
    const b = add({ name: 'Savitri Devi', gender: 'F', birthYear: 1953, fatherId: root.id });
    add({ name: 'Raised by mother', gender: 'M', birthYear: 1978, motherId: b.id, notes: 'Father not recorded' });
    // A person with 12 children
    const c = add({ name: 'Gopal Pratap', gender: 'M', birthYear: 1948, fatherId: root.id });
    const cw = add({ name: 'Parvati', gender: 'F', birthYear: 1950 }); marry(c, cw);
    const kidsC = ['Arjun','Bhim','Chandra','Dhruv','Eshan','Faiz','Girish','Hema','Indu','Jaya','Kala','Leela'];
    const cKids = kidsC.map((k, i) => add({ name: k, gender: i < 7 ? 'M' : 'F', birthYear: 1970 + i, fatherId: c.id, motherId: cw.id }));
    // Cousin marriage: their child must appear exactly once
    const cousin1 = cKids[0];
    const d = add({ name: 'Kanta', gender: 'F', birthYear: 1955, fatherId: root.id });
    const cousin2 = add({ name: 'Rukmini', gender: 'F', birthYear: 1974, motherId: d.id });
    marry(cousin1, cousin2);
    add({ name: 'Child of cousins', gender: 'M', birthYear: 2000, fatherId: cousin1.id, motherId: cousin2.id, notes: 'Both parents are in the tree; shown once' });
    // Deep single-child chain (10 generations)
    let parent = add({ name: 'Chain gen 1', gender: 'M', birthYear: 1952, fatherId: root.id });
    for (let i = 2; i <= 10; i++) parent = add({ name: `Chain gen ${i}`, gender: i % 2 ? 'M' : 'F', birthYear: 1952 + (i - 1) * 8, fatherId: parent.gender === 'M' ? parent.id : '', motherId: parent.gender === 'F' ? parent.id : '' });
    // Very long name, unknown gender, no dates
    add({ name: 'Shrimati Rajkumari Bhagyashree Vijayalakshmi Pratap-Singh', fatherId: root.id });
    add({ name: 'Unknown details', fatherId: root.id });
    return people;
  }

  window.Samples = {
    list: [
      { key: 'small', label: 'Small (10 people)', make: small },
      { key: 'family', label: 'Family: 5 sons + 3 daughters (~150)', make: () => generate({ seed: 7, sons: 5, daughters: 3, generations: 4, kids: [1, 4], maxPeople: 400 }) },
      { key: 'large', label: 'Large stress test (~1000)', make: () => generate({ seed: 42, sons: 5, daughters: 3, generations: 6, kids: [2, 5], maxPeople: 1000, rootBirth: 1880 }) },
      { key: 'edge', label: 'Edge cases (messy data)', make: edge },
      { key: 'blank', label: 'Start empty', make: () => [] },
    ],
    get(key) { const s = this.list.find((x) => x.key === key) || this.list[1]; return s.make(); },
    BLANK,
  };
})();
