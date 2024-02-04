import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3 } from "../node_modules/gl-matrix/esm/index.js";

import { positions, normals, indices } from "../blender/sphere.js";
import { positions as cubePositions, normals as cubeNormals, indices as cubeIndices, uvs as cubeUvs } from "../blender/cube.js";

// ******************************************************
// **               Light configuration                **
// ******************************************************

let baseColor = vec3.fromValues(0.9, 0.7, 0.9);
let ambientLightColor = vec3.fromValues(0.7, 0.5, 1.0);
let numberOfPointLights = 2;
let pointLightColors = [vec3.fromValues(1.0, 1.0, 1.0), vec3.fromValues(0.02, 0.4, 0.5)];
let pointLightInitialPositions = [vec3.fromValues(-5, 5, 2), vec3.fromValues(5, -5, 2)];
let pointLightPositions = [vec3.create(), vec3.create()];


// language=GLSL
let lightCalculationShader = `
    uniform vec3 cameraPosition;
    uniform vec3 baseColor;    

    uniform vec3 ambientLightColor;    
    uniform vec3 lightColors[${numberOfPointLights}];        
    uniform vec3 lightPositions[${numberOfPointLights}];
    
    // This function calculates light reflection using Phong reflection model (ambient + diffuse + specular)
    vec4 calculateLights(vec3 normal, vec3 position) {
        float ambientIntensity = 0.0;
        float diffuseIntensity = 0.5;
        float specularIntensity = 1.0;
        float specularPower = 50.0;
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
    
    in vec3 vPosition;    
    in vec3 vNormal;
    in vec4 vColor;    
    
    out vec4 outColor;        
    
    void main() {                      
        // For Phong shading (per-fragment) move color calculation from vertex to fragment shader
        outColor = calculateLights(normalize(vNormal), vPosition);
        // outColor = vColor;
    }
`;

// language=GLSL
let cubeFragmentShader = `
    #version 300 es
    precision highp float;    
    ${lightCalculationShader}    

    in vec2 v_uv;
    in vec3 vPosition;   
    in vec3 vNormal;
    in vec4 vColor;    
    
    uniform sampler2D tex;
    
    out vec4 outColor;

    void main() {
        outColor = texture(tex, v_uv) + calculateLights(normalize(vNormal), vPosition);
    }
`;

// language=GLSL
let vertexShader = `
    #version 300 es
    ${lightCalculationShader}
        
    layout(location=0) in vec4 position;
    layout(location=1) in vec4 normal;
    
    uniform mat4 viewProjectionMatrix;
    uniform mat4 modelMatrix;            
    
    out vec3 vPosition;    
    out vec3 vNormal;
    out vec4 vColor;
    
    void main() {
        vec4 worldPosition = modelMatrix * position;
        
        vPosition = worldPosition.xyz;        
        vNormal = (modelMatrix * normal).xyz;
        
        // For Gouraud shading (per-vertex) move color calculation from fragment to vertex shader
        //vColor = calculateLights(normalize(vNormal), vPosition);
        
        gl_Position = viewProjectionMatrix * worldPosition;                        
    }
`;

// language=GLSL
let cubeVertexShader = `            
    #version 300 es
            
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
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);

        vPosition = worldPosition.xyz;
        vNormal = (modelMatrix * vec4(normal, 0.0)).xyz;

        gl_Position = viewProjectionMatrix * worldPosition;             
        v_uv = uv;
    }
`;


app.enable(PicoGL.DEPTH_TEST)
    .enable(PicoGL.CULL_FACE);

let program = app.createProgram(vertexShader.trim(), fragmentShader.trim());
let cubeProgram = app.createProgram(cubeVertexShader.trim(), cubeFragmentShader.trim());

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, normals))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));

let cubeVertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, cubePositions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, cubeNormals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, cubeUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, cubeIndices));

let projectionMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjectionMatrix = mat4.create();
let modelMatrix = mat4.create();
let cubeModelMatrix = mat4.create();
let leftCubeModelMatrix = mat4.create();
let rightCubeModelMatrix = mat4.create();
let cubeViewProjectionMatrix = mat4.create();
let leftCubePositionVector = vec3.fromValues(-3, 0, 0);
let rightCubePositionVector = vec3.fromValues(3, 0, 0);

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const tex = await loadTexture("red.jpg");

let drawCall = app.createDrawCall(program, vertexArray)
    .uniform("baseColor", baseColor)
    .uniform("ambientLightColor", ambientLightColor);

let leftCubeDrawCall = app.createDrawCall(cubeProgram, cubeVertexArray)
    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.REPEAT,
        wrapT: PicoGL.REPEAT
    }));

let rightCubeDrawCall = app.createDrawCall(cubeProgram, cubeVertexArray)
    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10,
        wrapS: PicoGL.REPEAT,
        wrapT: PicoGL.REPEAT
    }));


let cameraPosition = vec3.fromValues(10, 0, 10);
mat4.fromXRotation(modelMatrix, -Math.PI / 2);

const positionsBuffer = new Float32Array(numberOfPointLights * 3);
const colorsBuffer = new Float32Array(numberOfPointLights * 3);

const radius = 3;
const speed = 1.5;
let direction = 1;
let positionVector = vec3.fromValues(0, 0, 0);
let previousTime = 0;

function draw(timestamp) {
    const time = timestamp * 0.001;
    const deltaTime = time - previousTime;
    previousTime = time;

    positionVector[0] += speed * direction * deltaTime;

    if (positionVector[0] + radius > 5 || positionVector[0] - radius < -5) {
        direction *= -1;
    }

    mat4.perspective(projectionMatrix, Math.PI / 4, app.width / app.height, 0.1, 100.0);
    mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(-2.5 * app.width / app.height, 0, -5), vec3.fromValues(0, 1, 0));
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

    mat4.perspective(projectionMatrix, Math.PI / 4, app.width / app.height, 0.1, 100.0);
    mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(-2.5 * app.width / app.height, 0, -5), vec3.fromValues(0, 1, 0));
    mat4.multiply(cubeViewProjectionMatrix, projectionMatrix, viewMatrix);

    drawCall.uniform("viewProjectionMatrix", viewProjectionMatrix);
    drawCall.uniform("modelMatrix", modelMatrix);
    drawCall.uniform("cameraPosition", cameraPosition);

    leftCubeDrawCall.uniform("viewProjectionMatrix", cubeViewProjectionMatrix);
    leftCubeDrawCall.uniform("modelMatrix", cubeModelMatrix);
    leftCubeDrawCall.uniform("cameraPosition", cameraPosition);

    rightCubeDrawCall.uniform("viewProjectionMatrix", cubeViewProjectionMatrix);
    rightCubeDrawCall.uniform("modelMatrix", cubeModelMatrix);
    rightCubeDrawCall.uniform("cameraPosition", cameraPosition);

    for (let i = 0; i < numberOfPointLights; i++) {
        if (i === 0) {
            vec3.rotateZ(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), time);
        }
        else if (i === 1) {
            vec3.rotateZ(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), -time);
        }
        positionsBuffer.set(pointLightPositions[i], i * 3);
        colorsBuffer.set(pointLightColors[i], i * 3);
    }

    drawCall.uniform("lightPositions[0]", positionsBuffer);
    drawCall.uniform("lightColors[0]", colorsBuffer);
    leftCubeDrawCall.uniform("modelMatrix", leftCubeModelMatrix);
    rightCubeDrawCall.uniform("modelMatrix", rightCubeModelMatrix);

    mat4.fromTranslation(modelMatrix, positionVector);
    mat4.fromTranslation(leftCubeModelMatrix, leftCubePositionVector);
    mat4.fromTranslation(rightCubeModelMatrix, rightCubePositionVector);

    app.clear();
    drawCall.draw();
    leftCubeDrawCall.draw();
    rightCubeDrawCall.draw();

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
