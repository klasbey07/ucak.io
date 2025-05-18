let scene, camera, renderer;
let airplane = new THREE.Group();
let keys = {};
let speed = 0;
let maxSpeed = 2;
let acceleration = 0.008;
let pitch = 0, yaw = 0, roll = 0;
let rotationSpeed = 0.001;
let velocity = new THREE.Vector3();
let lift = 0.01;
// Landing variables
let groundEffect = false; // Yere yaklaşıldığında kaldırma etkisi
let suspensionForce = 0.05; // Uçağın amortisör gücü
let suspensionDamping = 0.2; // Süspansiyon sönümleme
let wheelFriction = 0.02; // Tekerlek sürtünme katsayısı
let groundDistance = 0; // Yerden yükseklik
let flareActive = false; // İniş öncesi süzülme durumu
let touchdownVelocity = 0; // İniş anındaki dikey hız
let touchdownPoint = null; // İniş noktası
let bounceHeight = 0; // Sıçrama yüksekliği
let landingPhase = "approach"; // approach, flare, touchdown, rollout

// Minimap variables
let minimapCamera, minimapRenderer;
let minimapWidth = 200, minimapHeight = 200;

// Landing variables
let isOnRunway = false;
let isLanded = false;
let landingSpeed = 0.5; // Maximum safe landing speed
let landingPitch = 0.1; // Maximum acceptable pitch for landing
let crashThreshold = 0.8; // Speed threshold for crashing
let planeDamage = 0; // Damage level (0-100)
let isCrashed = false;

// Cargo system variables
let cargo = [];
let cargoCapacity = 5;
let cargoWeight = 0;
let maxCargoWeight = 10;
let cargoLocations = [];
let playerMoney = 1000;

// Trail effect for airplane
// Add these variables to your global variables section
let trailParticles = [];
let trailParticlesMax = 200;
let trailEmissionRate = 0.1; // Lower = more particles
let trailLastEmitTime = 0;
let trailLifetime = 5; // Seconds before a particle fades out
let trailEnabled = true; // Toggle for enabling/disabling the trail

// Landing gear
let landingGear = true;

// Navigation Aids System
let navigationAids = {
  active: false,
  mode: "gps", // gps, vortac, ils
  waypoints: [],
  currentWaypoint: 0,
  approachActive: false
};

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue

  // Main camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(0, 2, -10);

  // Main renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Initialize minimap
  setupMinimap();

  // Initialize UI
  setupUI();

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(50, 100, 50);
  scene.add(dirLight);

  // Terrain
 // 1. Increase map size - Find and modify terrain creation
 const terrainGeo = new THREE.PlaneGeometry(6000, 6000); // Doubled from 3000 to 6000
 const terrainMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
 const terrain = new THREE.Mesh(terrainGeo, terrainMat);
 terrain.rotation.x = -Math.PI / 2;
 terrain.name = "terrain";
 scene.add(terrain);
  
 // Runway
  const runwayGeo = new THREE.PlaneGeometry(40, 600);
  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const runway = new THREE.Mesh(runwayGeo, runwayMat);
  runway.rotation.x = -Math.PI / 2;
  runway.position.z = 100;
  runway.position.y = 0.1;
  runway.name = "runway";
  scene.add(runway);

  // Add landing markers
  addLandingMarkers();

  // Create airplane
  createAirplane();

  // Add cargo pickup/delivery locations
  createCargoLocations();
  
  createLowPolyTrees();
  createLowPolyClouds();
  createLowPolyMountains();
  createLowPolyLakes();
  
  createNavigationMarkers();
  createControlsMenu();

  // Events
  document.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    handleKeyPress(e.key.toLowerCase());
  });
  document.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);
  window.addEventListener("resize", onWindowResize);
}

function setupMinimap() {
  // Create minimap camera (top-down view)
  minimapCamera = new THREE.OrthographicCamera(
    -1000, 1000, 1000, -1000, 1, 6000
  );
  minimapCamera.position.set(0, 1000, 0);
  minimapCamera.lookAt(0, 0, 0);
  
  // Create minimap renderer
  minimapRenderer = new THREE.WebGLRenderer({ antialias: true });
  minimapRenderer.setSize(minimapWidth, minimapHeight);
  minimapRenderer.domElement.style.position = 'absolute';
  minimapRenderer.domElement.style.bottom = '20px';
  minimapRenderer.domElement.style.right = '20px';
  minimapRenderer.domElement.style.border = '2px solid white';
  minimapRenderer.domElement.style.borderRadius = '50%';
  document.body.appendChild(minimapRenderer.domElement);
}

function setupUI() {
  // Create UI container
  const uiContainer = document.createElement('div');
  uiContainer.style.position = 'absolute';
  uiContainer.style.top = '20px';
  uiContainer.style.left = '20px';
  uiContainer.style.color = 'white';
  uiContainer.style.fontFamily = 'Arial, sans-serif';
  uiContainer.style.padding = '10px';
  uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  uiContainer.style.borderRadius = '5px';
  uiContainer.id = 'ui-container';
  
  // Add initial content
  uiContainer.innerHTML = `
    <div id="altitude">Altitude: 0m</div>
    <div id="speed">Speed: 0</div>
    <div id="pitch">Pitch: 0°</div>
    <div id="landing-status">Status: In Air</div>
    <div id="gear-status">Landing Gear: Down</div>
    <div id="damage">Uçak Durumu: %100</div>
    <div id="cargo-info">Cargo: 0/${cargoCapacity} (Weight: 0/${maxCargoWeight})</div>
    <div id="money">Money: ${playerMoney}₺</div>
    <div id="bilgi">Tuş Kontrol Menüsünü Açmak İçin "H" a basın</div>
    <div id="mission" style="display:none;"></div>
  `;
  
  document.body.appendChild(uiContainer);
  
  // Add landing guide
  const landingGuide = document.createElement('div');
  landingGuide.style.position = 'absolute';
  landingGuide.style.bottom = '20px';
  landingGuide.style.left = '20px';
  landingGuide.style.color = 'white';
  landingGuide.style.fontFamily = 'Arial, sans-serif';
  landingGuide.style.padding = '10px';
  landingGuide.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  landingGuide.style.borderRadius = '5px';
  landingGuide.id = 'landing-guide';
  landingGuide.style.display = 'none';
  
  landingGuide.innerHTML = `
    <h3>İniş Rehberi</h3>
    <div>Hız: <span id="landing-speed-status">Çok Hızlı</span></div>
    <div>Pist: <span id="landing-runway-status">Pistte Değil</span></div>
    <div>Açı: <span id="landing-angle-status">Çok Dik</span></div>
    <div>İniş Takımları: <span id="landing-gear-status">İnik</span></div>
  `;
  
  document.body.appendChild(landingGuide);

  // Add to UI container HTML
uiContainer.innerHTML += `
<div id="nav-status" style="margin-top: 10px; display: none;">
  <div>Navigation: <span id="nav-mode">GPS</span></div>
  <div id="nav-distance">Distance: --</div>
</div>
`;
}

