import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { equipment } from "./lab/registry.js";

function createEquipment(v, glass) {
  const group = new THREE.Group();
  group.userData.id = v.id;
  const def = equipment[v.kind], model = def.model;
  const mesh = (geo, material, y = 0) => {
    const m = new THREE.Mesh(geo, material); m.position.y = y; group.add(m); return m;
  };
  const metal = new THREE.MeshStandardMaterial({ color: "#6d7c7a", metalness: 0.65, roughness: 0.32 });
  const solid = new THREE.MeshStandardMaterial({ color: "#f4f2e8", roughness: 1 });
  group.userData.ownedMaterials = [glass, metal, solid];
  if (model === "funnel") {
    mesh(new THREE.CylinderGeometry(0.55, 0.08, 0.65, 32, 1, true), glass, 1.5);
    mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 20, 1, true), glass, 0.91);
  } else if (["deliveryTube", "condenser"].includes(model)) {
    const hose = model === "deliveryTube" ? new THREE.MeshStandardMaterial({ color: "#456f65", roughness: 0.62 }) : glass;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.95, 0.85, 0), new THREE.Vector3(-0.65, 1.25, 0),
      new THREE.Vector3(0.55, 1.25, 0), new THREE.Vector3(0.95, 0.72, 0),
    ]);
    mesh(new THREE.TubeGeometry(curve, 32, model === "condenser" ? 0.09 : 0.035, 10), hose);
    if (model === "condenser") {
      const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.85, 20, 1, true), glass);
      jacket.rotation.z = Math.PI / 2; jacket.position.y = 1.25; group.add(jacket);
    }
  } else if (["stand", "clamp", "rod", "burner"].includes(model)) {
    if (model === "stand") {
      mesh(new THREE.BoxGeometry(1.3, 0.12, 0.6), metal, 0.06);
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 16), metal, 1.35);
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 12), metal, 2.1).rotation.z = Math.PI / 2;
    } else if (model === "burner") {
      mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.12, 24), metal, 0.08);
      mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.62, 24), metal, 0.43);
      if (v.heated) mesh(new THREE.ConeGeometry(0.2, 0.6, 20), new THREE.MeshBasicMaterial({ color: "#76c9f2", transparent: true, opacity: 0.75 }), 1.04);
    } else if (model === "clamp") {
      mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), metal, 1.2);
      mesh(new THREE.TorusGeometry(0.22, 0.035, 10, 24, Math.PI), metal, 1.25).rotation.z = Math.PI;
    } else {
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 12), glass, 0.85).rotation.z = Math.PI / 2;
    }
  } else if (model === "watchGlass") {
    mesh(new THREE.SphereGeometry(0.65, 32, 12, 0, Math.PI * 2, 0, 0.45), glass, 0.12);
  } else if (["dropper", "pipette", "burette"].includes(model)) {
    const length = model === "burette" ? 2.8 : model === "pipette" ? 1.7 : 0.9;
    mesh(new THREE.CylinderGeometry(model === "burette" ? 0.09 : 0.045, 0.025, length, 16, 1, true), glass, length / 2 + 0.06);
    if (model === "dropper") mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ color: "#829b9c" }), length + 0.08);
    if (model === "burette") mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), metal, 0.35);
  } else {
    const top = model === "flask" || model === "volumetric" ? 0.24 : model === "cylinder" ? 0.27 : 0.55;
    const bottom = model === "flask" || model === "volumetric" ? 0.65 : model === "cylinder" ? 0.25 : 0.5;
    const height = model === "cylinder" ? 1.65 : model === "roundFlask" ? 1.25 : model === "tube" ? 1.45 : 1.2;
    if (model === "roundFlask") mesh(new THREE.SphereGeometry(0.62, 32, 24), glass, 0.65);
    else mesh(new THREE.CylinderGeometry(top, bottom, height, 32, 1, true), glass, height / 2 + 0.05);
    if (["flask", "volumetric", "roundFlask"].includes(model))
      mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.35, 32, 1, true), glass, 1.42);
    if (model === "bottle") {
      mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 24, 1, true), glass, 1.48);
      mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 20), metal, 1.66);
    }
    if (model === "volumetric") mesh(new THREE.TorusGeometry(0.25, 0.018, 8, 32), new THREE.MeshBasicMaterial({ color: "#529e82" }), 1.43);
    if (model === "tube") mesh(new THREE.SphereGeometry(0.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0.1);
    const fraction = v.volumeMl / Math.max(def.capacityMl, 1);
    if (fraction > 0 && def.capacityMl > 0) {
      const amount = Object.values(v.solutes || {}).reduce((a, b) => a + b, 0);
      const color = (v.solutes?.AgNO3 || 0) > 0 ? "#d6e7c3" : (v.solutes?.HCl || 0) > 0 ? "#e5f0dd" : (v.solutes?.NaOH || 0) > 0 ? "#d3e6df" : "#83c9ce";
      const liquidHeight = Math.max(0.025, height * 0.8 * Math.min(1, fraction));
      const liquidMaterial = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.83, roughness: 0.25 });
      mesh(new THREE.CylinderGeometry(Math.max(0.08, bottom * 0.86), bottom * 0.9, liquidHeight, 32), liquidMaterial, 0.08 + liquidHeight / 2);
      group.userData.amountMol = amount;
    }
    const solidMoles = Object.values(v.solids || {}).reduce((sum, n) => sum + n, 0);
    if (solidMoles > 0) {
      const solidColor = (v.solids?.AgCl || 0) > 0 ? "#f4f2e8" : (v.solids?.KClO3 || 0) > 0 ? "#e7e5dc" : "#ddd9cb";
      const precipitate = solid.clone(); precipitate.color.set(solidColor);
      mesh(new THREE.CylinderGeometry(bottom * 0.8, bottom * 0.8, Math.min(0.13, 0.04 + solidMoles * 8), 32), precipitate, 0.09);
    }
    const gasMl = Object.values(v.gases || {}).reduce((sum, n) => sum + n, 0) * 22.414 * 1000;
    if (gasMl > 0 && def.gasCapacityMl) {
      const gasHeight = height * 0.8 * Math.min(1, gasMl / def.gasCapacityMl);
      mesh(new THREE.CylinderGeometry(top * 0.86, Math.max(0.06, top * 0.82), gasHeight, 24), new THREE.MeshStandardMaterial({ color: "#c7e6ed", transparent: true, opacity: 0.22, depthWrite: false }), height * 0.22 + gasHeight / 2);
    }
  }
  group.position.set(v.position[0], 0, v.position[1]);
  group.rotation.y = v.position[2];
  return group;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.parent = null;
    const geometries = new Set(), materials = new Set(child.userData.ownedMaterials || []);
    child.traverse((o) => { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m)); });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
  }
}

