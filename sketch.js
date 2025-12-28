let flock;
let weatherData;

let apiURL =
  "https://api.openweathermap.org/data/2.5/weather?q=Bengaluru&APPID=aacedc9a30cfcbe4d7e237cd5ad4830b";

let currentTemp = 273;
let targetTemp = 273;
let currentHumidity = 50;
let targetHumidity = 50;

let daylightValue = 0;
let weatherCondition = "";

let daylightSlider;
let humiditySlider;
let skyConditionSlider;

let murmurationSound;
let repelSound;

let repelPoints = [];

// ---------------- PRELOAD ----------------
function preload() {
  murmurationSound = loadSound("STARLINGS.mp3");
  repelSound = loadSound("FLIGHT.mp3");
}

// ---------------- SETUP ----------------
function setup() {
  createCanvas(1200, 600);
  loadWeatherData();
  setInterval(loadWeatherData, 10000);

  flock = new Flock();

  for (let i = 0; i < 2000; i++) {
    flock.addBoid(
      new Boid(
        width / 2 + random(-50, 50),
        height / 2 + random(-50, 50)
      )
    );
  }

  daylightSlider = createSlider(0, 1, 0.5, 0.01);
  humiditySlider = createSlider(0, 100, 50, 1);
  skyConditionSlider = createSlider(0, 1, 0.5, 0.01);

  daylightSlider.position(20, height + 20);
  humiditySlider.position(20, height + 60);
  skyConditionSlider.position(20, height + 100);

  murmurationSound.loop();
}

// ---------------- DRAW ----------------
function draw() {
  background(255);

  daylightValue = daylightSlider.value();
  let skyConditionValue = skyConditionSlider.value();
  currentHumidity = humiditySlider.value();

  if (weatherData) {
    currentTemp = lerp(currentTemp, targetTemp, 0.05);
    currentHumidity = lerp(currentHumidity, targetHumidity, 0.05);

    for (let boid of flock.boids) {
      boid.updateWeatherEffects(
        currentTemp,
        currentHumidity,
        weatherCondition,
        daylightValue,
        skyConditionValue
      );
    }
  }

  flock.run();
  adjustBoidCount(daylightValue);
}

// ---------------- INTERACTION ----------------
function mousePressed() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    repelPoints.push(createVector(mouseX, mouseY));
    repelSound.play();
  }
}

function mouseReleased() {
  repelPoints = [];
}

// ---------------- WEATHER ----------------
function loadWeatherData() {
  loadJSON(apiURL, processWeatherData);
}

function processWeatherData(data) {
  weatherData = data;
  targetTemp = data.main.temp;
  targetHumidity = data.main.humidity;
  weatherCondition = data.weather[0].description;
}

// ---------------- BOID COUNT ----------------
function adjustBoidCount(daylightValue) {
  let target = map(daylightValue, 0, 1, 500, 1700);
  while (flock.boids.length > target) flock.boids.pop();
  while (flock.boids.length < target) {
    flock.addBoid(
      new Boid(
        width / 2 + random(-100, 100),
        height / 2 + random(-100, 100)
      )
    );
  }
}

// ================= FLOCK CLASS =================
class Flock {
  constructor() {
    this.boids = [];
  }

  run() {
    for (let boid of this.boids) {
      boid.run(this.boids);
    }
  }

  addBoid(b) {
    this.boids.push(b);
  }
}

// ================= BOID CLASS =================
class Boid {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = createVector(random(-1, 1), random(-1, 1));
    this.acceleration = createVector(0, 0);

    this.r = 6; // 🔥 BIGGER SIZE (was 1.5)

    this.maxspeed = 3;
    this.maxforce = 0.3;

    this.separationFactor = 20;
    this.cohesionFactor = 20;
  }

  run(boids) {
    this.flock(boids);
    this.update();
    this.borders();
    this.render();
  }

  applyForce(f) {
    this.acceleration.add(f);
  }

  updateWeatherEffects(temp, humidity, _, daylight, sky) {
    this.cohesionFactor = map(temp, 270, 310, 1, 2);
    this.separationFactor = map(humidity, 0, 100, 1, 3);

    this.maxspeed = sky < 0.5 ? 6 : 3;
    if (daylight < 0.2) this.maxspeed = 2;
  }

  flock(boids) {
    let sep = this.separate(boids).mult(this.separationFactor);
    let ali = this.align(boids).mult(2);
    let coh = this.cohesion(boids).mult(this.cohesionFactor);

    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxspeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  render() {
    let theta = this.velocity.heading() + radians(90);

    fill(50);
    stroke(50);
    strokeWeight(1);

    push();
    translate(this.position.x, this.position.y);
    rotate(theta);
    beginShape();
    vertex(0, -this.r * 2.5);
    vertex(-this.r * 1.4, this.r * 2);
    vertex(this.r * 1.4, this.r * 2);
    endShape(CLOSE);
    pop();
  }

  borders() {
    let m = 200;
    if (this.position.x < m) this.applyForce(createVector(this.maxforce, 0));
    if (this.position.x > width - m) this.applyForce(createVector(-this.maxforce, 0));
    if (this.position.y < m) this.applyForce(createVector(0, this.maxforce));
    if (this.position.y > height - m) this.applyForce(createVector(0, -this.maxforce));
  }

  separate(boids) {
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < 25) {
        let diff = p5.Vector.sub(this.position, other.position);
        diff.normalize().div(d);
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) steer.div(count);
    if (steer.mag() > 0) {
      steer.setMag(this.maxspeed);
      steer.sub(this.velocity);
      steer.limit(this.maxforce);
    }
    return steer;
  }

  align(boids) {
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < 40) {
        sum.add(other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      sum.setMag(this.maxspeed);
      return p5.Vector.sub(sum, this.velocity).limit(this.maxforce);
    }
    return createVector(0, 0);
  }

  cohesion(boids) {
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < 40) {
        sum.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      let desired = p5.Vector.sub(sum, this.position);
      desired.setMag(this.maxspeed);
      return p5.Vector.sub(desired, this.velocity).limit(this.maxforce);
    }
    return createVector(0, 0);
  }
}
