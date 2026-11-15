import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function OxygenScene({ state, selected, onSelect, onMove }) {
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
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8ba99b, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(3, 8, 5);
    scene.add(light);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: "#d5e4dc" }),
    );
    base.position.y = -0.1;
    scene.add(base);
    const grid = new THREE.GridHelper(10, 20, 0xb0c8bd, 0xc6d8cf);
    grid.position.y = 0.01;
    scene.add(grid);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xcff3ef,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.15,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: "#536965",
      metalness: 0.4,
      roughness: 0.4,
    });
    function part(group, geometry, material, x, y, z) {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      group.add(m);
      return m;
    }
    const objects = {};
    const tube = new THREE.Group();
    tube.userData.id = "tube";
    part(
      tube,
      new THREE.CylinderGeometry(0.3, 0.3, 1.6, 32, 1, true),
      glass,
      0,
      1.4,
      0,
    );
    part(
      tube,
      new THREE.SphereGeometry(
        0.3,
        24,
        12,
        0,
        Math.PI * 2,
        Math.PI / 2,
        Math.PI / 2,
      ),
      glass,
      0,
      0.6,
      0,
    );
    part(
      tube,
      new THREE.CylinderGeometry(0.31, 0.31, 0.12, 24),
      metal,
      0,
      2.23,
      0,
    );
    const solid = part(
      tube,
      new THREE.CylinderGeometry(0.24, 0.24, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: "#eee9df" }),
      0,
      0.7,
      0,
    );
    solid.visible = false;
    tube.userData.solid = solid;
    objects.tube = tube;
    scene.add(tube);
    const burner = new THREE.Group();
    burner.userData.id = "burner";
    part(
      burner,
      new THREE.CylinderGeometry(0.48, 0.52, 0.12, 24),
      metal,
      0,
      0.08,
      0,
    );
    part(
      burner,
      new THREE.CylinderGeometry(0.12, 0.16, 0.72, 24),
      metal,
      0,
      0.5,
      0,
    );
    const flame = part(
      burner,
      new THREE.ConeGeometry(0.2, 0.6, 20),
      new THREE.MeshBasicMaterial({
        color: "#76c9f2",
        transparent: true,
        opacity: 0.75,
      }),
      0,
      1.15,
      0,
    );
    flame.visible = false;
    burner.userData.flame = flame;
    objects.burner = burner;
    scene.add(burner);
    const jar = new THREE.Group();
    jar.userData.id = "jar";
    part(
      jar,
      new THREE.CylinderGeometry(0.55, 0.55, 1.8, 32, 1, true),
      glass,
      0,
      1,
      0,
    );
    part(
      jar,
      new THREE.CylinderGeometry(0.52, 0.52, 0.08, 32),
      glass,
      0,
      0.1,
      0,
    );
    const water = part(
      jar,
      new THREE.CylinderGeometry(0.48, 0.48, 1.3, 32),
      new THREE.MeshStandardMaterial({
        color: "#95d7da",
        transparent: true,
        opacity: 0.55,
      }),
      0,
      0.76,
      0,
    );
    jar.userData.water = water;
    const bubbles = new THREE.Group();
    for (let i = 0; i < 5; i++)
      part(
        bubbles,
        new THREE.SphereGeometry(0.05, 10, 8),
        new THREE.MeshBasicMaterial({ color: "#e7ffff" }),
        0.13 * Math.sin(i * 2),
        0.3 + i * 0.23,
        0,
      );
    jar.add(bubbles);
    bubbles.visible = false;
    jar.userData.bubbles = bubbles;
    objects.jar = jar;
    scene.add(jar);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: "#319a70", side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);
    let connection = null;
    node._lab = {
      scene,
      objects,
      ring,
      setConnection(enabled) {
        if (connection) {
          scene.remove(connection);
          connection.geometry.dispose();
          connection.material.dispose();
          connection = null;
        }
        if (enabled) {
          const a = objects.tube.position,
            b = objects.jar.position;
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(a.x, 2.25, a.z),
            new THREE.Vector3(a.x + 0.4, 2.7, a.z),
            new THREE.Vector3(b.x, 2.7, b.z),
            new THREE.Vector3(b.x, 1.9, b.z),
          ]);
          connection = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 32, 0.055, 8),
            metal.clone(),
          );
          scene.add(connection);
        }
      },
    };
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
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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
      delete node._lab;
    };
  }, []);
  useEffect(() => {
    const lab = host.current?._lab;
    if (!lab) return;
    for (const [id, p] of Object.entries(state.positions)) {
      const o = lab.objects[id];
      o.position.set(p[0], 0, p[1]);
      o.rotation.y = p[2] || 0;
    }
    lab.ring.position.set(
      lab.objects[selected].position.x,
      0.02,
      lab.objects[selected].position.z,
    );
    lab.objects.tube.userData.solid.visible = state.loaded;
    lab.objects.burner.userData.flame.visible =
      state.steps > 0 && state.steps < 5;
    lab.objects.jar.userData.bubbles.visible = state.steps > 0;
    const water = lab.objects.jar.userData.water;
    water.scale.y = 1 - state.steps * 0.11;
    water.position.y = 0.11 + 0.65 * water.scale.y;
    lab.setConnection(state.connected);
  }, [state, selected]);
  return (
    <div
      className="scene"
      ref={host}
      aria-label="Interactive oxygen apparatus. Drag objects to move them; drag background to orbit."
    />
  );
}
