// *********************************************************************************************************************
// **                                                                                                                 **
// **             Texturing example, Cube is mapped with 2D texture, skybox is mapped with a Cubemap                  **
// **                                                                                                                 **
// *********************************************************************************************************************

import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3 } from "../node_modules/gl-matrix/esm/index.js";


//import { positions, uvs, indices } from "../blender/cube.js";


import { positions as cubePositions, uvs as cubeUvs, indices as cubeIndices } from "../blender/cube.js";
import { positions as spherePositions, uvs as sphereUvs, indices as sphereIndices } from "../blender/sphere.js";


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
    uniform float objectSize;
    
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 v_uv;
    
    void main()
    {
        gl_Position = modelViewProjectionMatrix * vec4(position * objectSize, 1.0);           
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

let useCubeGeometry = false;

let positions, uvs, indices;
if (useCubeGeometry) {
    positions = cubePositions;
    uvs = cubeUvs;
    indices = cubeIndices;
} else {
    positions = spherePositions;
    uvs = sphereUvs;
    indices = sphereIndices;
}

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

let objects = [];
let textureFiles = ["color.jpg", "night.jpg", "abstract.jpg", "flowers.png", "canyon.jpg", "colorful.jpg", "mercury.jpg", "watercolor.jpg", "yellow.jpg", "red.jpg"];
let drawCalls = [];
for (const t of textureFiles) {
    const tex = await loadTexture(t);
    const texture = app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.NEAREST,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.MIRRORED_REPEAT,
        wrapT: PicoGL.MIRRORED_REPEAT
    });
    drawCalls.push(app.createDrawCall(program, vertexArray)
        .texture("tex", texture));
}

let objectCount = 1;
let previousTime = 0;

const camRotSpeed = 0.1;
const maxObjectsAmount = 3;
const maxBounceAmount = 8;

function createObject(rotationX, rotationY, rotationSpeedX, rotationSpeedY, directionX, directionY, movingXDirection, movingYDirection, speedX, speedY, translationX, translationY, translateXBoundary, translateYBoundary, texture, size, textureSize, childMovingXDirection) {
    let newObject = {
        rotationX: rotationX,
        rotationY: rotationY,
        rotationSpeedX: rotationSpeedX,
        rotationSpeedY: rotationSpeedY,
        directionX: directionX,
        directionY: directionY,
        bouncedX: false,
        bouncedY: false,
        movingXDirection: movingXDirection,
        movingYDirection: movingYDirection,
        translationX: translationX,
        translationY: translationY,
        bounceXCounter: 0,
        bounceYCounter: 0,
        speedX: speedX,
        speedY: speedY,
        translateXBoundary: translateXBoundary,
        translateYBoundary: translateYBoundary,
        childCreated: false,
        textureChanged: false,
        textureIndex: texture,
        objectSize: size,
        textureSize: textureSize,
        childMovingXDirection: childMovingXDirection
    };
    objects.push(newObject);
}

if (objects.length === 0) {
    createObject(0, 0, 0, 0, 0.5, 0.5, 'right', 'up', 1, 1, 0, 0, 0, 0, 4, 4, 1, 'left');
}

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", app.createCubemap({
        negX: await loadTexture("nx.png"),
        posX: await loadTexture("px.png"),
        negY: await loadTexture("ny.png"),
        posY: await loadTexture("py.png"),
        negZ: await loadTexture("nz.png"),
        posZ: await loadTexture("pz.png")
    }));

async function createChild(object) {
    if (object.bounceYCounter % maxBounceAmount === 0 && !object.childCreated && object.bounceYCounter !== 0 && objectCount < maxObjectsAmount) {
        object.objectSize = object.objectSize % 2 === 0 ? Math.floor((object.objectSize) * 0.25) : Math.floor((object.objectSize + 1) * 0.5);
        object.speedX *= 2;
        object.speedY *= 2;
        object.rotationSpeedX *= 0.5;
        object.rotationSpeedY *= 0.5;

        createObject(-object.rotationX, -object.rotationY, object.rotationSpeedX, object.rotationSpeedY, object.directionX, object.directionY, object.childMovingXDirection, object.childMovingYDirection, object.speedX, object.speedY, object.translationX, object.translationY, object.translateXBoundary, object.translateYBoundary, object.textureIndex, object.objectSize, object.textureSize, object.movingXDirection);

        object.childCreated = true;
        objectCount += 1;
    } else if (object.bounceYCounter % maxBounceAmount !== 0) {
        object.childCreated = false;
    }
}

