// *********************************************************************************************************************
// **                                                                                                                 **
// **             Texturing example, Cube is mapped with 2D texture, skybox is mapped with a Cubemap                  **
// **                                                                                                                 **
// *********************************************************************************************************************

import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3 } from "../node_modules/gl-matrix/esm/index.js";

import { positions, uvs, indices } from "../blender/cube.js";
import { positions as planePositions, indices as planeIndices } from "../blender/plane.js";

// language=GLSL
let fragmentShader = `
    #version 300 es
    precision highp float;
    
    uniform sampler2D tex;    
    uniform float textureSize;
        
    in vec2 v_uv;
    
    out vec4 outColor;
    
    void main()
    {
        outColor = texture(tex, v_uv * textureSize);
            }
`;

// language=GLSL
let vertexShader = `
    #version 300 es
            
    uniform mat4 modelViewProjectionMatrix;
    uniform float cubeSize;
    
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 v_uv;
    
    void main()
    {
        gl_Position = modelViewProjectionMatrix * vec4(position * cubeSize, 1.0);           
        v_uv = uv;
    }
`;


// language=GLSL
let skyboxFragmentShader = `
    #version 300 es
    precision mediump float;
    
    uniform samplerCube cubemap;
    uniform mat4 viewProjectionInverse;
    in vec4 v_position;
    
    out vec4 outColor;
    
    void main() {
      vec4 t = viewProjectionInverse * v_position;
      outColor = texture(cubemap, normalize(t.xyz / t.w));
    }
`;

// language=GLSL
let skyboxVertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    out vec4 v_position;
    
    void main() {
      v_position = vec4(position.xz, 1.0, 1.0);
      gl_Position = v_position;
    }
