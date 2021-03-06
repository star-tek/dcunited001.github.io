'use strict';

// TODO: automate an intro demonstrating UI options

function createShader(gl, source, type) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

window.createProgram = function (gl, vertexShaderSource, fragmentShaderSource, defines = {}) {
  var shaderPrefix = "#version 300 es\n";
  shaderPrefix += "#extension EXT_color_buffer_float : enable\n"; // not supported in chrome

  var precisionPrefix = `
    precision highp float;
    precision highp int;
    precision highp sampler2D;
    precision highp usampler2D;
    precision highp isampler2D;
    `;

  var program = gl.createProgram();
  vertexShaderSource = shaderPrefix + expandDefines(defines) + precisionPrefix + vertexShaderSource;
  fragmentShaderSource = shaderPrefix + expandDefines(defines) + precisionPrefix + fragmentShaderSource;

  var vshader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  var fshader = createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
  gl.attachShader(program, vshader);
  gl.deleteShader(vshader);
  gl.attachShader(program, fshader);
  gl.deleteShader(fshader);
  gl.linkProgram(program);

  var log = gl.getProgramInfoLog(program);
  if (log) {
    console.log(log);
  }

  log = gl.getShaderInfoLog(vshader);
  if (log) {
    console.log(log);
  }

  log = gl.getShaderInfoLog(fshader);
  if (log) {
    console.log(log);
  }

  return program;
};

window.expandDefines = function (defines = {}) {
  // TODO: fix this?
  var defineStrings = "";
  if (defines.keys !== undefined) {
    for (var k in Object.keys(defines)) {
      defineStrings += `#define ${k} ${defines[k]}\n`;
    }
  }

  return defineStrings;
};

class Quad {
  constructor(context) {
    this._pos = this.getQuadPositions();
    this._tex = this.getQuadTexCoords();

    this._buffers = this.prepareBuffers(context, this._pos, this._tex);
    this._vertexArray = this.prepareVertexArray(context, this._buffers);
  }

  get pos() {
    return this._pos;
  }

  set pos(pos) {
    this._pos = pos
  }

  get tex() {
    return this._tex;
  }

  set tex(tex) {
    this._tex = tex;
  }

  get buffers() {
    return this._buffer;
  }

  set buffers(buffer) {
    this._buffer = buffer;
  }

  get vertexArray() {
    return this._vertexArray;
  }

  set vertexArray(vertexArray) {
    this._vertexArray = vertexArray;
  }

  prepareBuffers(context, pos, tex) {
    var vertexPosBuffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, vertexPosBuffer);
    context.bufferData(context.ARRAY_BUFFER, pos, context.STATIC_DRAW);
    context.bindBuffer(context.ARRAY_BUFFER, null);

    var vertexTexBuffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, vertexTexBuffer);
    context.bufferData(context.ARRAY_BUFFER, tex, context.STATIC_DRAW);
    context.bindBuffer(context.ARRAY_BUFFER, null);

    return {
      pos: vertexPosBuffer,
      tex: vertexTexBuffer
    }
  }

  prepareVertexArray(context, buffers) {
    var vertexArray = context.createVertexArray();
    context.bindVertexArray(vertexArray);

    var vertexPosIdx = 0;
    context.bindBuffer(context.ARRAY_BUFFER, buffers.pos);
    context.vertexAttribPointer(vertexPosIdx, 4, context.FLOAT, false, 0, 0);
    context.enableVertexAttribArray(vertexPosIdx);
    context.bindBuffer(context.ARRAY_BUFFER, null);

    var vertexTexIdx = 1;
    context.bindBuffer(context.ARRAY_BUFFER, buffers.tex);
    context.vertexAttribPointer(vertexTexIdx, 2, context.FLOAT, false, 0, 0);
    context.enableVertexAttribArray(vertexTexIdx);
    context.bindBuffer(context.ARRAY_BUFFER, null);

    context.bindVertexArray(null);

    return vertexArray;
  }

  createVertexLayout() {
    // TODO: given a hash config, return new vertex layout using these buffers
  }

  getQuadPositions() {
    return new Float32Array([
      -1.0, -1.0, 0.0, 1.0,
      1.0, -1.0, 0.0, 1.0,
      1.0, 1.0, 0.0, 1.0,
      1.0, 1.0, 0.0, 1.0,
      -1.0, 1.0, 0.0, 1.0,
      -1.0, -1.0, 0.0, 1.0
    ])
  }

  getQuadTexCoords() {
    return new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      1.0, 1.0,
      0.0, 1.0,
      0.0, 0.0
    ])
  }
}