export default function LiquidScene({ state, selected, onSelect, onMove }) {
  const host = useRef(null), runtime = useRef(null), latest = useRef({});
  latest.current = { onSelect, onMove };
  useEffect(() => {
    const node = host.current, scene = new THREE.Scene();
    scene.background = new THREE.Color("#eaf2f0");
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100); camera.position.set(6, 6, 9);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); node.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0.8, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.05; controls.minDistance = 5; controls.maxDistance = 18;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x90aa9c, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(3, 8, 5); scene.add(light);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 6), new THREE.MeshStandardMaterial({ color: "#d5e4dc" })); bench.position.y = -0.1; scene.add(bench);
    const grid = new THREE.GridHelper(10, 20, 0xb0c8bd, 0xc6d8cf); grid.position.y = 0.01; scene.add(grid);
    const equipmentRoot = new THREE.Group(), connectionRoot = new THREE.Group(), selection = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.74, 32), new THREE.MeshBasicMaterial({ color: "#319a70", side: THREE.DoubleSide }));
    selection.rotation.x = -Math.PI / 2; scene.add(equipmentRoot, connectionRoot, selection);
    runtime.current = { scene, camera, renderer, controls, equipmentRoot, connectionRoot, selection };
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), offset = new THREE.Vector3();
    let dragged = null, moved = false;
    const coords = (e) => { const r = renderer.domElement.getBoundingClientRect(); pointer.set(((e.clientX-r.left)/r.width)*2-1, (-(e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(pointer,camera); };
    const down = (e) => { coords(e); const hits = ray.intersectObjects(equipmentRoot.children, true); if (!hits.length) return; let o=hits[0].object; while (o.parent && !o.userData.id) o=o.parent; if (!o.userData.id) return; dragged=o; moved=false; latest.current.onSelect(o.userData.id); if (ray.ray.intersectPlane(plane,hit)) offset.set(o.position.x-hit.x,0,o.position.z-hit.z); controls.enabled=false; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = (e) => { if (!dragged) return; coords(e); if(ray.ray.intersectPlane(plane,hit)){ dragged.position.x=THREE.MathUtils.clamp(hit.x+offset.x,-4,4); dragged.position.z=THREE.MathUtils.clamp(hit.z+offset.z,-2.5,2.5); selection.position.set(dragged.position.x,0.025,dragged.position.z); moved=true; } };
    const up = () => { if(dragged&&moved) latest.current.onMove(dragged.userData.id,[dragged.position.x,dragged.position.z,dragged.rotation.y]); dragged=null; controls.enabled=true; };
    const lost = (e) => { e.preventDefault(); node.dataset.context = "WebGL context lost. Attempting to restore the laboratory view…"; };
    const restored = () => { delete node.dataset.context; };
    renderer.domElement.addEventListener("pointerdown",down); renderer.domElement.addEventListener("pointermove",move); renderer.domElement.addEventListener("pointerup",up); renderer.domElement.addEventListener("pointercancel",up); renderer.domElement.addEventListener("webglcontextlost",lost,false); renderer.domElement.addEventListener("webglcontextrestored",restored,false);
    const resize=()=>{const w=node.clientWidth,h=node.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}}; const ro=new ResizeObserver(resize); ro.observe(node); resize(); let frame; const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}; animate();
    return ()=>{cancelAnimationFrame(frame);ro.disconnect();controls.dispose();renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",up);renderer.domElement.removeEventListener("webglcontextlost",lost);renderer.domElement.removeEventListener("webglcontextrestored",restored);clearGroup(equipmentRoot);clearGroup(connectionRoot);scene.traverse((o)=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach((m)=>m.dispose());});renderer.dispose();renderer.domElement.remove();runtime.current=null;};
  }, []);
  useEffect(() => {
    const rt=runtime.current; if(!rt) return;
    clearGroup(rt.equipmentRoot); clearGroup(rt.connectionRoot);
    const objects={}; for(const v of Object.values(state.objects)){const g=createEquipment(v,new THREE.MeshPhysicalMaterial({color:0xd5f6f2,transparent:true,opacity:0.38,roughness:0.13,side:THREE.DoubleSide,depthWrite:false}));objects[v.id]=g;rt.equipmentRoot.add(g);}
    for(const c of state.connections){const a=objects[c.a]?.position,b=objects[c.b]?.position;if(!a||!b)continue;const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(a.x,1.6,a.z),new THREE.Vector3((a.x+b.x)/2,2.2,(a.z+b.z)/2),new THREE.Vector3(b.x,1.25,b.z)]);rt.connectionRoot.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,0.025,6),new THREE.MeshBasicMaterial({color:"#4eaa7c"})));}
    const selectedObject=objects[selected];rt.selection.visible=!!selectedObject;if(selectedObject)rt.selection.position.set(selectedObject.position.x,0.025,selectedObject.position.z);
  }, [state, selected]);
  return <div className="scene" ref={host} aria-label="3D chemistry workbench. Select and drag equipment; use movement controls for precise positioning." />;
}