function createAirplane() {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });

  // Body (shorter and thicker)
  const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.15, 12);
  bodyGeo.rotateZ(Math.PI / 2); // Rotate to align with forward direction
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  airplane.add(body);

  // Wings (shorter, more aesthetic)
  const wingGeo = new THREE.BoxGeometry(3, 0.1, 0.4);
  const wing = new THREE.Mesh(wingGeo, bodyMat);
  wing.position.y = 0;
  airplane.add(wing);

  // Horizontal tail
  const tailWingGeo = new THREE.BoxGeometry(2, 0.05, 0.2);
  const tailWing = new THREE.Mesh(tailWingGeo, bodyMat);
  tailWing.position.set(0, 0.15, -1);
  airplane.add(tailWing);

  // Vertical tail
  const tailFinGeo = new THREE.BoxGeometry(0.05, 0.4, 0.3);
  const tailFin = new THREE.Mesh(tailFinGeo, bodyMat);
  tailFin.position.set(0, 0.25, -1);
  airplane.add(tailFin);
  
  // Landing gear - front
  const gearFrontGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const gearFront = new THREE.Mesh(gearFrontGeo, gearMat);
  gearFront.position.set(0, -0.3, 0.5);
  gearFront.name = "landingGearFront";
  airplane.add(gearFront);
  
  // Landing gear - wheels front
  const wheelGeo = new THREE.TorusGeometry(0.1, 0.05, 8, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const wheelFront = new THREE.Mesh(wheelGeo, wheelMat);
  wheelFront.rotation.x = Math.PI / 2;
  wheelFront.position.set(0, -0.55, 0.5);
  wheelFront.name = "wheelFront";
  airplane.add(wheelFront);
  
  // Landing gear - back left
  const gearLeftGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8);
  const gearLeft = new THREE.Mesh(gearLeftGeo, gearMat);
  gearLeft.position.set(0.6, -0.25, -0.2);
  gearLeft.name = "landingGearLeft";
  airplane.add(gearLeft);
  
  // Landing gear - wheel back left
  const wheelLeft = new THREE.Mesh(wheelGeo, wheelMat);
  wheelLeft.rotation.x = Math.PI / 2;
  wheelLeft.position.set(0.6, -0.45, -0.2);
  wheelLeft.name = "wheelLeft";
  airplane.add(wheelLeft);
  
  // Landing gear - back right
  const gearRightGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8);
  const gearRight = new THREE.Mesh(gearRightGeo, gearMat);
  gearRight.position.set(-0.6, -0.25, -0.2);
  gearRight.name = "landingGearRight";
  airplane.add(gearRight);
  
  // Landing gear - wheel back right
  const wheelRight = new THREE.Mesh(wheelGeo, wheelMat);
  wheelRight.rotation.x = Math.PI / 2;
  wheelRight.position.set(-0.6, -0.45, -0.2);
  wheelRight.name = "wheelRight";
  airplane.add(wheelRight);

  // Add airplane blip for minimap
  const blipGeo = new THREE.ConeGeometry(0.5, 1, 8);
  const blipMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const blip = new THREE.Mesh(blipGeo, blipMat);
  blip.rotation.x = Math.PI;
  blip.position.y = 5;
  blip.scale.set(5, 5, 5);
  airplane.add(blip);

  airplane.position.set(0, 5, 0);
  scene.add(airplane);
}

function toggleLandingGear() {
  if (airplane.position.y < 10) {
    showNotification("İniş takımlarını kapatmak için yüksekte olmalısınız!");
    return;
  }
  
  landingGear = !landingGear;
  
  // Update landing gear visibility
  airplane.children.forEach(child => {
    if (child.name && child.name.includes("landingGear") || child.name && child.name.includes("wheel")) {
      child.visible = landingGear;
    }
  });
  
  // Update UI
  document.getElementById("gear-status").textContent = `Landing Gear: ${landingGear ? "Down" : "Up"}`;
  showNotification(`İniş takımları ${landingGear ? "indirildi" : "kaldırıldı"}`);
}

function addLandingMarkers() {
  // Landing approach markers
  const markerGeo = new THREE.BoxGeometry(5, 0.5, 5);
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  
  // Create landing lights along the runway
  for (let i = 0; i < 10; i++) {
    // Left side lights
    const leftLight = new THREE.Mesh(markerGeo, markerMat);
    leftLight.position.set(-25, 0.3, 100 - i * 60);
    scene.add(leftLight);
    
    // Right side lights
    const rightLight = new THREE.Mesh(markerGeo, markerMat);
    rightLight.position.set(25, 0.3, 100 - i * 60);
    scene.add(rightLight);
  }
  
  // Landing zone indicator
  const landingZoneGeo = new THREE.PlaneGeometry(30, 100);
  const landingZoneMat = new THREE.MeshStandardMaterial({ 
    color: 0xffff00,
    transparent: true,
    opacity: 0.3
  });
  const landingZone = new THREE.Mesh(landingZoneGeo, landingZoneMat);
  landingZone.rotation.x = -Math.PI / 2;
  landingZone.position.set(0, 0.2, 100);
  landingZone.name = "landingZone";
  scene.add(landingZone);
}

// 2. Update cargo locations to be more spread out
// In createCargoLocations function, update the positions:
function createCargoLocations() {
  const locationColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
  
  // Main airport cargo area
  createCargoLocation(0, 0.5, 200, 0xff0000, "Ana Havalimanı");
  
  // Additional cargo locations - distances doubled
  createCargoLocation(1000, 0.5, 1000, 0x00ff00, "Kuzey Limanı");
  createCargoLocation(-1000, 0.5, -1000, 0x0000ff, "Güney Köyü");
  createCargoLocation(1600, 0.5, -600, 0xffff00, "Doğu Şehri");
  createCargoLocation(-1600, 0.5, 600, 0xff00ff, "Batı Kasabası");
}

function createCargoLocation(x, y, z, color, name) {
  // Create cargo pickup/dropoff platform
  const platformGeo = new THREE.CylinderGeometry(30, 30, 1, 32);
  const platformMat = new THREE.MeshStandardMaterial({ color: color });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.set(x, y, z);
  platform.name = "cargoLocation";
  scene.add(platform);
  
  // Create cargo building
  const buildingGeo = new THREE.BoxGeometry(20, 10, 20);
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
  const building = new THREE.Mesh(buildingGeo, buildingMat);
  building.position.set(x, 5, z);
  scene.add(building);
  
  // Create small runway for the location
  const runwayGeo = new THREE.PlaneGeometry(20, 100);
  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const runway = new THREE.Mesh(runwayGeo, runwayMat);
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(x, 0.1, z + 60);
  runway.name = "runway";
  scene.add(runway);
  
  // Add to cargo locations array
  cargoLocations.push({
    position: new THREE.Vector3(x, y, z),
    name: name,
    color: color,
    hasCargo: Math.random() > 0.5 // Randomly decide if location has cargo
  });
  
  // Add location marker for minimap
  const markerGeo = new THREE.CylinderGeometry(5, 5, 1, 16);
  const markerMat = new THREE.MeshBasicMaterial({ color: color });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.set(x, 20, z);
  marker.scale.set(2, 2, 2);
  scene.add(marker);
}

