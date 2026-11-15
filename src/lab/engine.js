import { react, reactions } from "../simulation/reactions.js";
import { equipment, stocks } from "./registry.js";
import { substances, convertVolume } from "../simulation/substances.js";
import { oxygenReaction } from "../oxygen.js";
/** @typedef {{id:string, kind:string, position:number[], volumeMl:number, solutes:Record<string,number>, solids:Record<string,number>, gases:Record<string,number>, heated?:boolean, mixed?:boolean}} Vessel */
/** @typedef {{objects:Record<string,Vessel>, connections:Array<{a:string,ap:string,b:string,bp:string,connectionType?:string,sourceEquipment?:string,destinationEquipment?:string,direction?:string,capacityMl?:number|null,capacityGasMl?:number|null,status?:string}>, events:string[]}} LabState */
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
  return { id, kind, position: [...position], volumeMl: 0, solutes: {}, solids: {}, gases: {} };
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
/** Find a connected gas receiver without treating decorative non-gas links as flow paths. @param {LabState} state @param {string} sourceId @returns {string|null} */
export function gasReceiver(state, sourceId) {
  const queue = [sourceId], seen = new Set(queue);
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if (current !== sourceId && equipment[state.objects[current]?.kind]?.operations.includes("collect-gas")) return current;
    for (const c of state.connections) {
      const from = c.a === current ? c.b : c.b === current ? c.a : null;
      if (!from || seen.has(from)) continue;
      const a = object(state, c.a), b = object(state, c.b);
      const ap = equipment[a.kind].ports[c.ap], bp = equipment[b.kind].ports[c.bp];
      const gasKinds = ["gas-source", "gas-tube", "gas-port"];
      if (gasKinds.includes(ap.kind) && gasKinds.includes(bp.kind)) { seen.add(from); queue.push(from); }
    }
  }
  return null;
}
/** Move stored gas into the first connected receiver up to its declared volume limit. @param {LabState} state @param {string} sourceId @returns {{receiverId:string|null,collected:number}} */
function collectAccessibleGas(state, sourceId) {
  const receiverId = gasReceiver(state, sourceId);
  if (!receiverId) return { receiverId: null, collected: 0 };
  const source = object(state, sourceId), receiver = object(state, receiverId);
  source.gases ||= {}; receiver.gases ||= {};
  const available = source.gases.O2 || 0;
  const occupiedMl = Object.values(receiver.gases || {}).reduce((sum, n) => sum + n, 0) * oxygenReaction.molarGasVolume * 1000;
  const capacityMl = equipment[receiver.kind].gasCapacityMl;
  if (typeof capacityMl !== "number" || !Number.isFinite(capacityMl)) throw new Error("Gas receiver has no declared capacity");
  const transfer = Math.min(available, Math.max(0, capacityMl - occupiedMl) / (oxygenReaction.molarGasVolume * 1000));
  if (transfer > 0) {
    receiver.gases.O2 = (receiver.gases.O2 || 0) + transfer;
    source.gases.O2 -= transfer;
    if (source.gases.O2 < 1e-14) source.gases.O2 = 0;
  }
  return { receiverId, collected: transfer };
}
/** @param {LabState} state @param {string} source @param {string} destination @param {string} kind */
function connectedByPortKind(state, source, destination, kind) {
  return state.connections.some((c) => {
    const pair = c.a === source && c.b === destination ? [c.ap, c.bp] : c.b === source && c.a === destination ? [c.bp, c.ap] : null;
    if (!pair) return false;
    const a = equipment[state.objects[source].kind].ports[pair[0]], b = equipment[state.objects[destination].kind].ports[pair[1]];
    return a.kind === kind && b.kind === "open-vessel";
  });
}
/** @param {LabState} state @param {string} source @param {string} destination @param {string} kind @returns {number|null} */
function connectedCapacity(state, source, destination, kind) {
  const connection = state.connections.find((c) => {
    const pair = c.a === source && c.b === destination ? [c.ap, c.bp] : c.b === source && c.a === destination ? [c.bp, c.ap] : null;
    if (!pair) return false;
    const a = equipment[state.objects[source].kind].ports[pair[0]], b = equipment[state.objects[destination].kind].ports[pair[1]];
    return a.kind === kind && b.kind === "open-vessel";
  });
  return connection?.capacityMl ?? null;
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
            ([name, n]) => !["AgCl", "KClO3", "KCl"].includes(name) || !Number.isFinite(n) || n < 0,
          ))) ||
      (v.solids &&
        Object.values(v.solids).some((n) => n > 0) &&
        !definition(v).operations.some((operation) => ["receive", "receive-solid"].includes(operation))) ||
      (v.gases !== undefined && (!v.gases || typeof v.gases !== "object" || Array.isArray(v.gases) ||
        Object.entries(v.gases).some(([name, n]) => name !== "O2" || !Number.isFinite(n) || n < 0) ||
        (Object.values(v.gases).some((n) => n > 0) && !definition(v).operations.includes("collect-gas") && !definition(v).operations.includes("emit-gas")))) ||
      (v.gases && equipment[v.kind].gasCapacityMl !== undefined &&
        Object.values(v.gases).reduce((sum, n) => sum + n, 0) * oxygenReaction.molarGasVolume * 1000 > (equipment[v.kind].gasCapacityMl || 0) + 1e-8) ||
      (v.mixed !== undefined && typeof v.mixed !== "boolean") ||
      (v.heated !== undefined && typeof v.heated !== "boolean") ||
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
      (c.connectionType !== undefined && (!['gas', 'liquid', 'liquid-funnel', 'support', 'condenser'].includes(c.connectionType) || c.status !== "connected" ||
        typeof c.sourceEquipment !== "string" || ![c.a, c.b].includes(c.sourceEquipment) || typeof c.destinationEquipment !== "string" || ![c.a, c.b].includes(c.destinationEquipment) || c.sourceEquipment === c.destinationEquipment ||
        c.direction !== `${c.sourceEquipment}-to-${c.destinationEquipment}` ||
        (c.capacityMl !== null && c.capacityMl !== undefined && (!Number.isFinite(c.capacityMl) || c.capacityMl < 0)) ||
        (c.capacityGasMl !== null && c.capacityGasMl !== undefined && (!Number.isFinite(c.capacityGasMl) || c.capacityGasMl < 0)))) ||
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
  for (const vessel of Object.values(next.objects)) { vessel.solids ||= {}; vessel.gases ||= {}; }
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
      Object.values(v.solids || {}).some((n) => n > 0) || Object.values(v.gases || {}).some((n) => n > 0) ||
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
    const molarity = command.concentration === undefined ? stock.molarity : command.concentration;
    if (!Number.isFinite(molarity) || molarity < 0 || molarity > 20 || (!stock.solute && molarity !== 0))
      throw new Error("Concentration must be 0–20 M for a dissolved stock");
    if (v.volumeMl + command.volumeMl > def.capacityMl)
      throw new Error("Capacity exceeded");
    v.volumeMl += command.volumeMl;
    v.mixed = false;
    if (stock.solute)
      v.solutes[stock.solute] =
        (v.solutes[stock.solute] || 0) +
        (molarity * command.volumeMl) / 1000;
    next.events.push(`Added ${command.volumeMl} mL ${stock.name}${stock.solute ? ` (${molarity} M)` : ""} to ${v.id}.`);
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
    if (definition(from).operations.includes("dispense") && !connectedByPortKind(next, from.id, to.id, "pipette-tip"))
      throw new Error("Connect the dispensing tip to the receiving vessel first");
    if (definition(from).operations.includes("dispense") && command.volumeMl > (connectedCapacity(next, from.id, to.id, "pipette-tip") ?? 0))
      throw new Error("Dispensing connection capacity exceeded");
    if (command.via !== undefined) {
      const funnel = object(next, command.via);
      if (funnel.kind !== "funnel" || !connectedByPortKind(next, funnel.id, to.id, "funnel-stem"))
        throw new Error("Connect the funnel to the receiving vessel first");
      if (command.volumeMl > (connectedCapacity(next, funnel.id, to.id, "funnel-stem") ?? 0)) throw new Error("Funnel connection capacity exceeded");
    }
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
  } else if (command.type === "measure") {
    const v = object(next, command.id);
    if (
      !definition(v).operations.includes("receive") ||
      v.volumeMl <= 0 ||
      typeof command.solute !== "string" ||
      !Object.hasOwn(substances, command.solute)
    )
      throw new Error("A nonempty vessel and known solute are required");
    const value = concentration(v, command.solute);
    next.events.push(`Measured ${command.solute}: ${value} mol/L in ${v.id}.`);
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
    const pa = definition(object(next, a)).ports[ap], pb = definition(object(next, b)).ports[bp];
    const gasKinds = ["gas-source", "gas-tube", "gas-port"];
    const connectionType = gasKinds.includes(pa?.kind) && gasKinds.includes(pb?.kind) ? "gas" :
      pa?.kind === "funnel-stem" || pb?.kind === "funnel-stem" ? "liquid-funnel" :
      pa?.kind?.includes("clamp") || pb?.kind?.includes("clamp") || pa?.kind?.includes("stand") || pb?.kind?.includes("stand") ? "support" :
      pa?.kind?.includes("condenser") || pb?.kind?.includes("condenser") ? "condenser" : "liquid";
    const aOps = definition(object(next, a)).operations, bOps = definition(object(next, b)).operations;
    const sourceEquipment = aOps.includes("transfer") || aOps.includes("emit-gas") ? a : bOps.includes("transfer") || bOps.includes("emit-gas") ? b : a;
    const destinationEquipment = sourceEquipment === a ? b : a;
    const caps = [definition(object(next, a)).capacityMl, definition(object(next, b)).capacityMl].filter((n) => n > 0);
    const gasCaps = [definition(object(next, a)).gasCapacityMl, definition(object(next, b)).gasCapacityMl].filter((n) => typeof n === "number");
    next.connections.push({ a, ap, b, bp, connectionType, sourceEquipment, destinationEquipment, direction: `${sourceEquipment}-to-${destinationEquipment}`, capacityMl: caps.length ? Math.min(...caps) : null, capacityGasMl: gasCaps.length ? Math.min(...gasCaps) : null, status: "connected" });
    validateWorkspace(next);
    const gasSourceId = connectionType === "gas" && next.objects.tube?.kind === "reactionVessel" ? "tube" : null;
    const collected = gasSourceId ? collectAccessibleGas(next, gasSourceId).collected : 0;
    next.events.push(`Connected ${a}:${ap} to ${b}:${bp}.`);
    if (collected > 0) next.events.push(`Connected gas path collected ${collected} mol O₂ from the reaction vessel.`);
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
    const snapped = [Math.round(p[0] * 4) / 4, Math.round(p[1] * 4) / 4, p[2]];
    if (Object.values(next.objects).some((o) => o.id !== v.id &&
      Math.hypot(o.position[0] - snapped[0], o.position[1] - snapped[1]) < 0.5))
      throw new Error("Position overlaps other equipment");
    v.position = snapped;
    next.events.push(`Moved ${v.id} to ${snapped[0]}, ${snapped[1]} m (0.25 m snap).`);
  } else if (command.type === "rotate") {
    const v = object(next, command.id);
    if (!Number.isFinite(command.radians)) throw new Error("Invalid rotation");
    v.position[2] = Math.round((v.position[2] + command.radians) / (Math.PI / 12)) * (Math.PI / 12);
    next.events.push(`Rotated ${v.id} to ${Math.round(v.position[2] * 180 / Math.PI)}°.`);
  } else if (command.type === "add-solid") {
    const v = object(next, command.id);
    if (!definition(v).operations.includes("receive-solid") || command.stock !== "chlorate" || !Number.isFinite(command.massG) || command.massG <= 0 || command.massG > 100)
      throw new Error("Solid addition is unsupported or outside the model range");
    const amount = command.massG / oxygenReaction.potassiumChlorateMolarMass;
    v.solids.KClO3 = (v.solids.KClO3 || 0) + amount;
    next.events.push(`Loaded ${command.massG.toFixed(2)} g KClO₃ into ${v.id} (${amount} mol).`);
  } else if (command.type === "heat") {
    const v = object(next, command.id), burner = object(next, command.burnerId || "burner");
    if (!definition(v).operations.includes("heat") || !definition(burner).operations.includes("heat") || !Number.isFinite(command.fraction) || command.fraction <= 0 || command.fraction > 1 || !(v.solids?.KClO3 > 0))
      throw new Error("Heating requires a loaded reaction vessel and a valid conversion fraction");
    if (Math.hypot(v.position[0] - burner.position[0], v.position[1] - burner.position[1]) > 1.2)
      throw new Error("Move the burner within 1.2 m of the reaction vessel");
    const yieldResult = react(reactions.oxygen, { KClO3: v.solids.KClO3 }, command.fraction);
    const consumedKClO3 = yieldResult.extent * 2;
    v.solids.KClO3 = yieldResult.inventory.KClO3 || 0;
    v.solids.KCl = (v.solids.KCl || 0) + (yieldResult.produced.KCl || 0);
    const generated = yieldResult.produced.O2 || 0;
    v.gases.O2 = (v.gases.O2 || 0) + generated;
    burner.heated = true;
    const { collected } = collectAccessibleGas(next, v.id);
    next.events.push(`Heating stage ${v.id}: consumed ${consumedKClO3.toPrecision(5)} mol KClO₃; generated ${generated} mol O₂, collected ${collected} mol, uncollected ${generated - collected} mol.`);
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

/** Normalizes user-entered units then invokes the authoritative vessel engine. @param {LabState} state @param {any} command @returns {LabState} */
export function executeCommand(state, command) {
  if (!command || typeof command.type !== "string")
    throw new Error("Invalid command");
  const normalized = { ...command };
  if (
    ["add", "transfer"].includes(command.type) &&
    command.volume !== undefined
  )
    normalized.volumeMl = convertVolume(command.volume, command.unit, "mL");
  return execute(state, normalized);
}
