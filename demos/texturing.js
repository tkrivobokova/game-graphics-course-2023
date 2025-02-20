// *********************************************************************************************************************
// **                                                                                                                 **
// **             Texturing example, Cube is mapped with 2D texture, skybox is mapped with a Cubemap                  **
// **                                                                                                                 **
// *********************************************************************************************************************

import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3 } from "../node_modules/gl-matrix/esm/index.js";

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
    uniform float stretchXFactor;
    uniform float stretchYFactor;
    uniform float stretchZFactor;

    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 v_uv;
    
    void main()
    {
        vec3 objectPosition = vec3(position.x * stretchXFactor, position.y * stretchYFactor, position.z * stretchZFactor);

        gl_Position = modelViewProjectionMatrix * vec4(objectPosition * objectSize, 1.0);           
        v_uv = uv;
    }
`;

// language=GLSL
let skyboxFragmentShader = `
    #version 300 es
    precision mediump float;
    
    uniform samplerCube cubemap;
    uniform mat4 viewProjectionInverse;
    uniform float objectCount;
    in vec4 v_position;
    
    out vec4 outColor;
    
    void main() {
      vec4 t = viewProjectionInverse * v_position;
      vec3 ndc = normalize(t.xyz / t.w);

      vec3 color1 = vec3(1.0, 0.0, 1.0);   // Magenta
      vec3 color2 = vec3(0.0, 1.0, 1.0);   // Cyan
      vec3 color3 = vec3(0.0, 1.0, 0.0);   // Green
      vec3 color4 = vec3(0.7, 0.7, 0.1);   // Yellow
      vec3 color5 = vec3(1.0, 0.5, 0.0);   // Orange
      vec3 color6 = vec3(1.0, 0.0, 0.0);   // Red

      float gradient = clamp(1.0 - abs(ndc.y * 2.0), 0.0, 1.0);
      vec3 colorMix = color1 * (1.0 - gradient) + color2 * gradient;
      gradient = clamp((gradient - 0.5) * 2.0, 0.0, 1.0);
      colorMix = mix(colorMix, color3, gradient);
      gradient = clamp((gradient - 0.5) * 2.0, 0.0, 1.0);
      colorMix = mix(colorMix, color4, gradient);
      gradient = clamp((gradient - 0.5) * 2.0, 0.0, 1.0);
      colorMix = mix(colorMix, color5, gradient);
      gradient = clamp((gradient - 0.5) * 2.0, 0.0, 1.0);
      colorMix = mix(colorMix, color6, gradient);
        
      vec4 skyColor = texture(cubemap, ndc);
      float alpha = 0.5;
      if (objectCount < 6.0) {
        outColor = texture(cubemap, normalize(t.xyz / t.w));
      } else {
        outColor = vec4(mix(skyColor.rgb, colorMix, 0.5), alpha);
      }
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

let positions, uvs, indices;
let program = app.createProgram(vertexShader.trim(), fragmentShader.trim());
let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());

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

let textureFiles = ["color.jpg", "night.jpg", "abstract.jpg", "flowers.png", "canyon.jpg", "colorful.jpg", "mercury.jpg", "watercolor.jpg", "yellow.jpg", "red.jpg"];
let geometries = ['cube', 'sphere'];
let objects = [];
let drawCalls = [];
let vertexArrays = [];

for (const g of geometries) {
    switch (g) {
        case 'cube':
            positions = cubePositions;
            uvs = cubeUvs;
            indices = cubeIndices;
            break;

        case 'sphere':
            positions = spherePositions;
            uvs = sphereUvs;
            indices = sphereIndices;
            break;
    }

    let vertexArray;
    vertexArrays.push(vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
        .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, uvs))
        .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices)));
}

for (const t of textureFiles) {
    const tex = await loadTexture(t);
    const texture = app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.NEAREST,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.MIRRORED_REPEAT,
        wrapT: PicoGL.MIRRORED_REPEAT
    });
    for (const v of vertexArrays) {
        drawCalls.push(app.createDrawCall(program, v)
            .texture("tex", texture));
    }
}

let objectCount = 1.0;
let previousTime = 0;
let camRotSpeed = 0.2;

const maxObjectsAmount = 6;
const maxBounceAmount = 8;

function createObject(rotationX, rotationY, rotationSpeedX, rotationSpeedY, directionX, directionY, movingXDirection, movingYDirection, speedX, speedY, translationX, translationY, translateXBoundary, translateYBoundary, texture, size, textureSize, childMovingXDirection, stretchX, stretchY, stretchZ) {
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
        objectStretched: false,
        textureChanged: false,
        textureIndex: texture,
        objectSize: size,
        textureSize: textureSize,
        childMovingXDirection: childMovingXDirection,
        stretchX: stretchX,
        stretchY: stretchY,
        stretchZ: stretchZ,
        stretchCounter: 0
    };
    objects.push(newObject);
}