function animate() {
  requestAnimationFrame(animate);

  // Controls
  if (keys['arrowup']) pitch -= rotationSpeed * (isLanded ? 0.1 : 1);
  if (keys['arrowdown']) pitch += rotationSpeed * (isLanded ? 0.1 : 1);
  if (keys['a']) {
    yaw += rotationSpeed * (isLanded ? 0.2 : 1);
    roll = THREE.MathUtils.lerp(roll, -0.5, 0.1); // Left roll
  } else if (keys['d']) {
    yaw -= rotationSpeed * (isLanded ? 0.2 : 1);
    roll = THREE.MathUtils.lerp(roll, 0.5, 0.1); // Right roll
  } else {
    roll = THREE.MathUtils.lerp(roll, 0, 0.05);
  }
  
  if (keys['w']) {
    speed = Math.min(speed + acceleration, maxSpeed);
  }
  if (keys['s']) {
    speed = Math.max(speed - acceleration, 0);
  }

  airplane.rotation.order = "YXZ";
  
  // Apply rotation with limitations when on ground
  if (isLanded) {
    // Limit pitch and roll when landed
    pitch = THREE.MathUtils.lerp(pitch, 0, 0.1);
    roll = THREE.MathUtils.lerp(roll, 0, 0.1);
    
    // Update yaw for steering on ground but limit it
    airplane.rotation.y += yaw * 0.5;
  } else {
    airplane.rotation.y += yaw;
    airplane.rotation.x += pitch;
    airplane.rotation.z = roll;
  }

  // Movement
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(airplane.quaternion);
  
  // Adjust ground movement when landed
  if (isLanded) {
    // On ground movement - more friction
    velocity = forward.multiplyScalar(speed * 0.8);
    velocity.y = 0; // No vertical movement when landed
  } else {
    velocity = forward.multiplyScalar(speed);
    
    // Apply cargo weight to plane physics
    const cargoFactor = Math.max(0.5, 1 - (cargoWeight / maxCargoWeight) * 0.5);
    
    // Add lift based on speed and cargo weight
    const currentLift = lift * speed * cargoFactor;
    velocity.y += pitch * -0.5 + currentLift;
  }

  // Get absolute pitch value in degrees
  const pitchAngle = Math.abs(airplane.rotation.x * (180 / Math.PI)) % 360;
  const normalizedPitch = pitchAngle > 180 ? 360 - pitchAngle : pitchAngle;
  
  // Ground detection
if (airplane.position.y < 1.2) {
  // Check if we're on a runway
  isOnRunway = checkRunwayLanding();
  
  // Auto-land when touching a runway
  if (isOnRunway) {
    // Force plane to be at minimum altitude
    airplane.position.y = 1.2;
    
    // Auto-level the plane gradually when on runway
    pitch = THREE.MathUtils.lerp(pitch, 0, 0.2);
    roll = THREE.MathUtils.lerp(roll, 0, 0.2);

    // Force rotation to approach level
    airplane.rotation.x = THREE.MathUtils.lerp(airplane.rotation.x, 0, 0.15); // Added this line
    
    // Set landing status if not already landed
    if (!isLanded) {
      isLanded = true;
      updateUIStatus("Landed");
      showNotification("İniş başarılı!");
      checkCargoPickupDelivery();
    }
  } else {
    // Not on runway but touching ground - force minimum altitude
    airplane.position.y = 1.2;
    
    // If was landed but now off runway
    if (isLanded && !isOnRunway) {
      isLanded = false;
      updateUIStatus("Taxiing");
    }
  }
  
  // Limit vertical velocity when on ground
  velocity.y = Math.max(0, velocity.y);
} else {
  // In air
  isOnRunway = false;
  document.getElementById("landing-guide").style.display = 'none';
  
  if (isLanded) {
    isLanded = false;
    updateUIStatus("In Air");
  }
}

  airplane.position.add(velocity);

  // Camera follow from behind
  const camOffset = new THREE.Vector3(0, 2, -8);
  const camPosition = camOffset.clone().applyQuaternion(airplane.quaternion);
  camera.position.copy(airplane.position).add(camPosition);
  camera.lookAt(airplane.position);
  
  // Update minimap camera
  minimapCamera.position.set(airplane.position.x, 1000, airplane.position.z);
  
  // Update UI
  updateUI(normalizedPitch);

  updateNavigationDisplay();

  updateTrailParticles();

  // Render main scene
  renderer.render(scene, camera);
  
  // Render minimap
   // Temporarily disable fog for minimap
  const originalFog = scene.fog;
  scene.fog = null;
  minimapRenderer.render(scene, minimapCamera);
  scene.fog = originalFog;


  // Reset yaw/pitch
  yaw *= 0.9;
  pitch *= 0.9;
}

// Replace the handleCrash function with a dummy function that does nothing
function handleCrash(reason) {
  // Do nothing - we're removing crash functionality
  console.log("Crash avoided: " + reason);
}

// And finally, modify resetPlane for manual resets (keep it for convenience)
function resetPlane() {
  // Reset position
  airplane.position.set(0, 5, 0);
  airplane.rotation.set(0, 0, 0);
  
  // Reset physics
  speed = 0;
  velocity = new THREE.Vector3();
  pitch = 0;
  yaw = 0;
  roll = 0;
  
  // Update UI
  updateUIStatus("Ready");
  document.getElementById("gear-status").textContent = `Landing Gear: Down`;
  
  // Show notification
  showNotification("Uçak başlangıç konumuna alındı.");
}

