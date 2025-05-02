// This function takes the projection matrix, the translation, and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
function GetModelViewProjection(projectionMatrix, translationX, translationY, translationZ, rotationX, rotationY) {
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

    var rot = MatrixMult(rotY, rotX);
    var modelView = MatrixMult(trans, rot);
    return MatrixMult(projectionMatrix, modelView);
}

var vertShaderStr = `
attribute vec3 pos;
attribute vec2 tex;
uniform mat4 mvp;
uniform bool swapYZ;
varying vec2 texCoord;

void main() {
    vec3 position = pos;
    if (swapYZ) {
        position = vec3(position.x, position.z, position.y);
    }

    texCoord = tex;

    gl_Position = mvp * vec4(position, 1.0);
}
`;

var fragShaderStr = `
precision mediump float;
uniform bool useTex;
uniform sampler2D sampler;
varying vec2 texCoord;

void main() {
    if (useTex) {
        gl_FragColor = texture2D(sampler, texCoord);
    } else {
        gl_FragColor = vec4(0.7, 0.7, 0.7, 1.0);
    }
}
`;

function compileShader(gl, shaderSource, shaderType) {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
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
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function InitShaderProgram(vertShaderStr, fragShaderStr) {
    const vertexShader = compileShader(gl, vertShaderStr, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragShaderStr, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return null;
    const program = createShaderProgram(gl, vertexShader, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
}

function MatrixMult(a, b) {
    var result = [];
    for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
            var sum = 0;
            for (var k = 0; k < 4; k++) {
                sum += a[k + i * 4] * b[k + j * 4];
            }
            result[i + j * 4] = sum;
        }
    }
    return result;
}

class MeshDrawer {
    constructor() {
        this.prog = InitShaderProgram(vertShaderStr, fragShaderStr);
        this.posAttrib = gl.getAttribLocation(this.prog, 'pos');
        this.texAttrib = gl.getAttribLocation(this.prog, 'tex');
        this.mvpUniform = gl.getUniformLocation(this.prog, 'mvp');
        this.swapYZUniform = gl.getUniformLocation(this.prog, 'swapYZ');
        this.useTexUniform = gl.getUniformLocation(this.prog, 'useTex');
        this.samplerUniform = gl.getUniformLocation(this.prog, 'sampler');

        this.posBuffer = gl.createBuffer();
        this.texBuffer = gl.createBuffer();
        this.tex = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        this.useTexValue = true;
        this.swapYZValue = false;
        this.numVertices = 0;
    }

    setMesh(vertPos, texCoords) {
        if (!vertPos || vertPos.length === 0) return;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        this.numVertices = vertPos.length / 3;
    }

    swapYZ(swap) {
        this.swapYZValue = Boolean(swap);
    }

    draw(trans) {
        if (this.numVertices === 0) return;

        gl.useProgram(this.prog);
        gl.uniformMatrix4fv(this.mvpUniform, false, trans);
        gl.uniform1i(this.swapYZUniform, this.swapYZValue);
        gl.uniform1i(this.useTexUniform, this.useTexValue);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.uniform1i(this.samplerUniform, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.vertexAttribPointer(this.posAttrib, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.posAttrib);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
        gl.vertexAttribPointer(this.texAttrib, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.texAttrib);

        gl.drawArrays(gl.TRIANGLES, 0, this.numVertices);

        gl.disableVertexAttribArray(this.posAttrib);
        gl.disableVertexAttribArray(this.texAttrib);
    }

    setTexture(img) {
        if (!img) return;
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        const format = img.src.toLowerCase().endsWith('.png') ? gl.RGBA : gl.RGB;
        gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, img);

        if ((img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }

        this.useTexValue = true;
    }

    showTexture(show) {
        this.useTexValue = Boolean(show);
    }

    dispose() {
        gl.deleteBuffer(this.posBuffer);
        gl.deleteBuffer(this.texBuffer);
        gl.deleteTexture(this.tex);
        gl.deleteProgram(this.prog);
        this.numVertices = 0;
    }
}