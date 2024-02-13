// This demo demonstrates simple cubemap reflections and more complex planar reflections

import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3, mat3, vec4, vec2 } from "../node_modules/gl-matrix/esm/index.js";

import { positions as torusPositions, normals as torusNormals, indices as torusIndices, uvs as torusUvs } from "../blender/torus.js"
import { positions as cubePositions, normals as cubeNormals, indices as cubeIndices, uvs as cubeUvs } from "../blender/cube.js"
import { positions as planePositions, uvs as planeUvs, indices as planeIndices } from "../blender/plane.js"

let ambientLightColor = vec3.fromValues(0.8, 0.8, 0.8); // light gray
let numberOfPointLights = 3;
let pointLightColors = [
    vec3.fromValues(1.0, 1.0, 1.0), // white light
    vec3.fromValues(0.8, 0.9, 1.0), // softh bluish-white light
    vec3.fromValues(0.0, 1.0, 1.0)]; // cyan light
let pointLightInitialPositions = [vec3.fromValues(-2.5, -1, -5), vec3.fromValues(2.5, 1, -5), vec3.fromValues(0, 3, 5)];
let pointLightPositions = [vec3.create(), vec3.create(), vec3.create()];

// language=GLSL
let lightCalculationShader = `
    uniform vec3 cameraPosition;

    uniform vec3 ambientLightColor;    
    uniform vec3 lightColors[${numberOfPointLights}];        
    uniform vec3 lightPositions[${numberOfPointLights}];
    
    // This function calculates light reflection using Phong reflection model (ambient + diffuse + specular)
    vec4 calculateLights(vec3 baseColor, vec3 normal, vec3 position) {
        float ambientIntensity = 0.5;
        float diffuseIntensity = 1.0;
        float specularIntensity = 2.0;
        float specularPower = 100.0;
        float metalness = 0.0;

        vec3 viewDirection = normalize(cameraPosition.xyz - position);
        vec3 color = baseColor * ambientLightColor * ambientIntensity;
                
        for (int i = 0; i < lightPositions.length(); i++) {
            vec3 lightDirection = normalize(lightPositions[i] - position);
            
            // Lambertian reflection (ideal diffuse of matte surfaces) is also a part of Phong model                        
            float diffuse = max(dot(lightDirection, normal), 0.0);                                    
            color += baseColor * lightColors[i] * diffuse * diffuseIntensity;
                      
            // Phong specular highlight 
            float specular = pow(max(dot(viewDirection, reflect(-lightDirection, normal)), 0.0), specularPower);
            
            // Blinn-Phong improved specular highlight
            // float specular = pow(max(dot(normalize(lightDirection + viewDirection), normal), 0.0), specularPower);
            color += mix(vec3(1.0), baseColor, metalness) * lightColors[i] * specular * specularIntensity;
        }
        return vec4(color, 1.0);
    }
`;

// language=GLSL
let fragmentShader = `
    #version 300 es
    precision highp float;
    ${lightCalculationShader}  
    
    uniform samplerCube cubemap;  
    uniform vec3 baseColor;    
    uniform sampler2D tex;
        
    in vec2 vUv;  
    in vec3 vPosition;    
    in vec3 vNormal;
    in vec4 vColor; 
    in vec3 viewDir;
    
    out vec4 outColor;
    
    void main()
    {        
        vec3 reflectedDir = reflect(viewDir, normalize(vNormal));
        outColor = texture(cubemap, reflectedDir) + calculateLights(texture(tex, vUv).rgb, normalize(vNormal), vPosition);
        
        // Try using a higher mipmap LOD to get a rough material effect without any performance impact
        // outColor = textureLod(cubemap, reflectedDir, 7.0);
    }
`;

// language=GLSL
let vertexShader = `
    #version 300 es
    precision highp float; 
    ${lightCalculationShader}
            
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 modelMatrix;
    uniform mat3 normalMatrix;
    
    layout(location=0) in vec4 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;

        
    out vec2 vUv;
    out vec3 vNormal;
    out vec3 viewDir;
    out vec4 outColor;
    out vec3 vPosition;   
    out vec4 vColor;
    
    void main()
    {
        vec4 worldPosition = modelMatrix * position;
        vPosition = worldPosition.xyz;  
        gl_Position = modelViewProjectionMatrix * position;           
        vUv = uv;
        viewDir = (modelMatrix * position).xyz - cameraPosition;                
        vNormal = normalMatrix * normal;
    }
`;

// language=GLSL
let mirrorFragmentShader = `
    #version 300 es
    precision highp float;
    
    uniform sampler2D reflectionTex;
    uniform sampler2D distortionMap;
    uniform vec2 screenSize;
    
    in vec2 vUv;        
        
    out vec4 outColor;
    
    void main()
    {                        
        vec2 screenPos = gl_FragCoord.xy / screenSize;
        
        // 0.03 is a mirror distortion factor, try making a larger distortion         
        screenPos.x += (texture(distortionMap, vUv).r - 0.5) * 0.03;
        outColor = texture(reflectionTex, screenPos);
        outColor.a = 0.7;
    }   
`;

