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
let translateXBoundary = 0.00;
let translateYBoundary = 0.00;

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const tex = await loadTexture("steel.jpg");
let drawCall = app.createDrawCall(program, vertexArray)
    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.NEAREST,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.REPEAT,
        wrapT: PicoGL.REPEAT
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
let rotationX = 0;
let rotationY = 0;
let rotationSpeed = 0;//Math.floor(Math.random() * 10);

let translationX = 0.0;
let translationY = 0.0;
let prevTranslationX = 0.0;
let prevTranslationY = 0.0;

let translationSpeed = 1.0;
let movingXDirection = 'right';
let movingYDirection = 'up';

function draw(timems) {
    const time = timems * 0.001;
    const deltaTime = time - previousTime;
    previousTime = time;
    let rotationSpeedX = Math.sin(time);// * rotationSpeed;
    let rotationSpeedY = Math.sin(time);
    rotationX += deltaTime * rotationSpeedX;
    rotationY += deltaTime * rotationSpeedY;
    const camRotSpeed = 0.1;

    chooseMovingDirection(translateXBoundary, translateYBoundary, deltaTime);
    
    
    mat4.perspective(projMatrix, Math.PI * 0.25, app.width / app.height, 0.1, 100.0);
    let camPos = vec3.rotateY(vec3.create(), vec3.fromValues(0, 0.5, 5), vec3.fromValues(0, 0, 0), time * camRotSpeed);
    //mat4.lookAt(viewMatrix, vec3.fromValues(0, 0.5, 5), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    mat4.lookAt(viewMatrix, camPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    let cubePos = vec3.rotateY(vec3.create(), [translationX, translationY, 0.0], vec3.fromValues(0, 0, 0), time * camRotSpeed);
    mat4.translate(modelMatrix, mat4.create(), cubePos);

    mat4.fromXRotation(rotateXMatrix, rotationX);
    mat4.fromZRotation(rotateYMatrix, rotationY);
    mat4.multiply(modelMatrix, modelMatrix, rotateXMatrix);
    mat4.multiply(modelMatrix, modelMatrix, rotateYMatrix);


    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    
    
    //console.log(vec3.transformMat4(vec3.create(), vec3.create(), modelViewProjectionMatrix));
    vec3.transformMat4(translateVector, vec3.create(), modelViewProjectionMatrix);
    translateXBoundary = translateVector[0];
    translateYBoundary = translateVector[1];
    

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
    changeTextureSize();
    //drawCall.uniform("textureSize", 1.0);
    drawCall.uniform("cubeSize", 1.0);
    drawCall.draw();

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

let directionY = 0.5;
let directionX = 0.5;
let bounceCounter = 1.0; 

function chooseMovingDirection(positionX, positionY, deltaTime) {
    updateYDirection(positionY);
    updateXDirection(positionX);
    if (movingXDirection === 'right') {
        translationX += directionX * deltaTime;
    } else {
        translationX += -directionX * deltaTime;
    }

    if (movingYDirection === 'up') {
        translationY += directionY * deltaTime;
    } else {
        translationY += -directionY * deltaTime;
    }
}

function updateXDirection(positionX) {
    if (positionX > 1.00 || positionX < -1.00) {
        movingXDirection = positionX > 1.00 ? 'left' : 'right';
        directionX = getRandomDirection();
        bounceCounter += 1;
    }
}

function updateYDirection(positionY) {
    if (positionY > 1.00 || positionY < -1.00) {
        movingYDirection = positionY > 1.00 ? 'bottom' : 'up';
        directionY = getRandomDirection();
    }
}

function getRandomDirection() {
    return Math.floor(Math.random() * 10) / 10;
}

function changeTextureSize() {
    drawCall.uniform("textureSize", bounceCounter);
}