// Simplified updateLandingGuide function
function updateLandingGuide(pitchAngle, currentSpeed, onRunway, gearDown) {
  // Show landing guide when close to ground
  if (airplane.position.y < 20) {
    document.getElementById("landing-guide").style.display = 'block';
    
    // Update runway status
    let runwayStatus = "Pistte Değil";
    let runwayColor = "red";
    
    if (onRunway) {
      runwayStatus = "Pistte";
      runwayColor = "lime";
    }
    
    document.getElementById("landing-runway-status").textContent = runwayStatus;
    document.getElementById("landing-runway-status").style.color = runwayColor;
    
    // Always show landing gear as good
    document.getElementById("landing-gear-status").textContent = "İnik";
    document.getElementById("landing-gear-status").style.color = "lime";
    
    // Always show angle as acceptable
    document.getElementById("landing-angle-status").textContent = "İyi";
    document.getElementById("landing-angle-status").style.color = "lime";
    
    // Always show speed as acceptable
    document.getElementById("landing-speed-status").textContent = "İyi";
    document.getElementById("landing-speed-status").style.color = "lime";
  } else {
    document.getElementById("landing-guide").style.display = 'none';
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateUI(pitchAngle) {
  // Update altitude display
  document.getElementById("altitude").textContent = `Altitude: ${Math.floor(airplane.position.y)}m`;
  
  // Update speed display
  document.getElementById("speed").textContent = `Speed: ${speed.toFixed(2)}`;
  
  // Update pitch display
  if (pitchAngle !== undefined) {
    document.getElementById("pitch").textContent = `Pitch: ${pitchAngle.toFixed(1)}°`;
  }
  
  // Update cargo info
  document.getElementById("cargo-info").textContent = 
    `Cargo: ${cargo.length}/${cargoCapacity} (Weight: ${cargoWeight.toFixed(1)}/${maxCargoWeight})`;
  
  // Update money display
  document.getElementById("money").textContent = `Money: ${playerMoney}₺`;
}

function updateUIStatus(status) {
  document.getElementById("landing-status").textContent = `Status: ${status}`;
}

function handleKeyPress(key) {
  switch(key) {
    case 'g':
      toggleLandingGear();
      break;
    case 'space':
      if (isLanded) {
        checkCargoPickupDelivery();
      }
      break;
    case 'm':
      showMissionMenu();
      break;
    case 'r':
      if (isCrashed) {
        resetPlane();
      }
      break;
      case 'c':
  switchCameraView();
  break;
case 'n':
  toggleNavigationAids();
  break;
case 'm':
  cycleNavigationMode();
  break;
  case 't':
      toggleTrail();
      break;
  }
}

// Modify the checkRunwayLanding function to make it more forgiving
function checkRunwayLanding() {
  // Create a ray pointing downward from the airplane
  const raycaster = new THREE.Raycaster();
  raycaster.set(airplane.position, new THREE.Vector3(0, -1, 0));
  
  // Increase the max distance to detect runway
  const intersects = raycaster.intersectObjects(scene.children, true);
  
  // Check if we're over a runway
  for (let i = 0; i < intersects.length; i++) {
    if (intersects[i].object.name === "runway") {
      return true;
    }
  }
  
  return false;
}

function checkCargoPickupDelivery() {
  if (!isLanded) return;
  
  let nearbyLocation = getNearbyCargoLocation();
  
  if (nearbyLocation) {
    if (nearbyLocation.hasCargo && cargo.length < cargoCapacity) {
      // Pick up cargo
      const weight = 1 + Math.random() * 2; // Random weight between 1-3
      const value = Math.floor(weight * 100 * (1 + Math.random())); // Value based on weight
      const destination = getRandomDestination(nearbyLocation);
      
      // Add cargo to inventory
      cargo.push({
        from: nearbyLocation.name,
        to: destination.name,
        weight: weight,
        value: value
      });
      
      // Update cargo weight
      cargoWeight += weight;
      
      // Update location status
      nearbyLocation.hasCargo = false;
      
      // Show notification
      showNotification(`${weight.toFixed(1)} ton kargo alındı. Teslimat: ${destination.name}, Ödeme: ${value}₺`);
      
      // Show mission info
      showMissionInfo(cargo[cargo.length - 1]);
    } else if (cargo.length > 0) {
      // Check for deliveries
      for (let i = 0; i < cargo.length; i++) {
        if (cargo[i].to === nearbyLocation.name) {
          // Successful delivery
          playerMoney += cargo[i].value;
          cargoWeight -= cargo[i].weight;
          
          // Show notification
          showNotification(`Kargo başarıyla teslim edildi! ${cargo[i].value}₺ kazandınız.`);
          
          // Remove cargo
          cargo.splice(i, 1);
          
          // Reset mission info if no more cargo
          if (cargo.length === 0) {
            document.getElementById("mission").style.display = "none";
          } else {
            showMissionInfo(cargo[0]);
          }
          
          // Location now has new cargo
          nearbyLocation.hasCargo = true;
          
          break;
        }
      }
      
      if (cargo.length > 0 && cargo[0].to !== nearbyLocation.name) {
        showNotification(`Burası ${nearbyLocation.name}. Kargonuz ${cargo[0].to} için.`);
      }
    }
    
    // Update UI
    updateUI();
  }
}

function getNearbyCargoLocation() {
  // Check if we're near any cargo location
  for (let i = 0; i < cargoLocations.length; i++) {
    const distance = airplane.position.distanceTo(cargoLocations[i].position);
    if (distance < 50) {
      return cargoLocations[i];
    }
  }
  
  return null;
}

function getRandomDestination(currentLocation) {
  // Find a random destination different from current location
  let possibleDestinations = cargoLocations.filter(loc => loc !== currentLocation);
  return possibleDestinations[Math.floor(Math.random() * possibleDestinations.length)];
}

function showMissionInfo(cargoItem) {
  if (!cargoItem) return;
  
  const missionElement = document.getElementById("mission");
  missionElement.style.display = "block";
  missionElement.innerHTML = `
    <h3>Görev Bilgisi</h3>
    <div>Alış: ${cargoItem.from}</div>
    <div>Teslimat: ${cargoItem.to}</div>
    <div>Ağırlık: ${cargoItem.weight.toFixed(1)} ton</div>
    <div>Ödeme: ${cargoItem.value}₺</div>
  `;
}

function showMissionMenu() {
  // Create mission menu overlay if it doesn't exist
  let missionMenu = document.getElementById("mission-menu");
  
  if (!missionMenu) {
    missionMenu = document.createElement('div');
    missionMenu.id = "mission-menu";
    missionMenu.style.position = 'absolute';
    missionMenu.style.top = '50%';
    missionMenu.style.left = '50%';
    missionMenu.style.transform = 'translate(-50%, -50%)';
    missionMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    missionMenu.style.color = 'white';
    missionMenu.style.padding = '20px';
    missionMenu.style.borderRadius = '10px';
    missionMenu.style.zIndex = '1000';
    missionMenu.style.minWidth = '300px';
    document.body.appendChild(missionMenu);
  }
  
  // Toggle visibility
  if (missionMenu.style.display === 'none' || !missionMenu.style.display) {
    // Show menu with cargo locations info
    let content = `
      <h2>Kargo Noktaları</h2>
      <div style="margin-bottom: 10px">Para: ${playerMoney}₺</div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <th style="text-align: left; padding: 5px; border-bottom: 1px solid white;">Lokasyon</th>
          <th style="text-align: left; padding: 5px; border-bottom: 1px solid white;">Durum</th>
        </tr>
    `;
    
    cargoLocations.forEach(loc => {
      content += `
        <tr>
          <td style="padding: 5px; border-bottom: 1px solid #444;">${loc.name}</td>
          <td style="padding: 5px; border-bottom: 1px solid #444;">${loc.hasCargo ? "Kargo Var" : "Kargo Yok"}</td>
        </tr>
      `;
    });
    
    content += `
      </table>
      <h3 style="margin-top: 15px;">Mevcut Kargolar</h3>
    `;
    
    if (cargo.length === 0) {
      content += "<div>Hiç kargo yok</div>";
    } else {
      cargo.forEach((item, index) => {
        content += `
          <div style="margin-bottom: 10px; padding: 5px; background-color: rgba(255,255,255,0.1);">
            <div>${index + 1}. ${item.from} → ${item.to}</div>
            <div>Ağırlık: ${item.weight.toFixed(1)} ton, Değer: ${item.value}₺</div>
          </div>
        `;
      });
    }
    
    content += `<button id="close-mission" style="margin-top: 15px; padding: 5px 10px;">Kapat</button>`;
    
    missionMenu.innerHTML = content;
    missionMenu.style.display = 'block';
    
    // Add event listener to close button
    document.getElementById("close-mission").addEventListener("click", () => {
      missionMenu.style.display = 'none';
    });
  } else {
    missionMenu.style.display = 'none';
  }
}

function showNotification(message) {
  // Create notification element if it doesn't exist
  let notification = document.getElementById("notification");
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = "notification";
    notification.style.position = 'absolute';
    notification.style.bottom = '150px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.transition = 'opacity 0.5s';
    notification.style.zIndex = '1000';
    document.body.appendChild(notification);
  }
  
  // Set message and show notification
  notification.textContent = message;
  notification.style.opacity = '1';
  
  // Hide after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 3000);
}

// Add weather effects
function addWeatherEffects() {
  // Rain effect
  function createRain() {
    const rainCount =300;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = [];
    
    for (let i = 0; i < rainCount; i++) {
      rainPositions.push(
        Math.random() * 1000 - 500,
        Math.random() * 200 + 50,
        Math.random() * 1000 - 500
      );
    }
    
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPositions, 3));
    
    const rainMaterial = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.5,
      transparent: true,
      opacity: 0.6
    });
    
    const rain = new THREE.Points(rainGeo, rainMaterial);
    rain.name = "rain";
    scene.add(rain);
    
    return rain;
  }
  
  // Fog effect
  function addFog() {
    scene.fog = new THREE.FogExp2(0xcccccc, 0.002);
  }
  
  // Toggle weather features
  let currentWeather = "clear";
  const rain = createRain();
  rain.visible = false;
  
  // Weather cycle function
  function cycleWeather() {
    switch(currentWeather) {
      case "clear":
        currentWeather = "rain";
        rain.visible = true;
        scene.fog = new THREE.FogExp2(0xaaaaaa, 0.005);
        scene.background = new THREE.Color(0x555555);
        showNotification("Hava durumu: Yağmurlu");
        break;
      case "rain":
        currentWeather = "fog";
        rain.visible = false;
        scene.fog = new THREE.FogExp2(0xdddddd, 0.005);
        scene.background = new THREE.Color(0xaaaaaa);
        showNotification("Hava durumu: Sisli");
        break;
      case "fog":
        currentWeather = "clear";
        rain.visible = false;
        scene.fog = null;
        scene.background = new THREE.Color(0x87ceeb);
        showNotification("Hava durumu: Açık");
        break;
    }
    
    // Update the weather every 2-5 minutes
    setTimeout(cycleWeather, 120000 + Math.random() * 180000);
  }
  
  // Start weather cycle
  setTimeout(cycleWeather, 60000); // First change after 1 minute
  
  // Animate rain
  function animateRain() {
    if (!rain) return;
    
    const positions = rain.geometry.attributes.position.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      // Move rain down
      positions[i + 1] -= 1;
      
      // Reset raindrops that go below ground
      if (positions[i + 1] < 0) {
        positions[i] = Math.random() * 1000 - 500 + airplane.position.x;
        positions[i + 1] = 200;
        positions[i + 2] = Math.random() * 1000 - 500 + airplane.position.z;
      }
    }
    
    rain.geometry.attributes.position.needsUpdate = true;
    
    requestAnimationFrame(animateRain);
  }
  
  animateRain();
}