// language=GLSL
let mirrorVertexShader = `
    #version 300 es
            
    uniform mat4 modelViewProjectionMatrix;
    
    layout(location=0) in vec4 position;   
    layout(location=1) in vec2 uv;
    
    out vec2 vUv;
        
    void main()
    {
        vUv = uv;
        vec4 pos = position;
        pos.xz *= 2.0;
        gl_Position = modelViewProjectionMatrix * pos;
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

let program = app.createProgram(vertexShader, fragmentShader);
let skyboxProgram = app.createProgram(skyboxVertexShader, skyboxFragmentShader);
let mirrorProgram = app.createProgram(mirrorVertexShader, mirrorFragmentShader);

let torusVertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, torusPositions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, torusNormals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, torusUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, torusIndices));

let cubeVertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, cubePositions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, cubeNormals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, cubeUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, cubeIndices));

const planePositionsBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions);
const planeUvsBuffer = app.createVertexBuffer(PicoGL.FLOAT, 2, planeUvs);
const planeIndicesBuffer = app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices);

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, planePositionsBuffer)
    .indexBuffer(planeIndicesBuffer);

let mirrorArray = app.createVertexArray()
    .vertexAttributeBuffer(0, planePositionsBuffer)
    .vertexAttributeBuffer(1, planeUvsBuffer)
    .indexBuffer(planeIndicesBuffer);

// Change the reflection texture resolution to checkout the difference
let reflectionResolutionFactor = 0.8;
let reflectionColorTarget = app.createTexture2D(app.width * reflectionResolutionFactor, app.height * reflectionResolutionFactor, { magFilter: PicoGL.LINEAR });
let reflectionDepthTarget = app.createTexture2D(app.width * reflectionResolutionFactor, app.height * reflectionResolutionFactor, { internalFormat: PicoGL.DEPTH_COMPONENT16 });
let reflectionBuffer = app.createFramebuffer().colorTarget(0, reflectionColorTarget).depthTarget(reflectionDepthTarget);

let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotateXMatrix = mat4.create();
let rotateYMatrix = mat4.create();
let mirrorModelMatrix = mat4.create();
let mirrorModelViewProjectionMatrix = mat4.create();
let skyboxViewProjectionInverse = mat4.create();
let cameraPosition = vec3.create();

function calculateSurfaceReflectionMatrix(reflectionMat, mirrorModelMatrix, surfaceNormal) {
    let normal = vec3.transformMat3(vec3.create(), surfaceNormal, mat3.normalFromMat4(mat3.create(), mirrorModelMatrix));
    let pos = mat4.getTranslation(vec3.create(), mirrorModelMatrix);
    let d = -vec3.dot(normal, pos);
    let plane = vec4.fromValues(normal[0], normal[1], normal[2], d);

    reflectionMat[0] = (1 - 2 * plane[0] * plane[0]);
    reflectionMat[4] = (- 2 * plane[0] * plane[1]);
    reflectionMat[8] = (- 2 * plane[0] * plane[2]);
    reflectionMat[12] = (- 2 * plane[3] * plane[0]);

    reflectionMat[1] = (- 2 * plane[1] * plane[0]);
    reflectionMat[5] = (1 - 2 * plane[1] * plane[1]);
    reflectionMat[9] = (- 2 * plane[1] * plane[2]);
    reflectionMat[13] = (- 2 * plane[3] * plane[1]);

    reflectionMat[2] = (- 2 * plane[2] * plane[0]);
    reflectionMat[6] = (- 2 * plane[2] * plane[1]);
    reflectionMat[10] = (1 - 2 * plane[2] * plane[2]);
    reflectionMat[14] = (- 2 * plane[3] * plane[2]);

    reflectionMat[3] = 0;
    reflectionMat[7] = 0;
    reflectionMat[11] = 0;
    reflectionMat[15] = 1;

    return reflectionMat;
}

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const cubemap = app.createCubemap({
    negX: await loadTexture("clouds_nx.png"),
    posX: await loadTexture("clouds_px.png"),
    negY: await loadTexture("clouds_ny.png"),
    posY: await loadTexture("clouds_py.png"),
    negZ: await loadTexture("clouds_nz.png"),
    posZ: await loadTexture("clouds_pz.png")
});

const positionsBuffer = new Float32Array(numberOfPointLights * 3);
const colorsBuffer = new Float32Array(numberOfPointLights * 3);

const tex = await loadTexture("red.jpg");

let torusDrawCall = app.createDrawCall(program, torusVertexArray)
    .texture("cubemap", cubemap)
    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.REPEAT,
        wrapT: PicoGL.REPEAT
    }));

let cubeDrawCall = app.createDrawCall(program, cubeVertexArray)
    .texture("cubemap", cubemap)
    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.REPEAT,
        wrapT: PicoGL.REPEAT
    }));

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", cubemap);

let mirrorDrawCall = app.createDrawCall(mirrorProgram, mirrorArray)
    .texture("reflectionTex", reflectionColorTarget)
    .texture("distortionMap", app.createTexture2D(await loadTexture("noise.png")));

function renderReflectionTexture() {
    app.drawFramebuffer(reflectionBuffer);
    app.viewport(0, 0, reflectionColorTarget.width, reflectionColorTarget.height);
    app.gl.cullFace(app.gl.FRONT);

    let reflectionMatrix = calculateSurfaceReflectionMatrix(mat4.create(), mirrorModelMatrix, vec3.fromValues(0, 1, 0));
    let reflectionViewMatrix = mat4.mul(mat4.create(), viewMatrix, reflectionMatrix);
    let reflectionCameraPosition = vec3.transformMat4(vec3.create(), cameraPosition, reflectionMatrix);
    drawObjects(reflectionCameraPosition, reflectionViewMatrix);

    app.gl.cullFace(app.gl.BACK);
    app.defaultDrawFramebuffer();
    app.defaultViewport();
}

function drawObjects(cameraPosition, viewMatrix) {
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);

    let skyboxViewProjectionMatrix = mat4.create();
    mat4.mul(skyboxViewProjectionMatrix, projMatrix, viewMatrix);
    mat4.invert(skyboxViewProjectionInverse, skyboxViewProjectionMatrix);

    app.clear();

    app.disable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();

    app.enable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    torusDrawCall.uniform("modelViewProjectionMatrix", -modelViewProjectionMatrix);
    torusDrawCall.uniform("cameraPosition", cameraPosition);
    torusDrawCall.uniform("modelMatrix", modelMatrix);
    torusDrawCall.uniform("normalMatrix", mat3.normalFromMat4(mat3.create(), modelMatrix))
        .uniform("viewProjectionMatrix", viewProjMatrix)
        .uniform("modelMatrix", modelMatrix)
        .uniform("lightPositions[0]", positionsBuffer)
        .uniform("lightColors[0]", colorsBuffer)
        .uniform("ambientLightColor", ambientLightColor)
    torusDrawCall.draw();
    app.enable(PicoGL.CULL_FACE);


    cubeDrawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    cubeDrawCall.uniform("cameraPosition", cameraPosition);
    cubeDrawCall.uniform("modelMatrix", modelMatrix);
    cubeDrawCall.uniform("normalMatrix", mat3.normalFromMat4(mat3.create(), modelMatrix))
        .uniform("viewProjectionMatrix", viewProjMatrix)
        .uniform("modelMatrix", modelMatrix)
        .uniform("lightPositions[0]", positionsBuffer)
        .uniform("lightColors[0]", colorsBuffer)
        .uniform("ambientLightColor", ambientLightColor)
    cubeDrawCall.draw();
}

function drawMirror() {
    app.disable(PicoGL.CULL_FACE);
    app.enable(PicoGL.BLEND);
    app.blendFunc(PicoGL.SRC_ALPHA, PicoGL.ONE_MINUS_SRC_ALPHA);
    mat4.multiply(mirrorModelViewProjectionMatrix, viewProjMatrix, mirrorModelMatrix);
    mirrorDrawCall.uniform("modelViewProjectionMatrix", mirrorModelViewProjectionMatrix);
    mirrorDrawCall.uniform("screenSize", vec2.fromValues(app.width, app.height))
    mirrorDrawCall.draw();
    app.enable(PicoGL.CULL_FACE);
    app.disable(PicoGL.BLEND);
}

function draw(timems) {
    let time = timems * 0.001;

    mat4.perspective(projMatrix, Math.PI / 2.5, app.width / app.height, 0.1, 100.0);
    vec3.rotateY(cameraPosition, vec3.fromValues(5, 1, 2), vec3.fromValues(0, 0, 0), time * 0.1);
    mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(0, 0, 2), vec3.fromValues(0, 1, 0));

    mat4.fromXRotation(rotateXMatrix, time * 0.1136 - Math.PI / 2);
    mat4.fromZRotation(rotateYMatrix, time * 0.2235);
    mat4.mul(modelMatrix, rotateXMatrix, rotateYMatrix);
    mat4.rotateX(modelMatrix, modelMatrix, Math.PI / -2);
    mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(0.7, 0.7, 0.7));

    mat4.fromXRotation(rotateXMatrix, Math.PI / 2);
    mat4.fromYRotation(rotateYMatrix, time * 0.2354);
    mat4.mul(mirrorModelMatrix, rotateYMatrix, rotateXMatrix);
    mat4.translate(mirrorModelMatrix, mirrorModelMatrix, vec3.fromValues(0, -1, 0));

    for (let i = 0; i < numberOfPointLights; i++) {
        if (i % 2 === 0) {
            vec3.rotateY(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), time * 2);
        }
        else {
            vec3.rotateZ(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), time * -3);
        }
        positionsBuffer.set(pointLightPositions[i], i * 3);
        colorsBuffer.set(pointLightColors[i], i * 3);
    }

    renderReflectionTexture();
    drawObjects(cameraPosition, viewMatrix);
    drawMirror();

    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
