import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function Scene({
  baseMl,
  selected,
  onSelect,
  positions,
  onMove,
}) {
  const mount = useRef(null),
    latest = useRef({});
  latest.current = { onSelect, onMove };
  useEffect(() => {
    const host = mount.current,
      scene = new THREE.Scene();
    scene.background = new THREE.Color("#eaf2f0");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(7, 6, 9);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI / 2.05;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9bb5aa, 2.3));
    const light = new THREE.DirectionalLight(0xffffff, 2.6);
    light.position.set(3, 8, 5);
    light.castShadow = true;
    scene.add(light);
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: "#d5e4dc" }),
    );
    bench.position.y = -0.12;
    bench.receiveShadow = true;
    scene.add(bench);
    const grid = new THREE.GridHelper(10, 20, 0xb0c8bd, 0xc6d8cf);
    grid.position.y = 0.012;
    scene.add(grid);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xd9f8f5,
      transparent: true,
      opacity: 0.38,
      roughness: 0.12,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#344b49",
      metalness: 0.4,
      roughness: 0.4,
    });
    const objects = {};
    const selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 0.92, 48),
      new THREE.MeshBasicMaterial({
        color: 0x2f9c70,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.025;
    scene.add(selectionRing);
    scene.userData.selectionRing = selectionRing;
    function addMesh(group, geometry, material, x, y, z) {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      m.castShadow = true;
      group.add(m);
      return m;
    }
    const flask = new THREE.Group();
    flask.userData.id = "flask";
    addMesh(
      flask,
      new THREE.CylinderGeometry(0.22, 0.8, 1.35, 40, 1, true),
      glass,
      0,
      0.8,
      0,
    );
    addMesh(
      flask,
      new THREE.CylinderGeometry(0.22, 0.22, 0.48, 32, 1, true),
      glass,
      0,
      1.68,
      0,
    );
    addMesh(
      flask,
      new THREE.TorusGeometry(0.22, 0.025, 8, 32),
      glass,
      0,
      1.92,
      0,
    ).rotation.x = Math.PI / 2;
    const liquid = addMesh(
      flask,
      new THREE.CylinderGeometry(0.53, 0.73, 0.38, 40),
      new THREE.MeshStandardMaterial({
        color: "#8fd6cb",
        transparent: true,
        opacity: 0.8,
      }),
      0,
      0.28,
      0,
    );
    liquid.name = "liquid";
    scene.add(flask);
    objects.flask = flask;
    const stand = new THREE.Group();
    stand.userData.id = "stand";
    addMesh(stand, new THREE.BoxGeometry(1.4, 0.12, 1), dark, 0, 0.08, 0);
    addMesh(
      stand,
      new THREE.CylinderGeometry(0.045, 0.045, 3.8, 12),
      dark,
      -0.45,
      1.98,
      0,
    );
    addMesh(
      stand,
      new THREE.CylinderGeometry(0.035, 0.035, 0.85, 12),
      dark,
      0,
      3.18,
      0,
    ).rotation.z = Math.PI / 2;
    addMesh(
      stand,
      new THREE.CylinderGeometry(0.11, 0.11, 2.4, 24, 1, true),
      glass,
      0.35,
      2.15,
      0,
    );
    addMesh(
      stand,
      new THREE.CylinderGeometry(0.04, 0.04, 0.35, 12),
      glass,
      0.35,
      0.78,
      0,
    );
    addMesh(stand, new THREE.BoxGeometry(0.4, 0.08, 0.08), dark, 0.35, 0.97, 0);
    scene.add(stand);
    objects.stand = stand;
    const beaker = new THREE.Group();
    beaker.userData.id = "beaker";
    addMesh(
      beaker,
      new THREE.CylinderGeometry(0.52, 0.48, 1, 32, 1, true),
      glass,
      0,
      0.55,
      0,
    );
    addMesh(
      beaker,
      new THREE.CylinderGeometry(0.46, 0.46, 0.38, 32),
      new THREE.MeshStandardMaterial({
        color: "#b6ded8",
        transparent: true,
        opacity: 0.7,
      }),
      0,
      0.24,
      0,
    );
    scene.add(beaker);
    objects.beaker = beaker;
    scene.userData.objects = objects;
    scene.userData.liquid = liquid;
    host._scene = scene;
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit = new THREE.Vector3();
    let dragging = null,
      moved = false;
    const offset = new THREE.Vector3();
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
      if (hits.length) {
        let o = hits[0].object;
        while (o.parent && !o.userData.id) o = o.parent;
        if (o.userData.id) {
          dragging = o;
          moved = false;
          if (ray.ray.intersectPlane(plane, hit))
            offset.set(o.position.x - hit.x, 0, o.position.z - hit.z);
          else offset.set(0, 0, 0);
          controls.enabled = false;
          renderer.domElement.setPointerCapture(e.pointerId);
          latest.current.onSelect(o.userData.id);
        }
      }
    }
    function move(e) {
      if (!dragging) return;
      coords(e);
      if (ray.ray.intersectPlane(plane, hit)) {
        dragging.position.x = THREE.MathUtils.clamp(hit.x + offset.x, -4, 4);
        dragging.position.z = THREE.MathUtils.clamp(
          hit.z + offset.z,
          -2.5,
          2.5,
        );
        safelyMoveRing(dragging);
        moved = true;
      }
    }
    function safelyMoveRing(o) {
      selectionRing.position.set(o.position.x, 0.025, o.position.z);
    }
    function up() {
      if (dragging && moved)
        latest.current.onMove(dragging.userData.id, [
          dragging.position.x,
          dragging.position.z,
          dragging.rotation.y,
        ]);
      dragging = null;
      controls.enabled = true;
    }
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
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
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      delete host._scene;
    };
  }, []);
  useEffect(() => {
    const s = mount.current?._scene;
    if (!s) return;
    Object.entries(positions).forEach(([id, p]) => {
      if (s.userData.objects[id])
        (s.userData.objects[id].position.set(p[0], 0, p[1]),
          (s.userData.objects[id].rotation.y = p[2] || 0));
    });
    const l = s.userData.liquid;
    l.scale.y = 1 + baseMl / 50;
    l.position.y = 0.1 + 0.19 * l.scale.y;
    l.material.color.set(baseMl > 25 ? "#e29cb5" : "#8fd6cb");
  }, [positions, baseMl]);
  useEffect(() => {
    const s = mount.current?._scene;
    if (!s) return;
    const o = s.userData.objects[selected];
    if (o) {
      s.userData.selectionRing.position.set(o.position.x, 0.025, o.position.z);
    }
  }, [selected, positions]);
  return (
    <div
      ref={mount}
      className="scene"
      aria-label="Interactive 3D laboratory. Drag an object to move it; drag empty space to orbit."
    />
  );
}
