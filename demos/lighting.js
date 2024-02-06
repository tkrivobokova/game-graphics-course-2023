import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import { mat4, vec3 } from "../node_modules/gl-matrix/esm/index.js";

import { positions, normals, indices } from "../blender/monkey.js";
import { positions as cubePositions, normals as cubeNormals, indices as cubeIndices, uvs as cubeUvs } from "../blender/cube.js";

// ******************************************************
// **               Light configuration                **
// ******************************************************

let baseColor1 = vec3.fromValues(1.0, 0.8, 0.6); // peach
let baseColor2 = vec3.fromValues(1.0, 0.0, 1.0); // magenta
let baseColor3 = vec3.fromValues(0.75, 0.75, 0.75); // silver
let baseColor4 = vec3.fromValues(0.6, 1.0, 0.6); // mint
let ambientLightColor = vec3.fromValues(0.8, 0.8, 0.8); // light gray
let numberOfPointLights = 3;
let pointLightColors = [
    vec3.fromValues(1.0, 1.0, 1.0), // white light
    vec3.fromValues(0.8, 0.9, 1.0), // softh bluish-white light
    vec3.fromValues(0.0, 1.0, 1.0)]; // cyan light
let pointLightInitialPositions = [vec3.fromValues(-2.5, -1, -5), vec3.fromValues(2.5, 1, -5), vec3.fromValues(0, 3, 5)];
let pointLightPositions = [vec3.create(), vec3.create(), vec3.create()];

class Object {
    constructor(app, program, vertexArray, positionVector, movementDirection, ambientIntensity, diffuseIntensity, specularIntensity, specularPower, metalness, baseColor) {
        this.app = app;
        this.program = program;
        this.vertexArray = vertexArray;
        this.positionVector = positionVector;
        this.modelMatrix = mat4.create();
        this.movementDirection = movementDirection;
        this.direction = 1;
        this.ambientIntensity = ambientIntensity,
        this.diffuseIntensity = diffuseIntensity,
        this.specularIntensity = specularIntensity,
        this.specularPower = specularPower,
        this.metalness = metalness,
        this.baseColor = baseColor;
        this.drawCall = this.app.createDrawCall(this.program, this.vertexArray)
            .uniform("baseColor", this.baseColor)
            .uniform("ambientLightColor", ambientLightColor)
            .uniform("ambientIntensity", this.ambientIntensity)
            .uniform("diffuseIntensity", this.diffuseIntensity)
            .uniform("specularIntensity", this.specularIntensity)
            .uniform("specularPower", this.specularPower)
            .uniform("metalness", this.metalness);
        
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
        mat4.scale(this.modelMatrix, this.modelMatrix, vec3.fromValues(0.5, 0.5, 0.5));
        mat4.rotateX(this.modelMatrix, this.modelMatrix, Math.PI / -2);
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, Math.PI / 4);
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
    constructor(app, program, vertexArray, positionVector, texture, ambientIntensity, diffuseIntensity, specularIntensity, specularPower, metalness) {
        this.app = app;
        this.program = program;
        this.vertexArray = vertexArray;
        this.positionVector = positionVector;
        this.modelMatrix = mat4.create();
        this.ambientIntensity = ambientIntensity,
        this.diffuseIntensity = diffuseIntensity,
        this.specularIntensity = specularIntensity,
        this.specularPower = specularPower,
        this.metalness = metalness;
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
            .uniform("ambientLightColor", ambientLightColor)
            .uniform("ambientIntensity", this.ambientIntensity)
            .uniform("diffuseIntensity", this.diffuseIntensity)
            .uniform("specularIntensity", this.specularIntensity)
            .uniform("specularPower", this.specularPower)
            .uniform("metalness", this.metalness);

        this.drawCall.draw();
    }
}

// language=GLSL
let lightCalculationShader = `
    uniform vec3 cameraPosition;
    uniform float ambientIntensity;    
    uniform float diffuseIntensity;    
    uniform float specularIntensity;    
    uniform float specularPower;    
    uniform float metalness;    

    uniform vec3 ambientLightColor;    
    uniform vec3 lightColors[${numberOfPointLights}];        
    uniform vec3 lightPositions[${numberOfPointLights}];
    
    // This function calculates light reflection using Phong reflection model (ambient + diffuse + specular)
    vec4 calculateLights(vec3 baseColor, vec3 normal, vec3 position) {

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
        //outColor = vColor;
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

let downObjectPositionVector = vec3.fromValues(0, -2, 0);
let upObjectPositionVector = vec3.fromValues(0, 3, 0);
let leftObjectPositionVector = vec3.fromValues(-3, 1, 0);
let rightObjectPositionVector = vec3.fromValues(3, 1, 0);

let leftCubePositionVector = vec3.fromValues(-3, -2, 0);
let rightCubePositionVector = vec3.fromValues(3, -2, 0);
let upLeftCubePositionVector = vec3.fromValues(-3, 3, 0);
let upRightCubePositionVector = vec3.fromValues(3, 3, 0);

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

const tex = await loadTexture("red.jpg");

const downObject = new Object(app, program, vertexArray, downObjectPositionVector, 'left-right', 0.1, 0.4, 0.2, 30.0, 0.0, baseColor1); // matte surface
const upObject = new Object(app, program, vertexArray, upObjectPositionVector, 'left-right', 0.99, 0.6, 0.3, 40.0, 0.0, baseColor2); // smth funny
const leftObject = new Object(app, program, vertexArray, leftObjectPositionVector, 'up-down', 0.01, 0.1, 0.9, 60.0, 1.0, baseColor3); // silver material surface
const rightObject = new Object(app, program, vertexArray, rightObjectPositionVector, 'up-down', 0.4, 0.8, 0.95, 90.0, 0.9, baseColor4); // wet surface 

const leftCube = new Cube(app, cubeProgram, cubeVertexArray, leftCubePositionVector, tex, 0.2, 0.5, 1.0, 50.0, 0.0);
const rightCube = new Cube(app, cubeProgram, cubeVertexArray, rightCubePositionVector, tex, 0.2, 0.5, 1.0, 50.0, 0.0);
const upLeftCube = new Cube(app, cubeProgram, cubeVertexArray, upLeftCubePositionVector, tex, 0.2, 0.5, 1.0, 50.0, 0.0);
const upRightCube = new Cube(app, cubeProgram, cubeVertexArray, upRightCubePositionVector, tex, 0.2, 0.5, 1.0, 50.0, 0.0);

let cameraPosition = vec3.fromValues(7, 2, 9);
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
            vec3.rotateY(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), time * 2);
        }
        else {
            vec3.rotateZ(pointLightPositions[i], pointLightInitialPositions[i], vec3.fromValues(0, 0, 0), time * -3);
        }
        positionsBuffer.set(pointLightPositions[i], i * 3);
        colorsBuffer.set(pointLightColors[i], i * 3);
    }

    app.clear();

    downObject.draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer);
    upObject.draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer);
    leftObject.draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer);
    rightObject.draw(viewProjectionMatrix, cameraPosition, deltaTime, positionsBuffer, colorsBuffer);

    leftCube.draw(viewProjectionMatrix, cameraPosition);
    rightCube.draw(viewProjectionMatrix, cameraPosition);
    upLeftCube.draw(viewProjectionMatrix, cameraPosition);
    upRightCube.draw(viewProjectionMatrix, cameraPosition);


    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
