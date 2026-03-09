import Phaser from 'phaser';

// Fragment shader: directional motion blur + additive bloom/glow.
//
// Motion blur: samples 8 times along the negative velocity vector so
// each frame trails behind the snake's movement direction.
//
// Bloom: takes an 8-tap box sample around each pixel, extracts the
// bright areas by luminance, and adds them back as additive glow.
const FRAG_SHADER = `
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec2  uVelocity;    // motion-blur offset in UV space per step
uniform float uBloomRadius; // bloom tap radius in UV space

varying vec2 outTexCoord;

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 uv = outTexCoord;

  // ── Motion Blur ──────────────────────────────────────────────────────────
  // Accumulate 8 samples stepping back along the velocity direction.
  // Weight decreases linearly so the leading edge is sharpest.
  // vec4 blurred   = vec4(0.0);
  // float totalW   = 0.0;
  // for (int i = 0; i < 8; i++) {
  //  float t = float(i) / 7.0;
  //  float w = 1.0 - t * 0.75;
  //  vec2 sampleUV = clamp(uv - uVelocity * t, 0.0, 1.0);
  //  blurred += texture2D(uMainSampler, sampleUV) * w;
  //  totalW  += w;
  // }
  // blurred /= totalW;

  // ── Bloom / Glow ─────────────────────────────────────────────────────────
  // 8-tap box around the pixel at radius r and 2r.
  float r = uBloomRadius;
  vec4 bloomSample = vec4(0.0);
  bloomSample += texture2D(uMainSampler, uv + vec2(-r,       -r      ));
  bloomSample += texture2D(uMainSampler, uv + vec2( r,       -r      ));
  bloomSample += texture2D(uMainSampler, uv + vec2(-r,        r      ));
  bloomSample += texture2D(uMainSampler, uv + vec2( r,        r      ));
  bloomSample += texture2D(uMainSampler, uv + vec2(-r * 2.0,  0.0   ));
  bloomSample += texture2D(uMainSampler, uv + vec2( r * 2.0,  0.0   ));
  bloomSample += texture2D(uMainSampler, uv + vec2( 0.0,     -r * 2.0));
  bloomSample += texture2D(uMainSampler, uv + vec2( 0.0,      r * 2.0));
  bloomSample /= 8.0;

  // Extract pixels above a brightness threshold and amplify them.
  float lum       = luminance(bloomSample.rgb);
  float threshold = 0.25;
  vec4 bloom      = bloomSample
    * max(0.0, lum - threshold) / (1.0 - threshold)
    * 2.5;

  gl_FragColor = texture2D(uMainSampler, uv); // blurred + bloom;
}
`;

export const SNAKE_FX_PIPELINE_KEY = 'SnakeFX';

export class SnakeFXPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private vx = 0;
  private vy = 0;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: SNAKE_FX_PIPELINE_KEY,
      fragShader: FRAG_SHADER,
    });
  }

  onPreRender() {
    // Called once per frame before the pipeline renders.
    // Push the current uniform values to the GPU.
    this.set2f('uVelocity',    this.vx, this.vy);
    this.set1f('uBloomRadius', 0.003);
  }

  // Call this each game tick with the snake's movement vector in UV space.
  setVelocity(vx: number, vy: number) {
    this.vx = vx;
    this.vy = vy;
  }
}
