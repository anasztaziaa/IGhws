function GetModelViewMatrix(translationX, translationY, translationZ, rotationX, rotationY) {
    var rotX = [
        1, 0, 0, 0,
        0, Math.cos(rotationX), Math.sin(rotationX), 0,
        0, -Math.sin(rotationX), Math.cos(rotationX), 0,
        0, 0, 0, 1
    ];

    var rotY = [
        Math.cos(rotationY), 0, -Math.sin(rotationY), 0,
        0, 1, 0, 0,
        Math.sin(rotationY), 0, Math.cos(rotationY), 0,
        0, 0, 0, 1
    ];

    var trans = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        translationX, translationY, translationZ, 1
    ];

    var rotCombined = MatrixMult(rotX, rotY);
    var mv = MatrixMult(trans, rotCombined);
    
    return mv;
}

function GetModelViewProjection(projectionMatrix, translationX, translationY, translationZ, rotationX, rotationY) {
    var mv = GetModelViewMatrix(translationX, translationY, translationZ, rotationX, rotationY);
    var mvp = MatrixMult(projectionMatrix, mv);
    
    return {
        mvp: mvp,
        mv: mv
    };
}

function GetNormalMatrix(modelViewMatrix) {
    return [
        modelViewMatrix[0], modelViewMatrix[1], modelViewMatrix[2],
        modelViewMatrix[4], modelViewMatrix[5], modelViewMatrix[6],
        modelViewMatrix[8], modelViewMatrix[9], modelViewMatrix[10]
    ];
}

function MatrixMult(a, b) {
    var result = new Array(16);
    for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
            var sum = 0;
            for (var k = 0; k < 4; k++) {
                sum += a[i * 4 + k] * b[k * 4 + j];
            }
            result[i * 4 + j] = sum;
        }
    }
    return result;
}

const vertShaderStr = `
attribute vec3 pos;
attribute vec2 texCoord;
attribute vec3 normal;

uniform mat4 mvp;
uniform mat4 mv;
uniform mat3 normalMat;
uniform bool swapYZ;

varying vec2 vTexCoord;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 position = pos;
    vec3 normalVec = normal;

    if (swapYZ) {
        position = vec3(position.x, position.z, -position.y);
        normalVec = vec3(normalVec.x, normalVec.z, -normalVec.y);
    }

    gl_Position = mvp * vec4(position, 1.0);
    vPosition = (mv * vec4(position, 1.0)).xyz;
    vNormal = normalMat * normalVec;
    vTexCoord = texCoord;
}
`;

const fragShaderStr = `
precision mediump float;

uniform bool showTexture;
uniform sampler2D tex;
uniform vec3 lightDir;
uniform float shininess;

varying vec2 vTexCoord;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(-lightDir);
    
    float ambient = 0.3;
    float diffuse = max(dot(normal, lightDirection), 0.0);
    
    vec3 viewDir = normalize(-vPosition);
    vec3 halfwayDir = normalize(lightDirection + viewDir);
    float specular = pow(max(dot(normal, halfwayDir), 0.0), shininess) * 0.3;
    
    vec3 lighting = vec3(ambient + diffuse + specular);

    if (showTexture) {
        vec2 uv = fract(vTexCoord);
        vec4 texColor = texture2D(tex, uv);
        
        if (texColor.a < 0.05) discard;
        
        gl_FragColor = vec4(texColor.rgb * lighting, texColor.a);
    } else {
        gl_FragColor = vec4(0.7, 0.7, 0.7, 1.0) * vec4(lighting, 1.0);
    }
}
`;

