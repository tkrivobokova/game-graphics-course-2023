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

let skyboxViewProjectionInverse = mat4.create();

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
    

function draw(timems) {
    let time = timems / 1000;

    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);