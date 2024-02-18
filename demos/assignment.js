import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3, vec4, mat3 } from "../node_modules/gl-matrix/esm/index.js";

import { positions as planePositions, indices as planeIndices, normals as planeNormals } from "../blender/plane.js";
import { positions as octopusPositions, uvs as octopusUvs, indices as octopusIndices, normals as octopusNormals } from "../blender/octopus.js";
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
    
    in vec2 vUv;
    in vec3 vPosition;    
    in vec3 vNormal;
    in vec4 vColor; 
    
    out vec4 outColor;
    
    void main()
    {        
        outColor = calculateLights(texture(tex, vUv).rgb, normalize(vNormal), vPosition);
    }
`;

// language=GLSL
let octopusVertexShader = `
    #version 300 es
    ${lightCalculationShader}
              
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 viewProjectionMatrix;
    uniform mat4 modelMatrix;    
    uniform mat3 normalMatrix; 
    
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 vUv;
    out vec3 vPosition;    
    out vec3 vNormal;
    out vec4 outColor;  
    out vec4 vColor;
    
    void main()
    {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);

        vPosition = worldPosition.xyz;        
        vNormal = normalMatrix * normal;

        gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);           
        vUv = uv;
    }
`;

// language=GLSL
let shadowFragmentShader = `
    #version 300 es
    precision highp float;
    
    out vec4 fragColor;
    
    void main() {
        // Uncomment to see the depth buffer of the shadow map    
        fragColor = vec4((gl_FragCoord.z - 0.98) * 50.0);    
    }
`;

// language=GLSL
let shadowVertexShader = `
    #version 300 es
    layout(location=0) in vec4 position;
    uniform mat4 lightModelViewProjectionMatrix;
    
    void main() {
        gl_Position = lightModelViewProjectionMatrix * position;
    }
`;

// language=GLSL
let fragmentShader = `
    #version 300 es    
    precision highp float;    
    precision highp sampler2DShadow;
    
    uniform sampler2DShadow shadowMap;
    
    in vec4 vPositionFromLight;

    out vec4 fragColor;
        
    void main() {
        vec3 shadowCoord = (vPositionFromLight.xyz / vPositionFromLight.w) / 2.0 + 0.5;        
        float shadow = texture(shadowMap, shadowCoord);
        fragColor = vec4(vec3(0.0), (1.0 - shadow) * 0.6);
    }
`;

// language=GLSL
let vertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    layout(location=1) in vec3 normal;
        
    uniform mat4 modelMatrix;
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 lightModelViewProjectionMatrix;
    
    out vec4 vPositionFromLight;
        
    void main() {
        gl_Position = modelViewProjectionMatrix * position;
        vPositionFromLight = lightModelViewProjectionMatrix * position;
    }
`;

let currentCubemap = "paris";


async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const cubemapPaths = {
    paris: {
        nx: "paris_nx.png",
        ny: "paris_ny.png",
        nz: "paris_nz.png",
        px: "paris_px.png",
        py: "paris_py.png",
        pz: "paris_pz.png"
    },
    tunnel: {
        nx: "tunnel_nx.png",
        ny: "tunnel_ny.png",
        nz: "tunnel_nz.png",
        px: "tunnel_px.png",
        py: "tunnel_py.png",
        pz: "tunnel_pz.png"
    },
    village: {
        nx: "village_nx.png",
        ny: "village_ny.png",
        nz: "village_nz.png",
        px: "village_px.png",
        py: "village_py.png",
        pz: "village_pz.png"
    }

}

let cubemapCurrent = await setCubemapImage(currentCubemap);

let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());
let octopusProgram = app.createProgram(octopusVertexShader.trim(), octopusFragmentShader.trim());
let teapotProgram = app.createProgram(teapotVertexShader.trim(), teapotFragmentShader.trim());
let shadowProgram = app.createProgram(shadowVertexShader.trim(), shadowFragmentShader.trim());
let planeProgram = app.createProgram(vertexShader.trim(), fragmentShader.trim());

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

let octopusArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, octopusPositions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, octopusNormals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, octopusUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, octopusIndices));

let teapotArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, teapotPositions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, teapotNormals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, teapotUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, teapotIndices));

let planeArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, planeNormals))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

