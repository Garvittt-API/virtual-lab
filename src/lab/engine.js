import { equipment, stocks } from "./registry.js";
/** @typedef {{id:string, kind:string, position:number[], volumeMl:number, solutes:Record<string,number>}} Vessel */
/** @typedef {{objects:Record<string,Vessel>, connections:Array<{a:string,ap:string,b:string,bp:string}>, events:string[]}} LabState */
/** @param {string} id @param {string} kind @param {number[]} position @returns {Vessel} */
export function createObject(id, kind, position) {
  if (
    !id ||
    !Object.hasOwn(equipment, kind) ||
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every(Number.isFinite)
  )
    throw new Error("Invalid equipment definition or position");
  return { id, kind, position: [...position], volumeMl: 0, solutes: {} };
}
/** @returns {LabState} */
export function createWorkspace() {
  return {
    objects: {
      a: createObject("a", "beaker", [-1.5, 0, 0]),
      b: createObject("b", "flask", [1.5, 0, 0]),
      f: createObject("f", "funnel", [0, -1.5, 0]),
    },
    connections: [],
    events: [],
  };
}
/** @param {LabState} state @param {string} id @returns {Vessel} */
function object(state, id) {
  if (!Object.hasOwn(state.objects, id)) throw new Error("Unknown equipment");
  return state.objects[id];
}
/** @param {Vessel} item */
function definition(item) {
  const def = equipment[item.kind];
  if (!def) throw new Error("Unknown equipment type");
  return def;
}
/** @param {number} amount */
function positive(amount) {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Volume must be positive and finite");
}
/** Validate persisted or supplied state before use. @param {LabState} state */
export function validateWorkspace(state) {
  if (
    !state ||
    !state.objects ||
    !Array.isArray(state.connections) ||
    !Array.isArray(state.events) ||
    !state.events.every((x) => typeof x === "string")
  )
    throw new Error("Invalid workspace");
  for (const [id, v] of Object.entries(state.objects)) {
    if (
      id !== v.id ||
      !Object.hasOwn(equipment, v.kind) ||
      !Array.isArray(v.position) ||
      v.position.length !== 3 ||
      !v.position.every(Number.isFinite) ||
      Math.abs(v.position[0]) > 4 ||
      Math.abs(v.position[1]) > 2.5
    )
      throw new Error("Invalid object");
    if (
      !Number.isFinite(v.volumeMl) ||
      v.volumeMl < 0 ||
      v.volumeMl > definition(v).capacityMl ||
      !v.solutes ||
      typeof v.solutes !== "object" ||
      Array.isArray(v.solutes) ||
      Object.entries(v.solutes).some(
        ([name, n]) => name !== "NaCl" || !Number.isFinite(n) || n < 0,
      ) ||
      (v.volumeMl === 0 && Object.values(v.solutes).some((n) => n > 0))
    )
      throw new Error("Invalid vessel contents");
  }
  const used = new Set();
  for (const c of state.connections) {
    const a = object(state, c.a),
      b = object(state, c.b);
    const ap = Object.hasOwn(definition(a).ports, c.ap)
        ? definition(a).ports[c.ap]
        : undefined,
      bp = Object.hasOwn(definition(b).ports, c.bp)
        ? definition(b).ports[c.bp]
        : undefined;
    const k1 = `${c.a}:${c.ap}`,
      k2 = `${c.b}:${c.bp}`;
    if (
      c.a === c.b ||
      !ap ||
      !bp ||
      !ap.accepts.includes(bp.kind) ||
      !bp.accepts.includes(ap.kind) ||
      used.has(k1) ||
      used.has(k2)
    )
      throw new Error("Invalid connection");
    used.add(k1);
    used.add(k2);
  }
  return true;
}
/** Immutable deterministic command. Volumes mL, amounts mol. Unrecognized or incompatible operations fail atomically.
 * @param {LabState} state @param {any} command @returns {LabState} */
export function execute(state, command) {
  validateWorkspace(state);
  const next = structuredClone(state);
  if (command.type === "add") {
    const v = object(next, command.id),
      def = definition(v),
      stock = Object.hasOwn(stocks, command.stock)
        ? stocks[command.stock]
        : undefined;
    positive(command.volumeMl);
    if (!stock || !def.operations.includes("receive"))
      throw new Error("Incompatible stock or equipment");
    if (v.volumeMl + command.volumeMl > def.capacityMl)
      throw new Error("Capacity exceeded");
    v.volumeMl += command.volumeMl;
    if (stock.solute)
      v.solutes[stock.solute] =
        (v.solutes[stock.solute] || 0) +
        (stock.molarity * command.volumeMl) / 1000;
    next.events.push(`Added ${command.volumeMl} mL ${stock.name} to ${v.id}.`);
  } else if (command.type === "transfer") {
    if (command.from === command.to)
      throw new Error("Select different vessels");
    const from = object(next, command.from),
      to = object(next, command.to);
    positive(command.volumeMl);
    if (
      !definition(from).operations.includes("transfer") ||
      !definition(to).operations.includes("receive")
    )
      throw new Error("Incompatible vessels");
    if (command.volumeMl > from.volumeMl)
      throw new Error("Insufficient liquid");
    if (to.volumeMl + command.volumeMl > definition(to).capacityMl)
      throw new Error("Capacity exceeded");
    const amount = Math.min(command.volumeMl, from.volumeMl),
      fraction = amount / from.volumeMl;
    for (const [name, n] of Object.entries(from.solutes)) {
      const moved = n * fraction;
      from.solutes[name] = n - moved;
      to.solutes[name] = (to.solutes[name] || 0) + moved;
    }
    from.volumeMl -= amount;
    to.volumeMl += amount;
    if (from.volumeMl === 0) from.solutes = {};
    next.events.push(`Transferred ${amount} mL from ${from.id} to ${to.id}.`);
  } else if (command.type === "connect") {
    const { a, ap, b, bp } = command;
    object(next, a);
    object(next, b);
    next.connections.push({ a, ap, b, bp });
    validateWorkspace(next);
    next.events.push(`Connected ${a}:${ap} to ${b}:${bp}.`);
  } else if (command.type === "disconnect") {
    const i = next.connections.findIndex(
      (c) =>
        (c.a === command.id && c.ap === command.port) ||
        (c.b === command.id && c.bp === command.port),
    );
    if (i < 0) throw new Error("Port is not connected");
    next.connections.splice(i, 1);
    next.events.push(`Disconnected ${command.id}:${command.port}.`);
  } else if (command.type === "move") {
    const v = object(next, command.id),
      p = command.position;
    if (
      !Array.isArray(p) ||
      p.length !== 3 ||
      !p.every(Number.isFinite) ||
      Math.abs(p[0]) > 4 ||
      Math.abs(p[1]) > 2.5
    )
      throw new Error("Invalid position");
    v.position = [...p];
    next.events.push(`Moved ${v.id}.`);
  } else throw new Error("Unsupported operation");
  validateWorkspace(next);
  return next;
}
/** @param {Vessel} item @param {string} solute */
export function concentration(item, solute) {
  return item.volumeMl
    ? (item.solutes[solute] || 0) / (item.volumeMl / 1000)
    : 0;
}
