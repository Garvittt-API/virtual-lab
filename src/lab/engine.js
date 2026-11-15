import { react, reactions } from "../simulation/reactions.js";
import { equipment, stocks } from "./registry.js";
/** @typedef {{id:string, kind:string, position:number[], volumeMl:number, solutes:Record<string,number>, solids?:Record<string,number>, mixed?:boolean}} Vessel */
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
        ([name, n]) =>
          !["NaCl", "HCl", "NaOH", "AgNO3", "NaNO3", "H2O"].includes(name) ||
          !Number.isFinite(n) ||
          n < 0,
      ) ||
      (v.solids !== undefined &&
        (!v.solids ||
          typeof v.solids !== "object" ||
          Array.isArray(v.solids) ||
          Object.entries(v.solids).some(
            ([name, n]) => name !== "AgCl" || !Number.isFinite(n) || n < 0,
          ))) ||
      (v.solids &&
        Object.values(v.solids).some((n) => n > 0) &&
        !definition(v).operations.includes("receive")) ||
      (v.mixed !== undefined && typeof v.mixed !== "boolean") ||
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
  if (command.type === "place") {
    if (
      typeof command.id !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(command.id) ||
      Object.hasOwn(next.objects, command.id) ||
      Object.keys(next.objects).length >= 12
    )
      throw new Error("Invalid, duplicate, or excessive equipment ID");
    const v = createObject(command.id, command.kind, command.position);
    if (
      Math.abs(v.position[0]) > 4 ||
      Math.abs(v.position[1]) > 2.5 ||
      Object.values(next.objects).some(
        (o) =>
          Math.hypot(
            o.position[0] - v.position[0],
            o.position[1] - v.position[1],
          ) < 0.5,
      )
    )
      throw new Error("Position is outside the bench or overlaps equipment");
    next.objects[v.id] = v;
    next.events.push(`Placed ${definition(v).name} (${v.id}).`);
  } else if (command.type === "remove") {
    const v = object(next, command.id);
    if (
      v.volumeMl > 0 ||
      Object.values(v.solids || {}).some((n) => n > 0) ||
      next.connections.some((c) => c.a === v.id || c.b === v.id)
    )
      throw new Error("Empty and disconnect equipment before removal");
    delete next.objects[v.id];
    next.events.push(`Removed ${v.id}.`);
  } else if (command.type === "add") {
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
    v.mixed = false;
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
    to.mixed = false;
    if (from.volumeMl === 0) from.solutes = {};
    next.events.push(`Transferred ${amount} mL from ${from.id} to ${to.id}.`);
  } else if (command.type === "mix") {
    const v = object(next, command.id);
    if (!definition(v).operations.includes("receive") || v.volumeMl <= 0)
      throw new Error("A nonempty vessel is required");
    v.mixed = true;
    next.events.push(
      `Mixed vessel ${v.id}; model assumes instantaneous homogeneity.`,
    );
  } else if (command.type === "react") {
    const v = object(next, command.id);
    if (!v.mixed || v.volumeMl <= 0)
      throw new Error("Mix a nonempty vessel first");
    if (!["neutralization", "precipitation"].includes(command.reactionId))
      throw new Error("Unsupported vessel reaction");
    const reaction = reactions[command.reactionId];
    if (reaction.reactants.some((t) => !(v.solutes[t.species] > 0)))
      throw new Error("Both dissolved reactants are required");
    const result = react(reaction, v.solutes);
    const dissolved = { ...result.inventory };
    if (result.produced.AgCl !== undefined) {
      v.solids = {
        ...v.solids,
        AgCl: (v.solids?.AgCl || 0) + result.produced.AgCl,
      };
      delete dissolved.AgCl;
    }
    v.solutes = dissolved;
    const consumed = Object.fromEntries(
      reaction.reactants.map((t) => [t.species, t.coefficient * result.extent]),
    );
    v.mixed = false;
    next.events.push(
      `Reaction ${reaction.id} in ${v.id}: extent ${result.extent} mol; limiting ${result.limiting.join(", ")}; consumed ${JSON.stringify(consumed)}; produced ${JSON.stringify(result.produced)}.`,
    );
  } else if (command.type === "observe") {
    if (
      typeof command.note !== "string" ||
      !command.note.trim() ||
      command.note.length > 2000
    )
      throw new Error(
        "Observation must be nonempty and at most 2000 characters",
      );
    next.events.push(`Observation: ${command.note.trim()}`);
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
