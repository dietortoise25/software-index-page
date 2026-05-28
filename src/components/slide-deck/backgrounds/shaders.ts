export const magazineFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uInk;
  uniform vec3 uPaper;
  varying vec2 vUv;

  // Simplex-like noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv = vUv;

    // Multiple layers of flowing noise
    float t = uTime * 0.15;
    float n1 = noise(uv * 3.0 + vec2(t * 0.3, t * 0.2));
    float n2 = noise(uv * 5.0 - vec2(t * 0.4, t * 0.15));
    float n3 = noise(uv * 8.0 + vec2(t * 0.25, t * 0.35));

    float flow = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

    // Blend between paper and ink based on noise
    vec3 color = mix(uPaper, uInk, flow * 0.15);

    // Subtle vignette
    float vignette = 1.0 - length(uv - 0.5) * 0.6;
    color = mix(uInk * 0.2, color, vignette);

    gl_FragColor = vec4(color, 1.0);
  }
`

export const swissFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uInk;
  uniform vec3 uPaper;
  uniform vec3 uAccent;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // Fine grid
    float gridSize = 40.0;
    vec2 grid = abs(fract(uv * gridSize) - 0.5);
    float line = min(grid.x, grid.y);
    float gridLine = 1.0 - smoothstep(0.0, 0.02, line);

    // Dots at grid intersections
    vec2 dots = abs(fract(uv * gridSize - 0.5) - 0.5);
    float dotDist = length(dots);
    float dot = 1.0 - smoothstep(0.0, 0.06, dotDist);

    // Subtle movement
    float t = uTime * 0.05;
    float shift = sin(uv.x * 10.0 + t) * cos(uv.y * 8.0 + t * 0.7) * 0.02;

    float pattern = gridLine * 0.12 + dot * 0.25 + shift;

    vec3 color = mix(uPaper, uInk, pattern * 0.3);
    color = mix(color, uAccent, dot * 0.08);

    gl_FragColor = vec4(color, 1.0);
  }
`

export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