// Call weather effects
//addWeatherEffects();


// Add upgrade shop functionality
function createUpgradeShop() {
  const upgrades = [
    { name: "Motor Geliştirme", cost: 500, effect: "Hızı %20 artırır", applied: false, 
      apply: () => { maxSpeed *= 1.2; acceleration *= 1.2; } },
    { name: "Hafif Malzemeler", cost: 700, effect: "Kargo kapasitesini 2 artırır", applied: false,
      apply: () => { cargoCapacity += 2; maxCargoWeight += 4; } },
    { name: "Geliştirilmiş İniş Takımları", cost: 600, effect: "İniş zararını azaltır", applied: false,
      apply: () => { landingSpeed *= 1.3; landingPitch *= 1.3; } },
    { name: "İleri Navigasyon", cost: 800, effect: "Daha iyi kontrol", applied: false,
      apply: () => { rotationSpeed *= 1.5; } }
  ];
  
  // Create shop UI
  function showShop() {
    // Create shop overlay if it doesn't exist
    let shopMenu = document.getElementById("shop-menu");
    
    if (!shopMenu) {
      shopMenu = document.createElement('div');
      shopMenu.id = "shop-menu";
      shopMenu.style.position = 'absolute';
      shopMenu.style.top = '50%';
      shopMenu.style.left = '50%';
      shopMenu.style.transform = 'translate(-50%, -50%)';
      shopMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      shopMenu.style.color = 'white';
      shopMenu.style.padding = '20px';
      shopMenu.style.borderRadius = '10px';
      shopMenu.style.zIndex = '1000';
      shopMenu.style.minWidth = '400px';
      document.body.appendChild(shopMenu);
    }
    
    // Toggle visibility
    if (shopMenu.style.display === 'none' || !shopMenu.style.display) {
      // Show shop with upgrades
      let content = `
        <h2>Uçak Geliştirmeleri</h2>
        <div style="margin-bottom: 10px">Para: ${playerMoney}₺</div>
        <div style="max-height: 300px; overflow-y: auto;">
      `;
      
      upgrades.forEach((upgrade, index) => {
        const canAfford = playerMoney >= upgrade.cost;
        const buttonStyle = upgrade.applied ? 
          "background-color: #555; color: #aaa; cursor: not-allowed;" : 
          canAfford ? 
            "background-color: #4CAF50; color: white; cursor: pointer;" : 
            "background-color: #777; color: #ccc; cursor: not-allowed;";
        
        content += `
          <div style="margin-bottom: 15px; padding: 10px; background-color: rgba(255,255,255,0.1); border-radius: 5px;">
            <div style="font-weight: bold;">${upgrade.name} - ${upgrade.cost}₺</div>
            <div style="margin: 5px 0;">${upgrade.effect}</div>
            <button 
              id="upgrade-${index}" 
              style="padding: 5px 10px; border: none; border-radius: 3px; ${buttonStyle}"
              ${upgrade.applied || !canAfford ? 'disabled' : ''}
            >
              ${upgrade.applied ? 'Satın Alındı' : 'Satın Al'}
            </button>
          </div>
        `;
      });
      
      content += `
        </div>
        <button id="close-shop" style="margin-top: 15px; padding: 5px 10px;">Kapat</button>
      `;
      
      shopMenu.innerHTML = content;
      shopMenu.style.display = 'block';
      
      // Add event listeners to buttons
      upgrades.forEach((upgrade, index) => {
        const button = document.getElementById(`upgrade-${index}`);
        if (button && !upgrade.applied && playerMoney >= upgrade.cost) {
          button.addEventListener("click", () => {
            if (playerMoney >= upgrade.cost) {
              playerMoney -= upgrade.cost;
              upgrade.applied = true;
              upgrade.apply();
              showNotification(`${upgrade.name} satın alındı!`);
              updateUI();
              showShop(); // Refresh shop UI
            }
          });
        }
      });
      
      // Add event listener to close button
      document.getElementById("close-shop").addEventListener("click", () => {
        shopMenu.style.display = 'none';
      });
    } else {
      shopMenu.style.display = 'none';
    }
  }
  
  // Add keyboard shortcut for shop
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === 'u') {
      if (isLanded && isOnRunway && airplane.position.z > 0 && airplane.position.z < 200) {
        showShop();
      } else {
        showNotification("Geliştirme mağazasına erişmek için ana havalimanına inin!");
      }
    }
  });
}

// Initialize upgrade shop
createUpgradeShop();

// Add camera view switcher
let cameraView = "follow"; // follow, cockpit, top, free

function switchCameraView() {
  switch(cameraView) {
    case "follow":
      cameraView = "cockpit";
      showNotification("Kamera: Kokpit Görüşü");
      break;
    case "cockpit":
      cameraView = "top";
      showNotification("Kamera: Üstten Görüş");
      break;
    case "top":
      cameraView = "free";
      showNotification("Kamera: Serbest Görüş");
      break;
    case "free":
      cameraView = "follow";
      showNotification("Kamera: Takip");
      break;
  }
}

// Add camera switch key
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === 'c') {
    switchCameraView();
  }
});

