import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3 } from "../node_modules/gl-matrix/esm/index.js";

import { positions, normals, indices } from "../blender/sphere.js";
import { positions as cubePositions, normals as cubeNormals, indices as cubeIndices, uvs as cubeUvs } from "../blender/cube.js";

// ******************************************************
// **               Light configuration                **
// ******************************************************

let baseColor = vec3.fromValues(0.9, 0.7, 0.9);
let ambientLightColor = vec3.fromValues(0.7, 0.5, 1.0);
let numberOfPointLights = 4;
let pointLightColors = [vec3.fromValues(1.0, 1.0, 1.0), vec3.fromValues(0.02, 0.4, 0.5), vec3.fromValues(0.7, 0.6, 0.5), vec3.fromValues(1, 0.4, 0.9)];
let pointLightInitialPositions = [vec3.fromValues(-3, -2, 0), vec3.fromValues(3, -2, 0), vec3.fromValues(-3, 3, 0), vec3.fromValues(3, 3, 0)];
let pointLightPositions = [vec3.create(), vec3.create(), vec3.create(), vec3.create()];

class Sphere {
    constructor(app, program, vertexArray, positionVector, movementDirection) {
        this.app = app;
        this.program = program;
        this.vertexArray = vertexArray;
        this.positionVector = positionVector;
        this.modelMatrix = mat4.create();
        this.movementDirection = movementDirection;
        this.direction = 1;
        this.drawCall = this.app.createDrawCall(this.program, this.vertexArray)
            .uniform("baseColor", baseColor)
            .uniform("ambientLightColor", ambientLightColor);
    }

    updateModelMatrix(deltaTime) {
        const radius = 3;
        const speed = 1.5;
        switch (this.movementDirection) {
            case "up-down":
                this.positionVector[1] += speed * this.direction * deltaTime;
                break;
            case "left-right":
                this.positionVector[0] += speed * this.direction * deltaTime;
                break;
        }

        if ((this.movementDirection === 'up-down' && (this.positionVector[1] + radius >= 5 || this.positionVector[1] - radius <= -4)) ||
            (this.movementDirection === 'left-right' && (this.positionVector[0] + radius >= 5 || this.positionVector[0] - radius <= -5))) {
            this.direction *= -1;
        }

        mat4.fromTranslation(this.modelMatrix, this.positionVector);
    }

    draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer) {
        this.updateModelMatrix(deltaTime);

        this.drawCall
            .uniform("lightPositions[0]", positionsBuffer)
            .uniform("lightColors[0]", colorsBuffer)
            .uniform("viewProjectionMatrix", viewProjectionMatrix)
            .uniform("modelMatrix", this.modelMatrix)
            .uniform("cameraPosition", cameraPosition);

        this.drawCall.draw();
    }
}

class Cube {
    constructor(app, program, vertexArray, positionVector, texture) {
        this.app = app;
        this.program = program;
        this.vertexArray = vertexArray;
        this.positionVector = positionVector;
        this.modelMatrix = mat4.create();
        this.drawCall = this.app.createDrawCall(this.program, this.vertexArray)
            .texture("tex", app.createTexture2D(texture, texture.width, texture.height, {
                magFilter: PicoGL.LINEAR,
                minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
                maxAnisotropy: 10,
                wrapS: PicoGL.REPEAT,
                wrapT: PicoGL.REPEAT
            }));
    }

    updateModelMatrix() {
        mat4.fromTranslation(this.modelMatrix, this.positionVector);
    }

    draw(viewProjectionMatrix, cameraPosition) {
        this.updateModelMatrix();

        this.drawCall
            .uniform("viewProjectionMatrix", viewProjectionMatrix)
            .uniform("modelMatrix", this.modelMatrix)
            .uniform("cameraPosition", cameraPosition)
            .uniform("lightPositions[0]", positionsBuffer)
            .uniform("lightColors[0]", colorsBuffer)
            .uniform("ambientLightColor", ambientLightColor);

        this.drawCall.draw();
    }
}