let shadowDepthTarget = app.createTexture2D(512, 512, {
    internalFormat: PicoGL.DEPTH_COMPONENT16,
    compareMode: PicoGL.COMPARE_REF_TO_TEXTURE,
    magFilter: PicoGL.LINEAR,
    minFilter: PicoGL.LINEAR,
    wrapS: PicoGL.CLAMP_TO_EDGE,
    wrapT: PicoGL.CLAMP_TO_EDGE
});
let shadowBuffer = app.createFramebuffer().depthTarget(shadowDepthTarget);

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
let lightModelViewProjectionMatrix = mat4.create();
let lightViewProjMatrix = mat4.create();
let lightViewMatrix = mat4.create();

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray);

let teapotDrawCall = app.createDrawCall(teapotProgram, teapotArray);

let planeDrawCall = app.createDrawCall(planeProgram, planeArray);

let octopusShadowDrawCall = app.createDrawCall(shadowProgram, octopusArray)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix);

let teapotShadowDrawCall = app.createDrawCall(shadowProgram, teapotArray)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix);

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

function renderShadowMap() {
    app.drawFramebuffer(shadowBuffer);
    app.viewport(0, 0, shadowDepthTarget.width, shadowDepthTarget.height);
    app.gl.cullFace(app.gl.FRONT);

    // Projection and view matrices are changed to render objects from the point view of light source
    mat4.lookAt(lightViewMatrix, pointLightPositions[0], vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    mat4.perspective(projMatrix, Math.PI * 0.4, shadowDepthTarget.width / shadowDepthTarget.height, 0.1, 100.0);
    mat4.multiply(lightViewProjMatrix, projMatrix, lightViewMatrix);

    app.clear();
    drawObjects(octopusShadowDrawCall, teapotShadowDrawCall);

    app.gl.cullFace(app.gl.BACK);
    app.defaultDrawFramebuffer();
    app.defaultViewport();
}

function drawObjects(odc, tdc) {
    app.enable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    odc.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix)
        .uniform("normalMatrix", mat3.normalFromMat4(mat3.create(), modelMatrix));

    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);
    odc.draw();

    app.enable(PicoGL.BLEND);
    app.blendFunc(PicoGL.ONE, PicoGL.ONE_MINUS_SRC_ALPHA);
    tdc.texture("cubemap", cubemapCurrent);
    tdc.uniform("cameraPosition", camPos);
    tdc.uniform("modelMatrix", modelMatrix);
    tdc.uniform("normalMatrix", mat3.normalFromMat4(mat3.create(), modelMatrix));
    tdc.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);

    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);
    tdc.draw();
    app.disable(PicoGL.BLEND);
}

async function draw(timems) {
    let time = timems * 0.001;

    mat4.perspective(projMatrix, Math.PI * 0.3, app.width / app.height, 0.1, 100.0);
    camPos = vec3.rotateY(vec3.create(), vec3.fromValues(3, 4, 2), vec3.fromValues(0, 0, 0), time * 0.05);
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
        let angle = time + i * Math.PI;
        let radius = 5;
        let lightX = radius * Math.cos(angle);
        let lightZ = radius * Math.sin(angle);
        let lightY = 5;

        vec3.set(pointLightPositions[i], lightX, lightY, lightZ);
        positionsBuffer.set(pointLightPositions[i], i * 3);
        colorsBuffer.set(pointLightColors[i], i * 3);
    }

    app.disable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);

    skyboxDrawCall.texture("cubemap", cubemapCurrent);
    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();

    mat4.identity(modelMatrix);
    mat4.scale(modelMatrix, modelMatrix, [0.5, 0.5, 0.5]);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);


    renderShadowMap();
    drawObjects(octopusDrawCall, teapotDrawCall);

    mat4.identity(modelMatrix);
    mat4.fromTranslation(modelMatrix, [0, -2, 0]);
    mat4.scale(modelMatrix, modelMatrix, [25, 3, 25]);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);

    app.enable(PicoGL.BLEND);
    app.blendFunc(PicoGL.ONE, PicoGL.ONE_MINUS_SRC_ALPHA);
    planeDrawCall.uniform("modelMatrix", modelMatrix);
    planeDrawCall.uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix);
    planeDrawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    planeDrawCall.texture("shadowMap", shadowDepthTarget);

    planeDrawCall.draw();
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

function changeCubemap() {
    const cubemaps = Object.keys(cubemapPaths);
    const currentIndex = cubemaps.indexOf(currentCubemap);
    const nextIndex = (currentIndex + 1) % cubemaps.length;
    currentCubemap = cubemaps[nextIndex];
    setCubemapImage(currentCubemap).then(newCubemap => {
        cubemapCurrent = newCubemap;
    });
}

const cubemapInterval = setInterval(changeCubemap, 3000);
