import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3, vec4, mat3 } from "../node_modules/gl-matrix/esm/index.js";

import { positions as planePositions, indices as planeIndices } from "../blender/plane.js";
import { positions as octopusPositions, uvs as octopusUvs, indices as octopusIndices } from "../blender/octopus.js";
import { positions as teapotPositions, uvs as teapotUvs, indices as teapotIndices, normals as teapotNormals } from "../blender/teapot.js";

let ambientLightColor = vec3.fromValues(0.1, 0.1, 1.0);
let numberOfPointLights = 2;
let pointLightColors = [vec3.fromValues(1.0, 1.0, 1.0), vec3.fromValues(0.02, 0.4, 0.5)];
let pointLightInitialPositions = [vec3.fromValues(5, 0, 2), vec3.fromValues(-5, 0, 2)];
let pointLightPositions = [vec3.create(), vec3.create()];

// language=GLSL
let lightCalculationShader = `
    uniform vec3 cameraPosition;
    uniform vec3 baseColor;    

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
        outColor.a = 0.5;
        
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
    ${lightCalculationShader}
    
    uniform sampler2D tex;    
    
    in vec2 v_uv;
    in vec3 vPosition;    
    in vec3 vNormal;
    
    out vec4 outColor;
    
    void main()
    {        
        outColor = calculateLights(texture(tex, v_uv).rgb, normalize(vNormal), vPosition);
    }
`;

// language=GLSL
let octopusVertexShader = `
    #version 300 es
    ${lightCalculationShader}
              
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 viewProjectionMatrix;
    uniform mat4 modelMatrix;     
    
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 v_uv;
    out vec3 vPosition;    
    out vec3 vNormal;
    
    void main()
    {
        vec4 worldPosition = modelMatrix * position;

        vPosition = worldPosition.xyz;        
        vNormal = (modelMatrix * normal).xyz;

        gl_Position = (modelViewProjectionMatrix * vec4(position, 1.0)) + (viewProjectionMatrix * worldPosition);           
        v_uv = uv;
    }
`;

let currentCubemap = "whale";


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

let cubemapCurrent = await setCubemapImage(currentCubemap);

let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());
let octopusProgram = app.createProgram(octopusVertexShader.trim(), octopusFragmentShader.trim());
let teapotProgram = app.createProgram(teapotVertexShader.trim(), teapotFragmentShader.trim());

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

let octopusArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, octopusPositions))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, octopusUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, octopusIndices));

let teapotArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, teapotPositions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, teapotNormals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, teapotUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, teapotIndices));

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray);



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
let camPos = vec3.create();

const positionsBuffer = new Float32Array(numberOfPointLights * 3);
const colorsBuffer = new Float32Array(numberOfPointLights * 3);

const tex = await loadTexture("octopus_skin.jpg");
let octopusDrawCall = app.createDrawCall(octopusProgram, octopusArray)
    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.NEAREST,
        minFilter: PicoGL.LINEAR_MIPMAP_NEAREST,
        maxAnisotropy: 15,
        wrapS: PicoGL.REPEAT,
        wrapT: PicoGL.REPEAT
    }))
    .uniform("viewProjectionMatrix", viewProjMatrix)
    .uniform("modelMatrix", modelMatrix)
    .uniform("cameraPosition", camPos)
    .uniform("lightPositions[0]", positionsBuffer)
    .uniform("ambientLightColor", ambientLightColor)
    .uniform("lightColors[0]", colorsBuffer);

async function draw(timems) {
    let time = timems * 0.001;

    mat4.perspective(projMatrix, Math.PI * 0.3, app.width / app.height, 0.1, 100.0);
    camPos = vec3.rotateY(vec3.create(), vec3.fromValues(0, 2.5, 2), vec3.fromValues(0, 0, 0), time * 0.05);
    mat4.lookAt(viewMatrix, camPos, vec3.fromValues(0, 1, 0), vec3.fromValues(0, 1, 0));
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

    for (let i = 0; i < numberOfPointLights; i++) {
        vec3.rotateZ(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), time);
        positionsBuffer.set(pointLightPositions[i], i * 3);
        colorsBuffer.set(pointLightColors[i], i * 3);
    }

    teapotDrawCall.uniform("lightPositions[0]", positionsBuffer);
    teapotDrawCall.uniform("lightColors[0]", colorsBuffer);

    app.disable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);

    skyboxDrawCall.texture("cubemap", cubemapCurrent);
    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();

    mat4.identity(modelMatrix);
    mat4.scale(modelMatrix, modelMatrix, [0.5, 0.5, 0.5])
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);

    app.enable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    octopusDrawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    octopusDrawCall.draw();

    app.enable(PicoGL.BLEND);
    app.blendFunc(PicoGL.ONE, PicoGL.ONE_MINUS_SRC_ALPHA);
    teapotDrawCall.texture("cubemap", cubemapCurrent);
    teapotDrawCall.uniform("cameraPosition", camPos);
    teapotDrawCall.uniform("modelMatrix", modelMatrix);
    teapotDrawCall.uniform("normalMatrix", mat3.normalFromMat4(mat3.create(), modelMatrix));
    teapotDrawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    teapotDrawCall.draw();
    app.disable(PicoGL.BLEND);

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

async function setCubemapImage(currentCubemap) {
    let path = cubemapPaths[currentCubemap];

    let cubemap = app.createCubemap({
        negX: await loadTexture(path.nx),
        posX: await loadTexture(path.px),
        negY: await loadTexture(path.ny),
        posY: await loadTexture(path.py),
        negZ: await loadTexture(path.nz),
        posZ: await loadTexture(path.pz)
    });

    return cubemap;
}