// =======================================
// RenderPassConfig
// =======================================

class RenderPassConfig {

  constructor(context, program, options = {uniformLocations: {}}) {
    this._program = program;
    this._context = context;
    this._uniformLocations = options.uniformLocations || {};
    delete options.uniformLocations;
    this._options = options;
  }

  get program() {
    return this._program
  }

  set program(program) {
    this._program = program;
  }

  get context() {
    return this._context;
  }

  set context(context) {
    this._context = context;
  }

  get options() {
    return this._options;
  }

  set options(options) {
    this._options = options;
  }

  get uniformLocations() {
    return this._uniformLocations;
  }

  set uniformLocations(uniformLocations) {
    this._uniformLocations = uniformLocations;
  }

  initUniformLocations(keys) {
    // initialize the keys for uniform locations
    var locations = {};
    for (var k of keys) {
      locations[k] = null;
    }
    this._uniformLocations = locations;
  }

  setUniformLocations() {
    var keys = Object.keys(this.uniformLocations);
    for (var k of keys) {
      this.uniformLocations[k] = this.context.getUniformLocation(this.program, k);
    }
  }

  selectProgram() {
    this.context.useProgram(this.program)
  }

  encode(uniforms, options = {}) {
    var ops = Object.assign({}, this.options, options);

    // for each key in uniforms, encode value into the specific location
    if (ops.beforeEncode !== undefined) {
      ops.beforeEncode(this.context, uniforms, ops);
    }

    this.selectProgram();

    if (ops.encodeUniforms !== undefined) {
      ops.encodeUniforms(this.context, uniforms, ops);
    } else {
      this.encodeUniforms(this.context, uniforms, ops);
    }

    if (ops.encodeDraw !== undefined) {
      ops.encodeDraw(this.context, uniforms, ops);
    } else {
      this.encodeDraw(this.context, uniforms, ops);
    }

    if (ops.afterEncode !== undefined) {
      ops.afterEncode(this.context, uniforms, ops);
    }

    this.cleanupEncode();
  }

  encodeUniforms(c, uniforms, options = {}) {
    console.error("RenderPassConfig: override encodeUniforms() or pass 'encodeUniforms'")
  }

  encodeDraw(c, uniforms, options = {}) {
    console.error("RenderPassConfig: override encodeDraw() or pass 'encodeDraw'")
  }

  cleanupEncode() {
    this._context.bindBuffer(this._context.ARRAY_BUFFER, null);
    this._context.bindVertexArray(null);
    this._context.useProgram(null);
  }
}

class ResourceProvider {
  // i need the triple buffering pattern from iOS/OSX Metal semaphore
  // - this is because i'm rendering updated particle positons to a texture
  //   - this in turn renders a gradient that's used in the next frame
  // - double buffering may be enough, but ideally the data should remain written to buffer for as long as it's needed to render

  constructor(options = {}) {
    this._current = 0;
    this._textures = {};
    this._max = options.max || 3
  }

  registerTextures(k, textures) {
    this._textures[k] = textures;
  }

  getCurrent(k) {
    return this._textures[k][this.getCurrentId()];
  }

  getNext(k) {
    return this._textures[k][this.getNextId()];
  }

  getPrev(k) {
    return this._textures[k][this.getPrevId()];
  }

  getCurrentId() {
    return this._current;
  }

  getNextId() {
    if (this._current == this._max - 1) {
      return 0;
    } else {
      return this._current + 1;
    }
  }

  getPrevId() {
    if (this._current == 0) {
      return this._max - 1;
    } else {
      return this._current - 1;
    }
  }

  increment() {
    if (this._current == this._max - 1) {
      this._current = 0;
    } else {
      this._current++;
    }
  }
}

function updateTexture(f) {
  //return a function that's enveloped in the correct access calls to update before render or b/w draw calls
  return function (context, triple, i) {
    var thisTexture = triple[i];

    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, triple[i]);

    f(context, thisTexture);

    context.bindTexture(context.TEXTURE_2D, null);
  }
}

