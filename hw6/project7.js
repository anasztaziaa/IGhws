// This function takes the translation and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// You can use the MatrixMult function defined in project5.html to multiply two 4x4 matrices in the same format.
// [TO-DO] Modify the code below to form the transformation matrix.
function GetModelViewMatrix(translationX, translationY, translationZ, rotationX, rotationY) {
	const rotX = [
		1, 0, 0, 0,
		0, Math.cos(rotationX), Math.sin(rotationX), 0,
		0, -Math.sin(rotationX), Math.cos(rotationX), 0,
		0, 0, 0, 1
	];

	const rotY = [
		Math.cos(rotationY), 0, -Math.sin(rotationY), 0,
		0, 1, 0, 0,
		Math.sin(rotationY), 0, Math.cos(rotationY), 0,
		0, 0, 0, 1
	];

	const trans = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		translationX, translationY, translationZ, 1
	];

	const rotCombined = MatrixMult(rotX, rotY);
	const mv = MatrixMult(trans, rotCombined);
	return mv;
}

class MeshDrawer {
	constructor() {
		// [TO-DO] initializations
		this.prog = InitShaderProgram(vsMesh, fsMesh);
		gl.useProgram(this.prog);

		this.mvp = gl.getUniformLocation(this.prog, 'mvp');
		this.mv = gl.getUniformLocation(this.prog, 'mv');
		this.mvn = gl.getUniformLocation(this.prog, 'mvn');
		this.y_up = gl.getUniformLocation(this.prog, 'y_up');
		gl.uniform1i(this.y_up, true);

		this.pos = gl.getAttribLocation(this.prog, 'pos');
		this.posbuffer = gl.createBuffer();
		this.norm = gl.getAttribLocation(this.prog, 'norm');
		this.normbuffer = gl.createBuffer();
		this.txc = gl.getAttribLocation(this.prog, 'txc');
		this.txcbuffer = gl.createBuffer();
		this.light = gl.getUniformLocation(this.prog, 'light');
		this.alpha = gl.getUniformLocation(this.prog, 'alpha');
		this.texture = gl.createTexture();
		this.sampler = gl.getUniformLocation(this.prog, 'tex');
		this.checkbox_show = true;
		this.is_texture_exist = false;
		this.show = gl.getUniformLocation(this.prog, 'show');
		gl.uniform1i(this.show, false);
	}

	setMesh(vertPos, texCoords, normals) {
		// [TO-DO] Update the contents of the vertex buffer objects.
		this.numTriangles = vertPos.length / 3;
		gl.useProgram(this.prog);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.posbuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normbuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.txcbuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
	}

	swapYZ(swap) {
		gl.useProgram(this.prog);
		// [TO-DO] Set the uniform parameter\(s\) of the vertex shader
		gl.uniform1i(this.y_up, !swap);
	}

	draw(matrixMVP, matrixMV, matrixNormal) {
		// [TO-DO] Complete the WebGL initializations before drawing
		gl.useProgram(this.prog);
		gl.uniformMatrix4fv(this.mvp, false, matrixMVP);
		gl.uniformMatrix4fv(this.mv, false, matrixMV);
		gl.uniformMatrix3fv(this.mvn, false, matrixNormal);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.posbuffer);
		gl.vertexAttribPointer(this.pos, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.pos);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normbuffer);
		gl.vertexAttribPointer(this.norm, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.norm);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.txcbuffer);
		gl.vertexAttribPointer(this.txc, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.txc);
		gl.drawArrays(gl.TRIANGLES, 0, this.numTriangles);
	}

	setTexture(img) {
		// [TO-DO] Bind the texture
		gl.useProgram(this.prog);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.uniform1i(this.sampler, 0);
		this.is_texture_exist = true;
		gl.uniform1i(this.show, this.checkbox_show && this.is_texture_exist);
	}

	showTexture(show) {
		gl.useProgram(this.prog);
		// [TO-DO] set the uniform parameter\(s\) of the fragment shader to specify if it should use the texture.
		this.checkbox_show = show;
		gl.uniform1i(this.show, this.checkbox_show && this.is_texture_exist);
	}

	setLightDir(x, y, z) {
		gl.useProgram(this.prog);
		// [TO-DO] set the uniform parameter\(s\) of the fragment shader to specify the light direction.
		gl.uniform3f(this.light, x, y, z);
	}

	setShininess(shininess) {
		gl.useProgram(this.prog);
		// [TO-DO] set the uniform parameter\(s\) of the fragment shader to specify the shininess.
		gl.uniform1f(this.alpha, shininess);
	}
}

