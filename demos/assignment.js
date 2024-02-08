import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3, vec4 } from "../node_modules/gl-matrix/esm/index.js";

import { positions as planePositions, indices as planeIndices } from "../blender/plane.js";
import { positions as octopusPositions, uvs as octopusUvs, indices as octopusIndices } from "../blender/octopus.js";
import { positions as teapotPositions, uvs as teapotUvs, indices as teapotIndices } from "../blender/teapot.js";

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

let teapotFragmentShader = `
    #version 300 es
    precision highp float;

    uniform samplerCube cubemap;    
        
    in vec3 vNormal;
    in vec3 viewDir;

    out vec4 outColor;

    void main()
    {        
        vec3 reflectedDir = reflect(viewDir, normalize(vNormal));
        outColor = texture(cubemap, reflectedDir);
        
        // Try using a higher mipmap LOD to get a rough material effect without any performance impact
        // outColor = textureLod(cubemap, reflectedDir, 7.0);
    }
`;

// language=GLSL
let teapotVertexShader = `
    #version 300 es
            
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 modelMatrix;
    uniform mat3 normalMatrix;
    uniform vec3 cameraPosition;
    
    layout(location=0) in vec4 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 vUv;
    out vec3 vNormal;
    out vec3 viewDir;
    
    void main()
    {
        gl_Position = modelViewProjectionMatrix * position;           
        vUv = uv;
        viewDir = (modelMatrix * position).xyz - cameraPosition;                
        vNormal = normalMatrix * normal;
    }
`;

// language=GLSL
let octopusFragmentShader = `
    #version 300 es
    precision highp float;
    
    uniform sampler2D tex;    
    
    in vec2 v_uv;
    
    out vec4 outColor;
    
    void main()
    {        
        outColor = texture(tex, v_uv);
    }
`;

// language=GLSL
let octopusVertexShader = `
    #version 300 es
            
    uniform mat4 modelViewProjectionMatrix;
    
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 v_uv;
    
    void main()
    {
        gl_Position = modelViewProjectionMatrix * vec4(position * 0.5, 1.0);           
        v_uv = uv;
    }
`;

let currentCubemap = "cellar";

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const cubemapPaths = {
    cellar: {
        nx: "cellar_nx.png",
        ny: "cellar_ny.png",
        nz: "cellar_nz.png",
        px: "cellar_px.png",
        py: "cellar_py.png",
        pz: "cellar_pz.png"
    },
    burnt: {
        nx: "burnt_nx.png",
        ny: "burnt_ny.png",
        nz: "burnt_nz.png",
        px: "burnt_px.png",
        py: "burnt_py.png",
        pz: "burnt_pz.png"
    },
    tunnel: {
        nx: "tunnel_nx.png",
        ny: "tunnel_ny.png",
        nz: "tunnel_nz.png",
        px: "tunnel_px.png",
        py: "tunnel_py.png",
        pz: "tunnel_pz.png"
    },
    whale: {
        nx: "whale_nx.png",
        ny: "whale_ny.png",
        nz: "whale_nz.png",
        px: "whale_px.png",
        py: "whale_py.png",
        pz: "whale_pz.png"
    }

}

let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());
let octopusProgram = app.createProgram(octopusVertexShader.trim(), octopusFragmentShader.trim());
let teapotProgram = app.createProgram(octopusVertexShader.trim(), teapotFragmentShader.trim());

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

let octopusArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, octopusPositions))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, octopusUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, octopusIndices));

let teapotArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, teapotPositions))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, teapotUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, teapotIndices));

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", app.createCubemap({
        negX: await loadTexture(cubemapPaths[currentCubemap].nx),
        posX: await loadTexture(cubemapPaths[currentCubemap].px),
        negY: await loadTexture(cubemapPaths[currentCubemap].ny),
        posY: await loadTexture(cubemapPaths[currentCubemap].py),
        negZ: await loadTexture(cubemapPaths[currentCubemap].nz),
        posZ: await loadTexture(cubemapPaths[currentCubemap].pz)
    }));

const tex = await loadTexture("ice.jpg");
let octopusDrawCall = app.createDrawCall(octopusProgram, octopusArray)
    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.REPEAT,
        wrapT: PicoGL.REPEAT
    }));

let teapotDrawCall = app.createDrawCall(teapotProgram, teapotArray);

let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotateXMatrix = mat4.create();
let rotateYMatrix = mat4.create();
let skyboxViewProjectionInverse = mat4.create();

function draw(timems) {
    let time = timems * 0.001;

    mat4.perspective(projMatrix, Math.PI / 2, app.width / app.height, 0.1, 100.0);
    let camPos = vec3.rotateY(vec3.create(), vec3.fromValues(0, 0.5, 2), vec3.fromValues(0, 0, 0), time * 0.05);
    mat4.lookAt(viewMatrix, camPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    mat4.fromXRotation(rotateXMatrix, time * 0.1136);
    mat4.fromZRotation(rotateYMatrix, time * 0.2235);
    mat4.multiply(modelMatrix, rotateXMatrix, rotateYMatrix);

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

    mat4.identity(modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);

    app.enable(PicoGL.DEPTH_TEST);
    app.enable(PicoGL.CULL_FACE);
    octopusDrawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    octopusDrawCall.draw();

    teapotDrawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    teapotDrawCall.draw();

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);