function runWebGL() {

  var canvas = document.getElementById('main-canvas');
  canvas.style.width = '100%';
  canvas.height = 500;
  canvas.width = canvas.offsetWidth;

  // =======================================
  // Canvas & WebGL
  // =======================================

  var gl = canvas.getContext('webgl2', {antialias: true});
  var colorBufferFloatExt = gl.getExtension('EXT_color_buffer_float');
  if (!colorBufferFloatExt) {
    console.error("EXT_color_buffer_float not supported.")
  }

  var isWebGL2 = !!gl;
  if (!isWebGL2) {
    document.getElementById('info').innerHTML = 'WebGL 2 is not available.  See <a href="https://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">How to get a WebGL 2 implementation</a>';
    console.error('WebGL 2 is not available.')
  }

  var WIN_X = gl.drawingBufferWidth;
  var WIN_Y = gl.drawingBufferHeight;

  var UINT32_MAX = (2 ** 32) - 1;
  var INT32_MAX = (2 ** 31) - 1;

  // =======================================
  // GLSL Programs
  // =======================================

  // -- initialize glsl programs
  var vsPass = document.getElementById('vsPass').textContent,
    fsParticleIntRandoms = document.getElementById('fsUpdateParticles').textContent,
    vsFieldPoints = document.getElementById('vsParticles').textContent,
    fsFieldPoints = document.getElementById('fsParticles').textContent;

  var programIntRandomTexture = createProgram(gl, vsPass, fsParticleIntRandoms);
  var programFieldPoints = createProgram(gl, vsFieldPoints, fsFieldPoints);

  // =======================================
  // GLSL options
  // =======================================

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // =======================================
  // particles
  // =======================================

  function generateFloat32Randoms(w, h, n, max = 1, min = 0) {
    var randoms = new Float32Array(w * h * n);
    var range = max - min;
    var mid = min + range/2;
    for (var i = 0; i < (w * h * n); i++) {
      randoms[i] = Math.random() * range + min;
    }
    return randoms
  }

  function generateInt32Randoms(w, h, n) {
    var randoms = new Int32Array(w * h * n);
    for (var i = 0; i < (w * h * n); i++) {
      randoms[i] = Math.trunc(Math.random() * UINT32_MAX - INT32_MAX);
    }
    return randoms
  }

  // =======================================
  // particle buffers
  // =======================================

  function generateParticleIndices(h, w) {
    var indices = new Int32Array(h * w);
    for (var i = 0; i < (h * w); i++) {
      indices[i] = i;
    }
    return indices;
  }

  var PARTICLE_FB_HEIGHT = 1024;
  var PARTICLE_FB_WIDTH = 1024;
  var PARTICLE_COUNT = PARTICLE_FB_HEIGHT * PARTICLE_FB_WIDTH;

  var particleIdx = generateParticleIndices(PARTICLE_FB_HEIGHT, PARTICLE_FB_WIDTH);

  var particleIdxBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, particleIdxBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, particleIdx, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  var particleVertexArray = gl.createVertexArray();
  gl.bindVertexArray(particleVertexArray);

  var particleIdxIndex = 0;
  gl.bindBuffer(gl.ARRAY_BUFFER, particleIdxBuffer);
  gl.vertexAttribIPointer(particleIdxIndex, 1, gl.INT, false, 0, 0);
  gl.enableVertexAttribArray(particleIdxIndex);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindVertexArray(null);

  // =======================================
  // Particle Framebuffer: Create Color Attachments
  // =======================================

  // four attributes can be stores per texture (x,y,z,w)
  var particleRandomsAttachments, // stores random seed data
    particleAttachments;   // stores particle basics (floats)

  particleRandomsAttachments = [0,1,2].map((f) => {
    gl.activeTexture(gl.TEXTURE0);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32I, PARTICLE_FB_WIDTH, PARTICLE_FB_HEIGHT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  });

  particleAttachments = [0,1,2].map(() => {
    gl.activeTexture(gl.TEXTURE0);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, PARTICLE_FB_WIDTH, PARTICLE_FB_HEIGHT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  });

  gl.activeTexture(gl.TEXTURE0);
  var particleAttributes = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, particleAttributes);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, PARTICLE_FB_WIDTH, PARTICLE_FB_HEIGHT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texSubImage2D(gl.TEXTURE_2D,
    0,
    0, // x offset
    0, // y offset
    PARTICLE_FB_WIDTH,
    PARTICLE_FB_HEIGHT,
    gl.RGBA,
    gl.FLOAT,
    generateFloat32Randoms(PARTICLE_FB_WIDTH, PARTICLE_FB_HEIGHT, 4, 0.25, 0.75));
  gl.bindTexture(gl.TEXTURE_2D, null);

  // =======================================
  // Initialize texture data
  // =======================================

  for (var i = 0; i <= 2; i++) {

    // initialize random seeds
    updateTexture((context, texture) => {

      context.texSubImage2D(context.TEXTURE_2D,
        0,
        0, // x offset
        0, // y offset
        PARTICLE_FB_WIDTH,
        PARTICLE_FB_HEIGHT,
        context.RGBA_INTEGER,
        context.INT,
        generateInt32Randoms(PARTICLE_FB_WIDTH, PARTICLE_FB_HEIGHT, 4));

    })(gl, particleRandomsAttachments, i);

    // init particle positions
    updateTexture((context, texture) => {

      context.texSubImage2D(context.TEXTURE_2D,
        0,
        0, // x offset
        0, // y offset
        PARTICLE_FB_WIDTH,
        PARTICLE_FB_HEIGHT,
        context.RGBA,
        context.FLOAT,
        generateFloat32Randoms(PARTICLE_FB_WIDTH, PARTICLE_FB_HEIGHT, 4, -0.5, 0.5));

    })(gl, particleAttachments, i);
  }

  // =======================================
  // configure framebuffers
  // =======================================

  var particleFb = [0,1,2].map((i) => {
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, particleRandomsAttachments[i], 0);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, particleAttachments[i], 0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    return fb;
  });

  gl.activeTexture(gl.TEXTURE0);
  var renderedParticles = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, renderedParticles);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, WIN_X, WIN_Y);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null);

  var particlesRp = new ResourceProvider();
  particlesRp.registerTextures('particleRandoms', particleRandomsAttachments);
  particlesRp.registerTextures('particles', particleAttachments);

  // =======================================
  // configure renderpasses
  // =======================================

  var anyQuad = new Quad(gl);

  var renderPassRandoms = new RenderPassConfig(gl, programIntRandomTexture, {
    beforeEncode: (context, uniforms, options) => {
      context.blendFunc(gl.ONE, gl.ZERO);
      context.bindFramebuffer(context.DRAW_FRAMEBUFFER, options.framebuffer);
      context.viewport(0, 0, uniforms.resolution[0], uniforms.resolution[1]);
      context.drawBuffers([
        context.COLOR_ATTACHMENT0,
        context.COLOR_ATTACHMENT1
      ]);

      checkFbStatus();
    },
    encodeUniforms: (context, uniforms, options) => {
      context.uniform2fv(renderPassRandoms.uniformLocations.resolution, uniforms.resolution);
      context.uniform4iv(renderPassRandoms.uniformLocations.randomSeed, uniforms.randomSeed);
      context.uniform1f(renderPassRandoms.uniformLocations.particleSpeed, uniforms.particleSpeed);
      context.uniform4fv(renderPassRandoms.uniformLocations.deltaTime, uniforms.deltaTime);
      context.uniform1i(renderPassRandoms.uniformLocations.particleRandoms, uniforms.particleRandomsLocation);
      context.uniform1i(renderPassRandoms.uniformLocations.particles, uniforms.particlesLocation);

      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, options.particleRandoms);

      context.activeTexture(context.TEXTURE1);
      context.bindTexture(context.TEXTURE_2D, options.particles);
    },
    encodeDraw: (context, uniforms, options) => {
      context.bindVertexArray(anyQuad.vertexArray);
      context.drawArrays(context.TRIANGLES, 0, 6);
    },
    afterEncode: (context, uniforms, options) => {
      context.bindFramebuffer(context.DRAW_FRAMEBUFFER, null);
    }
  });

  renderPassRandoms.initUniformLocations([
    'resolution',
    'randomSeed',
    'particleSpeed',
    'deltaTime',
    'particleRandoms',
    'particles'
  ]);

  renderPassRandoms.setUniformLocations();

  var rpFieldPoints = new RenderPassConfig(gl, programFieldPoints, {
    beforeEncode: (context, uniforms, options) => {
      context.bindFramebuffer(context.DRAW_FRAMEBUFFER, options.framebuffer);
      context.viewport(0,0, renderResolution[0], renderResolution[1]);
      context.clearColor(0.0, 0.0, 0.0, 1.0);
      context.clear(context.COLOR_BUFFER_BIT);
      checkFbStatus();
    },
    encodeUniforms: (context, uniforms, options) => {
      context.uniform1i(rpFieldPoints.uniformLocations.particles, uniforms.particlesLocation);
      context.uniform1f(rpFieldPoints.uniformLocations.particleSize, uniforms.particleSize);
      context.uniform1i(rpFieldPoints.uniformLocations.particleAttributes, uniforms.particleAttributesLocation);
      context.uniform2fv(rpFieldPoints.uniformLocations.resolution, uniforms.resolution);

      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, options.particles);

      context.activeTexture(context.TEXTURE1);
      context.bindTexture(context.TEXTURE_2D, options.particleAttributes);
    },
    encodeDraw: (context, uniforms, options) => {
      context.bindVertexArray(particleVertexArray);
      context.drawArrays(context.POINTS, 0, options.particleCount);
    }
  });

  rpFieldPoints.initUniformLocations([
    'resolution',
    'particles',
    'particleSize',
    'particleAttributes'
  ]);

  rpFieldPoints.setUniformLocations();

  function makeRandomUniforms() {
    return new Float32Array([
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random()
    ]);
  }

  function makeIntRandomUniforms() {
    return new Int32Array([
      Math.trunc(Math.random() * UINT32_MAX - INT32_MAX),
      Math.trunc(Math.random() * UINT32_MAX - INT32_MAX),
      Math.trunc(Math.random() * UINT32_MAX - INT32_MAX),
      Math.trunc(Math.random() * UINT32_MAX - INT32_MAX)
    ]);
  }

  var startTime = Date.now(),
    currentTime = startTime,
    elapsedTime = currentTime - startTime,
    lastFrameStart = currentTime,
    lastFrameTime = currentTime - lastFrameStart;

  // deltaT stores the last four frame times
  var deltaT = vec4.fromValues(0.0, 0.0, 0.0, 0.0);
  var framecount = 0;

  function updateTime() {
    lastFrameStart = currentTime;
    currentTime = Date.now();
    elapsedTime = currentTime - startTime;
    lastFrameTime = currentTime - lastFrameStart;
  }

  function updateDeltaT(dt, newDeltaT) {
    return vec4.fromValues(newDeltaT, dt[0], dt[1], dt[2]);
  }

  function checkFbStatus() {
    var status = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER);
    if (status != gl.FRAMEBUFFER_COMPLETE) {
      console.error('fb status: ' + status.toString(10));
    }
  }

  var particleResolution = vec2.fromValues(PARTICLE_FB_WIDTH, PARTICLE_FB_HEIGHT);
  var renderResolution = vec2.fromValues(WIN_X, WIN_Y);

  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.viewport(0, 0, renderResolution[0], renderResolution[1]);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  var particleSpeed, particleCount, particleSize;

  function render() {
    updateTime();
    deltaT = updateDeltaT(deltaT, lastFrameTime);

    // =======================================
    // grab UI values
    // =======================================

    particleSpeed = document.getElementById('particle-speed').value;
    particleCount = document.getElementById('particle-count').value;
    particleSize = document.getElementById('particle-size').value;

    // =======================================
    // particle framebuffer
    // =======================================

    // -- pass 1: render new randoms

    var randomUniforms = {
      resolution: particleResolution,
      randomSeed: makeIntRandomUniforms(),
      particleSpeed: particleSpeed,
      deltaTime: deltaT,
      particleRandomsLocation: 0,
      particlesLocation: 1
    };

    renderPassRandoms.encode(randomUniforms, {
      framebuffer: particleFb[particlesRp.getNextId()],
      particleRandoms: particlesRp.getCurrent('particleRandoms'),
      particles: particlesRp.getCurrent('particles')
    });

    particlesRp.increment();

    // =======================================
    // default framebuffer
    // =======================================

    var rpFieldPointsUniforms = {
      resolution: renderResolution,
      particlesLocation: 0,
      particleSize: parseFloat(particleSize),
      particleAttributesLocation: 1
    };

    rpFieldPoints.encode(rpFieldPointsUniforms, {
      framebuffer: null,
      particles: particlesRp.getCurrent('particles'),
      particleCount: particleCount,
      particleAttributes: particleAttributes
    });

    framecount++;
    requestAnimationFrame(render);
  }

  render();
}

window.onload = function() {
  runWebGL();
};