async function changeTexture(object) {
    if (object.bounceXCounter % (maxBounceAmount * 0.25) === 0 && !object.textureChanged && object.bounceXCounter !== 0) {
        let previousIndex = object.textureIndex;
        let randomIndex;

        do {
            randomIndex = Math.floor(Math.random() * textureFiles.length);
        }
        while (randomIndex === previousIndex);

        object.textureIndex = randomIndex;
        object.textureSize = 1;
        object.textureChanged = true;

        return randomIndex;
    } else if (object.bounceXCounter % (maxBounceAmount * 0.25) !== 0) {
        object.textureChanged = false;
    }
}

async function updateObject(object, deltaTime, time) {
    object.rotationX += deltaTime * object.rotationSpeedX;
    object.rotationY += deltaTime * object.rotationSpeedY;

    chooseMovingDirection(object, deltaTime);

    let objectPos = vec3.rotateY(vec3.create(), [object.translationX, object.translationY, 0.0], vec3.fromValues(0, 0, 0), time * camRotSpeed);
    mat4.translate(modelMatrix, mat4.create(), objectPos);

    mat4.fromXRotation(rotateXMatrix, object.rotationX);
    mat4.fromZRotation(rotateYMatrix, object.rotationY);
    mat4.multiply(modelMatrix, modelMatrix, rotateXMatrix);
    mat4.multiply(modelMatrix, modelMatrix, rotateYMatrix);

    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);

    vec3.transformMat4(translateVector, vec3.create(), modelViewProjectionMatrix);
    object.translateXBoundary = translateVector[0];
    object.translateYBoundary = translateVector[1];

    changeTextureSize(object);
    changeobjectSize(object);
    drawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    drawCall.draw();
}

async function drawObjects(deltaTime, time) {
    for (let i = 0; i < objects.length; i++) {
        let object = objects[i];
        drawCall = drawCalls[object.textureIndex];

        await updateObject(object, deltaTime, time);
        await createChild(object);
        await changeTexture(object);
    }
    if (objectCount === maxObjectsAmount) {
        useCubeGeometry = false;
    }
}

let drawCall;

function draw(timems) {
    const time = timems * 0.001;
    const deltaTime = time - previousTime;
    previousTime = time;

    mat4.perspective(projMatrix, Math.PI * 0.3, app.width / app.height, 0.1, 100.0);
    let camPos = vec3.rotateY(vec3.create(), vec3.fromValues(0, 0.5, 5), vec3.fromValues(0, 0, 0), time * camRotSpeed);
    mat4.lookAt(viewMatrix, camPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    let skyboxViewProjectionMatrix = mat4.create();
    mat4.mul(skyboxViewProjectionMatrix, projMatrix, viewMatrix);
    mat4.invert(skyboxViewProjectionInverse, skyboxViewProjectionMatrix);

    app.clear();

    app.disable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();

    app.disable(PicoGL.DEPTH_TEST);
    app.enable(PicoGL.CULL_FACE);

    drawObjects(deltaTime, time);

    requestAnimationFrame(draw);

}
requestAnimationFrame(draw);

function chooseMovingDirection(object, deltaTime) {
    updateYDirection(object);
    updateXDirection(object);

    if (object.movingXDirection === 'right') {
        object.translationX += object.directionX * deltaTime * object.speedX;
        object.childMovingXDirection = 'left';
    } else {
        object.translationX += -object.directionX * deltaTime * object.speedX;
        object.childMovingXDirection = 'right';
    }

    if (object.movingYDirection === 'up') {
        object.translationY += object.directionY * deltaTime * object.speedY;
    } else {
        object.translationY += -object.directionY * deltaTime * object.speedY;
    }
}

function updateXDirection(object) {
    if (object.translateXBoundary > 1.00 || object.translateXBoundary < -1.00) {
        object.movingXDirection = object.translateXBoundary > 1.00 ? 'left' : 'right';
        object.directionX = getRandomDirection();
        object.speedX = getRandomSpeed();
        if (!object.bouncedX) {
            object.bounceXCounter += 1;
            object.textureSize += 1;
            object.rotationSpeedX = getRandomSpeedRotation();
            object.bouncedX = true;
        }
    } else {
        object.bouncedX = false;
    }
}

function updateYDirection(object) {
    if (object.translateYBoundary > 1.00 || object.translateYBoundary < -1.00) {
        object.movingYDirection = object.translateYBoundary > 1.00 ? 'bottom' : 'up';
        object.directionY = getRandomDirection();
        object.speedY = getRandomSpeed();
        if (!object.bouncedY) {
            object.bounceYCounter += 1;
            object.rotationSpeedY = getRandomSpeedRotation();
            object.bouncedY = true;
            if (objectCount < maxObjectsAmount) {
                object.objectSize += 1;
            }
        }
    } else {
        object.bouncedY = false;
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

function changeTextureSize(object) {
    drawCall.uniform("textureSize", object.textureSize);
}

function changeobjectSize(object) {
    drawCall.uniform("objectSize", object.objectSize * 0.1);
}