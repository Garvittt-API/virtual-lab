import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { equipment } from "./lab/registry.js";
export default function LiquidScene({ state, selected, onSelect, onMove }) {
  const host = useRef(null),
    latest = useRef({});
  latest.current = { onSelect, onMove };
  useEffect(() => {
    const node = host.current,
      scene = new THREE.Scene();
    scene.background = new THREE.Color("#eaf2f0");
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(6, 6, 9);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    node.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.8, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x90aa9c, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(3, 8, 5);
    scene.add(light);
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: "#d5e4dc" }),
    );
    bench.position.y = -0.1;
    scene.add(bench);
    const grid = new THREE.GridHelper(10, 20, 0xb0c8bd, 0xc6d8cf);
    grid.position.y = 0.01;
    scene.add(grid);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xd5f6f2,
      transparent: true,
      opacity: 0.38,
      roughness: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const objects = {};
    function add(group, geo, mat, y) {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      group.add(m);
      return m;
    }
    for (const v of Object.values(state.objects)) {
      const group = new THREE.Group();
      group.userData.id = v.id;
      const def = equipment[v.kind];
      if (def.model === "funnel") {
        add(
          group,
          new THREE.CylinderGeometry(0.55, 0.08, 0.65, 32, 1, true),
          glass,
          1.5,
        );
        add(
          group,
          new THREE.CylinderGeometry(0.08, 0.08, 0.55, 20, 1, true),
          glass,
          0.91,
        );
      } else {
        const top =
            def.model === "flask"
              ? 0.24
              : def.model === "cylinder"
                ? 0.27
                : 0.55,
          bottom =
            def.model === "flask"
              ? 0.65
              : def.model === "cylinder"
                ? 0.25
                : 0.5,
          height = def.model === "cylinder" ? 1.65 : 1.2;
        add(
          group,
          new THREE.CylinderGeometry(top, bottom, height, 32, 1, true),
          glass,
          height / 2 + 0.05,
        );
        if (def.model === "flask")
          add(
            group,
            new THREE.CylinderGeometry(0.24, 0.24, 0.35, 32, 1, true),
            glass,
            1.42,
          );
        const fraction = v.volumeMl / def.capacityMl;
        if (fraction > 0) {
          const liquidHeight = Math.max(0.015, height * 0.8 * fraction);
          const liquid = new THREE.Mesh(
            new THREE.CylinderGeometry(
              (bottom + (top - bottom) * (liquidHeight / height)) * 0.9,
              bottom * 0.9,
              liquidHeight,
              32,
            ),
            new THREE.MeshStandardMaterial({
              color: "#85cfd3",
              transparent: true,
              opacity: 0.75,
            }),
          );
          liquid.position.y = 0.07 + liquidHeight / 2;
          group.add(liquid);
        }
      }
      group.position.set(v.position[0], 0, v.position[1]);
      group.rotation.y = v.position[2];
      objects[v.id] = group;
      scene.add(group);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.74, 32),
      new THREE.MeshBasicMaterial({ color: "#319a70", side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(
      objects[selected].position.x,
      0.02,
      objects[selected].position.z,
    );
    scene.add(ring);
    for (const c of state.connections) {
      const a = objects[c.a].position,
        b = objects[c.b].position;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(a.x, 1.6, a.z),
        new THREE.Vector3((a.x + b.x) / 2, 2.2, (a.z + b.z) / 2),
        new THREE.Vector3(b.x, 1.25, b.z),
      ]);
      scene.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, 24, 0.025, 6),
          new THREE.MeshBasicMaterial({ color: "#4eaa7c" }),
        ),
      );
    }
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit = new THREE.Vector3(),
      offset = new THREE.Vector3();
    let dragged = null,
      moved = false;
    function coords(e) {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
    }
    function down(e) {
      coords(e);
      const hits = ray.intersectObjects(Object.values(objects), true);
      if (!hits.length) return;
      let o = hits[0].object;
      while (o.parent && !o.userData.id) o = o.parent;
      if (!o.userData.id) return;
      dragged = o;
      moved = false;
      if (ray.ray.intersectPlane(plane, hit))
        offset.set(o.position.x - hit.x, 0, o.position.z - hit.z);
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      latest.current.onSelect(o.userData.id);
    }
    function move(e) {
      if (!dragged) return;
      coords(e);
      if (ray.ray.intersectPlane(plane, hit)) {
        dragged.position.x = THREE.MathUtils.clamp(hit.x + offset.x, -4, 4);
        dragged.position.z = THREE.MathUtils.clamp(hit.z + offset.z, -2.5, 2.5);
        ring.position.set(dragged.position.x, 0.02, dragged.position.z);
        moved = true;
      }
    }
    function up() {
      if (dragged && moved)
        latest.current.onMove(dragged.userData.id, [
          dragged.position.x,
          dragged.position.z,
          dragged.rotation.y,
        ]);
      dragged = null;
      controls.enabled = true;
    }
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    const resize = () => {
      const w = node.clientWidth,
        h = node.clientHeight;
      if (w && h) {
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(node);
    resize();
    let frame;
    function animate() {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [state, selected]);
  return (
    <div
      className="scene"
      ref={host}
      aria-label="Liquid workspace. Drag vessels to move; drag the background to orbit."
    />
  );
}
