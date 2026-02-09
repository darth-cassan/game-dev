(function () {
  const stage = document.getElementById("gameStage");
  const overlay = document.getElementById("gameOverlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const scoreLabel = document.getElementById("scoreLabel");
  const timeLabel = document.getElementById("timeLabel");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080a12);

  const camera = new THREE.PerspectiveCamera(65, stage.clientWidth / stage.clientHeight, 0.1, 140);
  camera.position.set(0, 18, 18);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  stage.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x202040, 0.9));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(6, 12, 4);
  scene.add(light);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.MeshStandardMaterial({ color: 0x16202d, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const floorRing = new THREE.Mesh(
    new THREE.RingGeometry(11.3, 11.8, 64),
    new THREE.MeshBasicMaterial({ color: 0xdc143c, side: THREE.DoubleSide })
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.01;
  scene.add(floorRing);

  const player = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x6ff7ff, emissive: 0x0d141a })
  );
  player.position.set(0, 0.65, 0);
  scene.add(player);

  function randomArenaPosition(radius) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    return new THREE.Vector3(Math.cos(angle) * r, 0.5, Math.sin(angle) * r);
  }

  const orbGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const orbMat = new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0x3a2d00 });
  const orbs = [];

  for (let i = 0; i < 14; i += 1) {
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.copy(randomArenaPosition(9.8));
    orb.position.y = 0.45;
    orb.userData.phase = Math.random() * Math.PI * 2;
    scene.add(orb);
    orbs.push(orb);
  }

  const dangerGeo = new THREE.OctahedronGeometry(0.65, 0);
  const dangerMat = new THREE.MeshStandardMaterial({ color: 0xff3458, emissive: 0x2f0912, roughness: 0.25 });
  const dangers = [];

  for (let i = 0; i < 6; i += 1) {
    const danger = new THREE.Mesh(dangerGeo, dangerMat);
    danger.position.copy(randomArenaPosition(8.5));
    danger.position.y = 0.75;
    const dir = randomArenaPosition(1);
    danger.userData.velocity = new THREE.Vector3(dir.x, 0, dir.z).normalize().multiplyScalar(0.07);
    scene.add(danger);
    dangers.push(danger);
  }

  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  const state = {
    running: false,
    ended: false,
    score: 0,
    timeLeft: 60,
    hitCooldown: 0,
  };

  function updateHUD() {
    scoreLabel.textContent = String(state.score);
    timeLabel.textContent = String(Math.ceil(state.timeLeft));
  }

  function resetGame() {
    player.position.set(0, 0.65, 0);
    for (let i = 0; i < orbs.length; i += 1) {
      orbs[i].position.copy(randomArenaPosition(9.8));
      orbs[i].position.y = 0.45;
    }
    for (let i = 0; i < dangers.length; i += 1) {
      dangers[i].position.copy(randomArenaPosition(8.5));
      dangers[i].position.y = 0.75;
    }

    state.running = true;
    state.ended = false;
    state.score = 0;
    state.timeLeft = 60;
    state.hitCooldown = 0;
    updateHUD();
    overlay.hidden = true;
  }

  function endGame() {
    state.running = false;
    state.ended = true;
    overlay.hidden = false;
    overlayTitle.textContent = "Tiempo finalizado";
    overlayText.textContent = `Puntuación total: ${state.score}. Presiona R para reiniciar.`;
  }

  function clampInsideArena(obj, radius) {
    const dist = Math.hypot(obj.position.x, obj.position.z);
    if (dist > radius) {
      const fix = radius / dist;
      obj.position.x *= fix;
      obj.position.z *= fix;
    }
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "w" || key === "arrowup") keys.up = true;
    if (key === "s" || key === "arrowdown") keys.down = true;
    if (key === "a" || key === "arrowleft") keys.left = true;
    if (key === "d" || key === "arrowright") keys.right = true;

    if (event.code === "Space" && !state.running && !state.ended) {
      resetGame();
    }

    if (key === "r") {
      overlayTitle.textContent = "Reinicio";
      overlayText.textContent = "Recoge orbes dorados y evita drones rojos durante 60 segundos.";
      resetGame();
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "w" || key === "arrowup") keys.up = false;
    if (key === "s" || key === "arrowdown") keys.down = false;
    if (key === "a" || key === "arrowleft") keys.left = false;
    if (key === "d" || key === "arrowright") keys.right = false;
  });

  function resize() {
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  }

  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.033);

    if (state.running) {
      const moveSpeed = 7.2 * dt;
      if (keys.up) player.position.z -= moveSpeed;
      if (keys.down) player.position.z += moveSpeed;
      if (keys.left) player.position.x -= moveSpeed;
      if (keys.right) player.position.x += moveSpeed;

      clampInsideArena(player, 10.5);

      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) {
        updateHUD();
        endGame();
      }

      state.hitCooldown = Math.max(0, state.hitCooldown - dt);

      for (let i = 0; i < orbs.length; i += 1) {
        const orb = orbs[i];
        orb.userData.phase += dt * 3;
        orb.position.y = 0.45 + Math.sin(orb.userData.phase) * 0.12;
        orb.rotation.y += dt * 1.8;

        const dist = orb.position.distanceTo(player.position);
        if (dist < 1.05) {
          state.score += 10;
          orb.position.copy(randomArenaPosition(9.8));
          orb.position.y = 0.45;
          updateHUD();
        }
      }

      for (let i = 0; i < dangers.length; i += 1) {
        const danger = dangers[i];
        danger.rotation.x += dt * 2;
        danger.rotation.y += dt * 2.6;
        danger.position.addScaledVector(danger.userData.velocity, dt * 60);

        const distCenter = Math.hypot(danger.position.x, danger.position.z);
        if (distCenter > 10.4) {
          const normal = new THREE.Vector3(danger.position.x, 0, danger.position.z).normalize();
          danger.userData.velocity.reflect(normal);
        }

        const hitDist = danger.position.distanceTo(player.position);
        if (hitDist < 1.05 && state.hitCooldown <= 0) {
          state.score = Math.max(0, state.score - 15);
          state.hitCooldown = 0.8;
          player.position.add(new THREE.Vector3(-danger.userData.velocity.x, 0, -danger.userData.velocity.z).multiplyScalar(4));
          clampInsideArena(player, 10.4);
          updateHUD();
        }
      }

      updateHUD();
    }

    player.rotation.y += dt * 1.4;
    renderer.render(scene, camera);
  }

  updateHUD();
  animate();
})();