// Modify animate function to handle camera views
function updateCamera() {
  switch(cameraView) {
    case "follow":
      // Original follow camera
      const camOffset = new THREE.Vector3(0, 2, -8);
      const camPosition = camOffset.clone().applyQuaternion(airplane.quaternion);
      camera.position.copy(airplane.position).add(camPosition);
      camera.lookAt(airplane.position);
      break;
    case "cockpit":
      // Cockpit view
      const cockpitOffset = new THREE.Vector3(0, 0.4, 0.6);
      const cockpitPosition = cockpitOffset.clone().applyQuaternion(airplane.quaternion);
      camera.position.copy(airplane.position).add(cockpitPosition);
      
      // Look forward direction
      const lookAtOffset = new THREE.Vector3(0, 0, 10);
      const lookAtPosition = lookAtOffset.clone().applyQuaternion(airplane.quaternion);
      camera.lookAt(airplane.position.clone().add(lookAtPosition));
      break;
    case "top":
      // Top-down view
      camera.position.set(airplane.position.x, airplane.position.y + 20, airplane.position.z);
      camera.lookAt(airplane.position);
      break;
    case "free":
      // Free camera, doesn't follow but can be moved with arrow keys
      if (keys['arrowleft']) camera.position.x -= 0.5;
      if (keys['arrowright']) camera.position.x += 0.5;
      if (keys['arrowup'] && keys['shift']) camera.position.z -= 0.5;
      if (keys['arrowdown'] && keys['shift']) camera.position.z += 0.5;
      if (keys['pageup']) camera.position.y += 0.5;
      if (keys['pagedown']) camera.position.y -= 0.5;
      
      camera.lookAt(airplane.position);
      break;
  }
}


// Replace the camera update in the animate function with this:
// Just update animate function to call updateCamera() instead of directly setting camera position

// Low-poly trees
function createLowPolyTrees() {
  // Lower segment count for more polygonal look
  const treeGeo = new THREE.CylinderGeometry(0, 1, 5, 4); // Reduced from 8 to 4 segments
  const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 4, 4); // Low-poly trunk
  const treeMat = new THREE.MeshStandardMaterial({ 
    color: 0x006400,
    flatShading: true // Enable flat shading for more polygonal look
  });
  const trunkMat = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    flatShading: true
  });
  
  for (let i = 0; i < 500; i++) {
    // Create tree group
    const treeGroup = new THREE.Group();
    
    // Create trunk
    const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
    trunk.position.y = -0.5;
    treeGroup.add(trunk);
    
    // Create foliage (1-3 cone sections for variety)
    const sections = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < sections; j++) {
      const scale = 1 - (j * 0.2);
      const cone = new THREE.Mesh(treeGeo, treeMat);
      cone.position.y = 2 + j * 1.2;
      cone.scale.set(scale, scale * 0.8, scale);
      treeGroup.add(cone);
    }
    
    // Position the tree
    treeGroup.position.set(
      (Math.random() - 0.5) * 5000,
      0,
      (Math.random() - 0.5) * 5000
    );
    
    // Random rotation and scale variation
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    const treeScale = 0.8 + Math.random() * 0.5;
    treeGroup.scale.set(treeScale, treeScale, treeScale);
    
    scene.add(treeGroup);
  }
}

// Low-poly clouds
function createLowPolyClouds() {
  for (let i = 0; i < 160; i++) {
    // Create cloud group
    const cloudGroup = new THREE.Group();
    
    // Cloud material with flat shading
    const cloudMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      flatShading: true
    });
    
    // Number of cloud puffs
    const puffCount = 3 + Math.floor(Math.random() * 4);
    
    // Create multiple puffs per cloud for more interesting shape
    for (let j = 0; j < puffCount; j++) {
      // Use low-poly sphere or icosahedron for puffs
      let puffGeo;
      if (Math.random() > 0.5) {
        // Very low detail sphere for angular look
        puffGeo = new THREE.SphereGeometry(3 + Math.random() * 2, 4, 3); // Reduced detail
      } else {
        // Icosahedron gives nice low-poly look
        puffGeo = new THREE.IcosahedronGeometry(3 + Math.random() * 2, 0); // 0 = no subdivisions
      }
      
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      
      // Position puffs relative to each other
      puff.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 10
      );
      
      // Random rotation
      puff.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      cloudGroup.add(puff);
    }
    
    // Position the cloud group
    cloudGroup.position.set(
      (Math.random() - 0.5) * 5000,
      80 + Math.random() * 100,
      (Math.random() - 0.5) * 5000
    );
    
    // Random scale for variety
    const cloudScale = 0.8 + Math.random() * 1.2;
    cloudGroup.scale.set(cloudScale, cloudScale * 0.6, cloudScale);
    
    scene.add(cloudGroup);
  }
}

// Create geometric mountains for more polygon-style landscape elements
function createLowPolyMountains() {
  const mountainCount = 10;
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    flatShading: true
  });
  
  for (let i = 0; i < mountainCount; i++) {
    // Create a cone with few segments for a blocky mountain
    const mountainGeo = new THREE.ConeGeometry(100 + Math.random() * 150, 200 + Math.random() * 300, 5 + Math.floor(Math.random() * 3));
    const mountain = new THREE.Mesh(mountainGeo, mountainMat);
    
    // Position far from center
    const angle = (i / mountainCount) * Math.PI * 2;
    const radius = 2000 + Math.random() * 1500;
    mountain.position.set(
      Math.cos(angle) * radius,
      -20, // Partially below ground
      Math.sin(angle) * radius
    );
    
    // Random rotation
    mountain.rotation.y = Math.random() * Math.PI;
    
    scene.add(mountain);
  }
}

// Call these functions in your init() function instead of the original tree and cloud creation code
// init() {
//   ...
//   createLowPolyTrees();
//   createLowPolyClouds();
//   createLowPolyMountains(); // Optional - adds mountains around the perimeter
//   ...
// }

// Optional: Add low-poly water for lakes
function createLowPolyLakes() {
  const lakeCount = 10;
  const waterMat = new THREE.MeshStandardMaterial({ 
    color: 0x4444ff, 
    flatShading: true, 
    transparent: true, 
    opacity: 0.8 
  });
  
  for (let i = 0; i < lakeCount; i++) {
    // Create random lake shape using disk geometry (flat circle)
    const radius = 50 + Math.random() * 100;
    // Use CircleGeometry for flat lakes - fewer segments for low-poly look
    const lakeGeo = new THREE.CircleGeometry(radius, 6 + Math.floor(Math.random() * 4));
    const lake = new THREE.Mesh(lakeGeo, waterMat);
    
    // Position lakes randomly but not near airports
    let validPosition = false;
    let pos = new THREE.Vector3();
    
    while (!validPosition) {
      pos.set(
        (Math.random() - 0.5) * 4500,
        0.5, // Just barely above ground to prevent z-fighting
        (Math.random() - 0.5) * 4500
      );
      
      // Check distance from cargo locations (avoid placing lakes too close)
      validPosition = true;
      for (let j = 0; j < cargoLocations.length; j++) {
        if (pos.distanceTo(cargoLocations[j].position) < 300) {
          validPosition = false;
          break;
        }
      }
    }
    
    lake.position.copy(pos);
    // CircleGeometry is created on XY plane, so rotate to lay flat on ground (XZ plane)
    lake.rotation.x = -Math.PI / 2;
    scene.add(lake);
  }
}