if (objects.length === 0) {
    createObject(0, 0, 0, 0, 0.5, 0.5, 'right', 'up', 1, 1, 0, 0, 0, 0, getRandomValue('textureIndex'), 4, 1, 'left', 1.0, 1.0, 1.0);
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
    if (object.bounceYCounter % maxBounceAmount === 0 && !object.childCreated && object.bounceYCounter !== 0) {
        object.objectSize = object.objectSize % 2 === 0 ? Math.floor((object.objectSize) * 0.25) : Math.floor((object.objectSize + 1) * 0.5);
        object.speedX *= 2;
        object.speedY *= 2;
        object.rotationSpeedX *= 0.5;
        object.rotationSpeedY *= 0.5;

        createObject(-object.rotationX, -object.rotationY, object.rotationSpeedX, object.rotationSpeedY, object.directionX, object.directionY, object.childMovingXDirection, object.childMovingYDirection, object.speedX, object.speedY, object.translationX, object.translationY, object.translateXBoundary, object.translateYBoundary, object.textureIndex, object.objectSize, object.textureSize, object.movingXDirection, object.stretchX, object.stretchY, object.stretchZ);

        object.childCreated = true;
        objectCount += 1.0;
    } else if (object.bounceYCounter % maxBounceAmount !== 0) {
        object.childCreated = false;
    }
}

async function stretchObject(object) {
    camRotSpeed = 1;
    if (!object.objectStretched && object.bouncedY && object.bounceYCounter % (maxBounceAmount * 0.5) === 0) {
        object.stretchX = getRandomValue('stretch');
        object.stretchY = getRandomValue('stretch');
        object.stretchZ = getRandomValue('stretch');
        object.objectStretched = true;
        object.stretchCounter += 1;
    }
    else if (object.bounceYCounter % maxBounceAmount !== 0) {
        object.objectStretched = false;
    }
}

async function changeTexture(object) {
    if (object.bounceXCounter % (maxBounceAmount * 0.25) === 0 && !object.textureChanged && object.bounceXCounter !== 0) {
        let previousIndex = object.textureIndex;
        let randomIndex;

        do {
            randomIndex = getRandomValue('textureIndex');
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
    drawCall.uniform("stretchXFactor", object.stretchX);
    drawCall.uniform("stretchYFactor", object.stretchY);
    drawCall.uniform("stretchZFactor", object.stretchZ);
    drawCall.draw();
}

async function drawObjects(deltaTime, time) {
    for (let i = 0; i < objects.length; i++) {
        let object = objects[i];
        drawCall = drawCalls[object.textureIndex];

        await updateObject(object, deltaTime, time);
        objectCount < maxObjectsAmount ? await createChild(object) : await stretchObject(object);
        await changeTexture(object);
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
    skyboxDrawCall.uniform("objectCount", objectCount);
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

    object.movingXDirection === 'right' ? object.translationX += object.directionX * deltaTime * object.speedX : object.translationX += -object.directionX * deltaTime * object.speedX;
    object.movingXDirection === 'right' ? object.childMovingXDirection = 'left' : object.childMovingXDirection = 'right';
    object.movingYDirection === 'up' ? object.translationY += object.directionY * deltaTime * object.speedY : object.translationY += -object.directionY * deltaTime * object.speedY;
}

function updateXDirection(object) {
    if (object.translateXBoundary > 1.00 || object.translateXBoundary < -1.00) {
        object.movingXDirection = object.translateXBoundary > 1.00 ? 'left' : 'right';
        object.directionX = getRandomValue('direction');
        object.speedX = getRandomValue('speed');
        if (!object.bouncedX) {
            object.bounceXCounter += 1;
            object.textureSize += 1;
            object.rotationSpeedX = getRandomValue('rotationSpeed');
            object.bouncedX = true;
        }
    } else {
        object.bouncedX = false;
    }
}

function updateYDirection(object) {
    if (object.translateYBoundary > 1.00 || object.translateYBoundary < -1.00) {
        object.movingYDirection = object.translateYBoundary > 1.00 ? 'bottom' : 'up';
        object.directionY = getRandomValue('direction');
        object.speedY = getRandomValue('speed');
        if (!object.bouncedY) {
            object.bounceYCounter += 1;
            object.rotationSpeedY = getRandomValue('rotationSpeed');
            object.bouncedY = true;
            objectCount < maxObjectsAmount ? object.objectSize += 1 : object.objectSize;
        }
    } else {
        object.bouncedY = false;
    }
}

function getRandomValue(value) {
    switch(value) {
        case 'direction':
            return Math.floor(Math.random() * 10) / 10;
        case 'speed':
            return Math.floor(Math.random() * 10) + 1;
        case 'rotationSpeed':
            return Math.floor(Math.random() * -10);
        case 'textureIndex': 
            return Math.floor(Math.random() * (textureFiles.length * 2));
        case 'stretch':
            return (Math.floor(Math.random() * 10) + 1) * 0.2;
    }
}

function changeTextureSize(object) {
    drawCall.uniform("textureSize", object.textureSize);
}

function changeobjectSize(object) {
    drawCall.uniform("objectSize", object.objectSize * 0.1);
}