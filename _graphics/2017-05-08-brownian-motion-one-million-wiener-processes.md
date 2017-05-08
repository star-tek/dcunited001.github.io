---
title: "Brownian Motion: One Million Wiener Processes"
categories: "graphics"
tags: "graphics computer-science"
headline: ""
excerpt: ""
author:
name: "David Conner"
---

####  Requires ES6 & WebGL 2.0 &#x2605; Runs Best In Firefox (and Chrome) &#x2605; Does Not Run On Mobile

<div class="row">
  <div class="col-sm-4">
    <label for="particle-count">Particle Count:</label>
    <input id="particle-count" type="range" min="1024" max="1048576" step="1024" value="1024"/>
  </div>
  <div class="col-sm-4">
    <label for="particle-speed">Particle Speed:</label>
    <input id="particle-speed" type="range" min="0.025" max="10.0" step="0.025" value="1.0"/>
  </div>
  <div class="col-sm-4">
    <label for="particle-size">Particle Size:</label>
    <input id="particle-size" type="range" min="1.0" max="5.0" step="0.025" value="1.0"/>
  </div>
</div>

<script type="x-shader/x-vertex" id="vsPass">
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec2 a_texcoord;

out vec2 v_st;
out vec3 v_position;

void main() {
  v_st = a_texcoord;
  v_position = a_position;
  gl_Position = vec4(a_position, 1.0);
}
</script>

<script type="x-shader/x-fragment" id="fsParticleIntRandoms">
uniform vec2 resolution;
uniform ivec4 randomSeed;
uniform float particleSpeed;
uniform vec4 deltaTime;

uniform isampler2D particleRandoms;
uniform sampler2D particles;

in vec2 v_st;
in vec3 v_position;

layout(location = 0) out ivec4 random;
layout(location = 1) out vec4 particle;

const float maxInt = 2147483647.0;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  // =======================================
  // Update Randoms
  // =======================================

  ivec4 randomTexel = texture(particleRandoms, uv);

  vec2 texelCoords[4];
  texelCoords[0] = mod(gl_FragCoord.xy + vec2( 0.0, -2.0), resolution.xy) / resolution.xy;
  texelCoords[1] = mod(gl_FragCoord.xy + vec2( 1.0,  0.0), resolution.xy) / resolution.xy;
  texelCoords[2] = mod(gl_FragCoord.xy + vec2( 0.0,  1.0), resolution.xy) / resolution.xy;
  texelCoords[3] = mod(gl_FragCoord.xy + vec2(-1.0,  1.0), resolution.xy) / resolution.xy;

  ivec4 texels[4];
  texels[0] = texture(particleRandoms, texelCoords[0]);
  texels[1] = texture(particleRandoms, texelCoords[1]);
  texels[2] = texture(particleRandoms, texelCoords[2]);
  texels[3] = texture(particleRandoms, texelCoords[3]);

  ivec4 newRandom = randomSeed ^ randomTexel ^ texels[0] ^ texels[1] ^ texels[2] ^ texels[3];
  random = newRandom;

  // =======================================
  // Update Particles
  // =======================================

  vec4 newRandomFloat = fract(vec4(newRandom) / maxInt + 0.5) - 0.5 ;
  particle = texture(particles, uv);
  particle.x += (particleSpeed * newRandomFloat.x * deltaTime.x / 1000.0);
  particle.y += (particleSpeed * newRandomFloat.y * deltaTime.x / 1000.0);
}
</script>

<script type="x-shader/x-vertex" id="vsFieldPoints">
uniform sampler2D particles;
uniform float particleSize;

layout(location = 0) in int a_index;

flat out int v_particleId;
out float v_pointSize;
out vec4 v_position;

const float maxInt = 2147483647.0;

void main()
{
  // textureSize must return ivec & texelFetch must accept ivec
  ivec2 texSize = textureSize(particles, 0);

  ivec2 texel = ivec2(a_index % texSize.x, a_index / texSize.x);
  vec4 pBasics = texelFetch(particles, texel, 0);

  v_particleId = a_index;
  v_position = vec4(pBasics.x, pBasics.y, 0.0, 1.0);
  v_pointSize = particleSize;

  gl_Position = v_position;
  gl_PointSize = v_pointSize;
}
</script>

<script type="x-shader/x-fragment" id="fsFieldPoints">
uniform vec2 resolution;
uniform sampler2D particleAttributes;

flat in int v_particleId;
in vec4 v_position;
in float v_pointSize;

out vec4 color;

void main()
{
  ivec2 texSize = textureSize(particleAttributes, 0);
  ivec2 texel = ivec2(v_particleId % texSize.x, v_particleId / texSize.x);
  vec4 pAttr = texelFetch(particleAttributes, texel, 0);

  // TODO: blend linearly with distance(gl_FragCoord.xy, gl_PointCoord);

  color = vec4(pAttr.r, pAttr.g, pAttr.b, 1.0);
  //color = vec4(intBitsToFloat(v_particleId), 0.0, 0.0, 1.0);
}

</script>

<script type="text/javascript" src="/js/3d/2017-05-08-brownian-motion-one-million-wiener-processes.es6.js"></script>