// language=GLSL
let lightCalculationShader = `
    uniform vec3 cameraPosition;
    //uniform vec3 baseColor;    

    uniform vec3 ambientLightColor;    
    uniform vec3 lightColors[${numberOfPointLights}];        
    uniform vec3 lightPositions[${numberOfPointLights}];
    
    // This function calculates light reflection using Phong reflection model (ambient + diffuse + specular)
    vec4 calculateLights(vec3 baseColor, vec3 normal, vec3 position) {
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
    
    uniform vec3 baseColor;  
    
    in vec3 vPosition;    
    in vec3 vNormal;
    in vec4 vColor;    
    
    out vec4 outColor;        
    
    void main() {                      
        // For Phong shading (per-fragment) move color calculation from vertex to fragment shader
        outColor = calculateLights(baseColor, normalize(vNormal), vPosition);
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
        outColor = calculateLights(texture(tex, v_uv).rgb, normalize(vNormal), vPosition);
    }
`;

// language=GLSL
let vertexShader = `
    #version 300 es
    ${lightCalculationShader}
    uniform vec3 baseColor;  
        
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
let cubeViewProjectionMatrix = mat4.create();

let downSpherePositionVector = vec3.fromValues(0, -2, 0);
let upSpherePositionVector = vec3.fromValues(0, 3, 0);
let leftSpherePositionVector = vec3.fromValues(-3, 1, 0);
let rightSpherePositionVector = vec3.fromValues(3, 1, 0);

let leftCubePositionVector = vec3.fromValues(-3, -2, 0);
let rightCubePositionVector = vec3.fromValues(3, -2, 0);
let upLeftCubePositionVector = vec3.fromValues(-3, 3, 0);
let upRightCubePositionVector = vec3.fromValues(3, 3, 0);

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const tex = await loadTexture("red.jpg");

const downSphere = new Sphere(app, program, vertexArray, downSpherePositionVector, 'left-right');
const upSphere = new Sphere(app, program, vertexArray, upSpherePositionVector, 'left-right');
const leftSphere = new Sphere(app, program, vertexArray, leftSpherePositionVector, 'up-down');
const rightSphere = new Sphere(app, program, vertexArray, rightSpherePositionVector, 'up-down');

const leftCube = new Cube(app, cubeProgram, cubeVertexArray, leftCubePositionVector, tex);
const rightCube = new Cube(app, cubeProgram, cubeVertexArray, rightCubePositionVector, tex);
const upLeftCube = new Cube(app, cubeProgram, cubeVertexArray, upLeftCubePositionVector, tex);
const upRightCube = new Cube(app, cubeProgram, cubeVertexArray, upRightCubePositionVector, tex);

let cameraPosition = vec3.fromValues(10, 2, 12);
mat4.fromXRotation(modelMatrix, -Math.PI / 2);

const positionsBuffer = new Float32Array(numberOfPointLights * 3);
const colorsBuffer = new Float32Array(numberOfPointLights * 3);

let previousTime = 0;

function draw(timestamp) {
    const time = timestamp * 0.001;
    const deltaTime = time - previousTime;
    previousTime = time;

    mat4.perspective(projectionMatrix, Math.PI / 4, app.width / app.height, 0.1, 100.0);
    mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(-2.5 * app.width / app.height, 0, -5), vec3.fromValues(0, 1, 0));
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

    mat4.perspective(projectionMatrix, Math.PI / 4, app.width / app.height, 0.1, 100.0);
    mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(-2.5 * app.width / app.height, 0, -5), vec3.fromValues(0, 1, 0));
    mat4.multiply(cubeViewProjectionMatrix, projectionMatrix, viewMatrix);

    for (let i = 0; i < numberOfPointLights; i++) {
        if (i % 2 === 0) {
            vec3.rotateX(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), time * 2);
        }
        else {
            vec3.rotateZ(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), time * -3);
        }
        positionsBuffer.set(pointLightPositions[i], i * 3);
        colorsBuffer.set(pointLightColors[i], i * 3);
    }

    app.clear();

    downSphere.draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer);
    upSphere.draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer);
    leftSphere.draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer);
    rightSphere.draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer);

    leftCube.draw(viewProjectionMatrix, cameraPosition);
    rightCube.draw(viewProjectionMatrix, cameraPosition);
    upLeftCube.draw(viewProjectionMatrix, cameraPosition);
    upRightCube.draw(viewProjectionMatrix, cameraPosition);


    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
