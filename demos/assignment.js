import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3, vec4 } from "../node_modules/gl-matrix/esm/index.js";

import { positions as planePositions, indices as planeIndices } from "../blender/plane.js";

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

let currentCubemap = "tunnel";

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

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

console.log("Current cubemap:", currentCubemap);
console.log("cubemapPaths[currentCubemap]:", cubemapPaths[currentCubemap]);

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", app.createCubemap({
        negX: await loadTexture(cubemapPaths[currentCubemap].nx),
        posX: await loadTexture(cubemapPaths[currentCubemap].px),
        negY: await loadTexture(cubemapPaths[currentCubemap].ny),
        posY: await loadTexture(cubemapPaths[currentCubemap].py),
        negZ: await loadTexture(cubemapPaths[currentCubemap].nz),
        posZ: await loadTexture(cubemapPaths[currentCubemap].pz)
    }));

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

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);