function toggleNavigationAids() {
  navigationAids.active = !navigationAids.active;
  showNotification(`Navigation Aids: ${navigationAids.active ? "ON" : "OFF"}`);
  
  if (navigationAids.active) {
    // If turning on, add our first waypoint to current cargo destination if we have cargo
    if (cargo.length > 0) {
      const destination = cargoLocations.find(loc => loc.name === cargo[0].to);
      if (destination) {
        navigationAids.waypoints = [destination.position.clone()];
        navigationAids.currentWaypoint = 0;
        showNotification(`Route to ${cargo[0].to} activated`);
      }
    }
  }
}

function cycleNavigationMode() {
  if (!navigationAids.active) return;
  
  const modes = ["gps", "vortac", "ils"];
  const currentIndex = modes.indexOf(navigationAids.mode);
  navigationAids.mode = modes[(currentIndex + 1) % modes.length];
  showNotification(`Navigation Mode: ${navigationAids.mode.toUpperCase()}`);
}

function createNavigationMarkers() {
  // Create materials for nav aid markers
  const navMarkerMats = {
    gps: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    vortac: new THREE.MeshBasicMaterial({ color: 0xff6600 }),
    ils: new THREE.MeshBasicMaterial({ color: 0x00ffff })
  };
  
  // Create a group to hold all navigation objects
  const navGroup = new THREE.Group();
  navGroup.name = "navigationAids";
  scene.add(navGroup);
  
  // Create VORTAC beacons at each cargo location
  cargoLocations.forEach(location => {
    const vortacGeo = new THREE.CylinderGeometry(2, 2, 10, 8);
    const vortac = new THREE.Mesh(vortacGeo, navMarkerMats.vortac);
    vortac.position.copy(location.position.clone().add(new THREE.Vector3(0, 5, 0)));
    vortac.name = "vortac_" + location.name;
    navGroup.add(vortac);
    
    // Add a beacon light on top
    const beaconGeo = new THREE.SphereGeometry(1, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 6;
    vortac.add(beacon);
  });
  
  // Create ILS approach path for the main runway
  const ilsStartPos = new THREE.Vector3(0, 20, 400); // Starting point of ILS beam
  const ilsEndPos = new THREE.Vector3(0, 1.2, 100); // End at the runway touchdown point
  
  // Create ILS marker path
  for (let i = 0; i < 10; i++) {
    const t = i / 9; // Interpolation parameter
    const pos = new THREE.Vector3().lerpVectors(ilsStartPos, ilsEndPos, t);
    
    const markerGeo = new THREE.BoxGeometry(2, 0.5, 2);
    const marker = new THREE.Mesh(markerGeo, navMarkerMats.ils);
    marker.position.copy(pos);
    marker.name = "ils_marker";
    navGroup.add(marker);
  }
  
  // Make all navigation aids invisible by default
  navGroup.visible = false;
}

function updateNavigationDisplay() {
  if (!navigationAids.active) return;
  
  // Get nav group
  const navGroup = scene.getObjectByName("navigationAids");
  if (!navGroup) return;
  
  // Toggle visibility based on mode
  navGroup.children.forEach(child => {
    if (child.name.startsWith(navigationAids.mode)) {
      child.visible = true;
    } else {
      child.visible = false;
    }
  });
  
  // If in GPS mode and we have waypoints, draw a path
  if (navigationAids.mode === "gps" && navigationAids.waypoints.length > 0) {
    updateGPSPath();
  }
  
  // For ILS mode - check if we're on approach to main runway
  if (navigationAids.mode === "ils") {
    const mainRunwayVector = new THREE.Vector3(0, 0, 1); // Runway direction vector
    const planeToRunway = new THREE.Vector3(0, 0, 100).sub(airplane.position);
    planeToRunway.y = 0; // Ignore height differences
    
    // Check if we're behind the runway and aligned with it
    if (planeToRunway.z < 0 && Math.abs(planeToRunway.x) < 50) {
      // We're on approach
      navigationAids.approachActive = true;
      
      // Add glide slope indicator to UI
      const idealGlideSlope = 3; // 3-degree glide slope
      const currentDistance = planeToRunway.length();
      const idealHeight = Math.tan(idealGlideSlope * Math.PI / 180) * currentDistance;
      const heightDifference = airplane.position.y - idealHeight;
      
      // Show glide slope information
      document.getElementById("landing-guide").style.display = 'block';
      const glideSlopeElement = document.getElementById("landing-angle-status");
      if (glideSlopeElement) {
        if (Math.abs(heightDifference) < 5) {
          glideSlopeElement.textContent = "İdeal";
          glideSlopeElement.style.color = "lime";
        } else if (heightDifference > 5) {
          glideSlopeElement.textContent = "Çok Yüksek";
          glideSlopeElement.style.color = "red";
        } else {
          glideSlopeElement.textContent = "Çok Alçak";
          glideSlopeElement.style.color = "red";
        }
      }
    } else {
      navigationAids.approachActive = false;
    }
  }
}

function updateGPSPath() {
  // Check if we already have a GPS path line
  let gpsLine = scene.getObjectByName("gpsPathLine");
  if (!gpsLine) {
    // Create a new GPS path line
    const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const pathGeometry = new THREE.BufferGeometry();
    gpsLine = new THREE.Line(pathGeometry, pathMaterial);
    gpsLine.name = "gpsPathLine";
    scene.add(gpsLine);
  }
  
  // Create path from current position to current waypoint
  const currentWaypoint = navigationAids.waypoints[navigationAids.currentWaypoint];
  if (!currentWaypoint) return;
  
  // Create points for the line
  const points = [
    airplane.position.clone(),
    currentWaypoint.clone()
  ];
  
  // Update line geometry
  gpsLine.geometry.setFromPoints(points);
  
  // Check if we've reached the waypoint
  const distanceToWaypoint = airplane.position.distanceTo(currentWaypoint);
  if (distanceToWaypoint < 50) {
    // We've reached the waypoint
    navigationAids.currentWaypoint++;
    
    // If we've reached all waypoints, create a new route if we have cargo
    if (navigationAids.currentWaypoint >= navigationAids.waypoints.length) {
      if (cargo.length > 0) {
        const destination = cargoLocations.find(loc => loc.name === cargo[0].to);
        if (destination) {
          navigationAids.waypoints = [destination.position.clone()];
          navigationAids.currentWaypoint = 0;
          showNotification(`New route to ${cargo[0].to} activated`);
        } else {
          navigationAids.waypoints = [];
          showNotification("Destination reached, no more waypoints");
        }
      } else {
        navigationAids.waypoints = [];
        showNotification("Destination reached, no more waypoints");
      }
    }
  }
  
  // Display distance to waypoint on UI
  const distanceElement = document.getElementById("nav-distance");
  if (distanceElement) {
    distanceElement.textContent = `Distance to waypoint: ${Math.floor(distanceToWaypoint)}m`;
  }
}

// Kontrol menüsü oluşturma fonksiyonu
function createControlsMenu() {
  // Kontrol menüsü için overlay oluştur
  let controlsMenu = document.getElementById("controls-menu");
  
  if (!controlsMenu) {
    controlsMenu = document.createElement('div');
    controlsMenu.id = "controls-menu";
    controlsMenu.style.position = 'absolute';
    controlsMenu.style.top = '50%';
    controlsMenu.style.left = '50%';
    controlsMenu.style.transform = 'translate(-50%, -50%)';
    controlsMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    controlsMenu.style.color = 'white';
    controlsMenu.style.padding = '20px';
    controlsMenu.style.borderRadius = '10px';
    controlsMenu.style.zIndex = '1000';
    controlsMenu.style.minWidth = '400px';
    controlsMenu.style.maxHeight = '80vh';
    controlsMenu.style.overflowY = 'auto';
    controlsMenu.style.display = 'none';
    document.body.appendChild(controlsMenu);
  }
  
  // Kontrol listesini oluştur
  const controlsList = [
    { key: "W", description: "Hızlanma (gaz)" },
    { key: "S", description: "Yavaşlama (gaz azaltma)" },
    { key: "A", description: "Sola dönüş" },
    { key: "D", description: "Sağa dönüş" },
    { key: "▲", description: "Burun aşağı (pitch down)" },
    { key: "▼", description: "Burun yukarı (pitch up)" },
    { key: "G", description: "İniş takımlarını aç/kapat" },
    { key: "Space", description: "Kargo yükle/boşalt" },
    { key: "M", description: "Görev menüsünü aç" },
    { key: "U", description: "Geliştirme mağazasını aç (ana havalimanında)" },
    { key: "C", description: "Kamera görünümünü değiştir" },
    { key: "R", description: "Uçağı sıfırla (kaza sonrası)" },
    { key: "N", description: "Navigasyon çizgisi ayarlama" },
    { key: "T", description: "Uçak izi açma kapama" },
    { key: "H", description: "Kontrol menüsünü aç/kapat" }
  ];
  
  // HTML içeriğini oluştur
  let content = `
    <h2 style="text-align: center; margin-bottom: 20px;">Klavye Kontrolleri</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <th style="padding: 8px; text-align: left; border-bottom: 1px solid white; width: 80px;">Tuş</th>
        <th style="padding: 8px; text-align: left; border-bottom: 1px solid white;">İşlev</th>
      </tr>
  `;
  
  // Her kontrol için tablo satırı ekle
  controlsList.forEach(control => {
    content += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #444; font-weight: bold;">
          <div style="display: inline-block; min-width: 25px; text-align: center; padding: 3px 8px; background-color: #333; border-radius: 4px; border: 1px solid #555;">${control.key}</div>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #444;">${control.description}</td>
      </tr>
    `;
  });
  
  content += `
    </table>
    <div style="margin-top: 20px; text-align: center;">
      <button id="close-controls-menu" style="padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Kapat</button>
    </div>
  `;
  
  controlsMenu.innerHTML = content;
  
  // Kapatma düğmesi için event listener ekle
  document.getElementById("close-controls-menu").addEventListener("click", () => {
    controlsMenu.style.display = 'none';
  });
  
  return controlsMenu;
}

// H tuşuna basıldığında menüyü aç/kapat
function toggleControlsMenu() {
  let controlsMenu = document.getElementById("controls-menu");
  
  if (!controlsMenu) {
    controlsMenu = createControlsMenu();
  }
  
  if (controlsMenu.style.display === 'none' || !controlsMenu.style.display) {
    controlsMenu.style.display = 'block';
  } else {
    controlsMenu.style.display = 'none';
  }
}

// H tuşu için event listener ekle
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === 'h') {
    toggleControlsMenu();
  }
});

// Oyun başladığında kısaca bilgi göster
setTimeout(() => {
  showNotification("Kontroller için H tuşuna basın");
}, 3000);

// Add this function to create a single trail particle
function createTrailParticle() {
  // Create a low-poly geometry for the trail particle
  // Using icosahedron for a low-poly cloud-like look
  const trailGeo = new THREE.IcosahedronGeometry(0.1 + Math.random() * 0.2, 0); // 0 = no subdivisions for low-poly look
  
  // White material with some transparency
  const trailMat = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    flatShading: true  // Important for low-poly look
  });
  
  const particle = new THREE.Mesh(trailGeo, trailMat);
  
  // Position slightly behind and below the aircraft
  const offset = new THREE.Vector3(
    (Math.random() - 0.5) * 0.2, // Small random X offset
    (Math.random() - 0.5) * 0.2, // Small random Y offset
    -0.5 - Math.random() * 0.5   // Behind the aircraft
  );
  
  // Apply airplane's rotation to the offset
  offset.applyQuaternion(airplane.quaternion);
  
  // Set particle position
  particle.position.copy(airplane.position).add(offset);
  
  // Add some randomness to scale
  const scale = 0.6 + Math.random() * 0.4;
  particle.scale.set(scale, scale, scale);
  
  // Add additional properties for animation
  particle.userData = {
    createdAt: Date.now(),
    lifetime: trailLifetime,
    initialScale: scale,
    rotationSpeed: {
      x: (Math.random() - 0.5) * 0.01,
      y: (Math.random() - 0.5) * 0.01,
      z: (Math.random() - 0.5) * 0.01
    }
  };
  
  // Add to scene and particle array
  scene.add(particle);
  trailParticles.push(particle);
}

// Add this function to update all trail particles
function updateTrailParticles() {
  // Only emit particles when moving fast enough and trail is enabled
  if (speed > 0.5 && trailEnabled) {
    const now = Date.now();
    if (now - trailLastEmitTime > trailEmissionRate * 1000) {
      createTrailParticle();
      trailLastEmitTime = now;
    }
  }
  
  // Update existing particles
  for (let i = trailParticles.length - 1; i >= 0; i--) {
    const particle = trailParticles[i];
    const age = (Date.now() - particle.userData.createdAt) / 1000; // Age in seconds
    
    // If particle is beyond its lifetime, remove it
    if (age > particle.userData.lifetime) {
      scene.remove(particle);
      trailParticles.splice(i, 1);
      continue;
    }
    
    // Calculate how far through its life the particle is (0 to 1)
    const lifeRatio = age / particle.userData.lifetime;
    
    // Update opacity - fade out as it ages
    particle.material.opacity = 0.7 * (1 - lifeRatio);
    
    // Slowly increase scale as it ages
    const growFactor = 1 + lifeRatio * 2;
    particle.scale.set(
      particle.userData.initialScale * growFactor,
      particle.userData.initialScale * growFactor,
      particle.userData.initialScale * growFactor
    );
    
    // Slow random rotation for more interesting effect
    particle.rotation.x += particle.userData.rotationSpeed.x;
    particle.rotation.y += particle.userData.rotationSpeed.y;
    particle.rotation.z += particle.userData.rotationSpeed.z;
    
    // Slight upward drift
    particle.position.y += 0.02;
    
    // Also drift slightly backward
    const driftDirection = new THREE.Vector3(0, 0, -0.01);
    driftDirection.applyQuaternion(airplane.quaternion);
    particle.position.add(driftDirection);
  }
  
  // Limit the maximum number of particles for performance
  if (trailParticles.length > trailParticlesMax) {
    const removeCount = trailParticles.length - trailParticlesMax;
    for (let i = 0; i < removeCount; i++) {
      scene.remove(trailParticles[i]);
    }
    trailParticles.splice(0, removeCount);
  }
}

// Add a toggle function for the trail effect
function toggleTrail() {
  trailEnabled = !trailEnabled;
  showNotification(`Uçak izi ${trailEnabled ? 'açıldı' : 'kapatıldı'}`);
}