function compileShader(gl, shaderSource, shaderType) {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function createShaderProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function InitShaderProgram(vertShaderStr, fragShaderStr, wgl=gl) {
    const vertexShader = compileShader(wgl, vertShaderStr, wgl.VERTEX_SHADER);
    const fragmentShader = compileShader(wgl, fragShaderStr, wgl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return null;
    const program = createShaderProgram(wgl, vertexShader, fragmentShader);
    wgl.deleteShader(vertexShader);
    wgl.deleteShader(fragmentShader);
    return program;
}

class MeshDrawer {
    constructor() {
        this.initShaders();
        this.initBuffers();
        this.initTexture();
        
        this.numTriangles = 0;
        this.swapYZ = false;
        this.showTexture = true;
        this.lightDir = [0, 0, -1];
        this.shininess = 100.0; 
        this.debug = true;
    }

    initShaders() {
        this.program = InitShaderProgram(vertShaderStr, fragShaderStr);
        if (!this.program) {
            console.error("Shader init failed");
            return;
        }

        this.posAttrib = gl.getAttribLocation(this.program, 'pos');
        this.texCoordAttrib = gl.getAttribLocation(this.program, 'texCoord');
        this.normalAttrib = gl.getAttribLocation(this.program, 'normal');

        this.mvpUniform = gl.getUniformLocation(this.program, 'mvp');
        this.mvUniform = gl.getUniformLocation(this.program, 'mv');
        this.normalMatUniform = gl.getUniformLocation(this.program, 'normalMat');
        this.swapYZUniform = gl.getUniformLocation(this.program, 'swapYZ');
        this.showTextureUniform = gl.getUniformLocation(this.program, 'showTexture');
        this.texUniform = gl.getUniformLocation(this.program, 'tex');
        this.lightDirUniform = gl.getUniformLocation(this.program, 'lightDir');
        this.shininessUniform = gl.getUniformLocation(this.program, 'shininess');
    }

    initBuffers() {
        this.posBuffer = gl.createBuffer();
        this.texCoordBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer();
    }

    initTexture() {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255]));
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    setMesh(vertPos, texCoords, normals) {
        if (!vertPos || vertPos.length === 0) {
            if (this.debug) console.warn("No vertex data");
            return;
        }

        this.numTriangles = vertPos.length / 3;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

        if (texCoords && texCoords.length > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        } else if (this.debug) {
            console.warn("No texture coordinates provided");
        }

        if (normals && normals.length > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
        } else if (this.debug) {
            console.warn("No normal data provided");
        }
    }

    setTexture(img) {
        if (!img) {
            console.error("No image provided");
            return;
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 

        try {
            const hasAlpha = img.src && img.src.toLowerCase().endsWith('.png');
            const format = hasAlpha ? gl.RGBA : gl.RGB;
            
            gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, img);
            
            if (this.isPowerOfTwo(img.width) && this.isPowerOfTwo(img.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            
            console.log("Texture loaded:", img.src);
            this.showTexture = true;
        } catch (e) {
            console.error("Texture error:", e);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([255, 255, 255, 255]));
        }
    }

    isPowerOfTwo(n) {
        return (n & (n - 1)) === 0 && n !== 0;
    }

    swapYZ(swap) { 
        this.swapYZ = Boolean(swap); 
    }

    showTexture(show) { 
        this.showTexture = Boolean(show); 
    }
    
    setLightDir(x, y, z) {
        const len = Math.sqrt(x*x + y*y + z*z);
        this.lightDir = len > 0 ? [x/len, y/len, z/len] : [0, 0, -1];
    }
    
    setShininess(s) { 
        this.shininess = Math.max(1.0, s); 
    }

    draw(matrixMVP, matrixMV, matrixNormal) {
        if (this.numTriangles === 0) return;

        if (matrixMVP && typeof matrixMVP === 'object' && matrixMVP.mvp && matrixMVP.mv) {
            const matrices = matrixMVP;
            matrixNormal = matrixMV || GetNormalMatrix(matrices.mv);
            matrixMV = matrices.mv;
            matrixMVP = matrices.mvp;
        } else if (!matrixNormal && matrixMV) {
            matrixNormal = GetNormalMatrix(matrixMV);
        }

        if (!matrixMVP) {
            console.error("MVP matrix is required for draw()");
            return;
        }

        gl.useProgram(this.program);

        gl.uniformMatrix4fv(this.mvpUniform, false, matrixMVP);
        gl.uniformMatrix4fv(this.mvUniform, false, matrixMV);
        gl.uniformMatrix3fv(this.normalMatUniform, false, matrixNormal);
        
        gl.uniform1i(this.swapYZUniform, this.swapYZ ? 1 : 0);
        gl.uniform1i(this.showTextureUniform, this.showTexture ? 1 : 0);
        gl.uniform3fv(this.lightDirUniform, this.lightDir);
        gl.uniform1f(this.shininessUniform, this.shininess);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.texUniform, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.vertexAttribPointer(this.posAttrib, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.posAttrib);

        if (this.texCoordBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
            gl.vertexAttribPointer(this.texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.texCoordAttrib);
        }

        if (this.normalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.vertexAttribPointer(this.normalAttrib, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.normalAttrib);
        }

        gl.drawArrays(gl.TRIANGLES, 0, this.numTriangles);

        gl.disableVertexAttribArray(this.posAttrib);
        if (this.texCoordBuffer) gl.disableVertexAttribArray(this.texCoordAttrib);
        if (this.normalBuffer) gl.disableVertexAttribArray(this.normalAttrib);
    }

    dispose() {
        gl.deleteBuffer(this.posBuffer);
        gl.deleteBuffer(this.texCoordBuffer);
        gl.deleteBuffer(this.normalBuffer);
        gl.deleteTexture(this.texture);
        gl.deleteProgram(this.program);
    }
}