`;

let program = app.createProgram(vertexShader.trim(), fragmentShader.trim());
let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, uvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotateXMatrix = mat4.create();
let rotateYMatrix = mat4.create();
let skyboxViewProjectionInverse = mat4.create();

let translateVector = vec3.create();

let cubes = [];

function createCube() {
    let newCube = {
        rotationX: 0,
        rotationY: 0,
        rotationSpeedX: 0,
        rotationSpeedY: 0,
        directionX: getRandomDirection(),
        directionY: getRandomDirection(),
        bouncedX: false,
        bouncedY: false,
        movingXDirection: 'right',
        movingYDirection: 'up',
        translationX: 0.0,
        translationY: 0.0,
        bounceXCounter: 1,
        bounceYCounter: 1,
        speedX: 1,
        speedY: 1,
        translateXBoundary: 0.00,
        translateYBoundary: 0.00
    };
    cubes.push(newCube);
}

if (cubes.length === 0) {
    createCube();
}

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const tex = await loadTexture("steel.jpg");
let drawCall = app.createDrawCall(program, vertexArray)
    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.NEAREST,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.MIRRORED_REPEAT,
        wrapT: PicoGL.MIRRORED_REPEAT
    }));

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", app.createCubemap({
        negX: await loadTexture("stormydays_bk.png"),
        posX: await loadTexture("stormydays_ft.png"),
        negY: await loadTexture("stormydays_dn.png"),
        posY: await loadTexture("stormydays_up.png"),
        negZ: await loadTexture("stormydays_lf.png"),
        posZ: await loadTexture("stormydays_rt.png")
    }));

let previousTime = 0;

function draw(timems) {
    for (let i = 0; i < cubes.length; i++) {
    let cube = cubes[i];
    const time = timems * 0.001;
    const deltaTime = time - previousTime;
    previousTime = time;
    cube.rotationX += deltaTime * cube.rotationSpeedX;
    cube.rotationY += deltaTime * cube.rotationSpeedY;
    const camRotSpeed = 0.1;

    chooseMovingDirection(cube, deltaTime);
       
    
    mat4.perspective(projMatrix, Math.PI * 0.25, app.width / app.height, 0.1, 100.0);
    let camPos = vec3.rotateY(vec3.create(), vec3.fromValues(0, 0.5, 5), vec3.fromValues(0, 0, 0), time * camRotSpeed);
    mat4.lookAt(viewMatrix, camPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    let cubePos = vec3.rotateY(vec3.create(), [cube.translationX, cube.translationY, 0.0], vec3.fromValues(0, 0, 0), time * camRotSpeed);
    mat4.translate(modelMatrix, mat4.create(), cubePos);

    mat4.fromXRotation(rotateXMatrix, cube.rotationX);
    mat4.fromZRotation(rotateYMatrix, cube.rotationY);
    mat4.multiply(modelMatrix, modelMatrix, rotateXMatrix);
    mat4.multiply(modelMatrix, modelMatrix, rotateYMatrix);


    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    

    vec3.transformMat4(translateVector, vec3.create(), modelViewProjectionMatrix);
    cube.translateXBoundary = translateVector[0];
    cube.translateYBoundary = translateVector[1];
    

    let skyboxViewProjectionMatrix = mat4.create();
    mat4.mul(skyboxViewProjectionMatrix, projMatrix, viewMatrix);
    mat4.invert(skyboxViewProjectionInverse, skyboxViewProjectionMatrix);

    app.clear();

    app.disable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();

    app.enable(PicoGL.DEPTH_TEST);
    app.enable(PicoGL.CULL_FACE);

    drawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    changeTextureSize(cube);
    changeCubeSize(cube);
    drawCall.draw();
    console.log('x: ' + cube.bounceXCounter + ', y: ' + cube.bounceYCounter);
    if(cube.bounceYCounter === 10) {
        createCube();
    }
    }
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function chooseMovingDirection(cube, deltaTime) {
    updateYDirection(cube);
    updateXDirection(cube);
    if (cube.movingXDirection === 'right') {
        cube.translationX += cube.directionX * deltaTime * cube.speedX;
    } else {
        cube.translationX += -cube.directionX * deltaTime * cube.speedX;
    }

    if (cube.movingYDirection === 'up') {
        cube.translationY += cube.directionY * deltaTime * cube.speedY;
    } else {
        cube.translationY += -cube.directionY * deltaTime * cube.speedY;
    }
}

function updateXDirection(cube) {
    if (cube.translateXBoundary > 1.00 || cube.translateXBoundary < -1.00) {
        cube.movingXDirection = cube.translateXBoundary > 1.00 ? 'left' : 'right';
        cube.directionX = getRandomDirection();
        cube.speedX = getRandomSpeed();
        if (!cube.bouncedX) {
            cube.bounceXCounter += 1;
            cube.rotationSpeedX = getRandomSpeedRotation();
            cube.bouncedX = true;
        }
    } else {
        cube.bouncedX = false;
    }
}

function updateYDirection(cube) {
    if (cube.translateYBoundary > 1.00 || cube.translateYBoundary < -1.00) {
        cube.movingYDirection = cube.translateYBoundary > 1.00 ? 'bottom' : 'up';
        cube.directionY = getRandomDirection();
        cube.speedY = getRandomSpeed();
        if (!cube.bouncedY) {
            cube.bounceYCounter += 1;
            cube.rotationSpeedY = getRandomSpeedRotation();
            cube.bouncedY = true;
        }
    } else {
        cube.bouncedY = false;
    }
}

function getRandomDirection() {
    return Math.floor(Math.random() * 10) / 10;
}

function getRandomSpeed() {
    return Math.floor(Math.random() * 10) + 1;
}

function getRandomSpeedRotation() {
    return Math.floor(Math.random() * -10);
}

function changeTextureSize(cube) {
    drawCall.uniform("textureSize", cube.bounceXCounter);
}

function changeCubeSize(cube) {
    drawCall.uniform("cubeSize", cube.bounceYCounter * 0.1);
}