const vsMesh = `
	uniform bool y_up;
	attribute vec3 pos, norm;
	attribute vec2 txc;
	uniform mat4 mvp, mv;
	uniform mat3 mvn;
	varying vec3 n, p;
	varying vec2 texCoord;
	void main() {
		if (y_up) {
			gl_Position = mvp * vec4(pos, 1);
			p = vec3(mv * vec4(pos, 1));
			n = normalize(mvn * norm);
		} else {
			gl_Position = mvp * mat4(
				1, 0, 0, 0,
				0, 0, -1, 0,
				0, 1, 0, 0,
				0, 0, 0, 1
			) * vec4(pos, 1);
			p = vec3(mv * mat4(
				1, 0, 0, 0,
				0, 0, -1, 0,
				0, 1, 0, 0,
				0, 0, 0, 1
			) * vec4(pos, 1));
			n = normalize(mvn * mat3(
				1, 0, 0,
				0, 0, -1,
				0, 1, 0
			) * norm);
		}
		texCoord = txc;
	}
`;

const fsMesh = `
	precision mediump float;
	uniform sampler2D tex;
	uniform bool show;
	uniform float alpha;
	uniform vec3 light;
	varying vec3 n, p;
	varying vec2 texCoord;
	void main() {
		vec3 omega = normalize(light);
		float intensity = length(light);
		vec3 n_normed = normalize(n);
		vec3 v = -normalize(p);
		vec3 h = normalize(omega + v);
		gl_FragColor = intensity * (max(dot(omega, n_normed), 0.0) + pow(max(dot(h, n_normed), 0.0), alpha))
				* (show ? texture2D(tex, texCoord) : vec4(1, 1, 1, 1));
	}
`;

function SimTimeStep(dt, positions, velocities, springs, stiffness, damping, particleMass, gravity, restitution) {
	var forces = Array(positions.length);
		// [TO-DO] Compute the total force of each particle
	for (var i = 0; i < positions.length; ++i) {
		forces[i] = gravity.mul(particleMass);
	}
	springs.forEach(spring => {
		const i = spring.p0, j = spring.p1, rest = spring.rest;
		const d = positions[i].sub(positions[j]).unit();
		const l = positions[i].sub(positions[j]).len();
		forces[i].inc(d.mul(stiffness * (rest - l)));
		forces[j].inc(d.mul(stiffness * (l - rest)));
		forces[i].inc(d.mul(-damping * velocities[i].sub(velocities[j]).dot(d)));
		forces[j].inc(d.mul(-damping * velocities[j].sub(velocities[i]).dot(d)));
	});

		// [TO-DO] Update positions and velocities
	for (var i = 0; i < positions.length; ++i) {
		if (massSpring.selVert == i) continue;
		const a = forces[i].div(particleMass);
		velocities[i] = velocities[i].add(a.mul(dt));
		positions[i] = positions[i].add(velocities[i].mul(dt));
	}

		// [TO-DO] Handle collisions
	for (var i = 0; i < positions.length; ++i) {
		['x', 'y', 'z'].forEach(axis => {
			if (positions[i][axis] < -1.0) {
				const h = -1.0 - positions[i][axis];
				positions[i][axis] = restitution * h - 1;
				velocities[i][axis] = -velocities[i][axis] * restitution;
			}
			if (positions[i][axis] > 1.0) {
				const h = positions[i][axis] - 1.0;
				positions[i][axis] = 1.0 - restitution * h;
				velocities[i][axis] = -velocities[i][axis] * restitution;
			}
		});
	}
}